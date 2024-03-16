import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layout, message, Progress, theme, Tour, TourProps } from 'antd';
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

const { Content } = Layout;

export default function ContentTab({ keyTab }: { keyTab: string }) {
  const ref1 = useRef(null);
  const ref2 = useRef(null);
  const ref3 = useRef(null);
  const {
    token: { colorPrimary },
  } = theme.useToken();
  const [isRepoSelected, setIsRepoSelected] = useState(false);
  const { items, updateItems } = useItemsContext();
  const [isDarkMode, setIsDarkMode] = useState(
    JSON.parse(window.localStorage.getItem('isDarkMode') || 'false'),
  );
  const [loading, setLoading] = useState(true);
  const [percent, setPercent] = useState(0);
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
    setInterval(() => {
      setPercent(percent + 5);
    }, 100);
  });

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
    }, 2000);
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

  const steps: TourProps['steps'] = [
    {
      title: 'Create a new worktree',
      description: 'Put your files here.',
      cover: (
        <img
          alt="tour.png"
          src="https://www.litmus.com/wp-content/uploads/2021/02/ease-applied-to-tween-with-bouncein-example.gif"
        />
      ),
      target: () => ref1.current,
      placement: 'rightTop',
    },
    {
      title: 'Create a new workflow',
      description: 'Save your changes.',
      cover: (
        <img
          alt="tour.png"
          src="https://www.litmus.com/wp-content/uploads/2021/02/ease-applied-to-tween-with-bouncein-example.gif"
        />
      ),
      target: () => ref2.current,
      placement: 'left',
    },
    {
      title: 'Watch execution of the workflow',
      description: 'Click to see other actions.',
      cover: (
        <img
          alt="tour.png"
          height="180"
          src="https://www.litmus.com/wp-content/uploads/2021/02/ease-applied-to-tween-with-bouncein-example.gif"
        />
      ),
      target: () => ref3.current,
      placement: 'bottom',
    },
  ];

  const isFirstTimeOpenApp = () => {
    return !window.localStorage.getItem('fistTime');
  };

  const onCloseTour = () => {
    window.localStorage.setItem('fistTime', 'true');
  };

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

  if (isRepoSelected) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <Layout style={{ height: 'calc(100vh - 40px)' }}>
          <Worktrees isDarkMode={isDarkMode} ref={ref1} />
          <Layout>
            <Content style={{ margin: '8px' }}>
              <div ref={ref3}>
                <Execution />
              </div>
              <Workflows ref={ref2} />
            </Content>
          </Layout>
        </Layout>
        <Tour open={isFirstTimeOpenApp()} onClose={onCloseTour} steps={steps} />
      </motion.div>
    );
  }
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
      <div
        className={isDarkMode ? 'import-area-dark' : 'import-area'}
        onClick={onimportAreaClick}
      >
        <InboxOutlined style={{ fontSize: '46px', color: '#1677ff' }} />
        <p className="ant-upload-text">Open a repository</p>
      </div>
    </motion.div>
  );
}
