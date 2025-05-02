import { Modal, notification, Space, Select, Result } from 'antd';
import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranchIcon } from 'hugeicons-react';
import { LoadingOutlined } from '@ant-design/icons';
import pako from 'pako';
import TabService from '../../services/tab/TabService';
import LogUI from '../../components/log/LogUI';

export default function GitLog({
  isModalOpen,
  handleCancel,
}: {
  isModalOpen: boolean;
  handleCancel: any;
}) {
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

  return (
    <Modal
      open={isModalOpen}
      footer={null}
      onCancel={handleCancel}
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
      <Space className="center-huge-icon">
        <GitBranchIcon size={16} />
        <strong>Git Log</strong>
      </Space>
      <div
        style={{
          width: '100%',
          height: 'calc(100% - 94px)',
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
            <Result
              icon={<LoadingOutlined spin />}
              title="Loading git log ... Sit back and relax 😉"
            />
          </div>
        )}
        {!loading && <LogUI output={gitLog} />}
      </div>
    </Modal>
  );
}
