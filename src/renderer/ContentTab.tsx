import React, { useEffect, useMemo, useState } from 'react';
import { Layout, message, Spin } from 'antd';
import {
  InboxOutlined,
  LoadingOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import Worktrees from './modules/worktrees/Worktrees';
import Execution from './modules/execution/Execution';
import Workflows from './modules/workflows/Workflows';
import TabService from './services/tab/TabService';
import { useItemsContext } from './TabsContext';

const { Content } = Layout;

export default function ContentTab({ keyTab }: { keyTab: string }) {
  const [isRepoSelected, setIsRepoSelected] = useState(false);
  const { items, updateItems } = useItemsContext();
  const [isDarkMode, setIsDarkMode] = useState(
    JSON.parse(window.localStorage.getItem('isDarkMode') || 'false'),
  );
  const [loading, setLoading] = useState(true);

  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  function changeIconOfActiveTab(icon: any) {
    const newItems = items.map((item: any) => {
      if (item.key === keyTab) {
        item.icon = icon;
      }
      return item;
    });
    updateItems(newItems);
  }

  useEffect(() => {
    changeIconOfActiveTab(<LoadingOutlined />);
    const tabRepoPath = TabService.getTabRepoPath(keyTab);
    if (tabRepoPath) {
      setIsRepoSelected(true);
    } else {
      setIsRepoSelected(false);
    }
    setTimeout(() => {
      changeIconOfActiveTab(<FolderOutlined />);
      setLoading(false);
    }, 300);
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

  ipcRenderer.on(`theme-changed-${keyTab}`, function (event, isDarkModeNew) {
    setIsDarkMode(isDarkModeNew);
  });

  if (loading) {
    return (
      <Layout
        style={{ height: 'calc(100vh - 40px)', justifyContent: 'center' }}
      >
        <Spin />
      </Layout>
    );
  }

  if (isRepoSelected) {
    return (
      <Layout style={{ height: 'calc(100vh - 40px)' }}>
        <Worktrees isDarkMode={isDarkMode} />
        <Layout>
          <Content style={{ margin: '8px' }}>
            <Execution />
            <Workflows />
          </Content>
        </Layout>
      </Layout>
    );
  }
  return (
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
      <div
        className={isDarkMode ? 'import-area-dark' : 'import-area'}
        onClick={onimportAreaClick}
      >
        <InboxOutlined style={{ fontSize: '46px', color: '#1677ff' }} />
        <p className="ant-upload-text">Open a repository</p>
      </div>
    </div>
  );
}
