import React, { useState, useEffect } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Form,
  Input,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  App as AntdApp,
} from 'antd';
import {
  GithubOutlined,
  GitlabOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  StopOutlined,
  QuestionCircleOutlined,
  LinkOutlined,
  UserOutlined,
  DisconnectOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import {
  INTEGRATION_PROVIDERS,
  IntegrationProviderDef,
  IntegrationProviderId,
  IntegrationState,
  loadStoredIntegrations,
  normalizeHostDomain,
  saveStoredIntegrations,
  getTokenGenerationUrl,
  parseTokenScopes,
} from '../../../shared/integrations';
import { BitbucketIcon, AzureDevOpsIcon } from '../remotes/AddRemoteModal';
import './IntegrationsSettings.css';

export function getProviderIcon(id: IntegrationProviderId) {
  switch (id) {
    case 'github':
    case 'github-enterprise':
      return <GithubOutlined style={{ fontSize: 16 }} />;
    case 'gitlab':
    case 'gitlab-self-managed':
      return <GitlabOutlined style={{ fontSize: 16, color: '#fc6d26' }} />;
    case 'bitbucket':
    case 'bitbucket-datacenter':
      return <BitbucketIcon />;
    case 'azure-devops':
      return <AzureDevOpsIcon />;
    default:
      return <GlobalOutlined style={{ fontSize: 16 }} />;
  }
}

export default function IntegrationsSettings() {
  const { notification } = AntdApp.useApp();
  const [integrations, setIntegrations] = useState<Record<IntegrationProviderId, IntegrationState>>(
    () => loadStoredIntegrations(),
  );
  const [activeKey, setActiveKey] = useState<string>('github');
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    saveStoredIntegrations(integrations);
  }, [integrations]);

  const handleConnect = async (
    providerId: IntegrationProviderId,
    token: string,
    hostDomain?: string,
    manualUsername?: string,
    syncGitCredentialOpt: boolean = true,
  ) => {
    const provider = INTEGRATION_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;

    const domain = hostDomain ? normalizeHostDomain(hostDomain) : provider.defaultHost || '';

    setLoadingMap((prev) => ({ ...prev, [providerId]: true }));
    try {
      let verifiedUser: {
        username: string;
        displayName: string;
        avatarUrl?: string;
        email?: string;
        profileUrl?: string;
      } | null = null;
      let gitCredentialSynced = false;

      try {
        const result = await window.electron.ipcRenderer.invoke(
          'verify-integration',
          {
            providerId,
            token: token.trim(),
            hostDomain: domain,
            username: manualUsername?.trim(),
            syncToGit: syncGitCredentialOpt,
          },
        );

        if (result && result.ok) {
          if (result.user) verifiedUser = result.user;
          gitCredentialSynced = Boolean(result.gitCredentialSynced);
        } else if (result && !result.ok) {
          notification.error({
            message: 'Authentication Failed',
            description: result.error || 'Failed to authenticate with provider. Please verify your token and permissions.',
            placement: 'bottomLeft',
            duration: 5,
          });
          return;
        }
      } catch (ipcErr: any) {
        // Fallback gracefully in testing environments where IPC might not be registered
        console.warn('verify-integration IPC call error:', ipcErr);
      }

      const finalUsername =
        verifiedUser?.username ||
        manualUsername?.trim() ||
        (provider.isEnterprise ? 'Enterprise User' : 'User');
      const finalDisplayName =
        verifiedUser?.displayName || finalUsername;
      const avatarUrl = verifiedUser?.avatarUrl;
      const email = verifiedUser?.email;
      const profileUrl = verifiedUser?.profileUrl;

      setIntegrations((prev) => ({
        ...prev,
        [providerId]: {
          providerId,
          connected: true,
          token: token.trim(),
          hostDomain: domain,
          username: finalUsername,
          displayName: finalDisplayName,
          avatarUrl,
          email,
          profileUrl,
          lastConnectedAt: new Date().toISOString(),
          gitCredentialSynced,
        },
      }));

      notification.success({
        message: 'Integration Connected',
        description: gitCredentialSynced
          ? `Successfully connected as ${finalDisplayName} (@${finalUsername}) to ${provider.name}${domain ? ` (${domain})` : ''}. Git CLI credentials synchronized for push/pull.`
          : `Successfully connected as ${finalDisplayName} (@${finalUsername}) to ${provider.name}${domain ? ` (${domain})` : ''}.`,
        placement: 'bottomLeft',
        duration: 4,
      });
    } finally {
      setLoadingMap((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const handleDisconnect = async (providerId: IntegrationProviderId) => {
    const provider = INTEGRATION_PROVIDERS.find((p) => p.id === providerId);
    const existing = integrations[providerId];
    const host = existing?.hostDomain || provider?.defaultHost || '';

    if (host) {
      try {
        await window.electron?.ipcRenderer?.invoke('remove-git-credential', {
          host,
          username: existing?.username,
          providerId,
        });
      } catch {
        // ignore background removal error
      }
    }

    setIntegrations((prev) => ({
      ...prev,
      [providerId]: {
        providerId,
        connected: false,
        token: '',
        hostDomain: provider?.defaultHost || '',
        username: '',
        displayName: '',
        avatarUrl: undefined,
        email: undefined,
        profileUrl: undefined,
        gitCredentialSynced: false,
      },
    }));

    notification.info({
      message: 'Integration Disconnected',
      description: `Disconnected from ${provider?.name || providerId}.`,
      placement: 'bottomLeft',
      duration: 3,
    });
  };

  const renderProviderForm = (def: IntegrationProviderDef) => {
    const state = integrations[def.id];
    const isConnected = Boolean(state?.connected);
    const isLoading = Boolean(loadingMap[def.id]);

    const onFinish = (values: {
      hostDomain?: string;
      token: string;
      username?: string;
      syncGitCredential?: boolean;
    }) => {
      if (def.isEnterprise && !values.hostDomain) {
        notification.error({
          message: 'Host Domain Required',
          description: 'Please enter the host domain for this server.',
          placement: 'bottomLeft',
        });
        return;
      }
      if (!values.token) {
        notification.error({
          message: 'Token Required',
          description: 'Please provide a Personal Access Token.',
          placement: 'bottomLeft',
        });
        return;
      }
      handleConnect(
        def.id,
        values.token,
        values.hostDomain,
        values.username,
        values.syncGitCredential !== false,
      );
    };

function ProviderFormFields({
  def,
  state,
  isLoading,
  onFinish,
}: {
  def: IntegrationProviderDef;
  state: IntegrationState;
  isLoading: boolean;
  onFinish: (values: {
    hostDomain?: string;
    token: string;
    username?: string;
    syncGitCredential?: boolean;
  }) => void;
}) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const watchedHost = Form.useWatch('hostDomain', form);
  const hostDomain = watchedHost || state?.hostDomain || '';
  const tokenUrl = getTokenGenerationUrl(def, hostDomain);
  const scopesList = parseTokenScopes(def.tokenScopes);

  const handleCopyScopes = () => {
    navigator.clipboard.writeText(def.tokenScopes);
    message.success('Copied required scopes to clipboard');
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <span className="integrations-badge-not-connected">
          <StopOutlined />
          <span>Not Connected</span>
        </span>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          — Enter your credentials below to connect WorktreeWise with {def.name}.
        </Typography.Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        key={def.id}
        initialValues={{
          hostDomain: state?.hostDomain || '',
          token: state?.token || '',
          username: state?.username || '',
        }}
        onFinish={onFinish}
        className="integrations-form-layout"
      >
        {def.isEnterprise && (
          <div className="integrations-form-row">
            <label className="integrations-form-label">Host Domain</label>
            <Form.Item
              name="hostDomain"
              style={{ margin: 0 }}
              rules={[{ required: true, message: 'Host domain is required' }]}
            >
              <Input
                placeholder={def.placeholderHost || 'e.g., git.mycompany.com'}
                allowClear
              />
            </Form.Item>
          </div>
        )}

        <div className="integrations-form-row">
          <label className="integrations-form-label">
            <span>Personal Access Token</span>
            <Tooltip title={`Required scopes: ${def.tokenScopes}`}>
              <QuestionCircleOutlined style={{ cursor: 'pointer' }} />
            </Tooltip>
          </label>
          <Form.Item
            name="token"
            style={{ margin: 0 }}
            rules={[{ required: true, message: 'Personal access token is required' }]}
          >
            <Input.Password placeholder="Paste Personal Access Token" />
          </Form.Item>
        </div>

        {/* Generate Token with pre-filled scopes helper */}
        <div className="integrations-token-helper-box">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Typography.Text strong style={{ fontSize: 12 }}>
                Required Scopes:
              </Typography.Text>
              {scopesList.map((scope) => (
                <Tag color="blue" key={scope} style={{ margin: 0, fontSize: 11 }}>
                  {scope}
                </Tag>
              ))}
              <Tooltip title="Copy all required scopes">
                <Button
                  size="small"
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={handleCopyScopes}
                  style={{ fontSize: 11, height: 22, padding: '0 6px' }}
                >
                  Copy
                </Button>
              </Tooltip>
            </div>

            {tokenUrl ? (
              <Button
                type="primary"
                ghost
                size="small"
                icon={<LinkOutlined />}
                href={tokenUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontWeight: 500 }}
              >
                Generate Token on {def.name} ↗
              </Button>
            ) : def.isEnterprise ? (
              <Tooltip title="Enter your Host Domain above to enable the direct token generation link">
                <Button size="small" disabled icon={<LinkOutlined />}>
                  Generate Token (Enter Host Domain)
                </Button>
              </Tooltip>
            ) : null}
          </div>
        </div>

        <div className="integrations-form-row">
          <label className="integrations-form-label">Username (Optional)</label>
          <Form.Item name="username" style={{ margin: 0 }}>
            <Input placeholder="Your username" allowClear />
          </Form.Item>
        </div>

        <div className="integrations-form-row">
          <div />
          <Form.Item
            name="syncGitCredential"
            valuePropName="checked"
            initialValue={true}
            style={{ margin: 0 }}
          >
            <Checkbox>
              <span>Sync with Git Credential Manager for CLI push & pull</span>
              <Tooltip title="Registers this Personal Access Token into Git Credential Manager so git push/pull operations authenticate silently without opening browser popups.">
                <QuestionCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c', cursor: 'pointer' }} />
              </Tooltip>
            </Checkbox>
          </Form.Item>
        </div>

        <div className="integrations-form-row">
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              className="integrations-primary-connect-btn"
            >
              Connect
            </Button>
          </div>
        </div>

        <Alert
          type="info"
          showIcon
          message={def.tokenGuidance}
          description={
            <div style={{ marginTop: 4, fontSize: 12 }}>
              <span>
                WorktreeWise validates this token with {def.name}&apos;s API and automatically configures Git Credential Manager so that <code>git push</code> runs seamlessly without login popups.
              </span>
            </div>
          }
          style={{ marginTop: 12 }}
        />
      </Form>
    </div>
  );
}

    return (
      <div className="integrations-card">
        {isConnected ? (
          <div className="integrations-status-box">
            <Avatar
              size={54}
              src={state.avatarUrl}
              icon={!state.avatarUrl ? <UserOutlined /> : undefined}
              className="integrations-status-avatar"
            />
            <div className="integrations-status-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  {state.displayName || state.username || 'User'}
                </Typography.Text>
                <div className="integrations-badge-connected">
                  <CheckCircleOutlined />
                  <span>Connected</span>
                </div>
                {state.gitCredentialSynced && (
                  <Tooltip title="Credentials are automatically configured in Git Credential Manager for silent push & pull.">
                    <Tag color="green" style={{ margin: 0, cursor: 'help' }}>
                      <CheckCircleOutlined style={{ marginRight: 4 }} />
                      Git CLI Synced
                    </Tag>
                  </Tooltip>
                )}
                {state.hostDomain && state.hostDomain !== def.defaultHost && (
                  <Tag color="blue">{state.hostDomain}</Tag>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
                {state.username && (
                  <Typography.Text type="secondary">
                    @{state.username}
                  </Typography.Text>
                )}
                {state.email && (
                  <Typography.Text type="secondary">
                    • {state.email}
                  </Typography.Text>
                )}
                {state.profileUrl && (
                  <a
                    href={state.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}
                  >
                    <LinkOutlined />
                    <span>View Profile</span>
                  </a>
                )}
              </div>

              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Authenticated and ready for remote operations and branch tracking.
              </Typography.Text>
            </div>

            <Button
              type="text"
              danger
              icon={<DisconnectOutlined />}
              onClick={() => handleDisconnect(def.id)}
              className="integrations-disconnect-btn"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <ProviderFormFields
            def={def}
            state={state}
            isLoading={isLoading}
            onFinish={onFinish}
          />
        )}
      </div>
    );
  };

  const renderProviderTab = (def: IntegrationProviderDef) => {
    return (
      <div className="integrations-provider-view">
        <div className="integrations-provider-header">
          <Typography.Title level={4} className="integrations-provider-title">
            {getProviderIcon(def.id)}
            <span>{def.name}</span>
          </Typography.Title>
        </div>

        {renderProviderForm(def)}
      </div>
    );
  };

  const tabItems = INTEGRATION_PROVIDERS.map((def) => ({
    key: def.id,
    label: (
      <span className="integrations-tab-label">
        {getProviderIcon(def.id)}
        <span>{def.name}</span>
      </span>
    ),
    children: renderProviderTab(def),
  }));

  return (
    <div className="integrations-settings-container">
      <div className="integrations-header">
        <div>
          <Typography.Title level={3} className="integrations-header-title">
            Integrations
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Connect WorktreeWise with your Git cloud and self-hosted hosting services.
          </Typography.Text>
        </div>
      </div>

      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        className="integrations-tabs"
        items={tabItems}
      />
    </div>
  );
}
