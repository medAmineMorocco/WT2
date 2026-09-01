import {
  notification,
  Space,
  Select,
  Checkbox,
  Spin,
  Tooltip,
  Button,
} from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranchIcon } from 'hugeicons-react';
import { ReloadOutlined, LoadingOutlined } from '@ant-design/icons';
import pako from 'pako';
import TabService from '../../services/tab/TabService';
import LogUI from '../../components/log/LogUI';

const LIMIT = 40;

export default function GitLog({ isModal }: { isModal: boolean }) {
  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

  const [worktrees, setWorktrees] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);

  const [commits, setCommits] = useState<string[]>([]);

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
        setTimeout(() => {
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
        }, 4);
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
              label: item.name,
              value: item.name,
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

    window.electron.ipcRenderer.on('receive-git-log', onReceiveGitLog);
    window.electron.ipcRenderer.on('worktrees-found', onWorktreesFound);
    window.electron.ipcRenderer.on('receive-authors', onAuthorsFound);

    return () => {
      window.electron.ipcRenderer.removeAllListeners('receive-git-log');
      window.electron.ipcRenderer.removeAllListeners('receive-authors');
    };
  }, [tabRepoPath]);

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

  const onAuthorChange = (event: any) => {
    setIsAuthorEnabled(event.target.checked);
  };

  const onCommitDateChange = (event: any) => {
    setIsCommitDateEnabled(event.target.checked);
  };

  const onHashChange = (event: any) => {
    setIsHashEnabled(event.target.checked);
  };

  const onRefsChange = (event: any) => {
    setIsRefsEnabled(event.target.checked);
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

  return (
    <>
      <Space className="center-huge-icon">
        <GitBranchIcon size={16} />
        <strong>Git Log</strong>
      </Space>
      <div
        style={{
          width: '100%',
          height: isModal ? 'calc(100% - 94px)' : 'calc(100% - 96px)',
          padding: '12px',
          paddingLeft: 0,
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <Space>
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
              <Checkbox
                defaultChecked={isAuthorEnabled}
                onChange={onAuthorChange}
              >
                Author
              </Checkbox>
            )}
            {!shouldHide && (
              <Checkbox
                defaultChecked={isCommitDateEnabled}
                onChange={onCommitDateChange}
              >
                Date & Time
              </Checkbox>
            )}
            {!shouldHide && (
              <Checkbox defaultChecked={isHashEnabled} onChange={onHashChange}>
                Sha
              </Checkbox>
            )}
            {!shouldHide && (
              <Checkbox defaultChecked={isRefsEnabled} onChange={onRefsChange}>
                Refs
              </Checkbox>
            )}
            {!loading && (
              <Tooltip
                title="Reload Git Log"
                placement="top"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <ReloadOutlined
                  onClick={reloadGitLog}
                  style={{ cursor: 'pointer' }}
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
          <LogUI
            commits={commits}
            isAuthorEnabled={isAuthorEnabled}
            isCommitDateEnabled={isCommitDateEnabled}
            isHashEnabled={isHashEnabled}
            shouldHide={shouldHide}
            isRefsEnabled={isRefsEnabled}
          />
        )}
        {hasMore && !loading && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              type="link"
              onClick={handleLoadMore}
              icon={loadingMore ? <LoadingOutlined /> : null}
            >
              {!loadingMore && <span>Load More</span>}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
