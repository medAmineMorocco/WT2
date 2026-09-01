import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Layout,
  message,
  Progress,
  Result,
  Spin,
  theme,
  Typography,
} from 'antd';
import {
  InboxOutlined,
  LoadingOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { motion } from 'framer-motion';
import Worktrees from './modules/worktrees/Worktrees';
import Execution from './modules/execution/Execution';
import TabService from './services/tab/TabService';
import { useItemsContext } from './TabsContext';
import Loader from './components/Loader';

const { Content } = Layout;
const Workflows = lazy(() => import('./modules/workflows/Workflows'));
const GitLog = lazy(() => import('./modules/gitLog/GitLog'));

export default function ContentTab({ keyTab }: { keyTab: string }) {
  const ref1 = useRef(null);
  const ref2 = useRef(null);
  const ref3 = useRef(null);
  const {
    token: { colorPrimary },
  } = theme.useToken();
  const [isRepoSelected, setIsRepoSelected] = useState<Boolean>();
  const { items, updateItems, setActiveKey, isFirstRender, setIsFirstRender } =
    useItemsContext();
  const [isDarkMode, setIsDarkMode] = useState(
    JSON.parse(window.localStorage.getItem('isDarkMode') || 'false'),
  );
  const [loading, setLoading] = useState<Boolean | null>(null);
  const [percent, setPercent] = useState(0);
  const activeTab = useMemo(() => TabService.getActiveTab(), []);
  const tabRepoPath = TabService.getTabRepoPath(keyTab);
  const [isRepoExistsOnDisk, setIsRepoExistsOnDisk] = useState<boolean>(true);

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
        setIsFirstRender(false);
      }, 900);
    } else {
      changeIconOfActiveTab(<FolderOutlined />);
      setTimeout(() => {
        setIsFirstRender(false);
      }, 900);
    }
    // do not touch
  }, [isRepoSelected]);

  useEffect(() => {
    changeIconOfActiveTab(<LoadingOutlined />);
    if (tabRepoPath) {
      window.electron.ipcRenderer.send('check-repo-exists', tabRepoPath);
    } else {
      setIsRepoSelected(false);
    }
    // do not touch
  }, [keyTab]);

  const onimportAreaClick = () => {
    window.electron.ipcRenderer.send('choose-dir', keyTab);
  };

  useHotkeys('shift+o', onimportAreaClick, {
    preventDefault: true,
    enabled: () => {
      return !isRepoSelected;
    },
  });

  useEffect(() => {
    const onSelectRepo = (
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

    const onThemeChange = (isDarkModeNew: boolean) => {
      setIsDarkMode(isDarkModeNew);
    };

    const onRepoExist = (isExist: boolean) => {
      if (isExist) {
        setIsRepoSelected(true);
        setIsRepoExistsOnDisk(true);
      } else {
        setIsRepoSelected(false);
        setIsRepoExistsOnDisk(false);
      }
    };

    window.electron.ipcRenderer.on(`selected-repo-${keyTab}`, onSelectRepo);
    window.electron.ipcRenderer.on(`theme-changed-${keyTab}`, onThemeChange);
    window.electron.ipcRenderer.on('is-repo-exist', onRepoExist);

    return () => {
      window.electron.ipcRenderer.removeAllListeners(`selected-repo-${keyTab}`);
      window.electron.ipcRenderer.removeAllListeners(`theme-changed-${keyTab}`);
      window.electron.ipcRenderer.removeAllListeners('is-repo-exist');
    };
  }, [activeTab, items, keyTab, setActiveKey, updateItems]);

  if (isFirstRender === true) {
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

  if (!isRepoSelected && !isRepoExistsOnDisk) {
    return (
      <div
        style={{
          height: 'calc(100vh - 40px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Result
          status="warning"
          title={
            <Typography.Title level={3}>
              The repository at{' '}
              <Typography.Text type="secondary">{tabRepoPath}</Typography.Text>{' '}
              no longer exists on disk.
            </Typography.Title>
          }
        />
      </div>
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
        transition={{ duration: 1, ease: 'easeInOut' }}
      >
        <Layout style={{ height: 'calc(100vh - 40px)' }}>
          <Worktrees
            isDarkMode={isDarkMode}
            ref={ref1}
            mode={mode}
            onChangeMode={onChangeMode}
          />
          <Layout
            style={{
              // eslint-disable-next-line no-nested-ternary
              backgroundColor: isDarkMode
                ? 'black'
                : mode === 'GIT_LOG'
                  ? '#ffffff5e'
                  : '',
            }}
          >
            <Content style={{ margin: '8px' }}>
              {mode === 'WORKFLOW' && (
                <div ref={ref3}>
                  <Execution />
                </div>
              )}
              {mode === 'WORKFLOW' && (
                <Suspense fallback={<Spin size="large" />}>
                  <Workflows ref={ref2} />
                </Suspense>
              )}

              {mode === 'GIT_LOG' && (
                <Suspense fallback={<Spin size="large" />}>
                  <GitLog isModal={false} />
                </Suspense>
              )}
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
        transition={{ duration: 1, ease: 'easeOut' }}
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
