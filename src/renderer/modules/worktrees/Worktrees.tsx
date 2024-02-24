import React, { useState } from 'react';
import {
  Button,
  Divider,
  Form,
  Input,
  Layout,
  Modal,
  theme,
  Tooltip,
  Space,
  message,
  Segmented,
  Select,
} from 'antd';
import {
  SisternodeOutlined,
  BranchesOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  FolderOutlined,
  FolderAddOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import ListWorktrees from './ListWorktrees';

const { Sider } = Layout;

export default function Worktrees({ isDarkMode }: { isDarkMode: boolean }) {
  const {
    token: { colorWarning },
  } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form] = Form.useForm();

  const [selectedRepoPath, setSelectedRepoPath] = useState();
  const [repoName, setRepoName] = useState();

  const [createWorktreeMode, setCreateWorktreeMode] = useState('new-branch');

  const showModal = () => {
    setIsModalOpen(true);
  };

  useHotkeys(
    'shift+w',
    () => {
      if (collapsed) {
        setCollapsed(false);
        showModal();
      } else {
        showModal();
      }
    },
    { preventDefault: true },
  );
  useHotkeys('shift+c', () => setCollapsed(!collapsed), {
    preventDefault: true,
  });

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const openRepository = async () => {
    ipcRenderer.send('choose-dir');
  };
  useHotkeys('shift+o', () => openRepository(), { preventDefault: true });

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

  const onChangeCreateWorktreeMode = (newVal: string) => {
    setCreateWorktreeMode(newVal);
  };

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
              <Tooltip
                title={
                  <Space>
                    <span>Open a repository</span>{' '}
                    <small style={{ color: 'grey' }}>Shift+O</small>
                  </Space>
                }
                placement="bottomRight"
              >
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
            <Tooltip
              title={
                <Space>
                  <span>Add new worktree</span>
                  <small style={{ color: 'grey' }}>Shift+W</small>
                </Space>
              }
              placement="right"
            >
              <SisternodeOutlined
                style={{ cursor: 'pointer' }}
                onClick={showModal}
                className="icon-action"
              />
            </Tooltip>
          </Space>
          <Modal
            open={isModalOpen}
            footer={null}
            onCancel={handleCancel}
            destroyOnClose
            width={400}
            closeIcon={false}
          >
            <Segmented
              defaultValue={createWorktreeMode}
              onChange={onChangeCreateWorktreeMode}
              block
              options={[
                {
                  label: <div style={{ padding: 2 }}>With new branch</div>,
                  value: 'new-branch',
                },
                {
                  label: <div style={{ padding: 2 }}>From existing branch</div>,
                  value: 'existing-branch',
                },
              ]}
            />
            <Form layout="vertical" requiredMark="optional" form={form}>
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
                <Input
                  prefix={<BranchesOutlined />}
                  placeholder="feature-add-sidebar"
                />
              </Form.Item>
              {createWorktreeMode === 'existing-branch' && (
                <Form.Item
                  label="Existing branch"
                  name="existing-branch"
                  rules={[
                    {
                      required: true,
                      message: 'Please select a branch!',
                    },
                  ]}
                >
                  <Select
                    showSearch
                    placeholder="Select branch"
                    options={[
                      { value: 'main', label: 'main' },
                      { value: 'fix', label: 'fix' },
                      { value: 'feature', label: 'feature' },
                    ]}
                  />
                </Form.Item>
              )}
              <Form.Item label="Pre-hook" name="preHook">
                <Input
                  prefix={<StepBackwardOutlined />}
                  placeholder="git fetch origin main:main"
                />
              </Form.Item>
              <Form.Item label="Post-hook" name="postHook">
                <Input
                  prefix={<StepForwardOutlined />}
                  placeholder="npm install"
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  style={{ width: '100%' }}
                >
                  Create Worktree
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </Divider>
      )}
      {!collapsed && (
        <div>
          <ListWorktrees isDarkMode={isDarkMode} />
        </div>
      )}
    </Sider>
  );
}
