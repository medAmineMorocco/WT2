import { notification, Space, Select, Checkbox, Spin, Tooltip } from 'antd';
import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranchIcon } from 'hugeicons-react';
import { ReloadOutlined } from '@ant-design/icons';
import pako from 'pako';
import TabService from '../../services/tab/TabService';
import LogUI from '../../components/log/LogUI';

export default function GitLog({ isModal }: { isModal: boolean }) {
  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

  const [worktrees, setWorktrees] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);

  const [gitLog, setGitLog] = useState('');

  const [loading, setLoading] = useState<boolean>(true);

  const selectWorktreeRef = useRef(null);
  const selectAuthorRef = useRef(null);

  const [selectedWorktree, setSelectedWorktree] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);

  const [isAuthorEnabled, setIsAuthorEnabled] = useState(true);
  const [isCommitDateEnabled, setIsCommitDateEnabled] = useState(true);
  const [isHashEnabled, setIsHashEnabled] = useState(true);
  const [isRefsEnabled, setIsRefsEnabled] = useState(true);

  const [shouldHide, setShouldHide] = useState<boolean>(false);

  useEffect(() => {
    ipcRenderer.send('show-git-log', tabRepoPath);
    ipcRenderer.send('get-worktrees', tabRepoPath);
    ipcRenderer.send('list-authors', tabRepoPath);

    const onReceiveGitLog = (event: any, code: number, result: any) => {
      if (code === 0) {
        setTimeout(() => {
          setLoading(false);
          const decompressed = pako.ungzip(result, { to: 'string' });
          setGitLog(decompressed);
        }, 4);
      } else {
        setLoading(false);
        notification.error({
          message: 'Unable to get log',
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreesFound = (event: any, code: number, result: any) => {
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

    const onAuthorsFound = (event: any, code: number, result: any) => {
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

    ipcRenderer.on('receive-git-log', onReceiveGitLog);
    ipcRenderer.on('worktrees-found', onWorktreesFound);
    ipcRenderer.on('receive-authors', onAuthorsFound);

    return () => {
      ipcRenderer.removeAllListeners('receive-git-log');
      ipcRenderer.removeAllListeners('worktrees-found');
      ipcRenderer.removeAllListeners('receive-authors');
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
    ipcRenderer.send('show-git-log', tabRepoPath, worktree, author);
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
    ipcRenderer.send('show-git-log', tabRepoPath);
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
          height: isModal ? 'calc(100% - 94px)' : 'calc(100% - 64px)',
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
              height: '100%',
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
            output={gitLog}
            isAuthorEnabled={isAuthorEnabled}
            isCommitDateEnabled={isCommitDateEnabled}
            isHashEnabled={isHashEnabled}
            shouldHide={shouldHide}
            isRefsEnabled={isRefsEnabled}
          />
        )}
      </div>
    </>
  );
}
