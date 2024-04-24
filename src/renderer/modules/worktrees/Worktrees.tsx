import React, { forwardRef, useEffect, useMemo, useState } from 'react';
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
  App as AntdApp,
  Typography,
  Tag,
  Card,
  Statistic,
} from 'antd';
import {
  SisternodeOutlined,
  BranchesOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  LoadingOutlined,
  HourglassOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import ListWorktrees from './ListWorktrees';
import TabService from '../../services/tab/TabService';

const { Sider } = Layout;

const Worktrees = forwardRef<HTMLDivElement, { isDarkMode: boolean }>(
  ({ isDarkMode }, ref) => {
    const [collapsed, setCollapsed] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [form] = Form.useForm();

    const [createWorktreeMode, setCreateWorktreeMode] = useState('new-branch');

    const { notification } = AntdApp.useApp();

    const [branches, setBranches] = useState([]);

    const activeTab = useMemo(() => TabService.getActiveTab(), []);

    const [pruneLoading, setPruneLoading] = useState<boolean>(false);

    const tabRepoPath = useMemo(() => {
      return TabService.getTabRepoPath(activeTab);
    }, [activeTab]);

    useEffect(() => {
      const onWorktreeCreated = (event: any, code: number, result: any) => {
        if (code === 0) {
          form.setFieldValue('name', null);
          notification.success({
            message: 'Worktree Created',
            description: result,
            placement: 'bottomLeft',
            duration: 1,
          });
          ipcRenderer.send('get-worktrees', tabRepoPath);
          setIsModalOpen(false);
        } else {
          notification.error({
            message: 'Unable to Create Worktree',
            description: <Typography.Text copyable>{result}</Typography.Text>,
            placement: 'bottomLeft',
          });
        }
      };

      const onBranchesFound = (event: any, code: number, result: any) => {
        if (code === 0) {
          setBranches(
            JSON.parse(result).map((branch: string) => {
              return {
                label: branch,
                value: branch,
              };
            }),
          );
        }
      };

      const onWorktreesPruned = (event: any, code: number, result: any) => {
        setTimeout(() => {
          setPruneLoading(false);
          ipcRenderer.send('get-worktrees', tabRepoPath);
          if (code === 0) {
            notification.success({
              message: 'Stale worktrees have been successfully pruned',
              placement: 'bottomLeft',
              duration: 0.5,
            });
          } else {
            notification.error({
              message: 'Unable to Create Worktree',
              description: <Typography.Text copyable>{result}</Typography.Text>,
              placement: 'bottomLeft',
            });
          }
        }, 200);
      };

      ipcRenderer.on('worktree-created', onWorktreeCreated);
      ipcRenderer.on('branches-found', onBranchesFound);
      ipcRenderer.on('worktrees-pruned', onWorktreesPruned);

      return () => {
        ipcRenderer.removeAllListeners('worktree-created');
        ipcRenderer.removeAllListeners('branches-found');
        ipcRenderer.removeAllListeners('worktrees-pruned');
      };
    }, [notification, tabRepoPath]);

    useEffect(() => {
      if (createWorktreeMode === 'existing-branch' && isModalOpen) {
        ipcRenderer.send('get-branches', tabRepoPath);
      }
      const activeTabValue = TabService.getTab(activeTab);
      if (activeTabValue.preHook) {
        form.setFieldValue('preHook', activeTabValue.preHook);
      }
      if (activeTabValue.postHook) {
        form.setFieldValue('postHook', activeTabValue.postHook);
      }
    }, [activeTab, createWorktreeMode, form, isModalOpen, tabRepoPath]);

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

    const onClickPrune = () => {
      setPruneLoading(true);
      ipcRenderer.send('prune-worktrees', tabRepoPath);
    };

    const handleCancel = () => {
      setIsModalOpen(false);
    };

    const onChangeCreateWorktreeMode = (newVal: string) => {
      setCreateWorktreeMode(newVal);
    };

    const onFinish = (values: any) => {
      console.log('Received values of form: ', values);
      const worktreeName =
        createWorktreeMode === 'new-branch'
          ? values.name
          : values['existing-branch'];
      const command =
        createWorktreeMode === 'existing-branch'
          ? `git worktree add ../${worktreeName} ${worktreeName}`
          : `git worktree add ../${worktreeName}`;
      const workflow = {
        name: worktreeName,
        command: null,
        commands: [],
        mode: 'sequential',
        worktrees: [
          {
            label: 'create worktree',
            path: tabRepoPath,
          },
        ],
      } as any;
      if (values.preHook) {
        workflow.command = {
          key: '0',
          value: values.preHook,
        };
        workflow.commands = [
          {
            key: '1',
            value: command,
          },
        ];
      }
      if (values.postHook && !values.preHook) {
        workflow.command = {
          key: '0',
          value: command,
        };
        workflow.commands = [
          {
            key: '1',
            value: values.postHook,
            postHook: true,
            worktreeName,
          },
        ];
      }
      if (values.postHook && values.preHook) {
        workflow.commands = [
          {
            key: '1',
            value: command,
          },
          {
            key: '2',
            value: values.postHook,
            postHook: true,
            worktreeName,
          },
        ];
      }

      const activeTabValue = TabService.getTab(activeTab);
      const activeTabNewValue = {
        ...activeTabValue,
        preHook: values.preHook,
        postHook: values.postHook,
      };
      window.localStorage.setItem(activeTab, JSON.stringify(activeTabNewValue));

      if (values.preHook || values.postHook) {
        ipcRenderer.send('play-workflow', workflow);
        setIsModalOpen(false);
        return;
      }
      ipcRenderer.send(
        'create-worktree',
        worktreeName,
        createWorktreeMode === 'existing-branch',
        tabRepoPath,
      );
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
            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                paddingRight: '4px',
              }}
            >
              <Space style={{ flexGrow: 1 }}>
                <strong style={{ marginLeft: '8px' }}>Worktrees</strong>
                {!pruneLoading ? (
                  <Tooltip
                    title="Prune worktrees"
                    mouseEnterDelay={0}
                    mouseLeaveDelay={0}
                  >
                    <SyncOutlined
                      className="icon-action"
                      style={{ cursor: 'pointer' }}
                      onClick={onClickPrune}
                    />
                  </Tooltip>
                ) : (
                  <LoadingOutlined />
                )}
              </Space>

              <Tooltip
                title={
                  <Space>
                    <span>Add new worktree</span>
                    <small style={{ color: 'grey' }}>Shift+W</small>
                  </Space>
                }
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <Button
                  type="primary"
                  size="small"
                  onClick={showModal}
                  ref={ref}
                  icon={<SisternodeOutlined />}
                />
              </Tooltip>
            </div>
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
                      <div style={{ padding: 2 }}>For an existing branch</div>
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
                style={{ marginTop: '8px' }}
              >
                {createWorktreeMode === 'new-branch' && (
                  <Form.Item
                    label="Name"
                    name="name"
                    extra="Always created from HEAD of the main worktree"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'Please enter the name of your worktree.',
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
                      allowClear
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
                        whitespace: true,
                        message: 'Please choose a branch.',
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
                      options={branches}
                    />
                  </Form.Item>
                )}
                <Form.Item
                  label="Pre-hook"
                  name="preHook"
                  tooltip={{
                    title: `command will be executed in ${tabRepoPath}`,
                    icon: <InfoCircleOutlined />,
                    placement: 'right',
                  }}
                >
                  <Input
                    prefix={<StepBackwardOutlined />}
                    placeholder="git fetch origin main:main"
                    allowClear
                  />
                </Form.Item>
                <Form.Item
                  label="Post-hook"
                  name="postHook"
                  tooltip={{
                    title: `command will be executed in created worktree repository`,
                    icon: <InfoCircleOutlined />,
                    placement: 'right',
                  }}
                >
                  <Input
                    prefix={<StepForwardOutlined />}
                    placeholder="npm install"
                    allowClear
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
          <>
            <div style={{ height: '40%', overflowY: 'auto' }}>
              <ListWorktrees isDarkMode={isDarkMode} />
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: '46px',
                width: '100%',
                padding: '16px',
              }}
            >
              <Card
                bordered={false}
                style={{
                  backgroundColor: isDarkMode ? 'black' : '#f5f5f5',
                  boxShadow: 'none',
                }}
              >
                <Statistic
                  title="Free Trial"
                  value={4}
                  prefix={<HourglassOutlined />}
                  suffix="Days"
                />
              </Card>
            </div>
            <Tag
              style={{
                position: 'absolute',
                bottom: '12px',
                left: 'calc(50% - 25px)',
                zIndex: 8,
                display: 'none',
              }}
            >
              1.0.0
            </Tag>
          </>
        )}
      </Sider>
    );
  },
);

export default Worktrees;
