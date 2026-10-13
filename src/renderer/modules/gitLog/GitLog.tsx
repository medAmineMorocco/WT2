import {
  App as AntdApp,
  Space,
  Select,
  Checkbox,
  Popover,
  Spin,
  Tooltip,
  Button,
  Input,
  Typography,
  Dropdown,
  Segmented,
} from 'antd';
import type { InputRef } from 'antd';
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { GitBranchIcon } from 'hugeicons-react';
import {
  ReloadOutlined,
  SettingOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DiffOutlined,
  InboxOutlined,
  ExportOutlined,
  SearchOutlined,
  UpOutlined,
  DownOutlined,
  ExperimentOutlined,
  LoadingOutlined,
  FilterOutlined,
  ExclamationCircleOutlined,
  TagOutlined,
  LaptopOutlined,
  CloudOutlined,
  GithubOutlined,
  GitlabOutlined,
  DeleteOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import pako from 'pako';
import TabService from '../../services/tab/TabService';
import LogUI from '../../components/log/LogUI';
import type { ParsedCommit } from '../../components/log/LogUI';
import { CommitChangedFile } from '../../../shared/gitCommit';
import { WorkingTreeStatus } from '../../../shared/workingTree';
import type {
  ResetMode,
  ResetCommitResult,
  RevertCommitResult,
} from '../../../shared/gitResetRevert';
import type { CherryPickResult } from '../../../shared/cherryPick';
import type { WorktreeMergeResult } from '../../../shared/worktreeMerge';
import type { GitBisectState } from '../../../shared/gitBisect';
import type {
  CreateGitTagResult,
  DeleteGitTagResult,
  GitTagStatus,
  PushGitTagResult,
} from '../../../shared/gitTag';
import type { SelectedWorkingTreeFile } from './WorkingTreeFileDiffPane';
import type { GitRemote } from '../../../shared/gitRemote';
import { useItemsContext } from '../../TabsContext';

const GitDiff = lazy(() => import('../gitDiff/GitDiff'));
const CommitDetailsPanel = lazy(() => import('./CommitDetailsPanel'));
const CommitFileDiffPane = lazy(() => import('./CommitFileDiffPane'));
const WorkingTreePanel = lazy(() => import('./WorkingTreePanel'));
const WorkingTreeFileDiffPane = lazy(() => import('./WorkingTreeFileDiffPane'));
const CherryPickCommit = lazy(() => import('./CherryPickCommit'));
const ResetCommitModal = lazy(() => import('./ResetCommitModal'));
const RevertCommitModal = lazy(() => import('./RevertCommitModal'));
const MergeCommitModal = lazy(() => import('./MergeCommitModal'));
const CreateTagModal = lazy(() => import('./CreateTagModal'));
const PushTagModal = lazy(() => import('./PushTagModal'));
const DeleteRemoteTagModal = lazy(() => import('./DeleteRemoteTagModal'));
const GitBisectPanel = lazy(() => import('./GitBisectPanel'));

const LIMIT = 40;

const cleanErrorMessage = (error: any): string => {
  const raw = error?.message || String(error || '');
  return raw
    .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
    .trim();
};

interface GitLogActionButtonProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Button>,
  'icon'
> {
  label: string;
  icon: React.ReactNode;
  loading?: boolean;
  active?: boolean;
  tooltip?: React.ReactNode;
  ariaLabel?: string;
}

const GitLogActionButton = React.forwardRef<
  HTMLButtonElement,
  GitLogActionButtonProps
>(
  (
    {
      label,
      icon,
      loading = false,
      active = false,
      tooltip,
      disabled = false,
      onClick,
      className = '',
      type = 'default',
      style,
      ariaLabel,
      ...rest
    },
    ref,
  ) => {
    const btn = (
      <Button
        ref={ref}
        type={active ? 'primary' : type}
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel || label}
        className={`git-log-action-btn ${active ? 'git-log-action-btn-active' : ''} ${className}`}
        style={style}
        {...rest}
      >
        <span className="git-log-action-btn-icon">
          {loading ? <LoadingOutlined spin /> : icon}
        </span>
        <span className="git-log-action-btn-label">{label}</span>
      </Button>
    );

    if (tooltip) {
      return (
        <Tooltip title={tooltip} placement="bottom">
          {disabled ? (
            <span style={{ display: 'inline-flex' }}>{btn}</span>
          ) : (
            btn
          )}
        </Tooltip>
      );
    }

    return btn;
  },
);
GitLogActionButton.displayName = 'GitLogActionButton';

