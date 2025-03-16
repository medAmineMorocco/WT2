import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Form,
  Layout,
  Tooltip,
  Space,
  App as AntdApp,
  Typography,
  Tag,
  theme,
  Divider,
} from 'antd';
import {
  SisternodeOutlined,
  SyncOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import { GitBranchIcon, GitCompareIcon } from 'hugeicons-react';
import ListWorktrees from './ListWorktrees';
import TabService from '../../services/tab/TabService';
import GitLog from '../gitLog/GitLog';
import PackInfos from '../packInfos/PackInfos';
import GitDiff from '../gitDiff/GitDiff';
import AddWorktree from './AddWorktree';
import { useItemsContext } from '../../TabsContext';

const { Sider } = Layout;
const { useToken } = theme;

const Worktrees = forwardRef<HTMLDivElement, { isDarkMode: boolean }>(
  ({ isDarkMode }, ref) => {
    const { token } = useToken();
    const [collapsed, setCollapsed] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [form] = Form.useForm();

    const { notification } = AntdApp.useApp();

    const activeTab = useMemo(() => TabService.getActiveTab(), []);

    const [pruneLoading, setPruneLoading] = useState<boolean>(false);

    const [openGitLog, setOpenGitLog] = useState(false);

    const [openGitDiff, setOpenGitDiff] = useState(false);

    const { isWorkflowPlaying } = useItemsContext();

    const tabRepoPath = useMemo(() => {
      return TabService.getTabRepoPath(activeTab);
    }, [activeTab]);

    useEffect(() => {
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

      ipcRenderer.on('worktrees-pruned', onWorktreesPruned);

      return () => {
        ipcRenderer.removeAllListeners('worktrees-pruned');
      };
    }, [form, notification, tabRepoPath]);

    const showModal = () => {
      setIsModalOpen(true);
    };

    useHotkeys(
      'shift+w',
      () => {
        if (isWorkflowPlaying) {
          return;
        }
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

    const handleCancel = () => {
      setIsModalOpen(false);
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
                    <span>Add New Worktree</span>
                    <small style={{ color: 'grey' }}>Shift+W</small>
                  </Space>
                }
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <Button
                  type="primary"
                  size="small"
                  disabled={isWorkflowPlaying}
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
            {isModalOpen && (
              <AddWorktree
                isModalOpen={isModalOpen}
                handleCancel={handleCancel}
              />
            )}
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
              <PackInfos />
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
