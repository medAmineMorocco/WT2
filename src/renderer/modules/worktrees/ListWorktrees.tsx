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
  Checkbox,
  Avatar,
  Spin,
  Modal,
  Typography,
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
  WarningOutlined,
  SettingOutlined,
  BranchesOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { FolderEditIcon, Tree02Icon } from 'hugeicons-react';
import log from 'electron-log';
import { useHotkeys } from 'react-hotkeys-hook';
import TabService from '../../services/tab/TabService';
import { editorIconsMap, editorsCst } from '../config/EditorsConfig';
import type { TerminalAgentActivity } from '../terminal/TerminalInteractive';
import { useItemsContext } from '../../TabsContext';
import { getAiAgentIcon } from '../../components/aiAgents/AiAgentIcons';
import { WorktreeRebaseResult } from '../../../shared/worktreeRebase';
import { WorktreeMergeResult } from '../../../shared/worktreeMerge';

const TerminalInteractive = lazy(
  () => import('../terminal/TerminalInteractive'),
);
const RenameWorktree = lazy(() => import('./RenameWorktree'));
const LockWorktree = lazy(() => import('./LockWorktree'));
const MoveWorktree = lazy(() => import('./MoveWorktree'));
const ChangePatternWorktree = lazy(() => import('./ChangePatternWorktree'));
const WorktreeGitConfig = lazy(() => import('./WorktreeGitConfig'));
const RebaseWorktree = lazy(() => import('./RebaseWorktree'));
const MergeWorktree = lazy(() => import('./MergeWorktree'));
const RemotesList = lazy(() => import('../remotes/RemotesList'));
const SetupUpstreamModal = lazy(() => import('./SetupUpstreamModal'));

const { useToken } = theme;

type ActiveAgent = TerminalAgentActivity['agent'];

