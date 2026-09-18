import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Select,
  AutoComplete,
  Checkbox,
  Button,
  Space,
  Alert,
  Spin,
  Tag,
  App as AntdApp,
} from 'antd';
import {
  CloudUploadOutlined,
  BranchesOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { GitRemote } from '../../../shared/gitRemote';
import {
  loadStoredIntegrations,
  matchRemoteToIntegration,
  IntegrationState,
  IntegrationProviderId,
} from '../../../shared/integrations';
import { getProviderIcon } from '../settings/IntegrationsSettings';

export default function SetupUpstreamModal({
  open,
  worktree,
  repositoryPath,
  onClose,
  onCompleted,
}: {
  open: boolean;
  worktree: any;
  repositoryPath: string;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const { notification } = AntdApp.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [integrations, setIntegrations] = useState<
    Record<IntegrationProviderId, IntegrationState>
  >(() => loadStoredIntegrations());
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pushMode, setPushMode] = useState(true);
  const [selectedRemoteName, setSelectedRemoteName] = useState<string>('origin');

  const worktreePath = worktree?.path;
  const branchName = worktree?.name;

  useEffect(() => {
    if (!open || !worktreePath) return;

    setIntegrations(loadStoredIntegrations());
    let isMounted = true;
    setLoadingDetails(true);

    Promise.all([
      window.electron.ipcRenderer.invoke('get-remotes', repositoryPath || worktreePath),
      window.electron.ipcRenderer.invoke('get-upstream', worktreePath),
    ])
      .then(([remotesList, upstreamVal]: [GitRemote[], string | null]) => {
        if (!isMounted) return;
        setRemotes(remotesList || []);

        // Pick matching remote or first remote
        let defaultRemote = 'origin';
        let defaultBranch = branchName || '';

        if (upstreamVal) {
          const slashIdx = upstreamVal.indexOf('/');
          if (slashIdx !== -1) {
            defaultRemote = upstreamVal.slice(0, slashIdx);
            defaultBranch = upstreamVal.slice(slashIdx + 1);
          }
        } else if (remotesList && remotesList.length > 0) {
          const hasOrigin = remotesList.some((r) => r.name === 'origin');
          defaultRemote = hasOrigin ? 'origin' : remotesList[0].name;
        }

        setSelectedRemoteName(defaultRemote);
        setPushMode(!upstreamVal); // default pushMode = true if no upstream yet

        form.setFieldsValue({
          remote: defaultRemote,
          remoteBranch: defaultBranch,
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        notification.error({
          message: 'Failed to load remote information',
          description: err?.message || String(err),
          placement: 'bottomLeft',
        });
      })
      .finally(() => {
        if (isMounted) setLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, worktreePath, repositoryPath, branchName, form, notification]);

  const selectedRemote = remotes.find((r) => r.name === selectedRemoteName);
  const matchedIntegration = selectedRemote
    ? matchRemoteToIntegration(
        selectedRemote.fetchUrl || selectedRemote.pushUrl || '',
        integrations,
      )
    : null;

  const remoteBranchOptions = (selectedRemote?.branches || []).map((b) => ({
    value: b,
    label: (
      <Space size={6}>
        <BranchesOutlined style={{ fontSize: 12, opacity: 0.65 }} />
        <span>{b}</span>
      </Space>
    ),
  }));

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const resultMessage = await window.electron.ipcRenderer.invoke('set-upstream', {
        directory: worktreePath,
        localBranch: branchName,
        remote: values.remote.trim(),
        remoteBranch: values.remoteBranch.trim(),
        push: pushMode,
      });

      notification.success({
        message: 'Upstream configured',
        description:
          resultMessage ||
          `Branch "${branchName}" is now tracking "${values.remote}/${values.remoteBranch}".`,
        placement: 'bottomLeft',
      });

      onCompleted();
      onClose();
    } catch (error: any) {
      const raw = error?.message || String(error);
      const clean = raw
        .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
        .trim();
      notification.error({
        message: 'Failed to set upstream',
        description: clean || 'Could not configure upstream branch.',
        placement: 'bottomLeft',
        duration: 5,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      title={
        <Space style={{ fontSize: 16 }}>
          <CloudUploadOutlined style={{ fontSize: 18, color: '#3b82f6' }} />
          <span>Setup Upstream for {branchName}</span>
        </Space>
      }
      centered
      destroyOnClose
    >
      {loadingDetails ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Spin tip="Loading remote details..." />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
          style={{ marginTop: 12 }}
        >
          {remotes.length === 0 ? (
            <Alert
              type="warning"
              showIcon
              message="No remotes found"
              description={
                <div>
                  <div>
                    No remote repositories are currently configured for this project. Please add a remote first in the REMOTE sidebar section.
                  </div>
                  {Object.values(integrations).some((i) => i.connected) && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 12 }}>Connected integrations in Settings: </span>
                      <Space size={4} wrap style={{ marginTop: 4 }}>
                        {Object.values(integrations)
                          .filter((i) => i.connected)
                          .map((i) => (
                            <Tag key={i.providerId} color="blue">
                              {i.providerId} (@{i.username || 'connected'})
                            </Tag>
                          ))}
                      </Space>
                    </div>
                  )}
                </div>
              }
              style={{ marginBottom: 16 }}
            />
          ) : (
            <>
              <Form.Item
                label="Remote"
                name="remote"
                rules={[{ required: true, message: 'Please select a remote' }]}
              >
                <Select
                  options={remotes.map((r) => {
                    const matched = matchRemoteToIntegration(
                      r.fetchUrl || r.pushUrl || '',
                      integrations,
                    );
                    return {
                      value: r.name,
                      label: (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            width: '100%',
                          }}
                        >
                          <Space size={6}>
                            {matched ? (
                              getProviderIcon(matched.def.id)
                            ) : (
                              <GlobalOutlined style={{ opacity: 0.65 }} />
                            )}
                            <span>
                              <strong>{r.name}</strong> ({r.fetchUrl || r.pushUrl})
                            </span>
                          </Space>
                          {matched?.state.connected && (
                            <Tag
                              color="green"
                              style={{
                                margin: 0,
                                fontSize: 11,
                                lineHeight: '18px',
                                padding: '0 4px',
                              }}
                            >
                              {matched.def.name} Linked
                            </Tag>
                          )}
                        </div>
                      ),
                    };
                  })}
                  onChange={(val) => {
                    setSelectedRemoteName(val);
                    if (!form.getFieldValue('remoteBranch')) {
                      form.setFieldsValue({ remoteBranch: branchName });
                    }
                  }}
                />
              </Form.Item>

              {matchedIntegration && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: matchedIntegration.state.connected
                      ? 'rgba(34, 197, 94, 0.08)'
                      : 'rgba(239, 68, 68, 0.06)',
                    border: matchedIntegration.state.connected
                      ? '1px solid rgba(34, 197, 94, 0.3)'
                      : '1px solid rgba(239, 68, 68, 0.25)',
                    marginBottom: 16,
                    fontSize: 12,
                  }}
                >
                  <Space size={8}>
                    {matchedIntegration.state.connected ? (
                      <CheckCircleOutlined style={{ color: '#22c55e' }} />
                    ) : (
                      <InfoCircleOutlined style={{ color: '#ef4444' }} />
                    )}
                    <span>
                      {matchedIntegration.state.connected ? (
                        <>
                          Linked with <strong>{matchedIntegration.def.name}</strong> integration
                          {matchedIntegration.state.username ? ` (@${matchedIntegration.state.username})` : ''}
                        </>
                      ) : (
                        <>
                          <strong>{matchedIntegration.def.name}</strong> integration is not connected in Settings.
                        </>
                      )}
                    </span>
                  </Space>
                  {matchedIntegration.state.connected ? (
                    <Tag color="success" style={{ margin: 0 }}>
                      Authenticated
                    </Tag>
                  ) : (
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, fontSize: 12 }}
                      onClick={() => {
                        onClose();
                        navigate('/settings');
                      }}
                    >
                      Configure in Settings
                    </Button>
                  )}
                </div>
              )}

              <Form.Item
                label="Remote Branch"
                name="remoteBranch"
                tooltip="The name of the branch on the remote server to track"
                rules={[{ required: true, message: 'Please specify the remote branch name' }]}
              >
                <AutoComplete
                  options={remoteBranchOptions}
                  placeholder="e.g. main or feature-branch"
                  filterOption={(inputValue, option) =>
                    String(option?.value || '')
                      .toLowerCase()
                      .includes(inputValue.toLowerCase())
                  }
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 12 }}>
                <Checkbox
                  checked={pushMode}
                  onChange={(e) => setPushMode(e.target.checked)}
                >
                  <span>
                    Push local commits to remote now (<code>git push -u</code>)
                  </span>
                </Checkbox>
                <div
                  style={{
                    paddingLeft: 24,
                    fontSize: 12,
                    color: 'var(--ant-color-text-secondary, #8c8c8c)',
                    marginTop: 2,
                  }}
                >
                  {pushMode
                    ? 'Pushes your local branch to the remote and sets it as the upstream tracking branch.'
                    : 'Configures upstream tracking to an existing remote branch without pushing.'}
                </div>
              </Form.Item>
            </>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 20,
              paddingTop: 12,
              borderTop: '1px solid var(--ant-color-border-secondary, rgba(125,125,125,0.15))',
            }}
          >
            <Button onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              disabled={remotes.length === 0}
            >
              {pushMode ? 'Push & Set Upstream' : 'Set Upstream'}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
