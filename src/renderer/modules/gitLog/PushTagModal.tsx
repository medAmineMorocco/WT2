import { Alert, Button, Checkbox, Form, Modal, Select, Space, Typography } from 'antd';
import { CloudUploadOutlined, TagOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { PushGitTagResult } from '../../../shared/gitTag';
import type { GitRemote } from '../../../shared/gitRemote';

export default function PushTagModal({
  tagName,
  repositoryPath,
  onClose,
  onCompleted,
}: {
  tagName: string | null;
  repositoryPath: string;
  onClose: () => void;
  onCompleted: (result: Extract<PushGitTagResult, { ok: true }>) => void;
}) {
  const [form] = Form.useForm<{ remote: string; force?: boolean }>();
  const [loading, setLoading] = useState(false);
  const [loadingRemotes, setLoadingRemotes] = useState(false);
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tagName || !repositoryPath) return;
    setError('');
    setLoadingRemotes(true);

    window.electron.ipcRenderer
      .invoke('get-remotes', repositoryPath)
      .then((data: GitRemote[]) => {
        const list = data || [];
        setRemotes(list);
        const hasOrigin = list.some((r) => r.name === 'origin');
        const defaultRemote = hasOrigin
          ? 'origin'
          : list[0]?.name || 'origin';
        form.setFieldsValue({ remote: defaultRemote, force: false });
      })
      .catch(() => {
        form.setFieldsValue({ remote: 'origin', force: false });
      })
      .finally(() => {
        setLoadingRemotes(false);
      });
  }, [tagName, repositoryPath, form]);

  const submit = async (values: { remote: string; force?: boolean }) => {
    if (!tagName) return;
    setLoading(true);
    setError('');
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'push-tag',
        repositoryPath,
        tagName,
        values.remote,
        Boolean(values.force),
      )) as PushGitTagResult;
      if (result.ok) {
        onCompleted(result);
      } else {
        setError(result.error);
      }
    } catch (reason: any) {
      setError(reason?.message || 'The tag could not be pushed.');
    } finally {
      setLoading(false);
    }
  };

  const remoteOptions =
    remotes.length > 0
      ? remotes.map((r) => ({
          label: `${r.name} (${r.pushUrl || r.fetchUrl || 'remote'})`,
          value: r.name,
        }))
      : [{ label: 'origin', value: 'origin' }];

  return (
    <Modal
      title={
        <Space>
          <CloudUploadOutlined />
          <span>Push Tag to Remote</span>
        </Space>
      }
      open={Boolean(tagName)}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose
      width={480}
      closable={!loading}
      maskClosable={!loading}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{ remote: 'origin', force: false }}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary" style={{ marginRight: 8 }}>
            Tag:
          </Typography.Text>
          <Typography.Text strong code>
            <TagOutlined style={{ marginRight: 4 }} />
            {tagName}
          </Typography.Text>
        </div>

        <Form.Item
          label="Remote"
          name="remote"
          rules={[{ required: true, message: 'Select or enter a remote name.' }]}
        >
          <Select
            options={remoteOptions}
            loading={loadingRemotes}
            placeholder="Select remote"
            data-testid="push-tag-remote-select"
          />
        </Form.Item>

        <Form.Item name="force" valuePropName="checked">
          <Checkbox data-testid="push-tag-force-checkbox">
            Force push (--force)
          </Checkbox>
        </Form.Item>

        {error ? (
          <Alert
            type="error"
            showIcon
            message="Push failed"
            description={error}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          icon={<CloudUploadOutlined />}
          loading={loading}
          data-testid="confirm-push-tag-btn"
        >
          Push Tag
        </Button>
      </Form>
    </Modal>
  );
}
