import {
  notification,
  Space,
  Select,
  Checkbox,
  Popover,
  Spin,
  Tooltip,
  Button,
  Input,
} from 'antd';
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
} from '@ant-design/icons';
import pako from 'pako';
import TabService from '../../services/tab/TabService';
import LogUI from '../../components/log/LogUI';
import type { ParsedCommit } from '../../components/log/LogUI';
import { CommitChangedFile } from '../../../shared/gitCommit';
import { WorkingTreeStatus } from '../../../shared/workingTree';
import type { ResetMode } from '../../../shared/gitResetRevert';
import type { SelectedWorkingTreeFile } from './WorkingTreeFileDiffPane';

const GitDiff = lazy(() => import('../gitDiff/GitDiff'));
const CommitDetailsPanel = lazy(() => import('./CommitDetailsPanel'));
const CommitFileDiffPane = lazy(() => import('./CommitFileDiffPane'));
const WorkingTreePanel = lazy(() => import('./WorkingTreePanel'));
const WorkingTreeFileDiffPane = lazy(() => import('./WorkingTreeFileDiffPane'));
const CherryPickCommit = lazy(() => import('./CherryPickCommit'));
const ResetCommitModal = lazy(() => import('./ResetCommitModal'));
const RevertCommitModal = lazy(() => import('./RevertCommitModal'));

const LIMIT = 40;

