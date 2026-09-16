import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  App as AntdApp,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { GitRemote } from '../../../shared/gitRemote';
import './Remotes.css';

export default function EditRemoteModal({
  open,
  remote,
  repositoryPath,
  onClose,
  onUpdated,
}: {
  open: boolean;
  remote: GitRemote | null;
  repositoryPath: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { notification } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && remote) {
      form.setFieldsValue({
        name: remote.name,
        pullUrl: remote.fetchUrl,
        pushUrl: remote.pushUrl || remote.fetchUrl,
      });
    }
  }, [open, remote, form]);

  const handleSubmit = async () => {
    if (!remote) return;
    try {
      const values = await form.validateFields();
      setLoading(true);
      await window.electron.ipcRenderer.invoke(
        'edit-remote',
        repositoryPath,
        remote.name,
        values.name.trim(),
        values.pullUrl.trim(),
        values.pushUrl ? values.pushUrl.trim() : undefined,
      );
      notification.success({
        message: 'Remote updated',
        description: `Successfully updated remote "${values.name.trim()}".`,
        placement: 'bottomLeft',
      });
      onUpdated();
      onClose();
    } catch (error: any) {
      const raw = error?.message || String(error);
      const clean = raw
        .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
        .trim();
      notification.error({
        message: 'Failed to update remote',
        description: clean || 'Could not update remote.',
        placement: 'bottomLeft',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={460}
      className="add-remote-modal"
      title={
        <Space className="add-remote-modal-title">
          <EditOutlined style={{ fontSize: 18, color: '#6366f1' }} />
          <span>Edit Remote ({remote?.name})</span>
        </Space>
      }
      centered
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        className="add-remote-form"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: 'Please enter a remote name' },
            {
              pattern: /^[a-zA-Z0-9._-]+$/,
              message: 'Name can only contain letters, numbers, hyphens, underscores and dots',
            },
          ]}
        >
          <Input placeholder="e.g. origin or upstream" />
        </Form.Item>

        <Form.Item
          label="Pull URL"
          name="pullUrl"
          rules={[{ required: true, message: 'Please enter a pull URL' }]}
        >
          <Input placeholder="Pull URL" />
        </Form.Item>

        <Form.Item label="Push URL" name="pushUrl">
          <Input placeholder="Push URL (optional)" />
        </Form.Item>

        <div className="add-remote-actions">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            className="add-remote-submit-btn"
          >
            Save Changes
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
