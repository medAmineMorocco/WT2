import { Alert, Button, Checkbox, Form, Modal, Select, Space, Typography } from 'antd';
import { DeleteOutlined, GlobalOutlined, TagOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { DeleteGitTagResult } from '../../../shared/gitTag';
import type { GitRemote } from '../../../shared/gitRemote';

export default function DeleteRemoteTagModal({
  tagName,
  repositoryPath,
  onClose,
  onCompleted,
}: {
  tagName: string | null;
  repositoryPath: string;
  onClose: () => void;
  onCompleted: (
    result: Extract<DeleteGitTagResult, { ok: true }>,
    alsoDeletedLocally: boolean,
  ) => void;
}) {
  const [form] = Form.useForm<{ remote: string; alsoDeleteLocal?: boolean }>();
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
        form.setFieldsValue({ remote: defaultRemote, alsoDeleteLocal: false });
      })
      .catch(() => {
        form.setFieldsValue({ remote: 'origin', alsoDeleteLocal: false });
      })
      .finally(() => {
        setLoadingRemotes(false);
      });
  }, [tagName, repositoryPath, form]);

  const submit = async (values: {
    remote: string;
    alsoDeleteLocal?: boolean;
  }) => {
    if (!tagName) return;
    setLoading(true);
    setError('');
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'delete-tag-remotely',
        repositoryPath,
        tagName,
        values.remote,
      )) as DeleteGitTagResult;

      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      let deletedLocally = false;
      if (values.alsoDeleteLocal) {
        try {
          const localRes = (await window.electron.ipcRenderer.invoke(
            'delete-tag-locally',
            repositoryPath,
            tagName,
          )) as DeleteGitTagResult;
          if (localRes.ok) {
            deletedLocally = true;
          }
        } catch {
          // If local tag delete fails (e.g. was already not present locally), remote was still deleted
        }
      }

      onCompleted(result, deletedLocally);
    } catch (reason: any) {
      setError(reason?.message || 'Failed to delete remote tag.');
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
          <GlobalOutlined />
          <span>Delete Tag from Remote</span>
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
        initialValues={{ remote: 'origin', alsoDeleteLocal: false }}
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
          rules={[{ required: true, message: 'Select a remote.' }]}
        >
          <Select
            options={remoteOptions}
            loading={loadingRemotes}
            placeholder="Select remote"
            data-testid="delete-remote-tag-select"
          />
        </Form.Item>

        <Form.Item name="alsoDeleteLocal" valuePropName="checked">
          <Checkbox data-testid="also-delete-local-checkbox">
            Also delete tag locally
          </Checkbox>
        </Form.Item>

        <Alert
          type="warning"
          showIcon
          message="Remote deletion is irreversible"
          description={`Deleting "${tagName}" will remove the tag from the remote repository for all collaborators.`}
          style={{ marginBottom: 16 }}
        />

        {error ? (
          <Alert
            type="error"
            showIcon
            message="Deletion failed"
            description={error}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <Button
          type="primary"
          danger
          htmlType="submit"
          block
          size="large"
          icon={<DeleteOutlined />}
          loading={loading}
          data-testid="confirm-delete-remote-tag-btn"
        >
          Delete Tag from Remote
        </Button>
      </Form>
    </Modal>
  );
}
