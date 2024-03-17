import React, { forwardRef, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Layout,
  Modal,
  Tooltip,
  Space,
  Segmented,
  Select,
} from 'antd';
import {
  SisternodeOutlined,
  BranchesOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import ListWorktrees from './ListWorktrees';

const { Sider } = Layout;

const Worktrees = forwardRef<HTMLDivElement, { isDarkMode: boolean }>(
  ({ isDarkMode }, ref) => {
    const [collapsed, setCollapsed] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [form] = Form.useForm();

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

    const onChangeCreateWorktreeMode = (newVal: string) => {
      setCreateWorktreeMode(newVal);
    };

    const onFinish = (values: any) => {
      console.log('Received values of form: ', values);
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
            <Space style={{ marginTop: '16px' }}>
              <strong style={{ marginLeft: '8px' }}>Worktrees</strong>
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
                  ref={ref}
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
                    label: (
                      <div style={{ padding: 2 }}>From existing branch</div>
                    ),
                    value: 'existing-branch',
                  },
                ]}
              />
              <Form
                layout="vertical"
                requiredMark="optional"
                form={form}
                onFinish={onFinish}
              >
                {createWorktreeMode === 'new-branch' && (
                  <Form.Item
                    label="Name"
                    name="name"
                    rules={[
                      {
                        required: true,
                        message: 'Please input your worktree name!',
                      },
                      () => ({
                        validator(_, value) {
                          if (value && value.includes('/')) {
                            return Promise.reject(
                              new Error(
                                'The name of worktree should not contains / character !',
                              ),
                            );
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <Input
                      prefix={<BranchesOutlined />}
                      placeholder="feature-add-sidebar"
                    />
                  </Form.Item>
                )}
                {createWorktreeMode === 'existing-branch' && (
                  <Form.Item
                    label="Existing branch"
                    name="existing-branch"
                    rules={[
                      {
                        required: true,
                        message: 'Please select a branch!',
                      },
                      () => ({
                        validator(_, value) {
                          if (value && value.includes('/')) {
                            return Promise.reject(
                              new Error(
                                'The name of worktree should not contains / character !',
                              ),
                            );
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <Select
                      showSearch
                      placeholder="Select branch"
                      options={[
                        { value: 'main', label: 'main' },
                        { value: 'fix', label: 'fix' },
                        { value: 'feature', label: 'feature' },
                        {
                          value: 'feature/worktree',
                          label: 'feature/worktree',
                        },
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
          </>
        )}
        {!collapsed && (
          <div>
            <ListWorktrees isDarkMode={isDarkMode} />
          </div>
        )}
      </Sider>
    );
  },
);

export default Worktrees;