export default function GitLog({ isModal }: { isModal: boolean }) {
  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

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

  const handleOpenReset = useCallback(
    (commit: ParsedCommit, mode: ResetMode = 'mixed') => {
      setResetMode(mode);
      setResetTargetCommit(commit);
    },
    [],
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const selectWorktreeRef = useRef(null);
  const selectAuthorRef = useRef(null);

  const [selectedWorktree, setSelectedWorktree] = useState<string | null>(null);
  const selectedWorktreeValueRef = useRef<string | null>(null);
  const worktreesInitializedRef = useRef(false);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

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
        const nextSelection = worktreesInitializedRef.current
          ? nextWorktrees.some((item: any) => item.value === currentSelection)
            ? currentSelection
            : null
          : null;
        worktreesInitializedRef.current = true;
        selectedWorktreeValueRef.current = nextSelection;
        setWorktrees(nextWorktrees);
        setSelectedWorktree(nextSelection);
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
  }, [tabRepoPath]);

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
      /^(?:[*|/\\ ]*)?(.*?)(?: \(([^)]+)\))? <([^>]+)> \[([^\]]+)\]\s+([a-f0-9]{7,40})/;
    commits.forEach((line) => {
      if (!line || !line.trim()) return;
      if (/^(?:[*|/\\ ]*)?(?:index|untracked files) on [^:]+:\s/i.test(line)) {
        return;
      }
      const match = line.match(regex);
      if (match) {
        list.push({ subject: match[1] || '', hash: match[5] || '' });
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
      setCurrentMatchIndex(0);
      return;
    }
    const newMatches = commitList.filter(
      (c) =>
        c.hash.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q),
    );
    if (newMatches.length > 0) {
      selectMatch(0, newMatches);
    } else {
      setCurrentMatchIndex(0);
    }
  };

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
    setSelectedWorktree(worktree);
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
    if (selectWorktreeRef.current) {
      // @ts-ignore
      selectWorktreeRef.current.blur();
    }
    if (selectAuthorRef.current) {
      // @ts-ignore
      selectAuthorRef.current.blur();
    }
    window.electron.ipcRenderer.send(
      'show-git-log',
      tabRepoPath,
      worktree,
      author,
      0,
    );
  };

  const runToolbarAction = async (
    action: 'pull' | 'push' | 'stash' | 'pop',
  ) => {
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
      notification.error({
        message: `Git ${action} failed`,
        description: error?.message || String(error),
        placement: 'bottomLeft',
      });
    } finally {
      setGitActionLoading(null);
    }
  };

  const reloadGitLog = (showSpinner = true) => {
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
  };

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
    if (
      matchingCommits.length === 0 &&
      hasMore &&
      !loadingMore &&
      !loading &&
      commits.length < 500
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
          <Space wrap>
            <Select
              ref={selectWorktreeRef}
              value={selectedWorktree || undefined}
              placeholder="All refs"
              options={worktrees}
              onChange={(val?: string) =>
                handleChange(val || null, selectedAuthor)
              }
              allowClear
              style={{ width: 220 }}
            />
            <Select
              ref={selectAuthorRef}
              value={selectedAuthor}
              placeholder="Author"
              options={authors}
              onChange={(val: string) => handleChange(selectedWorktree, val)}
              showSearch
              allowClear
              style={{ width: 220 }}
            />
            <Input
              placeholder="Search Commit"
              prefix={<SearchOutlined style={{ opacity: 0.65 }} />}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    handlePrevMatch();
                  } else {
                    handleNextMatch();
                  }
                }
              }}
              suffix={
                searchQuery.trim() ? (
                  <Space size={2} style={{ marginLeft: 4, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color:
                          matchingCommits.length > 0
                            ? 'var(--ant-color-text-secondary, #6b7280)'
                            : '#ef4444',
                        userSelect: 'none',
                        marginRight: 2,
                        minWidth: 28,
                        textAlign: 'right',
                      }}
                    >
                      {matchingCommits.length > 0
                        ? `${currentMatchIndex + 1}/${matchingCommits.length}`
                        : '0/0'}
                    </span>
                    <Button
                      type="text"
                      size="small"
                      icon={<UpOutlined style={{ fontSize: 10 }} />}
                      disabled={matchingCommits.length === 0}
                      onClick={handlePrevMatch}
                      title="Previous match (Shift+Enter)"
                      style={{ width: 20, height: 20, padding: 0 }}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<DownOutlined style={{ fontSize: 10 }} />}
                      disabled={matchingCommits.length === 0}
                      onClick={handleNextMatch}
                      title="Next match (Enter)"
                      style={{ width: 20, height: 20, padding: 0 }}
                    />
                  </Space>
                ) : null
              }
              allowClear
              className="git-log-search-input"
              style={{ width: searchQuery.trim() ? 300 : 220 }}
            />
            {!shouldHide && (
              <Popover
                content={columnsMenu}
                trigger="click"
                placement="bottomLeft"
              >
                <Button icon={<SettingOutlined />}>Columns</Button>
              </Popover>
            )}
            <span className="git-log-toolbar-divider" />
            <Button
              icon={<CloudDownloadOutlined />}
              loading={gitActionLoading === 'pull'}
              onClick={() => {
                runToolbarAction('pull');
              }}
            >
              Pull
            </Button>
            <Button
              icon={<CloudUploadOutlined />}
              loading={gitActionLoading === 'push'}
              onClick={() => {
                runToolbarAction('push');
              }}
            >
              Push
            </Button>
            <Button
              icon={<InboxOutlined />}
              loading={gitActionLoading === 'stash'}
              onClick={() => {
                runToolbarAction('stash');
              }}
            >
              Stash
            </Button>
            <Button
              icon={<ExportOutlined />}
              loading={gitActionLoading === 'pop'}
              onClick={() => {
                runToolbarAction('pop');
              }}
            >
              Pop
            </Button>
            <Tooltip title="Open Diff (Shift+D)">
              <Button
                icon={<DiffOutlined />}
                onClick={() => setOpenGitDiff(true)}
              >
                Diff
              </Button>
            </Tooltip>
            {!loading && (
              <Tooltip
                title="Reload Git Log"
                placement="top"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <Button
                  type="text"
                  shape="circle"
                  icon={<ReloadOutlined />}
                  aria-label="Reload Git Log"
                  onClick={() => reloadGitLog()}
                />
              </Tooltip>
            )}
          </Space>
        </div>
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
                    selectedWorktree={selectedWorktree}
                    onResetCommit={handleOpenReset}
                    onRevertCommit={setRevertTargetCommit}
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
                  onReset={(mode = 'mixed') => {
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
        <CherryPickCommit
          commit={cherryPickSource}
          worktrees={worktrees}
          onClose={() => setCherryPickSource(null)}
          onCompleted={(result) => {
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
            onCompleted={(result) => {
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
            onCompleted={(result) => {
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
    </>
  );
}
