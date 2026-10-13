import { Alert, Button, Form, Input, Modal, Space, Typography } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { ParsedCommit } from '../../components/log/LogUI';
import type { CreateGitTagResult } from '../../../shared/gitTag';

export default function CreateTagModal({
  commit,
  repositoryPath,
  onClose,
  onCompleted,
}: {
  commit: ParsedCommit | null;
  repositoryPath: string;
  onClose: () => void;
  onCompleted: (result: Extract<CreateGitTagResult, { ok: true }>) => void;
}) {
  const [form] = Form.useForm<{ tagName: string; message?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    form.resetFields();
    setError('');
  }, [commit, form]);

  const submit = async (values: { tagName: string; message?: string }) => {
    if (!commit) return;
    setLoading(true);
    setError('');
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'create-tag-at-commit',
        repositoryPath,
        commit.hash,
        values.tagName,
        values.message,
      )) as CreateGitTagResult;
      if (result.ok) onCompleted(result);
      else setError(result.error);
    } catch (reason: any) {
      setError(reason?.message || 'The tag could not be created.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <TagOutlined />
          Create tag at commit
        </Space>
      }
      open={Boolean(commit)}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose
      width={500}
      closable={!loading}
      maskClosable={!loading}
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <div className="create-tag-commit-summary">
          <Typography.Text code>{commit?.hash.slice(0, 8)}</Typography.Text>
          <Typography.Text ellipsis>{commit?.subject}</Typography.Text>
        </div>
        <Form.Item
          label="Tag name"
          name="tagName"
          rules={[
            { required: true, whitespace: true, message: 'Enter a tag name.' },
            {
              validator: async (_, value?: string) => {
                const forbiddenCharacters = [
                  '~',
                  '^',
                  ':',
                  '?',
                  '*',
                  '[',
                  '\\',
                ];
                if (
                  !value ||
                  (!/\s/.test(value) &&
                    !forbiddenCharacters.some((character) =>
                      value.includes(character),
                    ))
                )
                  return;
                throw new Error('This tag name contains invalid characters.');
              },
            },
          ]}
        >
          <Input
            autoFocus
            prefix={<TagOutlined />}
            placeholder="v1.3.0"
            autoComplete="off"
            data-testid="create-tag-name"
          />
        </Form.Item>
        <Form.Item
          label="Annotation"
          name="message"
          extra="Optional. Adding a message creates an annotated tag; otherwise a lightweight tag is created."
        >
          <Input.TextArea
            rows={3}
            placeholder="Release notes or tag description"
            maxLength={1000}
            showCount
          />
        </Form.Item>
        {error ? (
          <Alert
            type="error"
            showIcon
            message="Tag creation failed"
            description={error}
          />
        ) : null}
        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          icon={<TagOutlined />}
          loading={loading}
          style={{ marginTop: 16 }}
        >
          Create Tag
        </Button>
      </Form>
    </Modal>
  );
}
