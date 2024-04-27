import { Modal, Typography, notification } from 'antd';
import { ipcRenderer } from 'electron';
import { useEffect, useMemo, useState } from 'react';
import TerminalUI from '../../components/terminal/TerminalUI';
import TabService from '../../services/tab/TabService';

export default function GitLog({
  isModalOpen,
  handleCancel,
  isDarkMode,
}: {
  isModalOpen: boolean;
  handleCancel: any;
  isDarkMode: boolean;
}) {
  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

  const [gitLog, setGitLog] = useState('');

  useEffect(() => {
    ipcRenderer.send('show-git-log', tabRepoPath);
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

    ipcRenderer.on('receive-git-log', onReceiveGitLog);

    return () => {
      ipcRenderer.removeAllListeners('receive-git-log');
    };
  }, [tabRepoPath]);

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
        height: 'calc(100% - 48px)',
        paddingBottom: 0,
      }}
    >
      <div>Git Log</div>
      <TerminalUI
        repositoryPath="repo"
        isDarkMode={isDarkMode}
        output={gitLog
          .replaceAll('*', '🔵 ')
          .replaceAll('->', '➡️ ')
          .replaceAll('-', '➖ ')}
      />
    </Modal>
  );
}
