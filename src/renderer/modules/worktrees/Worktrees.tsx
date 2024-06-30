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
  theme,
  Divider,
} from 'antd';
import {
  SisternodeOutlined,
  BranchesOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  LoadingOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import { GitBranchIcon, GitCompareIcon } from 'hugeicons-react';
import ListWorktrees from './ListWorktrees';
import TabService from '../../services/tab/TabService';
import GitLog from '../gitLog/GitLog';
import PackInfos from '../packInfos/PackInfos';
import GitDiff from '../gitDiff/GitDiff';

const { Sider } = Layout;
const { useToken } = theme;

const Worktrees = forwardRef<HTMLDivElement, { isDarkMode: boolean }>(
  ({ isDarkMode }, ref) => {
    const { token } = useToken();
    const [collapsed, setCollapsed] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [form] = Form.useForm();

    const [createWorktreeMode, setCreateWorktreeMode] = useState('new-branch');

    const { notification } = AntdApp.useApp();

    const [branches, setBranches] = useState<any[]>([]);

    const [tags, setTags] = useState<any[]>([]);

    const activeTab = useMemo(() => TabService.getActiveTab(), []);

    const [pruneLoading, setPruneLoading] = useState<boolean>(false);

    const [openGitLog, setOpenGitLog] = useState(false);

    const [openGitDiff, setOpenGitDiff] = useState(false);

    const [worktreesFolder, setWorktreesFolder] = useState<string>('');

    const [pathSeparator, setPathSeparator] = useState<string>('');

    const [loadingCreateWorktree, setLoadingCreateWorktree] = useState(false);

    const tabRepoPath = useMemo(() => {
      return TabService.getTabRepoPath(activeTab);
    }, [activeTab]);

    useEffect(() => {
      ipcRenderer.send('get-worktrees-folder', tabRepoPath);

      const onWorktreeCreated = (event: any, code: number, result: any) => {
        if (code === 0) {
          form.setFieldValue('name', null);
          notification.success({
            message: 'Worktree Created',
            description: result,
            placement: 'bottomLeft',
            duration: 1,
          });
          setLoadingCreateWorktree(false);
          ipcRenderer.send('get-worktrees', tabRepoPath);
          setIsModalOpen(false);
        } else {
          setLoadingCreateWorktree(false);
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

      const onTagsFound = (event: any, code: number, result: any) => {
        if (code === 0) {
          setTags(
            result.map((branch: string) => {
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

      const onWorktreesFolderFound = (
        event: any,
        code: number,
        result: any,
      ) => {
        if (code === 0) {
          const { folder, separator } = JSON.parse(result);
          setWorktreesFolder(folder);
          setPathSeparator(separator);
        }
      };

      const onSelectWorktreesDir = (
        event: any,
        code: number,
        dirPath: string,
      ) => {
        if (code === 0) {
          setWorktreesFolder(dirPath);
        }
      };

      ipcRenderer.on('worktree-created', onWorktreeCreated);
      ipcRenderer.on('branches-found', onBranchesFound);
      ipcRenderer.on('receive-tags', onTagsFound);
      ipcRenderer.on('worktrees-pruned', onWorktreesPruned);
      ipcRenderer.on('worktrees-folder-found', onWorktreesFolderFound);
      ipcRenderer.on('selected-worktrees-dir', onSelectWorktreesDir);

      return () => {
        ipcRenderer.removeAllListeners('worktree-created');
        ipcRenderer.removeAllListeners('branches-found');
        ipcRenderer.removeAllListeners('receive-tags');
        ipcRenderer.removeAllListeners('worktrees-pruned');
        ipcRenderer.removeAllListeners('worktrees-folder-found');
        ipcRenderer.removeAllListeners('selected-worktrees-dir');
      };
    }, [form, notification, tabRepoPath]);

    useEffect(() => {
      if (createWorktreeMode === 'existing-branch' && isModalOpen) {
        ipcRenderer.send('get-branches', tabRepoPath);
      }
      if (createWorktreeMode === 'existing-tag' && isModalOpen) {
        ipcRenderer.send('list-tags', tabRepoPath);
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

    useHotkeys('shift+p', () => onClickPrune(), {
      preventDefault: true,
    });

    const handleCancel = () => {
      setIsModalOpen(false);
    };

    const onChangeCreateWorktreeMode = (newVal: string) => {
      setCreateWorktreeMode(newVal);
    };

    const onFinish = (values: any) => {
      let worktreeName: any;
      if (createWorktreeMode === 'new-branch') {
        worktreeName = values.name;
      } else if (createWorktreeMode === 'existing-branch') {
        worktreeName = values['existing-branch'];
      } else {
        worktreeName = values['existing-tag'];
      }
      let command: string;
      if (createWorktreeMode === 'existing-branch') {
        command = `git worktree add ../${worktreeName} ${worktreeName}`;
      } else if (createWorktreeMode === 'existing-tag') {
        command = `git checkout -b ${worktreeName} 744dbb837b809e41fee306c1dafe7d28d1b544c7`;
      } else {
        command = `git worktree add ../${worktreeName}`;
      }
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
      setLoadingCreateWorktree(true);
      ipcRenderer.send(
        'create-worktree',
        worktreeName,
        worktreesFolder + pathSeparator + worktreeName,
        createWorktreeMode,
        tabRepoPath,
      );
    };

    const ShowGitLog = () => {
      setOpenGitLog(true);
    };

    const onCloseGitLog = () => {
      setOpenGitLog(false);
    };

    useHotkeys('shift+g', () => setOpenGitLog(true), {
      preventDefault: true,
    });

    const ShowGitDiff = () => {
      setOpenGitDiff(true);
    };

    const onCloseGitDiff = () => {
      setOpenGitDiff(false);
    };

    useHotkeys('shift+d', () => setOpenGitDiff(true), {
      preventDefault: true,
    });

    const getWorktreeName = () => {
      if (createWorktreeMode === 'new-branch') {
        return form.getFieldValue('name') || ' ';
      }
      if (createWorktreeMode === 'existing-branch') {
        return form.getFieldValue('existing-branch') || ' ';
      }
      if (createWorktreeMode === 'existing-tag') {
        const tag = form.getFieldValue('existing-tag');
        if (tag) {
          return tag.replaceAll('.', '-');
        }
        return ' ';
      }
      return '';
    };

    const chooseWorktreesDir = () => {
      ipcRenderer.send('choose-worktrees-dir');
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
                    title={
                      <Space>
                        <span>Prune worktrees</span>
                        <small style={{ color: 'grey' }}>Shift+P</small>
                      </Space>
                    }
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
            {openGitLog && (
              <GitLog isModalOpen={openGitLog} handleCancel={onCloseGitLog} />
            )}
            {openGitDiff && (
              <GitDiff
                isModalOpen={openGitDiff}
                handleCancel={onCloseGitDiff}
              />
            )}
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
                    label: <div style={{ padding: 2 }}>new worktree</div>,
                    value: 'new-branch',
                  },
                  {
                    label: <div style={{ padding: 2 }}>from branch</div>,
                    value: 'existing-branch',
                  },
                  {
                    label: <div style={{ padding: 2 }}>from tag</div>,
                    value: 'existing-tag',
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
                      allowClear
                      showSearch
                      placeholder="Select branch"
                      options={branches}
                    />
                  </Form.Item>
                )}
                {createWorktreeMode === 'existing-tag' && (
                  <Form.Item
                    label="Existing tag"
                    name="existing-tag"
                    extra="A new branch is created from the selected tag, and a worktree is linked to it"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'Please choose a tag.',
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
                      allowClear
                      showSearch
                      placeholder="Select tag"
                      options={tags}
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
                <Form.Item extra="The worktree will be created at the specified directory">
                  <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
                    <Tooltip
                      mouseEnterDelay={0}
                      mouseLeaveDelay={0}
                      title="Change location"
                      placement="bottom"
                    >
                      <Button
                        size="small"
                        icon={<FolderOutlined />}
                        onClick={chooseWorktreesDir}
                      />
                    </Tooltip>
                    <Tooltip
                      mouseEnterDelay={0}
                      mouseLeaveDelay={0}
                      title={
                        worktreesFolder +
                        pathSeparator +
                        form.getFieldValue('name')
                      }
                      placement="bottom"
                    >
                      <Typography.Text
                        code
                        ellipsis={{ rows: 1 }}
                        style={{ direction: 'rtl' }}
                      >
                        {worktreesFolder + pathSeparator + getWorktreeName()}
                      </Typography.Text>
                    </Tooltip>
                  </div>
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    style={{ width: '100%' }}
                    loading={loadingCreateWorktree}
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
            <Divider style={{ margin: 0 }} />
            <ul style={{ marginTop: 0, paddingLeft: '0' }}>
              <li
                key="git-log"
                style={{
                  color: token.colorTextBase,
                  cursor: 'pointer',
                }}
              >
                <Tooltip
                  title={<small>Shift+G</small>}
                  placement="right"
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <Button
                    type="text"
                    block
                    onClick={ShowGitLog}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 0,
                      textAlign: 'left',
                      paddingLeft: '8px',
                      fontWeight: 'bold',
                    }}
                    icon={<GitBranchIcon size={16} />}
                  >
                    Git Log
                  </Button>
                </Tooltip>
              </li>
              <li
                key="git-diff"
                style={{
                  color: token.colorTextBase,
                  cursor: 'pointer',
                }}
              >
                <Tooltip
                  title={<small>Shift+D</small>}
                  placement="right"
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <Button
                    type="text"
                    block
                    onClick={ShowGitDiff}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 0,
                      textAlign: 'left',
                      paddingLeft: '8px',
                      fontWeight: 'bold',
                    }}
                    icon={<GitCompareIcon size={16} />}
                  >
                    Git Diff
                  </Button>
                </Tooltip>
              </li>
            </ul>
            <div
              style={{
                position: 'absolute',
                bottom: '46px',
                width: '100%',
                padding: '16px',
              }}
            >
              <PackInfos isDarkMode={isDarkMode} />
            </div>
            <Tag
              style={{
                position: 'absolute',
                bottom: '12px',
                left: 'calc(50% - 25px)',
                zIndex: 8,
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
