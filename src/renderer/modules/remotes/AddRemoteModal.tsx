import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Tabs,
  Space,
  App as AntdApp,
} from 'antd';
import {
  CloudOutlined,
  GlobalOutlined,
  GithubOutlined,
  GitlabOutlined,
} from '@ant-design/icons';
import './Remotes.css';

export const BitbucketIcon = () => (
  <span className="anticon" style={{ display: 'inline-flex', alignItems: 'center' }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1.54 2.89a.6.6 0 0 0-.6.7l2.84 17a.6.6 0 0 0 .59.5h14.73a.6.6 0 0 0 .6-.5l2.84-17a.6.6 0 0 0-.6-.7H1.54zm12.39 12.37H9.28l-1.12-6.55h6.88l-1.11 6.55z" />
    </svg>
  </span>
);

export const AzureDevOpsIcon = () => (
  <span className="anticon" style={{ display: 'inline-flex', alignItems: 'center' }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.04 7.21l-7.39-2.73-8.87 3.32L0 12.18l4.47 3.51L1.29 20.3l12.56-1.07 8.2-3.83 1.95-8.19zm-3.08 7.39l-6.32 2.95-6.1-2.45V9.45l6.1-2.28 6.32 2.37v5.06z" />
    </svg>
  </span>
);

export default function AddRemoteModal({
  open,
  repositoryPath,
  onClose,
  onAdded,
}: {
  open: boolean;
  repositoryPath: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { notification } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('url');
  const [loading, setLoading] = useState(false);
  const [pushUrlDirty, setPushUrlDirty] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ name: 'origin' });
      setPushUrlDirty(false);
      setActiveTab('url');
    }
  }, [open, form]);

  const handlePullUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!pushUrlDirty) {
      form.setFieldsValue({ pushUrl: val });
    }
  };

  const handleServiceSelect = (service: string) => {
    setActiveTab(service);
    if (service === 'github') {
      const current = form.getFieldValue('pullUrl') || '';
      if (!current.includes('github.com')) {
        form.setFieldsValue({
          name: form.getFieldValue('name') || 'origin',
          pullUrl: 'https://github.com/',
          pushUrl: pushUrlDirty ? form.getFieldValue('pushUrl') : 'https://github.com/',
        });
      }
    } else if (service === 'gitlab') {
      const current = form.getFieldValue('pullUrl') || '';
      if (!current.includes('gitlab.com')) {
        form.setFieldsValue({
          name: form.getFieldValue('name') || 'origin',
          pullUrl: 'https://gitlab.com/',
          pushUrl: pushUrlDirty ? form.getFieldValue('pushUrl') : 'https://gitlab.com/',
        });
      }
    } else if (service === 'bitbucket') {
      const current = form.getFieldValue('pullUrl') || '';
      if (!current.includes('bitbucket.org')) {
        form.setFieldsValue({
          name: form.getFieldValue('name') || 'origin',
          pullUrl: 'https://bitbucket.org/',
          pushUrl: pushUrlDirty ? form.getFieldValue('pushUrl') : 'https://bitbucket.org/',
        });
      }
    } else if (service === 'azure') {
      const current = form.getFieldValue('pullUrl') || '';
      if (!current.includes('dev.azure.com')) {
        form.setFieldsValue({
          name: form.getFieldValue('name') || 'origin',
          pullUrl: 'https://dev.azure.com/',
          pushUrl: pushUrlDirty ? form.getFieldValue('pushUrl') : 'https://dev.azure.com/',
        });
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await window.electron.ipcRenderer.invoke(
        'add-remote',
        repositoryPath,
        values.name.trim(),
        values.pullUrl.trim(),
        values.pushUrl ? values.pushUrl.trim() : undefined,
      );
      notification.success({
        message: 'Remote added',
        description: `Successfully added remote "${values.name.trim()}".`,
        placement: 'bottomLeft',
      });
      onAdded();
      onClose();
    } catch (error: any) {
      const raw = error?.message || String(error);
      const clean = raw
        .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
        .trim();
      notification.error({
        message: 'Failed to add remote',
        description: clean || 'Could not add remote.',
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
          <CloudOutlined style={{ fontSize: 18, color: '#6366f1' }} />
          <span>Add Remote</span>
        </Space>
      }
      centered
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={handleServiceSelect}
        className="add-remote-tabs"
        items={[
          {
            key: 'url',
            label: (
              <span className="add-remote-tab-label">
                <GlobalOutlined className="tab-icon" />
                URL
              </span>
            ),
          },
          {
            key: 'github',
            label: (
              <span className="add-remote-tab-label">
                <GithubOutlined className="tab-icon" />
                GitHub
              </span>
            ),
          },
          {
            key: 'gitlab',
            label: (
              <span className="add-remote-tab-label">
                <GitlabOutlined className="tab-icon" />
                GitLab
              </span>
            ),
          },
          {
            key: 'bitbucket',
            label: (
              <span className="add-remote-tab-label">
                <BitbucketIcon />
                Bitbucket
              </span>
            ),
          },
          {
            key: 'azure',
            label: (
              <span className="add-remote-tab-label">
                <AzureDevOpsIcon />
                Azure DevOps
              </span>
            ),
          },
        ]}
      />

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
          <Input placeholder="e.g. origin or upstream" autoFocus />
        </Form.Item>

        <Form.Item
          label="Pull URL"
          name="pullUrl"
          rules={[
            { required: true, message: 'Please enter a pull URL' },
          ]}
        >
          <Input
            placeholder="https://github.com/user/repo.git or git@github.com:user/repo.git"
            onChange={handlePullUrlChange}
          />
        </Form.Item>

        <Form.Item
          label="Push URL"
          name="pushUrl"
          tooltip="Optional. Defaults to Pull URL if left identical."
        >
          <Input
            placeholder="Push URL (optional)"
            onChange={() => setPushUrlDirty(true)}
          />
        </Form.Item>

        <div className="add-remote-actions">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            className="add-remote-submit-btn"
          >
            Add Remote
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
