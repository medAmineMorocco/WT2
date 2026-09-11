import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Typography,
  Tooltip,
  notification,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  GetWorktreeConfigResult,
  SaveWorktreeConfigResult,
  WorktreeConfigEntry,
} from '../../../shared/worktreeConfig';

type WorktreeGitConfigProps = {
  open: boolean;
  worktreeName: string;
  worktreePath: string;
  onClose: () => void;
  onSaved: (enabled: boolean) => void;
};

const commonGitKeys = [
  'user.name',
  'user.email',
  'commit.gpgSign',
  'core.autocrlf',
  'pull.rebase',
  'rebase.autoStash',
  'push.autoSetupRemote',
].map((value) => ({ value }));

export default function WorktreeGitConfig({
  open,
  worktreeName,
  worktreePath,
  onClose,
  onSaved,
}: WorktreeGitConfigProps) {
  const [form] = Form.useForm<{ entries: WorktreeConfigEntry[] }>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [api, contextHolder] = notification.useNotification();

  const loadConfig = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    window.electron.ipcRenderer
      .invoke('get-worktree-config', worktreePath)
      .then((result: GetWorktreeConfigResult) => {
        if (!result.ok) throw new Error(result.error);
        setEnabled(result.enabled);
        form.setFieldsValue({
          entries:
            result.enabled && result.entries.length === 0
              ? [
                  { key: 'user.name', value: '' },
                  { key: 'user.email', value: '' },
                ]
              : result.entries,
        });
      })
      .catch((error: any) => {
        setLoadError(error?.message || 'Git configuration could not be read.');
      })
      .finally(() => setLoading(false));
  }, [form, worktreePath]);

  useEffect(() => {
    if (!open || !worktreePath) return;
    loadConfig();
  }, [loadConfig, open, worktreePath]);

  const save = async ({ entries = [] }: { entries: WorktreeConfigEntry[] }) => {
    setSaving(true);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'save-worktree-config',
        worktreePath,
        enabled,
        entries,
      )) as SaveWorktreeConfigResult;
      if (!result.ok) throw new Error(result.error);
      onSaved(result.enabled);
    } catch (error: any) {
      api.error({
        message: 'Unable to Save Worktree Config',
        description: error?.message || 'Git configuration could not be saved.',
        placement: 'bottomLeft',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        centered
        title={`Worktree Git Config · ${worktreeName}`}
        open={open}
        onCancel={onClose}
        okText="Save configuration"
        confirmLoading={saving}
        okButtonProps={{
          htmlType: 'submit',
          form: 'worktree-git-config-form',
          disabled: loading || Boolean(loadError),
        }}
        width={720}
        destroyOnClose
      >
        {loadError && (
          <Alert
            type="error"
            showIcon
            message="Unable to load this worktree's Git configuration"
            description={loadError}
            action={
              <Button size="small" onClick={loadConfig} loading={loading}>
                Retry
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        )}
        <Space
          align="center"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: enabled ? 16 : 0,
          }}
        >
          <div>
            <Typography.Text strong>Use per-worktree config</Typography.Text>
            <br />
            <Typography.Text type="secondary">
              Keep these Git values separate from the repository defaults.
            </Typography.Text>
          </div>
          <Switch
            checked={enabled}
            loading={loading}
            disabled={Boolean(loadError)}
            onChange={(checked) => {
              setEnabled(checked);
              if (checked && !form.getFieldValue('entries')?.length) {
                form.setFieldsValue({
                  entries: [
                    { key: 'user.name', value: '' },
                    { key: 'user.email', value: '' },
                  ],
                });
              }
            }}
            aria-label="Use per-worktree Git configuration"
          />
        </Space>
        <Form
          id="worktree-git-config-form"
          form={form}
          layout="vertical"
          onFinish={save}
          disabled={loading}
          initialValues={{ entries: [] }}
        >
          {enabled && (
            <Form.List name="entries">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {fields.map((field) => (
                    <Space
                      key={field.key}
                      align="start"
                      style={{ width: '100%' }}
                    >
                      <Form.Item
                        {...field}
                        name={[field.name, 'key']}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: 'Enter a key.',
                          },
                          {
                            pattern: /^[^\s=]+\.[^\s=]+$/,
                            message: 'Use a Git key such as user.email.',
                          },
                        ]}
                        style={{ width: 260, marginBottom: 4 }}
                      >
                        <AutoComplete
                          options={commonGitKeys}
                          aria-label="Git configuration key"
                          placeholder="user.email"
                          filterOption={(inputValue, option) =>
                            Boolean(
                              option?.value
                                .toLowerCase()
                                .includes(inputValue.toLowerCase()),
                            )
                          }
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'value']}
                        rules={[
                          {
                            required: true,
                            message: 'Enter a value or remove this setting.',
                          },
                        ]}
                        style={{ width: 360, marginBottom: 4 }}
                      >
                        <Input
                          aria-label="Git configuration value"
                          placeholder="developer@example.com"
                          autoComplete="off"
                        />
                      </Form.Item>
                      <Tooltip title="Remove setting">
                        <Button
                          type="text"
                          aria-label="Remove Git setting"
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                        />
                      </Tooltip>
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => add({ key: '', value: '' })}
                    block
                  >
                    Add Git setting
                  </Button>
                </Space>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>
    </>
  );
}
