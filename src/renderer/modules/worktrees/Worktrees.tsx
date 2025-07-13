import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Form,
  Layout,
  Tooltip,
  Space,
  App as AntdApp,
  Tag,
  theme,
  Collapse,
  Modal,
  Radio,
} from 'antd';
import {
  SisternodeOutlined,
  SyncOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import ListWorktrees from './ListWorktrees';
import TabService from '../../services/tab/TabService';
import GitLog from '../gitLog/GitLog';
import PackInfos from '../packInfos/PackInfos';
import GitDiff from '../gitDiff/GitDiff';
import AddWorktree from './AddWorktree';
import { useItemsContext } from '../../TabsContext';

const { Sider } = Layout;
const { useToken } = theme;

const optionsWithDisabled = [
  { label: 'Git Log', value: 'GIT_LOG' },
  { label: 'Workflow', value: 'WORKFLOW' },
];

const Worktrees = forwardRef<
  HTMLDivElement,
  { isDarkMode: boolean; mode: string; onChangeMode: any }
>(({ isDarkMode, mode, onChangeMode }, ref) => {
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
            message: 'Unable to Prune Worktree',
            description: result,
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

  const showModal = (event: any) => {
    if (event) {
      event.stopPropagation();
    }
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
        showModal(null);
      } else {
        showModal(null);
      }
    },
    { preventDefault: true },
  );
  useHotkeys('shift+c', () => setCollapsed(!collapsed), {
    preventDefault: true,
  });

  const onClickPrune = (event: any) => {
    event.stopPropagation();
    setPruneLoading(true);
    ipcRenderer.send('prune-worktrees', tabRepoPath);
  };

  useHotkeys('shift+p', onClickPrune, {
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
          <Collapse ghost defaultActiveKey={['1']}>
            <Collapse.Panel
              extra={
                <Space>
                  {!pruneLoading ? (
                    <Tooltip
                      title={
                        <Space>
                          <span>Prune Worktrees</span>
                          <small style={{ color: 'grey' }}>Shift+P</small>
                        </Space>
                      }
                      mouseEnterDelay={0}
                      mouseLeaveDelay={0}
                    >
                      <SyncOutlined
                        className="icon-action"
                        style={{ cursor: 'pointer', color: 'red' }}
                        onClick={onClickPrune}
                      />
                    </Tooltip>
                  ) : (
                    <LoadingOutlined />
                  )}
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
                </Space>
              }
              header={<strong>Worktrees</strong>}
              className="worktrees-panel-header"
              key="1"
            >
              <ListWorktrees isDarkMode={isDarkMode} />
            </Collapse.Panel>
          </Collapse>
          {openGitLog && (
            <Modal
              open={openGitLog}
              footer={null}
              onCancel={onCloseGitLog}
              destroyOnClose
              className="git-log-modal"
              width="calc(100% - 216px)"
              style={{
                position: 'absolute',
                right: '8px',
                top: '48px',
                height: 'calc(100% - 56px)',
                paddingBottom: 0,
              }}
            >
              <GitLog isModal />
            </Modal>
          )}
          {openGitDiff && (
            <GitDiff isModalOpen={openGitDiff} handleCancel={onCloseGitDiff} />
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
          <ul style={{ marginTop: 0, paddingLeft: '0' }}>
            {mode === 'WORKFLOW' && (
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
                      justifyContent: 'flex-start',
                      borderRadius: 0,
                      paddingLeft: '8px',
                      fontWeight: 'bold',
                    }}
                  >
                    Git Log
                  </Button>
                </Tooltip>
              </li>
            )}
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
                    justifyContent: 'flex-start',
                    borderRadius: 0,
                    paddingLeft: '8px',
                    fontWeight: 'bold',
                  }}
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
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Radio.Group
                  options={optionsWithDisabled}
                  onChange={onChangeMode}
                  value={mode}
                  optionType="button"
                  buttonStyle="solid"
                />
              </div>
              <PackInfos />
            </Space>
          </div>
          <Tag
            style={{
              position: 'absolute',
              bottom: '12px',
              left: 'calc(50% - 25px)',
              zIndex: 8,
            }}
          >
            {window.localStorage.getItem('VERSION') || ''}
          </Tag>
        </>
      )}
    </Sider>
  );
});

export default Worktrees;