function worktreeActivityKey(worktreePath: string) {
  const normalized = worktreePath.replace(/\\/g, '/').replace(/\/+$/, '');
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}

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
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const [isChangePatternModalOpen, setIsChangePatternModalOpen] =
    useState(false);

  const [worktrees, setWorktrees] = useState([]);
  const [worktreesActiveKey, setWorktreesActiveKey] = useState<string[]>(['1']);
  const [remotesActiveKey, setRemotesActiveKey] = useState<string[]>(['remotes']);

  const isWorktreesExpanded = worktreesActiveKey.includes('1');
  const isRemotesExpanded = remotesActiveKey.includes('remotes');

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
  const [loadingLockWorktree, setLoadingLockWorktree] = useState(false);

  const [loadingMoveWorktree, setLoadingMoveWorktree] = useState(false);

  const [loadingChangePatternWorktree, setLoadingChangePatternWorktree] =
    useState(false);

  const [pruneLoading, setPruneLoading] = useState<boolean>(false);
  const [prunePreviewLoading, setPrunePreviewLoading] =
    useState<boolean>(false);
  const [pruneModalOpen, setPruneModalOpen] = useState(false);
  const [prunePreview, setPrunePreview] = useState<{
    output: string;
    worktrees: Array<{
      name: string;
      resolvedName: string;
      path: string;
      pruneReason?: string;
    }>;
  }>({ output: '', worktrees: [] });
  const [selectedPrunePaths, setSelectedPrunePaths] = useState<string[]>([]);

  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);
  const [rebaseSourceWorktree, setRebaseSourceWorktree] = useState<any | null>(
    null,
  );
  const [mergeTargetWorktree, setMergeTargetWorktree] = useState<any | null>(
    null,
  );
  const [configWorktree, setConfigWorktree] = useState<any | null>(null);
  const [upstreamWorktree, setUpstreamWorktree] = useState<any | null>(null);

  const { isWorkflowPlaying } = useItemsContext();

  const onTerminalAgentActivity = useCallback(
    ({ terminalId, worktreePath, agent, active }: TerminalAgentActivity) => {
      setActiveAgentsByWorktree((current) => {
        const worktreeKey = worktreeActivityKey(worktreePath);
        const next = { ...current };
        const activeForWorktree = { ...(next[worktreeKey] || {}) };
        if (active) activeForWorktree[terminalId] = agent;
        else delete activeForWorktree[terminalId];

        if (Object.keys(activeForWorktree).length === 0)
          delete next[worktreeKey];
        else next[worktreeKey] = activeForWorktree;
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
      setLoadingLockWorktree(false);
      if (code === 0) {
        notification.success({
          message: toLock
            ? 'Access to the worktree has been successfully restricted'
            : 'Access to the worktree has been successfully restored',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        if (toLock) setIsLockModalOpen(false);
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
          setPruneModalOpen(false);
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

  const lockWorktree = () => {
    setLoadingLockWorktree(true);
    window.electron.ipcRenderer.send(
      'change-lock-worktree',
      true,
      form.getFieldValue('lockWorktreePath'),
      tabRepoPath,
      form.getFieldValue('lockReason') || undefined,
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
    const rebaseCandidates = worktrees.filter(
      (item: any) =>
        item.directoryExists !== false &&
        !item.prunable &&
        Boolean(item.name) &&
        item.name !== 'DETACHED HEAD',
    );

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
        type: 'divider',
      },
      {
        key: 'rebase-worktree',
        label: 'Rebase…',
        icon: <SyncOutlined />,
        disabled:
          !isHealthy ||
          worktree.name === 'DETACHED HEAD' ||
          rebaseCandidates.length < 2,
      },
      {
        key: 'merge-worktree',
        label: 'Merge…',
        icon: <BranchesOutlined />,
        disabled:
          !isHealthy ||
          worktree.name === 'DETACHED HEAD' ||
          rebaseCandidates.length < 2,
      },
      {
        key: 'setup-upstream',
        label: 'Setup Upstream…',
        icon: <CloudUploadOutlined />,
        disabled: !isHealthy || worktree.name === 'DETACHED HEAD',
      },
      {
        key: 'configure-worktree-config',
        label: 'Worktree Git Config',
        icon: <SettingOutlined />,
        disabled: !isHealthy,
      },
      {
        type: 'divider',
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
        label: 'Move',
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

  const closeWorktreeGitConfig = useCallback(() => setConfigWorktree(null), []);

  const handleWorktreeGitConfigSaved = useCallback(
    (enabled: boolean) => {
      const worktreeName = configWorktree?.name || 'this worktree';
      setConfigWorktree(null);
      api.success({
        message: enabled
          ? 'Worktree Config Saved'
          : 'Per-Worktree Config Disabled',
        description: enabled
          ? `Git settings now apply only to ${worktreeName}.`
          : 'This repository now uses its shared Git configuration.',
        placement: 'bottomLeft',
        duration: 3,
      });
    },
    [api, configWorktree],
  );

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
      if (key === 'rebase-worktree') {
        setRebaseSourceWorktree(worktree);
        return;
      }
      if (key === 'merge-worktree') {
        setMergeTargetWorktree(worktree);
        return;
      }
      if (key === 'setup-upstream') {
        setUpstreamWorktree(worktree);
        return;
      }
      if (key === 'configure-worktree-config') {
        setConfigWorktree(worktree);
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
        form.setFieldValue('lockWorktreePath', worktree.path);
        form.setFieldValue('lockWorktreeName', worktree.name);
        form.setFieldValue('lockReason', '');
        setIsLockModalOpen(true);
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

  const onClickPrune = async (event: any) => {
    event.stopPropagation();
    setPrunePreviewLoading(true);
    try {
      const preview = await window.electron.ipcRenderer.invoke(
        'preview-prune-worktrees',
        tabRepoPath,
      );
      setPrunePreview(preview);
      setSelectedPrunePaths(
        preview.worktrees.map((worktree: { path: string }) => worktree.path),
      );
      setPruneModalOpen(true);
    } catch (error: any) {
      notification.error({
        message: 'Unable to inspect prunable worktrees',
        description: error?.message || String(error),
        placement: 'bottomLeft',
      });
    } finally {
      setPrunePreviewLoading(false);
    }
  };

  const confirmPrune = () => {
    setPruneLoading(true);
    window.electron.ipcRenderer.send(
      'prune-worktrees',
      tabRepoPath,
      selectedPrunePaths,
    );
  };

  useHotkeys('shift+p', onClickPrune, {
    preventDefault: true,
  });

  useHotkeys('shift+r', onClickRefresh, {
    preventDefault: true,
  });

  return (
    <div className="worktrees-sidebar-container worktrees-sidebar-scrollable">
      <div
        className="worktrees-section-panel"
        style={{
          flex:
            isWorktreesExpanded && isRemotesExpanded
              ? '60 1 0%'
              : isWorktreesExpanded
                ? '1 1 0%'
                : '0 0 auto',
        }}
      >
        <Collapse
          ghost
          activeKey={worktreesActiveKey}
          onChange={(keys) => {
            const normalized = Array.isArray(keys) ? keys : keys ? [keys] : [];
            setWorktreesActiveKey(normalized);
          }}
          className="sidebar-section-collapse"
        >
          <Collapse.Panel
            extra={
              <Space
                style={{ marginRight: '6px' }}
                onClick={(e) => e.stopPropagation()}
              >
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
            {!pruneLoading && !prunePreviewLoading ? (
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
        header={
          <Space size={6} className="worktrees-header-title">
            <strong className="worktrees-title-text">WORKTREES</strong>
            {worktrees.length > 0 && (
              <span className="worktrees-count-badge">{worktrees.length}</span>
            )}
          </Space>
        }
        className="worktrees-panel-header"
        key="1"
      >
        {contextHolder}
        <Modal
          className="prune-review-modal"
          width={620}
          title={
            <div className="prune-review-title">
              <span className="prune-review-title-icon">
                <WarningOutlined />
              </span>
              <span>
                <strong>Review Damaged Worktrees</strong>
                <small>
                  {prunePreview.worktrees.length}{' '}
                  {prunePreview.worktrees.length === 1
                    ? 'worktree requires attention'
                    : 'worktrees require attention'}
                </small>
              </span>
            </div>
          }
          open={pruneModalOpen}
          onCancel={() => {
            if (!pruneLoading) setPruneModalOpen(false);
          }}
          cancelText="Cancel"
          okText={'Prune Worktrees'}
          okButtonProps={{
            danger: true,
            disabled: selectedPrunePaths.length === 0,
            loading: pruneLoading,
          }}
          onOk={confirmPrune}
          centered
        >
          {prunePreview.worktrees.length > 0 ? (
            <>
              <div className="prune-selection-toolbar">
                <Checkbox
                  checked={
                    selectedPrunePaths.length === prunePreview.worktrees.length
                  }
                  indeterminate={
                    selectedPrunePaths.length > 0 &&
                    selectedPrunePaths.length < prunePreview.worktrees.length
                  }
                  onChange={(event) =>
                    setSelectedPrunePaths(
                      event.target.checked
                        ? prunePreview.worktrees.map((item) => item.path)
                        : [],
                    )
                  }
                >
                  Select all
                </Checkbox>
                <Typography.Text type="secondary">
                  {selectedPrunePaths.length} selected
                </Typography.Text>
              </div>
              <div className="prune-worktree-list">
                {prunePreview.worktrees.map((worktree) => {
                  const selected = selectedPrunePaths.includes(worktree.path);
                  return (
                    <div
                      className={`prune-worktree-item ${selected ? 'selected' : ''}`}
                      key={worktree.path}
                      role="checkbox"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={() =>
                        setSelectedPrunePaths((current) =>
                          selected
                            ? current.filter((item) => item !== worktree.path)
                            : [...current, worktree.path],
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedPrunePaths((current) =>
                            selected
                              ? current.filter((item) => item !== worktree.path)
                              : [...current, worktree.path],
                          );
                        }
                      }}
                    >
                      <Checkbox checked={selected} tabIndex={-1} />
                      <div>
                        <Typography.Text strong className="prune-worktree-name">
                          {worktree.name || worktree.resolvedName}
                        </Typography.Text>
                        <div className="prune-worktree-detail">
                          <span>Path</span>
                          <Typography.Text ellipsis title={worktree.path}>
                            {worktree.path}
                          </Typography.Text>
                        </div>
                        <div className="prune-worktree-detail reason">
                          <span>Issue</span>
                          <Typography.Text>
                            {worktree.pruneReason ||
                              'Git marked this worktree as prunable.'}
                          </Typography.Text>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="prune-worktree-empty">
              <ClearOutlined />
              <Typography.Text>No damaged worktrees found.</Typography.Text>
            </div>
          )}
          {prunePreview.output && (
            <details className="prune-dry-run-output">
              <summary>Git dry-run output</summary>
              <pre>{prunePreview.output}</pre>
            </details>
          )}
        </Modal>
        <div className="worktrees-list-scrollable">
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
                  <Tooltip
                    title={
                      worktree.lockReason
                        ? `Lock reason: ${worktree.lockReason}`
                        : 'Worktree is locked'
                    }
                    placement="right"
                    mouseEnterDelay={0}
                    mouseLeaveDelay={0}
                  >
                    <LockOutlined style={{ color: token.colorWarning }} />
                  </Tooltip>
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
                {Object.values(
                  activeAgentsByWorktree[worktreeActivityKey(worktree.path)] ||
                    {},
                ).length > 0 && (
                  <span
                    className="worktree-agent-status"
                    aria-label="Active AI agents"
                  >
                    {Object.entries(
                      activeAgentsByWorktree[
                        worktreeActivityKey(worktree.path)
                      ] || {},
                    ).map(([terminalId, agent]) => (
                      <Tooltip
                        title={`${agent.label} is working`}
                        key={terminalId}
                      >
                        <Avatar
                          size={18}
                          className="agent-working-icon"
                          style={{
                            backgroundColor: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {getAiAgentIcon(agent.id, 18)}
                        </Avatar>
                      </Tooltip>
                    ))}
                  </span>
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
                  <MoreOutlined
                    style={{ cursor: 'pointer', padding: '2px 4px' }}
                  />
                </Tooltip>
              </Dropdown>
            </li>
          ))}
          </ul>
        </div>
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
        {isLockModalOpen && (
          <Suspense fallback={<Spin size="large" />}>
            <LockWorktree
              isModalOpen={isLockModalOpen}
              form={form}
              onFinish={lockWorktree}
              handleCancel={() => {
                setIsLockModalOpen(false);
                form.setFieldValue('lockReason', '');
              }}
              loading={loadingLockWorktree}
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
        {configWorktree && (
          <Suspense fallback={<Spin size="large" />}>
            <WorktreeGitConfig
              open={Boolean(configWorktree)}
              worktreeName={configWorktree.name}
              worktreePath={configWorktree.path}
              onClose={closeWorktreeGitConfig}
              onSaved={handleWorktreeGitConfigSaved}
            />
          </Suspense>
        )}
        {rebaseSourceWorktree && (
          <Suspense fallback={<Spin size="large" />}>
            <RebaseWorktree
              open={Boolean(rebaseSourceWorktree)}
              repositoryPath={tabRepoPath}
              worktrees={worktrees}
              initialSourcePath={rebaseSourceWorktree.path}
              onClose={() => setRebaseSourceWorktree(null)}
              onCompleted={(
                result: Extract<WorktreeRebaseResult, { ok: true }>,
              ) => {
                setRebaseSourceWorktree(null);
                api.success({
                  message: 'Rebase Completed',
                  description: `${result.sourceBranch} was rebased onto ${result.targetBranch}.`,
                  placement: 'bottomLeft',
                  duration: 3,
                });
                window.electron.ipcRenderer.send(
                  'show-git-log',
                  tabRepoPath,
                  null,
                );
                window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
              }}
            />
          </Suspense>
        )}
        {mergeTargetWorktree && (
          <Suspense fallback={<Spin size="large" />}>
            <MergeWorktree
              open={Boolean(mergeTargetWorktree)}
              repositoryPath={tabRepoPath}
              worktrees={worktrees}
              initialTargetPath={mergeTargetWorktree.path}
              onClose={() => setMergeTargetWorktree(null)}
              onCompleted={(
                result: Extract<WorktreeMergeResult, { ok: true }>,
              ) => {
                setMergeTargetWorktree(null);
                api.success({
                  message: 'Merge Completed',
                  description: `${result.sourceBranch} was merged into ${result.targetBranch}.`,
                  placement: 'bottomLeft',
                  duration: 3,
                });
                window.electron.ipcRenderer.send(
                  'show-git-log',
                  tabRepoPath,
                  null,
                );
                window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
              }}
            />
          </Suspense>
        )}
        {upstreamWorktree && (
          <Suspense fallback={<Spin size="large" />}>
            <SetupUpstreamModal
              open={Boolean(upstreamWorktree)}
              worktree={upstreamWorktree}
              repositoryPath={tabRepoPath}
              onClose={() => setUpstreamWorktree(null)}
              onCompleted={() => {
                setUpstreamWorktree(null);
                window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
                window.electron.ipcRenderer.send('show-git-log', tabRepoPath, null);
              }}
            />
          </Suspense>
        )}
          </Collapse.Panel>
        </Collapse>
      </div>
      <div
        style={{
          height: 1,
          backgroundColor:
            'var(--ant-color-border-secondary, rgba(125,125,125,0.15))',
          margin: '4px 0',
          flexShrink: 0,
        }}
      />
      <div
        className="remotes-section-panel"
        style={{
          flex:
            isWorktreesExpanded && isRemotesExpanded
              ? '40 1 0%'
              : isRemotesExpanded
                ? '1 1 0%'
                : '0 0 auto',
        }}
      >
        <Suspense fallback={<Spin size="small" style={{ padding: 12 }} />}>
          <RemotesList
            repositoryPath={tabRepoPath}
            isDarkMode={isDarkMode}
            activeKey={remotesActiveKey}
            onChangeActiveKey={setRemotesActiveKey}
          />
        </Suspense>
      </div>
    </div>
  );
}
