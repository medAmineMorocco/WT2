import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Layout, message, Progress, theme } from 'antd';
import {
  InboxOutlined,
  LoadingOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import { motion } from 'framer-motion';
import Worktrees from './modules/worktrees/Worktrees';
import Execution from './modules/execution/Execution';
import Workflows from './modules/workflows/Workflows';
import TabService from './services/tab/TabService';
import { useItemsContext } from './TabsContext';
import Loader from './components/Loader';
import GitLog from './modules/gitLog/GitLog';

const { Content } = Layout;

export default function ContentTab({ keyTab }: { keyTab: string }) {
  const ref1 = useRef(null);
  const ref2 = useRef(null);
  const ref3 = useRef(null);
  const {
    token: { colorPrimary },
  } = theme.useToken();
  const [isRepoSelected, setIsRepoSelected] = useState<Boolean>();
  const { items, updateItems, setActiveKey } = useItemsContext();
  const [isDarkMode, setIsDarkMode] = useState(
    JSON.parse(window.localStorage.getItem('isDarkMode') || 'false'),
  );
  const [loading, setLoading] = useState<Boolean | null>(null);
  const [percent, setPercent] = useState(0);
  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const [mode, setMode] = useState('GIT_LOG');

  const onChangeMode = ({ target: { value } }: any) => {
    setMode(value);
  };

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
    setInterval(() => {
      setPercent(percent + 50);
    }, 10);
  });

  useEffect(() => {
    if (isRepoSelected) {
      setLoading(true);
      setTimeout(() => {
        changeIconOfActiveTab(<FolderOutlined />);
        setLoading(false);
      }, 900);
    } else {
      changeIconOfActiveTab(<FolderOutlined />);
      ipcRenderer.send('clear-interval');
    }
    // do not touch
  }, [isRepoSelected]);

  useEffect(() => {
    changeIconOfActiveTab(<LoadingOutlined />);
    const tabRepoPath = TabService.getTabRepoPath(keyTab);
    if (tabRepoPath) {
      setIsRepoSelected(true);
    } else {
      setIsRepoSelected(false);
    }
    // do not touch
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

  useEffect(() => {
    const onSelectRepo = (
      event: any,
      isCanceled: boolean,
      isGitRepo: boolean,
      isWorktree: boolean,
      path: string,
      name: string,
    ) => {
      if (isCanceled) {
        return;
      }
      setLoading(true);
      if (!isGitRepo) {
        message.destroy();
        message.error('Oops! Not a Git Repository ☹️');
        setLoading(false);
        return;
      }
      if (isWorktree) {
        message.destroy();
        message.error(
          'Oops! This directory appears to be part of a Git worktree ☹️',
        );
        setLoading(false);
        return;
      }
      if (path && name) {
        if (keyTab === activeTab) {
          const allOpenedRepos = TabService.getTabsWithDetails();
          const foundRepo = allOpenedRepos.find(
            (openedRepo) => openedRepo.selectedRepoPath === path,
          );
          if (foundRepo) {
            setLoading(false);
            setActiveKey(foundRepo.tab);
            TabService.setActiveTab(foundRepo.tab);
          } else {
            setLoading(false);
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
      }
    };

    const onThemeChange = (event: any, isDarkModeNew: boolean) => {
      setIsDarkMode(isDarkModeNew);
    };

    ipcRenderer.on(`selected-repo-${keyTab}`, onSelectRepo);
    ipcRenderer.on(`theme-changed-${keyTab}`, onThemeChange);

    return () => {
      ipcRenderer.removeAllListeners(`selected-repo-${keyTab}`);
      ipcRenderer.removeAllListeners(`theme-changed-${keyTab}`);
    };
  }, [activeTab, items, keyTab, setActiveKey, updateItems]);

  if (loading) {
    return (
      <Layout
        style={{
          height: 'calc(100vh - 40px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Loader isDarkMode={isDarkMode} />
        <Progress
          strokeColor={colorPrimary}
          showInfo={false}
          percent={percent}
          size="small"
          style={{ width: 414 }}
        />
      </Layout>
    );
  }
  if (isRepoSelected && loading === null) {
    return <div />;
  }

  if (isRepoSelected && loading !== null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <Layout style={{ height: 'calc(100vh - 40px)' }}>
          <Worktrees
            isDarkMode={isDarkMode}
            ref={ref1}
            mode={mode}
            onChangeMode={onChangeMode}
          />
          <Layout>
            <Content style={{ margin: '8px' }}>
              {mode === 'WORKFLOW' && (
                <div ref={ref3}>
                  <Execution />
                </div>
              )}
              {mode === 'WORKFLOW' && <Workflows ref={ref2} />}
              {mode === 'GIT_LOG' && <GitLog isModal={false} />}
            </Content>
          </Layout>
        </Layout>
      </motion.div>
    );
  }
  if (isRepoSelected === false) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
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
        <Button
          className={isDarkMode ? 'import-area-dark' : 'import-area'}
          onClick={onimportAreaClick}
        >
          <InboxOutlined style={{ fontSize: '46px', color: '#1677ff' }} />
          <p className="ant-upload-text">Open a Repository</p>
        </Button>
      </motion.div>
    );
  }
  return <div />;
}
