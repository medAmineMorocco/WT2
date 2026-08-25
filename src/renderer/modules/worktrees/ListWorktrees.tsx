import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Tooltip,
  Space,
  theme,
  App as AntdApp,
  Form,
  Dropdown,
  notification,
  Button,
  Collapse,
  Avatar,
  Spin,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  MoreOutlined,
  EditOutlined,
  FolderOpenOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  ExportOutlined,
  LockOutlined,
  UnlockOutlined,
  CodeOutlined,
  CloseOutlined,
  LoadingOutlined,
  FieldStringOutlined,
  SyncOutlined,
  ClearOutlined,
  ToolOutlined,
  RobotOutlined,
  SisternodeOutlined,
} from '@ant-design/icons';
import { FolderEditIcon, Tree02Icon } from 'hugeicons-react';
import log from 'electron-log';
import { useHotkeys } from 'react-hotkeys-hook';
import TabService from '../../services/tab/TabService';
import { editorIconsMap, editorsCst } from '../config/EditorsConfig';
import type { TerminalAgentActivity } from '../terminal/TerminalInteractive';
import { useItemsContext } from '../../TabsContext';
import { getAiAgentIcon } from '../../components/aiAgents/AiAgentIcons';

const TerminalInteractive = lazy(
  () => import('../terminal/TerminalInteractive'),
);
const RenameWorktree = lazy(() => import('./RenameWorktree'));
const MoveWorktree = lazy(() => import('./MoveWorktree'));
const ChangePatternWorktree = lazy(() => import('./ChangePatternWorktree'));

const { useToken } = theme;

type ActiveAgent = TerminalAgentActivity['agent'];

