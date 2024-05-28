import { Modal, Typography, notification, Space, Select } from 'antd';
import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useState } from 'react';
import { GitBranchIcon } from 'hugeicons-react';
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

  useEffect(() => {
    ipcRenderer.send('show-git-log', tabRepoPath);
    ipcRenderer.send('get-worktrees', tabRepoPath);

    const onReceiveGitLog = (event: any, code: number, result: any) => {
      if (code === 0) {
        setGitLog(result);
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
        style={{ width: '96%', height: 'calc(100% - 94px)', padding: '22px' }}
      >
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <Select
            placeholder="Select a worktree"
            options={worktrees}
            onChange={handleChange}
            style={{ width: 220 }}
          />
        </div>
        <LogUI output={gitLog} />
      </div>
    </Modal>
  );
}
