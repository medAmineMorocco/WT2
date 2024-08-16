import { Modal, Typography, notification, Space, Select, Result } from 'antd';
import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranchIcon } from 'hugeicons-react';
import { LoadingOutlined } from '@ant-design/icons';
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

  const [gitLog, setGitLog] = useState('');

  const [loading, setLoading] = useState<boolean>(true);

  const selectWorktreeRef = useRef(null);

  useEffect(() => {
    ipcRenderer.send('show-git-log', tabRepoPath);
    ipcRenderer.send('get-worktrees', tabRepoPath);

    const onReceiveGitLog = (event: any, code: number, result: any) => {
      if (code === 0) {
        setTimeout(() => {
          setLoading(false);
          setGitLog(result);
        }, 4);
      } else {
        notification.error({
          message: 'Unable to get log',
          description: <Typography.Text copyable>{result}</Typography.Text>,
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
      }
    };

    ipcRenderer.on('receive-git-log', onReceiveGitLog);
    ipcRenderer.on('worktrees-found', onWorktreesFound);

    return () => {
      ipcRenderer.removeAllListeners('receive-git-log');
      ipcRenderer.removeAllListeners('worktrees-found');
    };
  }, [tabRepoPath]);

  const handleChange = (value: string) => {
    setLoading(true);
    if (selectWorktreeRef.current) {
      // @ts-ignore
      selectWorktreeRef.current.blur();
    }
    ipcRenderer.send('show-git-log', tabRepoPath, value);
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
      <Space>
        <GitBranchIcon size={16} />
        <strong>Git Log</strong>
      </Space>
      <div
        style={{ width: '100%', height: 'calc(100% - 94px)', padding: '12px' }}
      >
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <Select
            ref={selectWorktreeRef}
            placeholder="Select a worktree"
            options={worktrees}
            onChange={handleChange}
            style={{ width: 220 }}
          />
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
