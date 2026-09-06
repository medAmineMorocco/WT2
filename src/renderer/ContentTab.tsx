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
  Form,
  Input,
  Layout,
  message,
  Modal,
  Progress,
  Result,
  Spin,
  theme,
  Typography,
} from 'antd';
import {
  InboxOutlined,
  CloudDownloadOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  LoadingOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { motion } from 'framer-motion';
import Worktrees from './modules/worktrees/Worktrees';
import TabService from './services/tab/TabService';
import { useItemsContext } from './TabsContext';
import Loader from './components/Loader';

const { Content } = Layout;
const Workflows = lazy(() => import('./modules/workflows/Workflows'));
const Execution = lazy(() => import('./modules/execution/Execution'));
const GitLog = lazy(() => import('./modules/gitLog/GitLog'));
const WorktreeOverview = lazy(
  () => import('./modules/worktrees/WorktreeOverview'),
);

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
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneForm] = Form.useForm();

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
    if (!isFirstRender) return undefined;
    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 100) {
          return 100;
        }
        return prev + 20;
      });
    }, 120);

    const splashTimer = setTimeout(() => {
      setIsFirstRender(false);
    }, 850);

    return () => {
      clearInterval(interval);
      clearTimeout(splashTimer);
    };
  }, [isFirstRender, setIsFirstRender]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRepoSelected) {
      setLoading(true);
      timer = setTimeout(() => {
        changeIconOfActiveTab(<FolderOutlined />);
        setLoading(false);
      }, 20);
    } else {
      changeIconOfActiveTab(<FolderOutlined />);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
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

  const onLocateMovedRepository = () => {
    window.electron.ipcRenderer.send('choose-dir', keyTab);
  };

  const chooseCloneDirectory = async () => {
    const directory = await window.electron.ipcRenderer.invoke(
      'choose-clone-directory',
    );
    if (directory) cloneForm.setFieldValue('destination', directory);
  };

  const cloneRepository = async (values: {
    repositoryUrl: string;
    destination: string;
    folderName?: string;
  }) => {
    setCloneLoading(true);
    try {
      const cloned = await window.electron.ipcRenderer.invoke(
        'clone-repository',
        values.repositoryUrl,
        values.destination,
        values.folderName,
      );
      setCloneModalOpen(false);
      cloneForm.resetFields();
      window.electron.ipcRenderer.send(
        'choose-dir-from-outside',
        cloned.path,
        cloned.name,
        keyTab,
      );
      message.success('Repository cloned successfully.');
    } catch (error: any) {
      message.error(error?.message || String(error));
    } finally {
      setCloneLoading(false);
    }
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

    const removeSelectedRepo = window.electron.ipcRenderer.on(
      `selected-repo-${keyTab}`,
      onSelectRepo,
    );
    const removeThemeChanged = window.electron.ipcRenderer.on(
      `theme-changed-${keyTab}`,
      onThemeChange,
    );
    const removeRepoExist = window.electron.ipcRenderer.on(
      'is-repo-exist',
      onRepoExist,
    );

    return () => {
      if (typeof removeSelectedRepo === 'function') removeSelectedRepo();
      else
        window.electron.ipcRenderer.removeAllListeners(
          `selected-repo-${keyTab}`,
        );

      if (typeof removeThemeChanged === 'function') removeThemeChanged();
      else
        window.electron.ipcRenderer.removeAllListeners(
          `theme-changed-${keyTab}`,
        );

      if (typeof removeRepoExist === 'function') removeRepoExist();
      else window.electron.ipcRenderer.removeAllListeners('is-repo-exist');
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
          subTitle="The repository may have been moved or renamed. Locate its new folder to reconnect this tab."
          extra={
            <Button type="primary" onClick={onLocateMovedRepository}>
              Locate moved repository
            </Button>
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
                <Suspense fallback={<Spin size="large" />}>
                  <div ref={ref3}>
                    <Execution />
                  </div>
                </Suspense>
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
              {mode === 'OVERVIEW' && (
                <Suspense fallback={<Spin size="large" />}>
                  <WorktreeOverview />
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
        style={{ width: '100vw', height: 'calc(100vh - 40px)' }}
      >
        <div className="repository-start-content">
          <div className="repository-start-heading">
            <Typography.Title level={2}>
              Start with a repository
            </Typography.Title>
            <Typography.Text type="secondary">
              Open a local project or clone one from a remote Git server.
            </Typography.Text>
          </div>
          <div className="repository-start-grid">
            <Button
              className="repository-start-card open-repository-card"
              onClick={onimportAreaClick}
            >
              <span className="repository-start-icon">
                <InboxOutlined />
              </span>
              <span className="repository-start-card-title">
                Open a Repository
              </span>
              <span className="repository-start-card-description">
                Select an existing Git repository from this computer.
              </span>
            </Button>
            <Button
              className="repository-start-card clone-repository-card"
              onClick={() => setCloneModalOpen(true)}
            >
              <span className="repository-start-icon">
                <CloudDownloadOutlined />
              </span>
              <span className="repository-start-card-title">
                Clone a Repository
              </span>
              <span className="repository-start-card-description">
                Download a remote repository and open it in WorktreeWise.
              </span>
            </Button>
          </div>
        </div>
        <Modal
          title="Clone a repository"
          open={cloneModalOpen}
          onCancel={() => {
            if (!cloneLoading) setCloneModalOpen(false);
          }}
          footer={null}
          centered
          destroyOnClose
        >
          <Form form={cloneForm} layout="vertical" onFinish={cloneRepository}>
            <Form.Item
              label="Repository URL"
              name="repositoryUrl"
              rules={[{ required: true, message: 'Enter a repository URL.' }]}
            >
              <Input
                prefix={<LinkOutlined />}
                placeholder="https://github.com/owner/repository.git"
                allowClear
              />
            </Form.Item>
            <Form.Item
              label="Destination folder"
              name="destination"
              rules={[
                { required: true, message: 'Choose a destination folder.' },
              ]}
            >
              <Input
                prefix={<FolderOpenOutlined />}
                readOnly
                placeholder="Choose a parent folder"
                addonAfter={
                  <Button
                    type="text"
                    size="small"
                    onClick={chooseCloneDirectory}
                  >
                    Browse
                  </Button>
                }
              />
            </Form.Item>
            <Form.Item
              label="Folder name"
              name="folderName"
              extra="Optional. By default, the repository name is used."
            >
              <Input placeholder="repository" allowClear />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              icon={<CloudDownloadOutlined />}
              loading={cloneLoading}
            >
              Clone Repository
            </Button>
          </Form>
        </Modal>
      </motion.div>
    );
  }
  return <div />;
}
