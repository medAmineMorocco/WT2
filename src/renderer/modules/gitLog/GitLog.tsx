import {
  notification,
  Space,
  Select,
  Checkbox,
  Popover,
  Spin,
  Tooltip,
  Button,
} from 'antd';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GitBranchIcon } from 'hugeicons-react';
import {
  ReloadOutlined,
  LoadingOutlined,
  SettingOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  InboxOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import pako from 'pako';
import TabService from '../../services/tab/TabService';
import LogUI from '../../components/log/LogUI';
import CommitDetailsPanel from './CommitDetailsPanel';
import CommitFileDiffPane from './CommitFileDiffPane';
import { CommitChangedFile } from '../../../shared/gitCommit';
import { WorkingTreeStatus } from '../../../shared/workingTree';
import WorkingTreePanel from './WorkingTreePanel';
import WorkingTreeFileDiffPane, {
  SelectedWorkingTreeFile,
} from './WorkingTreeFileDiffPane';

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
  const [selectedCommitFile, setSelectedCommitFile] =
    useState<CommitChangedFile | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const selectWorktreeRef = useRef(null);
  const selectAuthorRef = useRef(null);

  const [selectedWorktree, setSelectedWorktree] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);

  const [isAuthorEnabled, setIsAuthorEnabled] = useState(true);
  const [isCommitDateEnabled, setIsCommitDateEnabled] = useState(true);
  const [isHashEnabled, setIsHashEnabled] = useState(true);
  const [isRefsEnabled, setIsRefsEnabled] = useState(true);

  const [shouldHide, setShouldHide] = useState<boolean>(false);

  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const handleWorkingTreeStatusChange = useCallback(
    (status: WorkingTreeStatus) => {
      setWorkingTreeStatus(status);
      if (status.files.length === 0) {
        setWorkingTreeSelected(false);
        setSelectedWorkingTreeFile(null);
      }
    },
    [],
  );

  const closeWorkingTreeFileDiff = useCallback(() => {
    setSelectedWorkingTreeFile(null);
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.send('show-git-log', tabRepoPath);
    window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
    window.electron.ipcRenderer.send('list-authors', tabRepoPath);

    const onReceiveGitLog = (
      code: number,
      result: any,
      skipReceived: number,
    ) => {
      if (code === 0) {
        setLoading(false);
        const decompressed = pako.ungzip(result, { to: 'string' });
        const newCommits = decompressed.split('\n');

        if (newCommits.length < LIMIT) {
          setHasMore(false);
        }

        setLoadingMore(false);
        if (skipReceived === 0) {
          setCommits([...newCommits]);
        } else {
          setCommits((prev) => [...prev, ...newCommits]);
        }
      } else {
        setLoading(false);
        notification.error({
          message: 'Unable to get log',
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreesFound = (code: number, result: any) => {
      if (code === 0) {
        setWorktrees(
          JSON.parse(result).map((item: any) => {
            return {
              label: item.isPrimary
                ? `${item.name || item.resolvedName} (main)`
                : item.name,
              value: item.name,
              path: item.path,
              isPrimary: item.isPrimary,
            };
          }),
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
    window.electron.ipcRenderer
      .invoke('get-working-tree-status', selectedRepositoryPath)
      .then((status: WorkingTreeStatus) => {
        if (!cancelled) setWorkingTreeStatus(status);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedRepositoryPath, workingTreeRefresh]);

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

  const handleChange = (worktree: string | null, author: string | null) => {
    setSelectedWorktree(worktree);
    setSelectedCommit(null);
    setSelectedCommitFile(null);
    setWorkingTreeSelected(false);
    setSelectedWorkingTreeFile(null);
    setSelectedAuthor(author);
    setLoading(true);
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
      window.electron.ipcRenderer.send('show-git-log', tabRepoPath);
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

  const reloadGitLog = () => {
    setLoading(true);
    window.electron.ipcRenderer.send('show-git-log', tabRepoPath);
  };

  const handleLoadMore = () => {
    const nextSkip = skip + LIMIT;
    setSkip(nextSkip);
    setLoadingMore(true);
    window.electron.ipcRenderer.send(
      'show-git-log',
      tabRepoPath,
      null,
      null,
      nextSkip,
    );
  };

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
              value={selectedWorktree}
              placeholder="Worktree"
              options={worktrees}
              onChange={(val: string) => handleChange(val, selectedAuthor)}
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
                  onClick={reloadGitLog}
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
                <WorkingTreeFileDiffPane
                  selection={selectedWorkingTreeFile}
                  repositoryPath={selectedRepositoryPath}
                  onClose={closeWorkingTreeFileDiff}
                  onChanged={() => setWorkingTreeRefresh((value) => value + 1)}
                />
              )}
              {!selectedWorkingTreeFile &&
                selectedCommit &&
                selectedCommitFile && (
                  <CommitFileDiffPane
                    commit={selectedCommit}
                    file={selectedCommitFile}
                    repositoryPath={tabRepoPath}
                    onClose={() => setSelectedCommitFile(null)}
                  />
                )}
              {!selectedWorkingTreeFile &&
                !(selectedCommit && selectedCommitFile) && (
                  <LogUI
                    commits={commits}
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
                  />
                )}
              {hasMore && !selectedCommitFile && !selectedWorkingTreeFile && (
                <div className="git-log-load-more">
                  <Button
                    type="link"
                    onClick={handleLoadMore}
                    icon={loadingMore ? <LoadingOutlined /> : null}
                  >
                    {!loadingMore && <span>Load more commits</span>}
                  </Button>
                </div>
              )}
            </div>
            {selectedCommit && (
              <CommitDetailsPanel
                commit={selectedCommit}
                repositoryPath={tabRepoPath}
                selectedFile={selectedCommitFile}
                onFileSelect={setSelectedCommitFile}
                onClose={() => {
                  setSelectedCommit(null);
                  setSelectedCommitFile(null);
                }}
              />
            )}
            {workingTreeSelected && (
              <WorkingTreePanel
                repositoryPath={selectedRepositoryPath}
                refreshToken={workingTreeRefresh}
                selectedFile={selectedWorkingTreeFile}
                onFileSelect={setSelectedWorkingTreeFile}
                onStatusChange={handleWorkingTreeStatusChange}
                onCommitted={() => {
                  setWorkingTreeRefresh((value) => value + 1);
                  reloadGitLog();
                }}
                onClose={() => {
                  setWorkingTreeSelected(false);
                  setSelectedWorkingTreeFile(null);
                }}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
