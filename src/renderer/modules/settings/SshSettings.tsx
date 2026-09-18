import React, { useState, useEffect } from 'react';
import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Tooltip,
  Typography,
  App as AntdApp,
} from 'antd';
import {
  CopyOutlined,
  FolderOpenOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  DEFAULT_SSH_SETTINGS,
  GenerateSshKeyParams,
  GenerateSshKeyResult,
  loadStoredSshSettings,
  saveStoredSshSettings,
  SshConnectionTestResult,
  SshSettings as ISshSettings,
} from '../../../shared/ssh';
import {
  loadStoredIntegrations,
  normalizeHostDomain,
} from '../../../shared/integrations';
import './SshSettings.css';

export default function SshSettings() {
  const { notification, message } = AntdApp.useApp();
  const [settings, setSettings] = useState<ISshSettings>(() => loadStoredSshSettings());
  const [publicKeyContent, setPublicKeyContent] = useState<string>('');
  const [generateModalOpen, setGenerateModalOpen] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [testingHost, setTestingHost] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<SshConnectionTestResult | null>(null);
  const [customTestHost, setCustomTestHost] = useState<string>('');
  const [generateForm] = Form.useForm();

  const integrations = loadStoredIntegrations();
  const enterpriseHost = normalizeHostDomain(
    integrations['github-enterprise']?.hostDomain ||
    integrations['gitlab-self-managed']?.hostDomain ||
    integrations['bitbucket-datacenter']?.hostDomain ||
    '',
  );

  // Sync to local storage & main process Git environment
  useEffect(() => {
    saveStoredSshSettings(settings);
    window.electron?.ipcRenderer
      ?.invoke('update-git-ssh-config', settings)
      .catch(() => {});
  }, [settings]);

  // Initial key detection if paths not set
  useEffect(() => {
    let isMounted = true;
    const loadKeys = async () => {
      if (!settings.privateKeyPath && !settings.publicKeyPath) {
        try {
          const detected = await window.electron?.ipcRenderer?.invoke('detect-ssh-keys');
          if (isMounted && detected) {
            setSettings((prev) => ({
              ...prev,
              privateKeyPath: detected.privateKeyPath || prev.privateKeyPath,
              publicKeyPath: detected.publicKeyPath || prev.publicKeyPath,
            }));
            if (detected.publicKeyContent) {
              setPublicKeyContent(detected.publicKeyContent);
            }
          }
        } catch (err) {
          // ignore detection error
        }
      } else if (settings.publicKeyPath) {
        try {
          const content = await window.electron?.ipcRenderer?.invoke(
            'read-ssh-public-key',
            settings.publicKeyPath,
          );
          if (isMounted && content) {
            setPublicKeyContent(content);
          }
        } catch {
          // ignore
        }
      }
    };
    loadKeys();
    return () => {
      isMounted = false;
    };
  }, [settings.privateKeyPath, settings.publicKeyPath]);

  const handleBrowseKey = async (type: 'private' | 'public') => {
    try {
      const selected = await window.electron?.ipcRenderer?.invoke('browse-ssh-key', type);
      if (selected) {
        if (type === 'private') {
          setSettings((prev) => {
            const nextPub = prev.publicKeyPath || `${selected}.pub`;
            return {
              ...prev,
              privateKeyPath: selected,
              publicKeyPath: nextPub,
            };
          });
        } else {
          setSettings((prev) => ({
            ...prev,
            publicKeyPath: selected,
          }));
          const content = await window.electron?.ipcRenderer?.invoke(
            'read-ssh-public-key',
            selected,
          );
          if (content) setPublicKeyContent(content);
        }
      }
    } catch (err: any) {
      notification.error({
        message: 'File Selection Error',
        description: err.message || 'Could not select key file.',
      });
    }
  };

  const handleCopyPublicKey = async () => {
    try {
      let content = publicKeyContent;
      if (!content && settings.publicKeyPath) {
        content = await window.electron?.ipcRenderer?.invoke(
          'read-ssh-public-key',
          settings.publicKeyPath,
        );
        if (content) setPublicKeyContent(content);
      }
      if (!content) {
        message.warning('No public key content available to copy.');
        return;
      }
      await navigator.clipboard.writeText(content);
      message.success('SSH Public Key copied to clipboard!');
    } catch {
      message.error('Failed to copy public key to clipboard.');
    }
  };

  const handleGenerateKey = async (values: GenerateSshKeyParams) => {
    setGenerating(true);
    try {
      const result: GenerateSshKeyResult = await window.electron?.ipcRenderer?.invoke(
        'generate-ssh-key',
        values,
      );
      if (result && result.ok && result.privateKeyPath && result.publicKeyPath) {
        setSettings((prev) => ({
          ...prev,
          privateKeyPath: result.privateKeyPath!,
          publicKeyPath: result.publicKeyPath!,
        }));
        if (result.publicKeyContent) {
          setPublicKeyContent(result.publicKeyContent);
          await navigator.clipboard.writeText(result.publicKeyContent);
          notification.success({
            message: 'SSH Key Generated',
            description: 'New key pair generated and public key copied to clipboard!',
            duration: 4,
          });
        } else {
          notification.success({
            message: 'SSH Key Generated',
            description: `Key pair created at ${result.privateKeyPath}`,
            duration: 4,
          });
        }
        setGenerateModalOpen(false);
        generateForm.resetFields();
      } else {
        notification.error({
          message: 'Key Generation Failed',
          description: result?.error || 'Failed to generate SSH key.',
          duration: 5,
        });
      }
    } catch (err: any) {
      notification.error({
        message: 'Key Generation Failed',
        description: err.message || 'Error occurred while generating key.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleTestConnection = async (host: string) => {
    if (!host) return;
    setTestingHost(host);
    setTestResult(null);
    try {
      const result: SshConnectionTestResult = await window.electron?.ipcRenderer?.invoke(
        'test-ssh-connection',
        host,
        settings.useLocalAgent ? undefined : settings.privateKeyPath,
      );
      setTestResult(result);
      if (result.ok) {
        message.success(`SSH connection to ${host} succeeded!`);
      } else {
        message.error(`SSH connection to ${host} failed.`);
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        host,
        message: err.message || 'Connection test failed.',
      });
    } finally {
      setTestingHost(null);
    }
  };

  return (
    <div className="ssh-settings-container">
      <div className="ssh-settings-header">
        <Typography.Title level={4} className="ssh-settings-title">
          SSH
        </Typography.Title>
        <Typography.Text type="secondary">
          Configure SSH authentication keys and Git Credential Manager for remote operations.
        </Typography.Text>
      </div>

      <div className="ssh-settings-section">
        {/* Use local SSH agent */}
        <div className="ssh-form-row">
          <Checkbox
            checked={settings.useLocalAgent}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, useLocalAgent: e.target.checked }))
            }
          >
            <span style={{ fontWeight: 500 }}>Use local SSH agent</span>
          </Checkbox>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 24 }}>
            Delegate authentication to your system&apos;s running SSH agent (e.g. Pageant, ssh-agent).
          </Typography.Text>
        </div>

        {/* SSH Private Key */}
        <div className="ssh-form-row">
          <label className="ssh-form-label">SSH Private Key</label>
          <div className="ssh-path-row">
            <Button
              icon={<FolderOpenOutlined />}
              disabled={settings.useLocalAgent}
              onClick={() => handleBrowseKey('private')}
            >
              Browse
            </Button>
            <Input
              className="ssh-path-input"
              value={settings.privateKeyPath}
              disabled={settings.useLocalAgent}
              placeholder="e.g. C:\Users\user\.ssh\id_ed25519"
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, privateKeyPath: e.target.value }))
              }
            />
          </div>
        </div>

        {/* SSH Public Key */}
        <div className="ssh-form-row">
          <label className="ssh-form-label">SSH Public Key</label>
          <div className="ssh-path-row">
            <Button
              icon={<FolderOpenOutlined />}
              disabled={settings.useLocalAgent}
              onClick={() => handleBrowseKey('public')}
            >
              Browse
            </Button>
            <Input
              className="ssh-path-input"
              value={settings.publicKeyPath}
              disabled={settings.useLocalAgent}
              placeholder="e.g. C:\Users\user\.ssh\id_ed25519.pub"
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, publicKeyPath: e.target.value }))
              }
            />
            <Tooltip title="Copy SSH Public Key to clipboard">
              <Button
                icon={<CopyOutlined />}
                onClick={handleCopyPublicKey}
                disabled={!settings.publicKeyPath}
              >
                Copy
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Generate new Private/Public key */}
        <div className="ssh-generate-card">
          <div>
            <Typography.Text strong style={{ fontSize: 14 }}>
              Generate new Private/Public key
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                This will create new keys in your ~/.ssh directory and configure WorktreeWise to use them.
              </Typography.Text>
            </div>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setGenerateModalOpen(true)}
          >
            Generate
          </Button>
        </div>

        {/* Use default Git Credential Manager */}
        <div className="ssh-form-row" style={{ marginTop: 8 }}>
          <Checkbox
            checked={settings.useGitCredentialManager}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                useGitCredentialManager: e.target.checked,
              }))
            }
          >
            <span style={{ fontWeight: 500 }}>Use default Git Credential Manager</span>
          </Checkbox>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 24 }}>
            Select this to have WorktreeWise use the credential manager in your Git config to access Git repositories.
          </Typography.Text>
        </div>

        {/* Quick Links to Provider Settings */}
        <div className="ssh-quick-links-box">
          <Typography.Text strong style={{ fontSize: 12 }}>
            Add public key to:
          </Typography.Text>
          <Button
            size="small"
            type="link"
            icon={<LinkOutlined />}
            href="https://github.com/settings/keys"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </Button>
          {enterpriseHost && (
            <Button
              size="small"
              type="link"
              icon={<LinkOutlined />}
              href={`https://${enterpriseHost}/settings/keys`}
              target="_blank"
              rel="noreferrer"
            >
              GitHub Enterprise ({enterpriseHost})
            </Button>
          )}
          <Button
            size="small"
            type="link"
            icon={<LinkOutlined />}
            href="https://gitlab.com/-/user_settings/ssh_keys"
            target="_blank"
            rel="noreferrer"
          >
            GitLab
          </Button>
        </div>

        {/* Test SSH Connection */}
        <div className="ssh-test-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>
              Test SSH Connection
            </Typography.Text>
            <Space size={8} wrap>
              <Button
                size="small"
                loading={testingHost === 'github.com'}
                onClick={() => handleTestConnection('github.com')}
              >
                Test github.com
              </Button>
              {enterpriseHost && (
                <Button
                  size="small"
                  loading={testingHost === enterpriseHost}
                  onClick={() => handleTestConnection(enterpriseHost)}
                >
                  Test {enterpriseHost}
                </Button>
              )}
              <Button
                size="small"
                loading={testingHost === 'gitlab.com'}
                onClick={() => handleTestConnection('gitlab.com')}
              >
                Test gitlab.com
              </Button>
            </Space>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Input
              size="small"
              placeholder="Or test custom host (e.g. bitbucket.org)"
              value={customTestHost}
              onChange={(e) => setCustomTestHost(e.target.value)}
              onPressEnter={() => handleTestConnection(customTestHost)}
            />
            <Button
              size="small"
              disabled={!customTestHost.trim()}
              loading={testingHost === customTestHost.trim()}
              onClick={() => handleTestConnection(customTestHost.trim())}
            >
              Test
            </Button>
          </div>

          {testResult && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 6,
                background: testResult.ok ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${testResult.ok ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              {testResult.ok ? (
                <CheckCircleOutlined style={{ color: '#22c55e', marginTop: 3 }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#ef4444', marginTop: 3 }} />
              )}
              <div style={{ flex: 1 }}>
                <Typography.Text strong style={{ fontSize: 12 }}>
                  {testResult.host}: {testResult.ok ? 'Connection verified' : 'Connection failed'}
                </Typography.Text>
                <div style={{ fontSize: 12, marginTop: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {testResult.message}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generate SSH Key Modal */}
      <Modal
        title={
          <Space size={8}>
            <KeyOutlined />
            <span>Generate new SSH Key Pair</span>
          </Space>
        }
        open={generateModalOpen}
        onCancel={() => setGenerateModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={generateForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ keyType: 'ed25519', comment: 'worktreewise' }}
          onFinish={handleGenerateKey}
          style={{ marginTop: 16 }}
        >
          <Form.Item label="Key Type" name="keyType">
            <Radio.Group>
              <Radio.Button value="ed25519">ED25519 (Recommended)</Radio.Button>
              <Radio.Button value="rsa">RSA (4096-bit)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label="Comment / Email (Optional)"
            name="comment"
            tooltip="Identifies the key on your hosting service"
          >
            <Input placeholder="e.g. user@example.com" />
          </Form.Item>

          <Form.Item
            label="Passphrase (Optional)"
            name="passphrase"
            tooltip="Leave blank for passwordless authentication"
          >
            <Input.Password placeholder="Leave empty for no passphrase" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
            <Button onClick={() => setGenerateModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={generating}>
              Generate Key
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
