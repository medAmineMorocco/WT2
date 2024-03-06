import React, { useEffect, useMemo, useState } from 'react';
import { Layout, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import Worktrees from './modules/worktrees/Worktrees';
import Execution from './modules/execution/Execution';
import Workflows from './modules/workflows/Workflows';
import TabService from './services/tab/TabService';
import { useItemsContext } from './TabsContext';

const { Content } = Layout;

export default function ContentTab({
  keyTab,
  isDarkMode,
}: {
  keyTab: string;
  isDarkMode: boolean;
}) {
  const [isRepoSelected, setIsRepoSelected] = useState(false);
  const { items, updateItems } = useItemsContext();

  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  useEffect(() => {
    const tabRepoPath = TabService.getTabRepoPath(keyTab);
    if (tabRepoPath) {
      setIsRepoSelected(true);
    } else {
      setIsRepoSelected(false);
    }
  }, [keyTab]);

  const onimportAreaClick = () => {
    ipcRenderer.send('choose-dir', keyTab);
  };

  useHotkeys('shift+o', onimportAreaClick, {
    preventDefault: true,
    enabled: () => {
      return !isRepoSelected;
    },
  });

  ipcRenderer.on(
    `selected-repo-${keyTab}`,
    function (event, isGitRepo, path, name) {
      if (isGitRepo) {
        if (path && name) {
          if (keyTab === activeTab) {
            const updatedTabsItems = items.map((tabItem: any) => {
              if (tabItem.key === activeTab) {
                tabItem.label = name;
              }
              return tabItem;
            });
            updateItems(updatedTabsItems);
            window.localStorage.setItem(
              activeTab,
              JSON.stringify({ repoName: name, selectedRepoPath: path }),
            );
            setIsRepoSelected(true);
            message.destroy();
            message.success('Success! Repository Imported 🎉');
          }
        }
      } else {
        message.destroy();
        message.error('Oops! Not a Git Repository ☹️');
      }
    },
  );

  return isRepoSelected ? (
    <Layout style={{ height: 'calc(100vh - 40px)' }}>
      <Worktrees isDarkMode={isDarkMode} />
      <Layout>
        <Content style={{ margin: '8px' }}>
          <Execution />
          <Workflows />
        </Content>
      </Layout>
    </Layout>
  ) : (
    <div
      className={
        isDarkMode ? 'import-area-dark-container' : 'import-area-container'
      }
      style={{
        width: '100vw',
        height: 'calc(100vh - 40px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div className="import-area" onClick={onimportAreaClick}>
        <InboxOutlined style={{ fontSize: '46px', color: '#1677ff' }} />
        <p className="ant-upload-text">Open a repository</p>
      </div>
    </div>
  );
}
