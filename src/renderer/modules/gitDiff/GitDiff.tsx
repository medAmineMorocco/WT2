import { Modal, Typography, notification, Space } from 'antd';
import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useState } from 'react';
import { GitCompareIcon } from 'hugeicons-react';
import TabService from '../../services/tab/TabService';
import 'highlight.js/styles/github.css';
import 'diff2html/bundles/css/diff2html.min.css';
import { useItemsContext } from '../../TabsContext';

export default function GitDiff({
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

  const { isDarkMode } = useItemsContext();

  const [gitDiff, setGitDiff] = useState('');

  useEffect(() => {
    ipcRenderer.send('show-git-diff', tabRepoPath, isDarkMode);
    const onReceiveGitDiff = (event: any, code: number, result: any) => {
      if (code === 0) {
        setGitDiff(result);
      } else {
        notification.error({
          message: 'Unable to get log',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    ipcRenderer.on('receive-git-diff', onReceiveGitDiff);

    return () => {
      ipcRenderer.removeAllListeners('receive-git-diff');
    };
  }, [isDarkMode, tabRepoPath]);

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
        <GitCompareIcon size={16} />
        <strong>Git Diff</strong>
      </Space>
      <div
        style={{
          width: '96%',
          height: 'calc(100% - 46px)',
          padding: '22px',
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: gitDiff }}
          style={{
            position: 'absolute',
            left: '26px',
            right: '26px',
            top: '54px',
            height: '90%',
            overflowY: 'auto',
          }}
        />
      </div>
    </Modal>
  );
}