export default function ListWorktrees({
  isDarkMode,
  ref,
  showModal,
}: {
  isDarkMode: boolean;
  ref: any;
  showModal: any;
}) {
  const { token } = useToken();

  const { modal } = AntdApp.useApp();

  const [api, contextHolder] = notification.useNotification();

  const [form] = Form.useForm();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const [isChangePatternModalOpen, setIsChangePatternModalOpen] =
    useState(false);

  const [worktrees, setWorktrees] = useState([]);

  const [openTerminalModal, setOpenTerminalModal] = useState(false);
  const [repositoryInTerminal, setRepositoryInTerminal] = useState<
    string | null
  >(null);
  const [terminalInitialMode, setTerminalInitialMode] = useState<
    'terminal' | 'agent'
  >('terminal');

  const [activeAgentsByWorktree, setActiveAgentsByWorktree] = useState<
    Record<string, Record<string, ActiveAgent>>
  >({});

  const [enabledEditors, setEnabledEditors] = useState([]);

  const [loadingRenameWorktree, setLoadingRenameWorktree] = useState(false);

  const [loadingMoveWorktree, setLoadingMoveWorktree] = useState(false);

  const [loadingChangePatternWorktree, setLoadingChangePatternWorktree] =
    useState(false);

  const [pruneLoading, setPruneLoading] = useState<boolean>(false);

  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);

  const { isWorkflowPlaying } = useItemsContext();

  const onTerminalAgentActivity = useCallback(
    ({ terminalId, worktreePath, agent, active }: TerminalAgentActivity) => {
      setActiveAgentsByWorktree((current) => {
        const next = { ...current };
        const activeForWorktree = { ...(next[worktreePath] || {}) };
        if (active) activeForWorktree[terminalId] = agent;
        else delete activeForWorktree[terminalId];

        if (Object.keys(activeForWorktree).length === 0)
          delete next[worktreePath];
        else next[worktreePath] = activeForWorktree;
        return next;
      });
    },
    [],
  );

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    const storedEditors = window.localStorage.getItem('editors');
    const editors = storedEditors
      ? JSON.parse(storedEditors)
      : JSON.parse(JSON.stringify(editorsCst));
    const enabledEditorsReceived = editors
      .filter((editor: any) => editor.enabled === true)
      .map((editor: any) => {
        editor.icon = {
          // @ts-ignore
          ...editorIconsMap[editor.icon],
          props: {
            width: '24px',
            height: '24px',
          },
        };
        return editor;
      });
    setEnabledEditors(enabledEditorsReceived);
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);

    const onOpenEditorError = (error: any) => {
      notification.error({
        message: 'Error During Web Editor Launch',
        description: error,
        placement: 'bottomLeft',
      });
    };

    const onWorktreesFound = (code: number, result: any) => {
      log.debug(`worktrees found: ${result}`);
      setRefreshLoading(false);
      if (code === 0) {
        setWorktrees(JSON.parse(result));
      } else {
        notification.error({
          message: 'Unable to Fetch Worktrees',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeRemoved = (
      code: number,
      result: any,
      worktreePath: string,
      worktreeName: string,
      withLocalBranch: boolean,
    ) => {
      log.debug(`onWorktreeRemoved: code: ${code} result: ${result}`);
      if (code === 0) {
        setTimeout(() => {
          api.success({
            key: 'updatable',
            message: 'Worktree Successfully Removed',
            placement: 'bottomLeft',
            duration: 0.5,
          });
          setTimeout(() => {
            api.destroy('updatable');
          }, 1500);
        }, 50);
        window.electron.ipcRenderer.send('show-git-log', tabRepoPath);
        window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
      } else if (result.includes('--force')) {
        setTimeout(() => {
          api.destroy('updatable');
          modal.confirm({
            title: withLocalBranch
              ? 'changes have been found in the worktree. Confirm deletion of this worktree and local branch ?'
              : 'changes have been found in the worktree. Confirm deletion of this worktree ?',
            icon: <ExclamationCircleFilled />,
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            centered: true,
            onOk() {
              if (withLocalBranch) {
                api.open({
                  key: 'updatable',
                  icon: <LoadingOutlined />,
                  message:
                    'Your worktree is being deleted. Please wait a moment while we complete the process.',
                  placement: 'bottomLeft',
                  duration: 0.5,
                });
                window.electron.ipcRenderer.send(
                  'remove-worktree-local-branch',
                  worktreeName,
                  worktreePath,
                  tabRepoPath,
                  true,
                );
              } else {
                api.open({
                  key: 'updatable',
                  icon: <LoadingOutlined />,
                  message:
                    'Your worktree is being deleted. Please wait a moment while we complete the process.',
                  placement: 'bottomLeft',
                  duration: 0.5,
                });
                window.electron.ipcRenderer.send(
                  'remove-worktree',
                  worktreeName,
                  worktreePath,
                  tabRepoPath,
                  true,
                );
              }
            },
          });
        }, 500);
      } else {
        setTimeout(() => {
          api.error({
            key: 'updatable',
            message: 'Unable to Remove Worktree',
            description: result,
            placement: 'bottomLeft',
          });
        }, 500);
      }
    };

    const onWorktreeRenamed = (code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'The worktree has been renamed',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        setLoadingRenameWorktree(false);
        setIsModalOpen(false);
        window.electron.ipcRenderer.send('show-git-log', tabRepoPath);
        window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        setLoadingRenameWorktree(false);
        notification.error({
          message: 'Unable to Rename Worktree',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeChangedLock = (
      code: number,
      toLock: boolean,
      result: any,
    ) => {
      if (code === 0) {
        notification.success({
          message: toLock
            ? 'Access to the worktree has been successfully restricted'
            : 'Access to the worktree has been successfully restored',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        notification.error({
          message: toLock
            ? 'Unable to Lock Worktree'
            : 'Unable to Unlock Worktree',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeMoved = (code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'The worktree has been moved',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        setLoadingMoveWorktree(false);
        setLoadingChangePatternWorktree(false);
        setIsMoveModalOpen(false);
        setIsChangePatternModalOpen(false);
        window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        setLoadingMoveWorktree(false);
        setLoadingChangePatternWorktree(false);
        notification.error({
          message: 'Unable to Move Worktree to folder',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreesPruned = (code: number, result: any) => {
      setTimeout(() => {
        setPruneLoading(false);
        window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
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

    const onMovedWorktreesSelectedForRepair = (
      paths: string[],
      selectionMode: 'single' | 'multiple',
    ) => {
      if (!paths?.length) return;
      window.electron.ipcRenderer.send(
        'repair-moved-worktrees',
        tabRepoPath,
        selectionMode === 'single' ? [paths[0]] : paths,
      );
    };

    const onMovedWorktreesRepaired = (code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'Git worktree metadata repaired',
          description:
            'Git now points to the selected relocated worktree folder(s).',
          placement: 'bottomLeft',
          duration: 2,
        });
        window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        notification.error({
          message: 'Unable to repair moved worktrees',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    window.electron.ipcRenderer.on('open-editor-error', onOpenEditorError);
    window.electron.ipcRenderer.on('worktrees-found', onWorktreesFound);
    window.electron.ipcRenderer.on('worktree-removed', onWorktreeRemoved);
    window.electron.ipcRenderer.on('worktree-renamed', onWorktreeRenamed);
    window.electron.ipcRenderer.on(
      'worktrees-changed-lock',
      onWorktreeChangedLock,
    );
    window.electron.ipcRenderer.on('worktree-moved-to-folder', onWorktreeMoved);
    window.electron.ipcRenderer.on('worktrees-pruned', onWorktreesPruned);
    window.electron.ipcRenderer.on(
      'moved-worktrees-selected-for-repair',
      onMovedWorktreesSelectedForRepair,
    );
    window.electron.ipcRenderer.on(
      'moved-worktrees-repaired',
      onMovedWorktreesRepaired,
    );

    return () => {
      window.electron.ipcRenderer.removeAllListeners('open-editor-error');
      window.electron.ipcRenderer.removeAllListeners('worktrees-found');
      window.electron.ipcRenderer.removeAllListeners('worktree-removed');
      window.electron.ipcRenderer.removeAllListeners('worktree-renamed');
      window.electron.ipcRenderer.removeAllListeners('worktrees-changed-lock');
      window.electron.ipcRenderer.removeAllListeners(
        'worktree-moved-to-folder',
      );
      window.electron.ipcRenderer.removeAllListeners('worktrees-pruned');
      window.electron.ipcRenderer.removeAllListeners(
        'moved-worktrees-selected-for-repair',
      );
      window.electron.ipcRenderer.removeAllListeners(
        'moved-worktrees-repaired',
      );
    };
  }, [api, modal, tabRepoPath]);

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const onFinish = () => {
    setLoadingRenameWorktree(true);
    window.electron.ipcRenderer.send(
      'rename-worktree',
      form.getFieldValue('oldWorktreeName'),
      form.getFieldValue('newWorktreeName'),
      form.getFieldValue('oldWorktreePath'),
      tabRepoPath,
    );
  };

  const handleCancelMoveWorktree = () => {
    setIsMoveModalOpen(false);
  };

  const onFinishMoveWorktree = () => {
    setLoadingMoveWorktree(true);
    window.electron.ipcRenderer.send(
      'move-worktree-to-folder',
      form.getFieldValue('nameWorktreeToMove'),
      form.getFieldValue('newWorktreePath'),
      form.getFieldValue('oldPathWorktreeToMove'),
      tabRepoPath,
    );
  };

  const onFinishChangePatternWorktree = () => {
    setLoadingChangePatternWorktree(true);
    window.electron.ipcRenderer.send(
      'move-worktree-to-folder',
      form.getFieldValue('worktreeToChange').name,
      form.getFieldValue('worktreeToChangePatternNewPath'),
      form.getFieldValue('worktreeToChange').path,
      tabRepoPath,
    );
  };

  const handleCancelChangePatternWorktree = () => {
    setIsChangePatternModalOpen(false);
  };

  const getWorktreeMenuItems = (worktree: any): MenuProps['items'] => {
    const isLocked = worktree.isLocked;
    const isPrimary = worktree.isPrimary;
    const isHealthy = worktree.directoryExists !== false && !worktree.prunable;

    const editorItems = enabledEditors.map((editor: any) => ({
      key: `editor:${editor.name || editor.key}`,
      label: editor.name || editor.label,
      icon: editor.icon ? React.cloneElement(editor.icon) : <CodeOutlined />,
    }));

    return [
      {
        key: 'open-explorer',
        label: 'Open in Explorer',
        icon: <ExportOutlined />,
        disabled: !isHealthy,
      },
      {
        key: 'open-terminal',
        label: 'Open in Terminal',
        icon: <CodeOutlined />,
        disabled: !isHealthy,
      },
      {
        key: 'work-agent',
        label: 'Work with AI Agent',
        icon: <RobotOutlined />,
        disabled: !isHealthy,
      },
      {
        key: 'open-in',
        label: 'Open in',
        icon: <FolderOpenOutlined />,
        children: editorItems.length > 0 ? editorItems : undefined,
        disabled: !isHealthy || editorItems.length === 0,
      },
      {
        key: 'copy',
        label: 'Copy',
        icon: <CopyOutlined />,
        children: [
          {
            key: 'copy-name',
            label: 'name',
          },
          {
            key: 'copy-path',
            label: 'path',
          },
        ],
      },
      {
        key: 'rename',
        label: 'Rename',
        icon: <EditOutlined />,
        disabled: isLocked || isPrimary || !isHealthy,
      },
      {
        key: 'change-pattern',
        label: 'Change Naming Pattern',
        icon: <FieldStringOutlined />,
        disabled: isLocked || isPrimary || !isHealthy,
      },
      {
        key: 'change-folder',
        label: 'Change Folder',
        icon: <FolderEditIcon size={16} />,
        disabled: isLocked || isPrimary || !isHealthy,
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: <DeleteOutlined />,
        disabled: isLocked || isPrimary || !isHealthy,
        children: [
          {
            key: 'delete-worktree',
            label: 'worktree',
          },
          {
            key: 'delete-worktree-branch',
            label: 'worktree and local branch',
          },
        ],
      },
      isLocked
        ? {
            key: 'unlock',
            label: 'Unlock',
            icon: <UnlockOutlined />,
            disabled: isPrimary || !isHealthy,
          }
        : {
            key: 'lock',
            label: 'Lock',
            icon: <LockOutlined />,
            disabled: isPrimary || !isHealthy,
          },
      {
        key: 'repair',
        label: 'Repair',
        icon: <ToolOutlined />,
        disabled: isPrimary || isHealthy,
      },
    ];
  };

  const closeTerminalModal = () => {
    setRepositoryInTerminal(null);
    setTerminalInitialMode('terminal');
    setOpenTerminalModal(false);
  };

  const handleWorktreeMenuClick =
    (worktree: any) =>
    ({ key }: { key: string }) => {
      const isHealthy =
        worktree.directoryExists !== false && !worktree.prunable;
      if (
        !isHealthy &&
        key !== 'repair' &&
        key !== 'copy-name' &&
        key !== 'copy-path'
      ) {
        return;
      }
      if (key === 'open-explorer') {
        window.electron.ipcRenderer.send('open-explorer', worktree.path);
        return;
      }
      if (key === 'open-terminal') {
        setRepositoryInTerminal(worktree.path);
        setTerminalInitialMode('terminal');
        setOpenTerminalModal(true);
        return;
      }
      if (key === 'work-agent') {
        setRepositoryInTerminal(worktree.path);
        setTerminalInitialMode('agent');
        setOpenTerminalModal(true);
        return;
      }
      if (key.startsWith('editor:')) {
        const editorName = key.replace('editor:', '');
        window.electron.ipcRenderer.send(
          'open-editor',
          editorName,
          worktree.path,
          tabRepoPath,
        );
        return;
      }
      if (key === 'copy-name') {
        navigator.clipboard.writeText(worktree.name);
        return;
      }
      if (key === 'copy-path') {
        navigator.clipboard.writeText(worktree.path);
        return;
      }
      if (key === 'rename') {
        setIsModalOpen(true);
        form.setFieldValue('oldWorktreeName', worktree.name);
        form.setFieldValue('oldWorktreePath', worktree.path);
        form.setFieldValue('newWorktreeName', worktree.name);
        return;
      }
      if (key === 'change-pattern') {
        setIsChangePatternModalOpen(true);
        form.setFieldValue('worktreeToChange', worktree);
        form.setFieldValue('repo', tabRepoPath);
        return;
      }
      if (key === 'change-folder') {
        setIsMoveModalOpen(true);
        form.setFieldValue('nameWorktreeToMove', worktree.name);
        form.setFieldValue('newWorktreePath', worktree.path);
        form.setFieldValue('oldPathWorktreeToMove', worktree.path);
        form.setFieldValue('resolvedName', worktree.resolvedName);
        return;
      }
      if (key === 'delete-worktree') {
        api.open({
          key: 'updatable',
          icon: <LoadingOutlined />,
          message:
            'Your worktree is being deleted. Please wait a moment while we complete the process.',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        window.electron.ipcRenderer.send(
          'remove-worktree',
          worktree.name,
          worktree.path,
          tabRepoPath,
          false,
        );
        return;
      }
      if (key === 'delete-worktree-branch') {
        api.open({
          key: 'updatable',
          icon: <LoadingOutlined />,
          message:
            'Your worktree is being deleted. Please wait a moment while we complete the process.',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        window.electron.ipcRenderer.send(
          'remove-worktree-local-branch',
          worktree.name,
          worktree.path,
          tabRepoPath,
          false,
        );
        return;
      }
      if (key === 'lock') {
        window.electron.ipcRenderer.send(
          'change-lock-worktree',
          true,
          worktree.path,
          tabRepoPath,
        );
        return;
      }
      if (key === 'unlock') {
        window.electron.ipcRenderer.send(
          'change-lock-worktree',
          false,
          worktree.path,
          tabRepoPath,
        );
        return;
      }
      if (key === 'repair') {
        window.electron.ipcRenderer.send(
          'choose-moved-worktrees-for-repair',
          false,
        );
      }
    };

  const onClickRefresh = (event: any) => {
    event.stopPropagation();
    setRefreshLoading(true);
    window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
  };

  const onClickPrune = (event: any) => {
    event.stopPropagation();
    setPruneLoading(true);
    window.electron.ipcRenderer.send('prune-worktrees', tabRepoPath);
  };

  useHotkeys('shift+p', onClickPrune, {
    preventDefault: true,
  });

  useHotkeys('shift+r', onClickRefresh, {
    preventDefault: true,
  });

  return (
    <Collapse ghost defaultActiveKey={['1']}>
      <Collapse.Panel
        extra={
          <Space style={{ marginRight: '6px' }}>
            {!refreshLoading ? (
              <Tooltip
                title={
                  <Space>
                    <span>Refresh Worktrees</span>
                    <small style={{ color: 'grey' }}>Shift+R</small>
                  </Space>
                }
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <SyncOutlined
                  className="icon-action"
                  style={{ cursor: 'pointer' }}
                  onClick={onClickRefresh}
                />
              </Tooltip>
            ) : (
              <LoadingOutlined />
            )}
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
                <ClearOutlined
                  className="icon-action"
                  style={{ cursor: 'pointer' }}
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
        {contextHolder}
        <ul style={{ margin: '0', paddingLeft: '8px', paddingRight: '2px' }}>
          {worktrees.map((worktree: any) => (
            <li
              key={worktree.name}
              className={!isDarkMode ? 'worktree-item' : 'worktree-item-dark'}
              style={{
                color: token.colorTextBase,
              }}
            >
              <Space
                className="worktree-container"
                style={{ overflowX: 'hidden', whiteSpace: 'nowrap' }}
              >
                {/* eslint-disable-next-line no-nested-ternary */}
                {worktree.isLocked ? (
                  <LockOutlined />
                ) : worktree.prunable ? (
                  <Tooltip
                    title="Gitdir file points to non-existent location"
                    placement="right"
                    mouseEnterDelay={0}
                    mouseLeaveDelay={0}
                  >
                    <CloseOutlined style={{ color: token.colorError }} />
                  </Tooltip>
                ) : (
                  <Tree02Icon size={18} />
                )}
                <span
                  style={{ color: worktree.prunable ? token.colorError : '' }}
                >
                  <Tooltip
                    title={worktree.name}
                    placement="right"
                    mouseEnterDelay={0}
                    mouseLeaveDelay={0}
                  >
                    {worktree.name}
                  </Tooltip>
                </span>
                {Object.values(activeAgentsByWorktree[worktree.path] || {})
                  .length > 0 && (
                  <Avatar.Group
                    size={18}
                    max={{
                      count: 2,
                      style: { color: '#fff', backgroundColor: '#722ed1' },
                    }}
                  >
                    {Object.values(
                      activeAgentsByWorktree[worktree.path] || {},
                    ).map((agent) => (
                      <Tooltip
                        title={`${agent.label} is running`}
                        key={agent.id}
                      >
                        <Avatar
                          size={18}
                          className="agent-working-icon"
                          style={{ backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {getAiAgentIcon(agent.id, 18)}
                        </Avatar>
                      </Tooltip>
                    ))}
                  </Avatar.Group>
                )}
              </Space>
              <Dropdown
                menu={{
                  items: getWorktreeMenuItems(worktree),
                  onClick: handleWorktreeMenuClick(worktree),
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Tooltip
                  title="actions"
                  placement="right"
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <MoreOutlined style={{ cursor: 'pointer', padding: '2px 4px' }} />
                </Tooltip>
              </Dropdown>
            </li>
          ))}
        </ul>
        {openTerminalModal && (
          <Suspense fallback={<Spin size="large" />}>
            <TerminalInteractive
              isModalOpen={openTerminalModal}
              initialRepository={repositoryInTerminal}
              worktrees={worktrees}
              handleCancel={closeTerminalModal}
              isDarkMode={isDarkMode}
              onAgentActivity={onTerminalAgentActivity}
              initialMode={terminalInitialMode}
            />
          </Suspense>
        )}
        {isModalOpen && (
          <Suspense fallback={<Spin size="large" />}>
            <RenameWorktree
              isModalOpen={isModalOpen}
              form={form}
              onFinish={onFinish}
              handleCancel={handleCancel}
              loading={loadingRenameWorktree}
            />
          </Suspense>
        )}
        {isMoveModalOpen && (
          <Suspense fallback={<Spin size="large" />}>
            <MoveWorktree
              isModalOpen={isMoveModalOpen}
              form={form}
              onFinish={onFinishMoveWorktree}
              handleCancel={handleCancelMoveWorktree}
              loading={loadingMoveWorktree}
            />
          </Suspense>
        )}
        {isChangePatternModalOpen && (
          <Suspense fallback={<Spin size="large" />}>
            <ChangePatternWorktree
              isModalOpen={isChangePatternModalOpen}
              form={form}
              onFinish={onFinishChangePatternWorktree}
              handleCancel={handleCancelChangePatternWorktree}
              loading={loadingChangePatternWorktree}
            />
          </Suspense>
        )}
      </Collapse.Panel>
    </Collapse>
  );
}