export default function GitLog({ isModal }: { isModal: boolean }) {
  const { notification, modal } = AntdApp.useApp();
  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

  const { selectedWorktreeByRepository, setSelectedWorktreeForRepository } =
    useItemsContext();
  const selectedWorktree = selectedWorktreeByRepository[tabRepoPath] ?? null;

  const [worktrees, setWorktrees] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);

  const [commits, setCommits] = useState<string[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [workingTreeSelected, setWorkingTreeSelected] = useState(false);
  const [selectedWorkingTreeFile, setSelectedWorkingTreeFile] =
    useState<SelectedWorkingTreeFile | null>(null);
  const [workingTreeStatus, setWorkingTreeStatus] = useState<WorkingTreeStatus>(
    { branch: '', files: [] },
  );
  const [workingTreeRefresh, setWorkingTreeRefresh] = useState(0);
  const [gitActionLoading, setGitActionLoading] = useState<string | null>(null);
  const [openGitDiff, setOpenGitDiff] = useState(false);
  const [selectedCommitFile, setSelectedCommitFile] =
    useState<CommitChangedFile | null>(null);
  const [cherryPickSource, setCherryPickSource] = useState<ParsedCommit | null>(
    null,
  );
  const [resetTargetCommit, setResetTargetCommit] =
    useState<ParsedCommit | null>(null);
  const [resetMode, setResetMode] = useState<ResetMode>('mixed');
  const [revertTargetCommit, setRevertTargetCommit] =
    useState<ParsedCommit | null>(null);
  const [mergeCommitTarget, setMergeCommitTarget] =
    useState<ParsedCommit | null>(null);
  const [tagTargetCommit, setTagTargetCommit] = useState<ParsedCommit | null>(
    null,
  );
  const [pushTargetTag, setPushTargetTag] = useState<string | null>(null);
  const [deleteRemoteTargetTag, setDeleteRemoteTargetTag] = useState<string | null>(
    null,
  );
  const [tagStatuses, setTagStatuses] = useState<Record<string, GitTagStatus>>({});
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);
  const [tagFilterQuery, setTagFilterQuery] = useState('');
  const [tagFilterMode, setTagFilterMode] = useState<'all' | 'local' | 'pushed'>('all');
  const [bisectMode, setBisectMode] = useState(false);
  const [bisectGoodCommit, setBisectGoodCommit] = useState<string | null>(null);
  const [bisectBadCommit, setBisectBadCommit] = useState<string | null>(null);
  const [bisectState, setBisectState] = useState<GitBisectState | null>(null);

  const handleOpenReset = useCallback(
    (commit: ParsedCommit, mode: ResetMode = 'mixed') => {
      setResetMode(mode);
      setResetTargetCommit(commit);
    },
    [],
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const selectedWorktreeValueRef = useRef<string | null>(selectedWorktree);
  const worktreesInitializedRef = useRef(false);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [commitSearchOpen, setCommitSearchOpen] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const commitSearchInputRef = useRef<InputRef>(null);
  const autoSelectedSearchRef = useRef('');

  const [isAuthorEnabled, setIsAuthorEnabled] = useState(true);
  const [isCommitDateEnabled, setIsCommitDateEnabled] = useState(true);
  const [isHashEnabled, setIsHashEnabled] = useState(true);
  const [isRefsEnabled, setIsRefsEnabled] = useState(true);

  const [shouldHide, setShouldHide] = useState<boolean>(false);

  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const skipRef = useRef(0);

  const handleWorkingTreeStatusChange = useCallback(
    (status: WorkingTreeStatus) => {
      setWorkingTreeStatus(status);
      if (status.files.length === 0) {
        setWorkingTreeSelected(false);
        setSelectedWorkingTreeFile(null);
        return;
      }

      setSelectedWorkingTreeFile((selection) => {
        if (!selection) return null;
        const currentFile = status.files.find(
          (file) => file.path === selection.file.path,
        );
        if (!currentFile) return null;
        if (selection.staged && !currentFile.staged) return null;
        if (!selection.staged && !currentFile.unstaged) return null;
        if (
          selection.file.indexStatus === currentFile.indexStatus &&
          selection.file.worktreeStatus === currentFile.worktreeStatus &&
          selection.file.staged === currentFile.staged &&
          selection.file.unstaged === currentFile.unstaged &&
          selection.file.untracked === currentFile.untracked
        ) {
          return selection;
        }
        return { ...selection, file: currentFile };
      });
    },
    [],
  );

  const closeWorkingTreeFileDiff = useCallback(() => {
    setSelectedWorkingTreeFile(null);
  }, []);

  const handleWorkingTreeFileChanged = useCallback(() => {
    setWorkingTreeRefresh((value) => value + 1);
  }, []);

  useHotkeys('shift+d', () => setOpenGitDiff(true), {
    preventDefault: true,
  });

  useEffect(() => {
    window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
    window.electron.ipcRenderer.send('list-authors', tabRepoPath);

    const onReceiveGitLog = (
      code: number,
      result: any,
      skipReceived: number,
      hasMoreReceived?: boolean,
    ) => {
      loadingRef.current = false;
      loadingMoreRef.current = false;
      setLoading(false);
      setLoadingMore(false);

      if (code === 0) {
        const decompressed = pako.ungzip(result, { to: 'string' });
        const newCommits = decompressed
          ? decompressed.split('\n').filter((line) => line.trim().length > 0)
          : [];

        const nextHasMore =
          typeof hasMoreReceived === 'boolean'
            ? hasMoreReceived
            : newCommits.length > 0;

        hasMoreRef.current = nextHasMore;
        setHasMore(nextHasMore);

        if (skipReceived === 0) {
          setCommits([...newCommits]);
        } else {
          setCommits((prev) => [...prev, ...newCommits]);
        }
      } else {
        notification.error({
          message: 'Unable to get log',
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreesFound = (code: number, result: any) => {
      if (code === 0) {
        const nextWorktrees = JSON.parse(result).map((item: any) => {
          const name = item.name || item.resolvedName;
          return {
            label: item.isPrimary ? `${name} (main)` : name,
            value: name,
            path: item.path,
            isPrimary: item.isPrimary,
          };
        });
        const currentSelection = selectedWorktreeValueRef.current;
        const nextSelection = nextWorktrees.some(
          (item: any) => item.value === currentSelection,
        )
          ? currentSelection
          : null;
        worktreesInitializedRef.current = true;
        selectedWorktreeValueRef.current = nextSelection;
        setWorktrees(nextWorktrees);
        setSelectedWorktreeForRepository(tabRepoPath, nextSelection);
        skipRef.current = 0;
        setHasMore(true);
        hasMoreRef.current = true;
        window.electron.ipcRenderer.send(
          'show-git-log',
          tabRepoPath,
          nextSelection,
        );
      } else {
        notification.error({
          message: 'Unable to Fetch Worktrees',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onAuthorsFound = (code: number, result: any) => {
      if (code === 0) {
        setAuthors(
          result.map((item: any) => {
            return {
              label: item,
              value: item,
            };
          }),
        );
      }
    };

    const removeGitLog = window.electron.ipcRenderer.on(
      'receive-git-log',
      onReceiveGitLog,
    );
    const removeWorktrees = window.electron.ipcRenderer.on(
      'worktrees-found',
      onWorktreesFound,
    );
    const removeAuthors = window.electron.ipcRenderer.on(
      'receive-authors',
      onAuthorsFound,
    );

    return () => {
      if (typeof removeGitLog === 'function') removeGitLog();
      else window.electron.ipcRenderer.removeAllListeners('receive-git-log');

      if (typeof removeWorktrees === 'function') removeWorktrees();
      else window.electron.ipcRenderer.removeAllListeners('worktrees-found');

      if (typeof removeAuthors === 'function') removeAuthors();
      else window.electron.ipcRenderer.removeAllListeners('receive-authors');
    };
  }, [tabRepoPath, setSelectedWorktreeForRepository]);

  const selectedRepositoryPath = useMemo(() => {
    if (selectedWorktree) {
      return (
        worktrees.find((item) => item.value === selectedWorktree)?.path ||
        tabRepoPath
      );
    }
    return worktrees.find((item) => item.isPrimary)?.path || tabRepoPath;
  }, [selectedWorktree, tabRepoPath, worktrees]);

  const selectedWorktreeInfo = useMemo(() => {
    if (!selectedWorktree) return null;
    return worktrees.find((item) => item.value === selectedWorktree) || null;
  }, [selectedWorktree, worktrees]);

  const workingTreeCounts = useMemo(
    () =>
      workingTreeStatus.files.reduce(
        (counts, file) => {
          if (
            file.untracked ||
            file.indexStatus === 'A' ||
            file.worktreeStatus === 'A'
          ) {
            counts.added += 1;
          } else if (file.indexStatus === 'D' || file.worktreeStatus === 'D') {
            counts.deleted += 1;
          } else {
            counts.modified += 1;
          }
          return counts;
        },
        { modified: 0, added: 0, deleted: 0 },
      ),
    [workingTreeStatus.files],
  );

  useEffect(() => {
    let cancelled = false;
    let requestInProgress = false;

    const refreshWorkingTree = () => {
      if (requestInProgress) return;
      requestInProgress = true;
      window.electron.ipcRenderer
        .invoke('get-working-tree-status', selectedRepositoryPath)
        .then((status: WorkingTreeStatus) => {
          if (!cancelled) handleWorkingTreeStatusChange(status);
          return undefined;
        })
        .catch(() => undefined)
        .finally(() => {
          requestInProgress = false;
        });
    };

    const refreshFromExternalChange = () => {
      if (document.visibilityState !== 'visible') return;
      refreshWorkingTree();
      setWorkingTreeRefresh((value) => value + 1);
    };

    refreshWorkingTree();
    const interval = window.setInterval(refreshFromExternalChange, 4000);
    window.addEventListener('focus', refreshFromExternalChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshFromExternalChange);
    };
  }, [handleWorkingTreeStatusChange, selectedRepositoryPath]);

  useEffect(() => {
    const handleResize = () => {
      // eslint-disable-next-line no-restricted-globals
      const halfScreenWidth = screen.width / 2 + 20;
      const currentWindowWidth = window.innerWidth;

      setShouldHide(currentWindowWidth <= halfScreenWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const commitList = useMemo(() => {
    const list: { hash: string; subject: string }[] = [];
    const regex =
      /^(?:[*|/\\ ]*)?(.*?)(?: \(([^)]+)\))? <([^>]+)>(?: \{([^}]*)\})? \[([^\]]+)\]\s+([a-f0-9]{7,40})/;
    commits.forEach((line) => {
      if (!line || !line.trim()) return;
      if (/^(?:[*|/\\ ]*)?(?:index|untracked files) on [^:]+:\s/i.test(line)) {
        return;
      }
      const match = line.match(regex);
      if (match) {
        list.push({ subject: match[1] || '', hash: match[6] || '' });
      }
    });
    return list;
  }, [commits]);

  const matchingCommits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return commitList.filter(
      (c) =>
        c.hash.toLowerCase().includes(q) ||
        c.hash.slice(0, 8).toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q),
    );
  }, [commitList, searchQuery]);

  const selectMatch = useCallback(
    (index: number, matches = matchingCommits) => {
      if (matches.length === 0) return;
      const validIndex = Math.max(0, Math.min(index, matches.length - 1));
      setCurrentMatchIndex(validIndex);
      const target = matches[validIndex];
      if (target) {
        setSelectedCommit(target.hash);
        setWorkingTreeSelected(false);
        setSelectedWorkingTreeFile(null);
        setSelectedCommitFile(null);
      }
    },
    [matchingCommits],
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const q = value.trim().toLowerCase();
    if (!q) {
      autoSelectedSearchRef.current = '';
      setCurrentMatchIndex(0);
      return;
    }
    const newMatches = commitList.filter(
      (c) =>
        c.hash.toLowerCase().includes(q) ||
        c.hash.slice(0, 8).toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q),
    );
    if (newMatches.length > 0) {
      autoSelectedSearchRef.current = q;
      selectMatch(0, newMatches);
    } else {
      setCurrentMatchIndex(0);
    }
  };

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || matchingCommits.length === 0) return;
    if (autoSelectedSearchRef.current === q) return;
    autoSelectedSearchRef.current = q;
    selectMatch(0, matchingCommits);
  }, [matchingCommits, searchQuery, selectMatch]);

  const handleNextMatch = () => {
    if (matchingCommits.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchingCommits.length;
    selectMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (matchingCommits.length === 0) return;
    const prevIdx =
      (currentMatchIndex - 1 + matchingCommits.length) % matchingCommits.length;
    selectMatch(prevIdx);
  };

  const handleChange = (worktree: string | null, author: string | null) => {
    selectedWorktreeValueRef.current = worktree;
    setSelectedWorktreeForRepository(tabRepoPath, worktree);
    setSelectedCommit(null);
    setSelectedCommitFile(null);
    setWorkingTreeSelected(false);
    setSelectedWorkingTreeFile(null);
    setSelectedAuthor(author);
    setLoading(true);
    loadingRef.current = true;
    skipRef.current = 0;
    setHasMore(true);
    hasMoreRef.current = true;
    window.electron.ipcRenderer.send(
      'show-git-log',
      tabRepoPath,
      worktree,
      author,
      0,
    );
  };

  useEffect(() => {
    if (
      !worktreesInitializedRef.current ||
      selectedWorktreeValueRef.current === selectedWorktree
    ) {
      return;
    }
    if (bisectState?.active) {
      setSelectedWorktreeForRepository(
        tabRepoPath,
        selectedWorktreeValueRef.current,
      );
      notification.warning({
        message: 'Finish Git bisect first',
        description:
          'The selected worktree cannot change during an active bisect.',
        placement: 'bottomLeft',
      });
      return;
    }
    handleChange(selectedWorktree, selectedAuthor);
    // This effect intentionally reacts only to selection made in the sidebar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorktree, bisectState?.active]);

  const runToolbarAction = async (
    action: 'pull' | 'push' | 'stash' | 'pop',
  ) => {
    if (!selectedWorktree) {
      notification.warning({
        message: 'No worktree selected',
        description: `Please select a worktree before running git ${action}.`,
        placement: 'bottomLeft',
      });
      return;
    }
    if (!selectedRepositoryPath) {
      notification.error({
        message: `Git ${action} failed`,
        description: 'Unable to determine the worktree repository path.',
        placement: 'bottomLeft',
      });
      return;
    }
    setGitActionLoading(action);
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'run-working-tree-action',
        selectedRepositoryPath,
        action,
        [],
      );
      notification.success({
        message: `${action[0].toUpperCase()}${action.slice(1)} complete`,
        description: result || undefined,
        placement: 'bottomLeft',
      });
      setWorkingTreeRefresh((value) => value + 1);
      setLoading(true);
      loadingRef.current = true;
      skipRef.current = 0;
      setHasMore(true);
      hasMoreRef.current = true;
      window.electron.ipcRenderer.send(
        'show-git-log',
        tabRepoPath,
        selectedWorktree,
        selectedAuthor,
        0,
      );
    } catch (error: any) {
      const errorDetail = cleanErrorMessage(error);
      notification.error({
        message: `Git ${action} failed`,
        description: errorDetail || `Git ${action} failed.`,
        placement: 'bottomLeft',
      });
    } finally {
      setGitActionLoading(null);
    }
  };

  const reloadGitLog = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true);
    loadingRef.current = true;
    skipRef.current = 0;
    setHasMore(true);
    hasMoreRef.current = true;
    window.electron.ipcRenderer.send(
      'show-git-log',
      tabRepoPath,
      selectedWorktree,
      selectedAuthor,
      0,
    );
  }, [tabRepoPath, selectedWorktree, selectedAuthor]);

  const loadTagStatuses = useCallback(
    async (forceRemoteRefresh = false) => {
      if (!tabRepoPath) return;
      setTagsLoading(true);
      try {
        const list = (await window.electron.ipcRenderer.invoke(
          'get-tag-statuses',
          tabRepoPath,
          forceRemoteRefresh,
        )) as GitTagStatus[];
        const map: Record<string, GitTagStatus> = {};
        for (const item of list || []) {
          map[item.name] = item;
        }
        setTagStatuses(map);
      } catch (err: any) {
        console.error('Failed to load tag statuses:', err);
      } finally {
        setTagsLoading(false);
      }
    },
    [tabRepoPath],
  );

  useEffect(() => {
    loadTagStatuses();
  }, [loadTagStatuses]);

  const loadRemotes = useCallback(async () => {
    if (!tabRepoPath) return;
    try {
      const list = (await window.electron.ipcRenderer.invoke(
        'get-remotes',
        tabRepoPath,
      )) as GitRemote[];
      setRemotes(list || []);
    } catch (err: any) {
      console.error('Failed to load remotes:', err);
    }
  }, [tabRepoPath]);

  useEffect(() => {
    loadRemotes();
  }, [loadRemotes]);

  const handleDeleteTagLocally = useCallback(
    (tagName: string) => {
      modal.confirm({
        title: `Delete tag "${tagName}" locally?`,
        icon: <ExclamationCircleOutlined />,
        content: `Are you sure you want to delete tag "${tagName}" from your local repository? This action cannot be undone.`,
        okText: 'Delete Locally',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            const result = (await window.electron.ipcRenderer.invoke(
              'delete-tag-locally',
              tabRepoPath,
              tagName,
            )) as DeleteGitTagResult;
            if (result.ok) {
              notification.success({
                message: 'Tag deleted locally',
                description: `Tag "${tagName}" was removed.`,
                placement: 'bottomLeft',
              });
              reloadGitLog(false);
              loadTagStatuses();
            } else {
              notification.error({
                message: 'Failed to delete tag',
                description: result.error,
                placement: 'bottomLeft',
              });
            }
          } catch (err: any) {
            notification.error({
              message: 'Failed to delete tag',
              description: cleanErrorMessage(err),
              placement: 'bottomLeft',
            });
          }
        },
      });
    },
    [modal, notification, tabRepoPath, reloadGitLog, loadTagStatuses],
  );

  const handleDeleteTagBoth = useCallback(
    (tagName: string) => {
      modal.confirm({
        title: `Delete tag "${tagName}" from both local and remote?`,
        icon: <ExclamationCircleOutlined />,
        content: `Are you sure you want to delete tag "${tagName}" from both your local repository and remote? This action cannot be undone.`,
        okText: 'Delete from Both',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            const result = (await window.electron.ipcRenderer.invoke(
              'delete-tag-both',
              tabRepoPath,
              tagName,
            )) as DeleteGitTagResult;
            if (result.ok) {
              notification.success({
                message: 'Tag deleted',
                description: `Tag "${tagName}" was removed locally and from remote.`,
                placement: 'bottomLeft',
              });
              reloadGitLog(false);
              loadTagStatuses(true);
            } else {
              notification.error({
                message: 'Failed to delete tag',
                description: result.error,
                placement: 'bottomLeft',
              });
            }
          } catch (err: any) {
            notification.error({
              message: 'Failed to delete tag',
              description: cleanErrorMessage(err),
              placement: 'bottomLeft',
            });
          }
        },
      });
    },
    [modal, notification, tabRepoPath, reloadGitLog, loadTagStatuses],
  );

  const handleLoadMore = useCallback(() => {
    if (loadingRef.current || loadingMoreRef.current || !hasMoreRef.current) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextSkip = skipRef.current + LIMIT;
    skipRef.current = nextSkip;
    window.electron.ipcRenderer.send(
      'show-git-log',
      tabRepoPath,
      selectedWorktree,
      selectedAuthor,
      nextSkip,
    );
  }, [tabRepoPath, selectedWorktree, selectedAuthor]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const searchingByHash = /^[a-f0-9]{7,40}$/i.test(q);
    if (
      matchingCommits.length === 0 &&
      hasMore &&
      !loadingMore &&
      !loading &&
      (searchingByHash || commits.length < 500)
    ) {
      handleLoadMore();
    }
  }, [
    searchQuery,
    matchingCommits.length,
    hasMore,
    loadingMore,
    loading,
    commits.length,
    handleLoadMore,
  ]);

  const columnsMenu = (
    <div className="git-log-columns-menu">
      <Checkbox
        checked={isAuthorEnabled}
        onChange={(event) => setIsAuthorEnabled(event.target.checked)}
      >
        Author
      </Checkbox>
      <Checkbox
        checked={isCommitDateEnabled}
        onChange={(event) => setIsCommitDateEnabled(event.target.checked)}
      >
        Date
      </Checkbox>
      <Checkbox
        checked={isHashEnabled}
        onChange={(event) => setIsHashEnabled(event.target.checked)}
      >
        SHA
      </Checkbox>
      <Checkbox
        checked={isRefsEnabled}
        onChange={(event) => setIsRefsEnabled(event.target.checked)}
      >
        Refs
      </Checkbox>
    </div>
  );

  const commitFilterControl = (
    <Popover
      trigger="click"
      placement="bottomLeft"
      open={commitSearchOpen}
      onOpenChange={(open) => {
        setCommitSearchOpen(open);
        if (open) {
          window.setTimeout(() => {
            commitSearchInputRef.current?.focus({ cursor: 'all' });
          }, 0);
        }
      }}
      content={
        <div className="git-log-header-filter-popover git-log-commit-filter-popover">
          <Typography.Text strong>Find commit</Typography.Text>
          <Input
            ref={commitSearchInputRef}
            placeholder="Hash or commit message"
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(event) => handleSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              if (event.shiftKey) handlePrevMatch();
              else handleNextMatch();
            }}
            allowClear
          />
          <div className="git-log-filter-navigation">
            <Typography.Text type="secondary">
              {searchQuery.trim()
                ? matchingCommits.length > 0
                  ? `${currentMatchIndex + 1} of ${matchingCommits.length}`
                  : 'No matching commits'
                : 'The full log remains visible'}
            </Typography.Text>
            <Space size={2}>
              <Button
                type="text"
                size="small"
                icon={<UpOutlined />}
                disabled={matchingCommits.length === 0}
                onClick={handlePrevMatch}
                aria-label="Previous matching commit"
              />
              <Button
                type="text"
                size="small"
                icon={<DownOutlined />}
                disabled={matchingCommits.length === 0}
                onClick={handleNextMatch}
                aria-label="Next matching commit"
              />
            </Space>
          </div>
        </div>
      }
    >
      <Button
        type="text"
        size="small"
        icon={<SearchOutlined />}
        aria-label="Search commits"
        className={`git-log-header-filter-trigger ${searchQuery.trim() ? 'active' : ''}`}
      />
    </Popover>
  );

  const authorFilterControl = (
    <Popover
      trigger="click"
      placement="bottomLeft"
      content={
        <div className="git-log-header-filter-popover">
          <Typography.Text strong>Filter by author</Typography.Text>
          <Select
            value={selectedAuthor || undefined}
            placeholder="All authors"
            options={authors}
            onChange={(value?: string) =>
              handleChange(selectedWorktree, value || null)
            }
            showSearch
            allowClear
            optionFilterProp="label"
            style={{ width: 240 }}
          />
        </div>
      }
    >
      <Button
        type="text"
        size="small"
        icon={<FilterOutlined />}
        aria-label="Filter commits by author"
        className={`git-log-header-filter-trigger ${selectedAuthor ? 'active' : ''}`}
      />
    </Popover>
  );

  const tagList = useMemo(
    () =>
      Object.values(tagStatuses).sort((a, b) =>
        b.name.localeCompare(a.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      ),
    [tagStatuses],
  );
  const localTagsCount = useMemo(
    () => tagList.filter((t) => t.isLocal && !t.isRemote).length,
    [tagList],
  );
  const remoteTagsCount = useMemo(
    () => tagList.filter((t) => t.isRemote).length,
    [tagList],
  );

  const filteredTagList = useMemo(() => {
    return tagList.filter((tag) => {
      if (
        tagFilterQuery.trim() &&
        !tag.name.toLowerCase().includes(tagFilterQuery.trim().toLowerCase()) &&
        !tag.commit.toLowerCase().includes(tagFilterQuery.trim().toLowerCase())
      ) {
        return false;
      }
      if (tagFilterMode === 'local') return tag.isLocal && !tag.isRemote;
      if (tagFilterMode === 'pushed') return tag.isRemote;
      return true;
    });
  }, [tagList, tagFilterQuery, tagFilterMode]);

  const tagsPopoverContent = (
    <div className="git-log-tags-popover">
      <div className="git-log-tags-popover-header">
        <Space size={6} align="center">
          <TagOutlined style={{ fontSize: 13 }} />
          <Typography.Text strong>Repository Tags</Typography.Text>
          <span className="git-log-tags-count-badge">{tagList.length}</span>
        </Space>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined spin={tagsLoading} />}
          disabled={tagsLoading}
          onClick={() => loadTagStatuses(true)}
          title="Refresh remote tags"
        />
      </div>
      <Input
        size="small"
        placeholder="Filter tags by name or hash..."
        prefix={<SearchOutlined />}
        value={tagFilterQuery}
        onChange={(e) => setTagFilterQuery(e.target.value)}
        allowClear
        className="git-log-tags-search-input"
      />
      <Segmented
        size="small"
        block
        options={[
          { label: `All (${tagList.length})`, value: 'all' },
          { label: `Local (${localTagsCount})`, value: 'local' },
          { label: `Pushed (${remoteTagsCount})`, value: 'pushed' },
        ]}
        value={tagFilterMode}
        onChange={(val) => setTagFilterMode(val as any)}
      />
      <div className="git-log-tags-list">
        {filteredTagList.length === 0 ? (
          <div className="git-log-tags-empty">
            {tagList.length === 0
              ? 'No tags in repository'
              : 'No matching tags'}
          </div>
        ) : (
          filteredTagList.map((tag) => (
            <div
              key={tag.name}
              className={`git-log-tag-item ${selectedCommit === tag.commit ? 'selected' : ''}`}
              onClick={() => {
                if (tag.commit) {
                  setSelectedCommit(tag.commit);
                  setWorkingTreeSelected(false);
                  setSelectedWorkingTreeFile(null);
                  setSelectedCommitFile(null);
                  setTagsPopoverOpen(false);
                }
              }}
            >
              <div className="git-log-tag-item-info">
                <div className="git-log-tag-item-name-row">
                  <span className="git-log-tag-item-name" title={tag.name}>
                    {tag.name}
                  </span>
                  <span className="git-log-tag-item-badges">
                    {tag.isLocal && (
                      <span className="ref-status-badge local" title="Local">
                        <LaptopOutlined />
                      </span>
                    )}
                    {tag.isRemote && (
                      <span
                        className="ref-status-badge remote"
                        title={`Pushed to ${tag.remotes.join(', ') || 'remote'}`}
                      >
                        {tag.remoteUrl?.toLowerCase().includes('github.com') ? (
                          <GithubOutlined />
                        ) : tag.remoteUrl?.toLowerCase().includes('gitlab.com') ? (
                          <GitlabOutlined />
                        ) : (
                          <CloudOutlined />
                        )}
                      </span>
                    )}
                  </span>
                </div>
                {tag.commit && (
                  <span className="git-log-tag-item-commit">
                    {tag.commit.slice(0, 8)}
                  </span>
                )}
              </div>
              <div
                className="git-log-tag-item-actions"
                onClick={(e) => e.stopPropagation()}
              >
                {!tag.isRemote && (
                  <Button
                    type="text"
                    size="small"
                    icon={<CloudUploadOutlined />}
                    title={`Push "${tag.name}" to remote`}
                    onClick={() => {
                      setPushTargetTag(tag.name);
                      setTagsPopoverOpen(false);
                    }}
                  />
                )}
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'push',
                        label: tag.isRemote
                          ? `Push tag "${tag.name}" again...`
                          : `Push tag "${tag.name}" to remote...`,
                        icon: <CloudUploadOutlined />,
                        onClick: () => {
                          setPushTargetTag(tag.name);
                          setTagsPopoverOpen(false);
                        },
                      },
                      { type: 'divider' },
                      {
                        key: 'del-local',
                        label: 'Delete locally',
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => {
                          handleDeleteTagLocally(tag.name);
                          setTagsPopoverOpen(false);
                        },
                      },
                      ...(tag.isRemote
                        ? [
                            {
                              key: 'del-remote',
                              label: 'Delete from remote...',
                              icon: <GlobalOutlined />,
                              danger: true,
                              onClick: () => {
                                setDeleteRemoteTargetTag(tag.name);
                                setTagsPopoverOpen(false);
                              },
                            },
                            {
                              key: 'del-both',
                              label: 'Delete from both...',
                              icon: <DeleteOutlined />,
                              danger: true,
                              onClick: () => {
                                handleDeleteTagBoth(tag.name);
                                setTagsPopoverOpen(false);
                              },
                            },
                          ]
                        : []),
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button type="text" size="small" icon={<SettingOutlined />} />
                </Dropdown>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <Space className="center-huge-icon">
        <GitBranchIcon size={16} />
        <strong>Git Log</strong>
      </Space>
      <div
        className="git-log-body"
        style={{
          width: '100%',
          height: isModal ? 'calc(100% - 94px)' : 'calc(100% - 12px)',
          padding: '12px',
          paddingLeft: 0,
        }}
      >
        <div className="git-log-controls">
          <div className="git-log-toolbar">
            <div className="git-log-toolbar-actions">
              <div className="git-log-action-group git-log-action-group-feature">
                <GitLogActionButton
                  label="Bisect"
                  icon={<ExperimentOutlined />}
                  active={bisectMode}
                  disabled={!selectedWorktree}
                  onClick={() => setBisectMode(true)}
                  tooltip={
                    !selectedWorktree
                      ? 'Select a worktree before starting Git bisect'
                      : bisectMode
                        ? 'Git bisect mode is active'
                        : 'Find the first bad commit'
                  }
                />
              </div>
              <div className="git-log-action-group">
                <GitLogActionButton
                  label="Pull"
                  icon={<CloudDownloadOutlined />}
                  loading={gitActionLoading === 'pull'}
                  disabled={!selectedWorktree || Boolean(gitActionLoading)}
                  onClick={() => runToolbarAction('pull')}
                  tooltip={
                    !selectedWorktree ? 'Select a worktree to pull' : 'Pull'
                  }
                />
                <GitLogActionButton
                  label="Push"
                  icon={<CloudUploadOutlined />}
                  loading={gitActionLoading === 'push'}
                  disabled={!selectedWorktree || Boolean(gitActionLoading)}
                  onClick={() => runToolbarAction('push')}
                  tooltip={
                    !selectedWorktree ? 'Select a worktree to push' : 'Push'
                  }
                />
                <GitLogActionButton
                  label="Stash"
                  icon={<InboxOutlined />}
                  loading={gitActionLoading === 'stash'}
                  disabled={!selectedWorktree || Boolean(gitActionLoading)}
                  onClick={() => runToolbarAction('stash')}
                  tooltip={
                    !selectedWorktree
                      ? 'Select a worktree to stash'
                      : 'Stash changes'
                  }
                />
                <GitLogActionButton
                  label="Pop"
                  icon={<ExportOutlined />}
                  loading={gitActionLoading === 'pop'}
                  disabled={!selectedWorktree || Boolean(gitActionLoading)}
                  onClick={() => runToolbarAction('pop')}
                  tooltip={
                    !selectedWorktree
                      ? 'Select a worktree to pop'
                      : 'Pop latest stash'
                  }
                />
              </div>
              <div className="git-log-action-group">
                <Popover
                  content={tagsPopoverContent}
                  trigger="click"
                  placement="bottomRight"
                  open={tagsPopoverOpen}
                  onOpenChange={setTagsPopoverOpen}
                >
                  <GitLogActionButton
                    label={`Tags (${tagList.length})`}
                    icon={<TagOutlined />}
                    tooltip="View and manage repository tags (local / pushed)"
                    active={tagsPopoverOpen}
                  />
                </Popover>
                <GitLogActionButton
                  label="Diff"
                  icon={<DiffOutlined />}
                  onClick={() => setOpenGitDiff(true)}
                  tooltip="Open Diff (Shift+D)"
                />
                <GitLogActionButton
                  label="Refresh"
                  icon={<ReloadOutlined spin={loading} />}
                  disabled={loading}
                  onClick={() => {
                    reloadGitLog();
                    loadTagStatuses(true);
                  }}
                  tooltip="Reload Git Log"
                  ariaLabel="Reload Git Log"
                />
              </div>
            </div>
          </div>
        </div>
        {bisectMode && selectedWorktree && (
          <Suspense fallback={<Spin size="small" />}>
            <GitBisectPanel
              repositoryPath={selectedRepositoryPath}
              worktreeName={selectedWorktreeInfo?.label || selectedWorktree}
              goodCommit={bisectGoodCommit}
              badCommit={bisectBadCommit}
              onClearGood={() => setBisectGoodCommit(null)}
              onClearBad={() => setBisectBadCommit(null)}
              onStateChange={setBisectState}
              onClose={() => {
                setBisectMode(false);
                setBisectState(null);
                setBisectGoodCommit(null);
                setBisectBadCommit(null);
              }}
              onReload={() => reloadGitLog(false)}
              notify={notification}
              hasWorkingChanges={workingTreeStatus.files.length > 0}
            />
          </Suspense>
        )}
        {loading && (
          <div
            style={{
              height: 'calc(100% - 32px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Spin size="large" />
          </div>
        )}
        {!loading && (
          <div className="git-log-workspace">
            <div className="git-log-commits-pane">
              {workingTreeSelected && selectedWorkingTreeFile && (
                <Suspense fallback={<Spin size="large" />}>
                  <WorkingTreeFileDiffPane
                    selection={selectedWorkingTreeFile}
                    repositoryPath={selectedRepositoryPath}
                    onClose={closeWorkingTreeFileDiff}
                    onChanged={handleWorkingTreeFileChanged}
                  />
                </Suspense>
              )}
              {!selectedWorkingTreeFile &&
                selectedCommit &&
                selectedCommitFile && (
                  <Suspense fallback={<Spin size="large" />}>
                    <CommitFileDiffPane
                      commit={selectedCommit}
                      file={selectedCommitFile}
                      repositoryPath={tabRepoPath}
                      onClose={() => setSelectedCommitFile(null)}
                    />
                  </Suspense>
                )}
              {!selectedWorkingTreeFile &&
                !(selectedCommit && selectedCommitFile) && (
                  <LogUI
                    commits={commits}
                    searchQuery={searchQuery}
                    isAuthorEnabled={isAuthorEnabled}
                    isCommitDateEnabled={isCommitDateEnabled}
                    isHashEnabled={isHashEnabled}
                    shouldHide={shouldHide || Boolean(selectedCommit)}
                    isRefsEnabled={isRefsEnabled}
                    selectedCommit={selectedCommit}
                    hasDetailsPanel={
                      Boolean(selectedCommit) || workingTreeSelected
                    }
                    workingTreeCount={workingTreeStatus.files.length}
                    workingTreeCounts={workingTreeCounts}
                    workingTreeSelected={workingTreeSelected}
                    hasMore={hasMore}
                    loadingMore={loadingMore}
                    onLoadMore={handleLoadMore}
                    onWorkingTreeSelect={() => {
                      setWorkingTreeSelected(true);
                      setSelectedWorkingTreeFile(null);
                      setSelectedCommit(null);
                      setSelectedCommitFile(null);
                    }}
                    onCommitSelect={(hash) => {
                      setWorkingTreeSelected(false);
                      setSelectedWorkingTreeFile(null);
                      setSelectedCommit(hash);
                      setSelectedCommitFile(null);
                    }}
                    onCherryPick={setCherryPickSource}
                    onCreateTag={setTagTargetCommit}
                    onPushTag={setPushTargetTag}
                    onDeleteTagLocally={handleDeleteTagLocally}
                    onDeleteTagRemotely={setDeleteRemoteTargetTag}
                    onDeleteTagBoth={handleDeleteTagBoth}
                    tagStatuses={tagStatuses}
                    remotes={remotes}
                    selectedWorktree={selectedWorktree}
                    onResetCommit={handleOpenReset}
                    onRevertCommit={setRevertTargetCommit}
                    onMergeCommit={setMergeCommitTarget}
                    bisectMode={bisectMode}
                    bisectGoodCommit={bisectGoodCommit}
                    bisectBadCommit={bisectBadCommit}
                    bisectCurrentCommit={
                      bisectState?.active ? bisectState.currentCommit : null
                    }
                    onBisectMark={(commit, mark) => {
                      if (mark === 'good') {
                        setBisectGoodCommit(commit.hash);
                        if (bisectBadCommit === commit.hash) {
                          setBisectBadCommit(null);
                        }
                      } else {
                        setBisectBadCommit(commit.hash);
                        if (bisectGoodCommit === commit.hash) {
                          setBisectGoodCommit(null);
                        }
                      }
                    }}
                    columnsControl={
                      !shouldHide ? (
                        <Popover
                          content={columnsMenu}
                          trigger="click"
                          placement="bottomRight"
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<SettingOutlined />}
                            aria-label="Choose Git log columns"
                            className="git-log-columns-trigger"
                          />
                        </Popover>
                      ) : null
                    }
                    commitFilterControl={commitFilterControl}
                    authorFilterControl={authorFilterControl}
                  />
                )}
            </div>
            {selectedCommit && (
              <Suspense fallback={<Spin size="large" />}>
                <CommitDetailsPanel
                  commit={selectedCommit}
                  repositoryPath={selectedRepositoryPath}
                  selectedFile={selectedCommitFile}
                  onFileSelect={setSelectedCommitFile}
                  onClose={() => {
                    setSelectedCommit(null);
                    setSelectedCommitFile(null);
                  }}
                  selectedWorktree={selectedWorktree}
                  onReset={(mode: ResetMode = 'mixed') => {
                    const matched = commitList.find(
                      (c) => c.hash === selectedCommit,
                    );
                    handleOpenReset(
                      {
                        hash: selectedCommit,
                        subject: matched?.subject || '',
                        parents: [],
                        refs: '',
                        author: '',
                        date: '',
                        lane: 0,
                        passingLanes: [],
                        forks: [],
                        merges: [],
                        hasTop: false,
                        hasBottom: false,
                      },
                      mode,
                    );
                  }}
                  onRevert={() => {
                    const matched = commitList.find(
                      (c) => c.hash === selectedCommit,
                    );
                    setRevertTargetCommit({
                      hash: selectedCommit,
                      subject: matched?.subject || '',
                      parents: [],
                      refs: '',
                      author: '',
                      date: '',
                      lane: 0,
                      passingLanes: [],
                      forks: [],
                      merges: [],
                      hasTop: false,
                      hasBottom: false,
                    });
                  }}
                  onMerge={() => {
                    const matched = commitList.find(
                      (c) => c.hash === selectedCommit,
                    );
                    setMergeCommitTarget({
                      hash: selectedCommit,
                      subject: matched?.subject || '',
                      parents: [],
                      refs: '',
                      author: '',
                      date: '',
                      lane: 0,
                      passingLanes: [],
                      forks: [],
                      merges: [],
                      hasTop: false,
                      hasBottom: false,
                    });
                  }}
                />
              </Suspense>
            )}
            {workingTreeSelected && (
              <Suspense fallback={<Spin size="large" />}>
                <WorkingTreePanel
                  repositoryPath={selectedRepositoryPath}
                  refreshToken={workingTreeRefresh}
                  selectedFile={selectedWorkingTreeFile}
                  onFileSelect={setSelectedWorkingTreeFile}
                  onStatusChange={handleWorkingTreeStatusChange}
                  onCommitted={() => {
                    setWorkingTreeRefresh((value) => value + 1);
                    reloadGitLog(false);
                  }}
                  onClose={() => {
                    setWorkingTreeSelected(false);
                    setSelectedWorkingTreeFile(null);
                  }}
                />
              </Suspense>
            )}
          </div>
        )}
      </div>
      {openGitDiff && (
        <Suspense fallback={<Spin size="large" />}>
          <GitDiff
            isModalOpen={openGitDiff}
            handleCancel={() => setOpenGitDiff(false)}
          />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <CreateTagModal
          commit={tagTargetCommit}
          repositoryPath={tabRepoPath}
          onClose={() => setTagTargetCommit(null)}
          onCompleted={(
            result: Extract<CreateGitTagResult, { ok: true }>,
          ) => {
            setTagTargetCommit(null);
            notification.success({
              message: 'Tag created',
              description: `${result.tagName} now points to ${result.commit.slice(0, 8)}.`,
              placement: 'bottomLeft',
            });
            reloadGitLog(false);
            loadTagStatuses();
          }}
        />
        <PushTagModal
          tagName={pushTargetTag}
          repositoryPath={tabRepoPath}
          onClose={() => setPushTargetTag(null)}
          onCompleted={(
            result: Extract<PushGitTagResult, { ok: true }>,
          ) => {
            setPushTargetTag(null);
            notification.success({
              message: 'Tag pushed',
              description: `Tag "${result.tagName}" was pushed to ${result.remote}.`,
              placement: 'bottomLeft',
            });
            reloadGitLog(false);
            loadTagStatuses(true);
          }}
        />
        <DeleteRemoteTagModal
          tagName={deleteRemoteTargetTag}
          repositoryPath={tabRepoPath}
          onClose={() => setDeleteRemoteTargetTag(null)}
          onCompleted={(
            result: Extract<DeleteGitTagResult, { ok: true }>,
            alsoDeletedLocally: boolean,
          ) => {
            setDeleteRemoteTargetTag(null);
            const desc = alsoDeletedLocally
              ? `Tag "${result.tagName}" was deleted from ${result.remote} and deleted locally.`
              : `Tag "${result.tagName}" was deleted from ${result.remote}.`;
            notification.success({
              message: 'Tag deleted remotely',
              description: desc,
              placement: 'bottomLeft',
            });
            reloadGitLog(false);
            loadTagStatuses(true);
          }}
        />
        <CherryPickCommit
          commit={cherryPickSource}
          worktrees={worktrees}
          onClose={() => setCherryPickSource(null)}
          onCompleted={(
            result: Extract<
              CherryPickResult,
              { ok: true; status: 'completed' }
            >,
          ) => {
            setCherryPickSource(null);
            notification.success({
              message: 'Commit cherry-picked',
              description: `${result.commit.slice(0, 8)} was cherry-picked onto ${result.targetBranch}.`,
              placement: 'bottomLeft',
            });
            setWorkingTreeRefresh((value) => value + 1);
            reloadGitLog(false);
          }}
        />
      </Suspense>
      {resetTargetCommit && (
        <Suspense fallback={null}>
          <ResetCommitModal
            commit={resetTargetCommit}
            worktree={selectedWorktreeInfo}
            initialMode={resetMode}
            onClose={() => setResetTargetCommit(null)}
            onCompleted={(result: ResetCommitResult) => {
              setResetTargetCommit(null);
              notification.success({
                message: 'Branch Reset Complete',
                description: `Reset ${result.targetBranch} to ${result.commit.slice(0, 8)} (${result.mode}).`,
                placement: 'bottomLeft',
              });
              setWorkingTreeRefresh((value) => value + 1);
              reloadGitLog(false);
            }}
          />
        </Suspense>
      )}
      {revertTargetCommit && (
        <Suspense fallback={null}>
          <RevertCommitModal
            commit={revertTargetCommit}
            worktree={selectedWorktreeInfo}
            onClose={() => setRevertTargetCommit(null)}
            onCompleted={(
              result: Extract<
                RevertCommitResult,
                { ok: true; status: 'completed' }
              >,
            ) => {
              setRevertTargetCommit(null);
              notification.success({
                message: 'Commit Reverted',
                description: `Reverted ${result.commit.slice(0, 8)} on ${result.targetBranch}.`,
                placement: 'bottomLeft',
              });
              setWorkingTreeRefresh((value) => value + 1);
              reloadGitLog(false);
            }}
          />
        </Suspense>
      )}
      {mergeCommitTarget && (
        <Suspense fallback={null}>
          <MergeCommitModal
            commit={mergeCommitTarget}
            worktree={selectedWorktreeInfo}
            onClose={() => setMergeCommitTarget(null)}
            onCompleted={(
              result: Extract<
                WorktreeMergeResult,
                { ok: true; status: 'completed' }
              >,
            ) => {
              setMergeCommitTarget(null);
              notification.success({
                message: 'Merge Completed',
                description: `${result.sourceBranch.slice(0, 8)} was merged into ${result.targetBranch}.`,
                placement: 'bottomLeft',
              });
              setWorkingTreeRefresh((value) => value + 1);
              reloadGitLog(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
