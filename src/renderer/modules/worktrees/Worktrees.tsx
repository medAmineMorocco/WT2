import React, { useState } from 'react';
import {
  Button,
  Divider,
  Dropdown,
  Form,
  Input,
  Layout,
  MenuProps,
  Modal,
  theme,
  Tooltip,
  Space,
  message,
  App as AntdApp,
} from 'antd';
import {
  CheckOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  SisternodeOutlined,
  MoreOutlined,
  BranchesOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  FolderOutlined,
  FolderAddOutlined,
  WarningOutlined,
} from '@ant-design/icons';

import { ipcRenderer } from 'electron';

const { Sider } = Layout;
const { useToken } = theme;

export default function Worktrees() {
  const {
    token: { colorWarning },
  } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);

  const { token } = useToken();

  const { modal } = AntdApp.useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form] = Form.useForm();

  const [selectedRepoPath, setSelectedRepoPath] = useState();
  const [repoName, setRepoName] = useState();

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const items = [
    {
      label: 'Delete',
      key: '0',
      icon: <DeleteOutlined />,
      danger: true,
    },
  ];

  const onClick: MenuProps['onClick'] = () => {
    modal.confirm({
      title: 'Are you sure delete this worktree ?',
      icon: <ExclamationCircleFilled />,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      centered: true,
      onOk() {
        console.log('OK');
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  };

  const openRepository = async () => {
    ipcRenderer.send('choose-dir');
  };

  ipcRenderer.on('selected-repo', function (event, isGitRepo, path, name) {
    if (isGitRepo) {
      if (path && name) {
        setSelectedRepoPath(path);
        setRepoName(name);
        message.destroy();
        message.success('Success! Repository Imported 🎉');
      }
    } else {
      message.destroy();
      message.error('Oops! Not a Git Repository ☹️');
    }
  });

  return (
    <Sider
      theme="light"
      collapsible
      collapsed={collapsed}
      onCollapse={(value) => setCollapsed(value)}
    >
      {!collapsed && (
        <>
          <Divider orientation="left" style={{ marginTop: 0 }}>
            <Space>
              <strong>Repository</strong>
              <Tooltip title="Open a repository" placement="right">
                <FolderAddOutlined
                  style={{ cursor: 'pointer' }}
                  onClick={openRepository}
                  className="icon-action"
                />
              </Tooltip>
            </Space>
          </Divider>
          {repoName ? (
            <div
              style={{
                marginLeft: '8px',
                marginRight: '8px',
                padding: '4px',
                border: '1px dashed',
                overflowWrap: 'anywhere',
              }}
            >
              <Space>
                <strong>
                  <FolderOutlined />
                </strong>
                <span>{repoName}</span>
              </Space>
              <div
                style={{
                  paddingRight: '4px',
                  fontSize: 'smaller',
                }}
              >
                {selectedRepoPath}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <Tooltip title="No repository selected" placement="left">
                <WarningOutlined
                  style={{ color: colorWarning, fontSize: '30px' }}
                />
              </Tooltip>
            </div>
          )}
        </>
      )}
      {!collapsed && (
        <Divider orientation="left">
          <Space>
            <strong>Worktrees</strong>
            <Tooltip title="Add new worktree" placement="right">
              <SisternodeOutlined
                style={{ cursor: 'pointer' }}
                onClick={showModal}
                className="icon-action"
              />
            </Tooltip>
          </Space>
          <Modal
            open={isModalOpen}
            centered
            footer={null}
            onCancel={handleCancel}
            destroyOnClose
            width={400}
          >
            <Form layout="vertical" form={form}>
              <Form.Item
                label="Name"
                name="name"
                rules={[
                  {
                    required: true,
                    message: 'Please input your worktree name!',
                  },
                ]}
              >
                <Input prefix={<BranchesOutlined />} />
              </Form.Item>
              <Form.Item label="Pre-hook" name="preHook">
                <Input prefix={<StepBackwardOutlined />} />
              </Form.Item>
              <Form.Item label="Post-hook" name="postHook">
                <Input prefix={<StepForwardOutlined />} />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<CheckOutlined />}
                >
                  Submit
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </Divider>
      )}
      {!collapsed && (
        <div>
          <ul style={{ paddingLeft: '8px', paddingRight: '2px' }}>
            <li
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '24px',
                color: token.colorTextBase,
              }}
            >
              <Space>
                <BranchesOutlined /> worktree1
              </Space>
              <Dropdown
                menu={{ items, onClick }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Tooltip title="Worktree actions" placement="right">
                  <MoreOutlined style={{ cursor: 'pointer' }} />
                </Tooltip>
              </Dropdown>
            </li>
            <li
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '24px',
                color: token.colorTextBase,
              }}
            >
              <Space>
                <BranchesOutlined /> worktree2
              </Space>
              <Dropdown
                menu={{ items, onClick }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Tooltip title="Worktree actions" placement="right">
                  <MoreOutlined style={{ cursor: 'pointer' }} />
                </Tooltip>
              </Dropdown>
            </li>
          </ul>
        </div>
      )}
    </Sider>
  );
}
