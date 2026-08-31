import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  MemoryRouter as Router,
  Routes,
  Route,
  useNavigate,
} from 'react-router-dom';
import './App.css';
import {
  ConfigProvider,
  theme,
  App as AntdApp,
  Tabs,
  Tooltip,
  Space,
} from 'antd';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  FolderOutlined,
  PlusOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import * as Sentry from '@sentry/electron/renderer';
import ContentTab from './ContentTab';
import TabService from './services/tab/TabService';
import { ItemsProvider, useItemsContext } from './TabsContext';

const KeyboardShortcuts = lazy(() => import('./modules/KeyboardShortcuts'));
const PackInfos = lazy(() => import('./modules/packInfos/PackInfos'));

Sentry.init({
  dsn: 'https://16dc0811aeb94357a43fc5a2d7af0e0c@app.glitchtip.com/10452',
});

const { defaultAlgorithm, darkAlgorithm } = theme;

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

function Hello() {
  const { notification } = AntdApp.useApp();
  const [openKeyboard, setOpenKeyboard] = useState(false);
  const navigate = useNavigate();
  const {
    items,
    updateItems,
    activeKey,
    setActiveKey,
    isWorkflowPlaying,
    isDarkMode,
    setIsDarkMode,
  } = useItemsContext();

  useEffect(() => {
    setIsDarkMode(window.localStorage.getItem('isDarkMode') === 'true');
  }, [setIsDarkMode]);

  useEffect(() => {
    window.localStorage.setItem('isDarkMode', isDarkMode.toString());
    window.electron.ipcRenderer.send('change-theme', isDarkMode, activeKey);
    const htmlTags = document.getElementsByTagName('html');
    if (htmlTags.length > 0) {
      const htmlTag = htmlTags[0];
      htmlTag.setAttribute('data-color-scheme', isDarkMode ? 'dark' : 'light');
    }
  }, [activeKey, isDarkMode]);

  const onThemeChange = () => {
    setIsDarkMode((previousValue: any) => !previousValue);
  };

  useHotkeys('shift+t', onThemeChange, {
    preventDefault: true,
  });

  const newTabIndex = useRef(
    Number(TabService.getMaxTabKey().replace('tab', '')) + 1,
  );

  const getItem = (array: string[], currentItem: string, direction: string) => {
    const currentIndex = array.indexOf(currentItem);
    let resultItem = null;

    if (currentIndex !== -1) {
      if (direction === 'next' && currentIndex < array.length - 1) {
        resultItem = array[currentIndex + 1];
      } else if (direction === 'previous' && currentIndex > 0) {
        resultItem = array[currentIndex - 1];
      }
    }
    return resultItem;
  };

  const showNotificationOfWorkflowPlaying = () => {
    notification.warning({
      message: 'A workflow is currently running. please stop the workflow.',
      placement: 'bottomLeft',
      duration: 2,
    });
  };

  useHotkeys(
    'shift+right',
    () => {
      if (isWorkflowPlaying) {
        showNotificationOfWorkflowPlaying();
        return;
      }
      const nextTab = getItem(TabService.getTabs(), activeKey, 'next');
      if (nextTab) {
        setActiveKey(nextTab);
        TabService.setActiveTab(nextTab);
      }
    },
    {
      preventDefault: true,
    },
  );

  useHotkeys(
    'shift+left',
    () => {
      if (isWorkflowPlaying) {
        showNotificationOfWorkflowPlaying();
        return;
      }
      const previousTab = getItem(TabService.getTabs(), activeKey, 'previous');
      if (previousTab) {
        setActiveKey(previousTab);
        TabService.setActiveTab(previousTab);
      }
    },
    {
      preventDefault: true,
    },
  );

  const onChange = (newActiveKey: string) => {
    if (isWorkflowPlaying) {
      showNotificationOfWorkflowPlaying();
      return;
    }
    setActiveKey(newActiveKey);
    TabService.setActiveTab(newActiveKey);
  };

  const add = () => {
    updateItems((prevItems: any[]) => {
      // eslint-disable-next-line no-plusplus
      const newActiveKey = `tab${newTabIndex.current++}`;

      const updated = [
        ...prevItems,
        {
          label: 'New Tab',
          children: <ContentTab keyTab={newActiveKey} />,
          key: newActiveKey,
          icon: <FolderOutlined />,
        },
      ];

      window.localStorage.setItem(newActiveKey, JSON.stringify({}));
      setActiveKey(newActiveKey);
      TabService.setActiveTab(newActiveKey);

      return updated;
    });
  };

  const remove = (targetKey: TargetKey) => {
    if (items.length >= 2) {
      if (isWorkflowPlaying && targetKey === activeKey) {
        showNotificationOfWorkflowPlaying();
        return;
      }
      window.localStorage.removeItem(String(targetKey));
      const newPanes = items.filter((item: any) => item.key !== targetKey);
      updateItems(newPanes);
      if (targetKey === activeKey) {
        const newActiveKey = TabService.getMaxTabKey();
        setActiveKey(newActiveKey);
        TabService.setActiveTab(newActiveKey);
      }
    }
  };

  const onEdit = (
    targetKey: React.MouseEvent | React.KeyboardEvent | string,
    action: 'add' | 'remove',
  ) => {
    if (action === 'add') {
      add();
    } else {
      remove(targetKey);
    }
  };

  const onCloseKeyboardShortcuts = () => {
    setOpenKeyboard(false);
  };

  const openKeyboardShortcuts = () => {
    setOpenKeyboard(true);
  };

  const openSettingsPage = () => {
    navigate('/settings');
  };

  useEffect(() => {

    const tabs = TabService.getTabs();
    let newItems = [];

    if (tabs.length === 0) {
      newItems = [
        {
          label: 'Tab 1',
          children: <ContentTab keyTab="tab1" />,
          key: 'tab1',
          icon: <FolderOutlined />,
        },
      ];
      updateItems(newItems);
      setActiveKey('tab1');
      TabService.setActiveTab('tab1');
      window.localStorage.setItem('tab1', JSON.stringify({}));
      return;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const tabKey of tabs) {
      const tabLabel = TabService.getTabLabel(tabKey);
      const tabRepoPath = TabService.getTabRepoPath(tabKey);
      const label = tabRepoPath ? (
        <Tooltip
          arrow={false}
          title={
            <div>
              <Space>
                <ApartmentOutlined />
                <span style={{ fontWeight: 'bold' }}>{tabLabel}</span>
              </Space>
              <Space>
                <FolderOutlined
                  style={{
                    fontSize: '12px',
                  }}
                />
                <span
                  style={{
                    display: 'block',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflowX: 'hidden',
                    width: '210px',
                    direction: 'rtl',
                    fontSize: '12px',
                  }}
                >
                  {tabRepoPath}
                </span>
              </Space>
            </div>
          }
          placement="bottomLeft"
          mouseEnterDelay={0}
          mouseLeaveDelay={0}
        >
          <span>{tabLabel}</span>
        </Tooltip>
      ) : (
        <span>{tabLabel}</span>
      );
      newItems.push({
        label,
        children: <ContentTab keyTab={tabKey} />,
        key: tabKey,
        icon: <FolderOutlined />,
      });
    }
    updateItems(newItems);
    setActiveKey(TabService.getActiveTab());
    // do not touch

    const onRepoFromOutside = (
      dirPath: string,
      dirName: string,
    ) => {
      const allOpenedRepos = TabService.getTabsWithDetails();
      const foundRepo = allOpenedRepos.find(
        (openedRepo) => openedRepo.selectedRepoPath === dirPath,
      );
      if (foundRepo) {
        setActiveKey(foundRepo.tab);
        TabService.setActiveTab(foundRepo.tab);
      } else {
        add();
        const key = TabService.getActiveTab();
        setTimeout(() => {
          window.electron.ipcRenderer.send('choose-dir-from-outside', dirPath, dirName, key);
        }, 500);
      }
    };

    window.electron.ipcRenderer.on('open-dir-from-outside', onRepoFromOutside);

    window.electron.ipcRenderer.on('open-settings', () => {
      openSettingsPage();
    });

    window.electron.ipcRenderer.on('open-shortcuts', () => {
      openKeyboardShortcuts();
    });

    window.electron.ipcRenderer.on('switch-theme', () => {
      onThemeChange();
    });

    window.electron.ipcRenderer.send('renderer-ready');

    return () => {
      window.electron.ipcRenderer.removeAllListeners('open-dir-from-outside');
      window.electron.ipcRenderer.removeAllListeners('open-shortcuts');
      window.electron.ipcRenderer.removeAllListeners('open-settings');
      window.electron.ipcRenderer.removeAllListeners('switch-theme');
    };
  }, []);

  const openLogsPage = () => {
    navigate('/logs');
  };

  useHotkeys('shift+l', openLogsPage, {
    preventDefault: true,
  });

  useHotkeys('shift+s', openSettingsPage, {
    preventDefault: true,
  });

  useHotkeys('shift+k', openKeyboardShortcuts, {
    preventDefault: true,
  });

  useHotkeys('shift+n', add, {
    preventDefault: true,
  });

  useHotkeys(
    'shift+F4',
    () => {
      const activeTab = TabService.getActiveTab();
      remove(activeTab);
    },
    {
      preventDefault: true,
    },
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        token: {
          colorBgLayout: isDarkMode ? 'black' : '#3434340f',
        },
        components: {
          Select: {
            optionActiveBg: isDarkMode ? '#E5E5E524' : '#34343424',
          },
          Segmented: {
            trackBg: isDarkMode ? '#E5E5E524' : '#ebebeb',
          },
          Table: {
            headerBg: isDarkMode ? '#E5E5E524' : '#3434340f',
          },
        },
      }}
    >
      <AntdApp>
        <Tabs
          type="editable-card"
          tabBarExtraContent={{
            right: (
              <Suspense fallback={null}>
                <PackInfos />
              </Suspense>
            ),
          }}
          onChange={onChange}
          activeKey={activeKey}
          onEdit={onEdit}
          items={items}
          addIcon={
            <Tooltip
              title={
                <>
                  <span>New Tab</span>
                  <small style={{ color: 'grey' }}> Shift+N</small>
                </>
              }
              placement="bottomRight"
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
            >
              <PlusOutlined />
            </Tooltip>
          }
          size="small"
          className={
            isDarkMode ? 'repositories-tabs-dark' : 'repositories-tabs'
          }
          destroyInactiveTabPane
        />
        {openKeyboard && (
          <Suspense fallback={null}>
            <KeyboardShortcuts
              open={openKeyboard}
              onClose={onCloseKeyboardShortcuts}
            />
          </Suspense>
        )}
      </AntdApp>
    </ConfigProvider>
  );
}

const Settings = lazy(() => import('./modules/settings/Settings'));
export default function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <AntdApp>
          <Routes>
            <Route
              path="/"
              element={
                <ItemsProvider>
                  <Hello />
                </ItemsProvider>
              }
            />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AntdApp>
      </Suspense>
    </Router>
  );
}
