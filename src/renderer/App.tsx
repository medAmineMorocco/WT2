import React, { Suspense, useEffect, useRef, useState } from 'react';
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
  FloatButton,
  Space,
} from 'antd';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  FolderOutlined,
  MoonOutlined,
  MoreOutlined,
  PlusOutlined,
  SunOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { CommandIcon } from 'hugeicons-react';
import { ipcRenderer } from 'electron';
import ContentTab from './ContentTab';
import TabService from './services/tab/TabService';
import { ItemsProvider, useItemsContext } from './TabsContext';
import KeyboardShortcuts from './modules/KeyboardShortcuts';

const { defaultAlgorithm, darkAlgorithm } = theme;

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

function Hello() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [openKeyboard, setOpenKeyboard] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { items, updateItems, activeKey, setActiveKey } = useItemsContext();

  useEffect(() => {
    setIsDarkMode(window.localStorage.getItem('isDarkMode') === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem('isDarkMode', isDarkMode.toString());
    ipcRenderer.send('change-theme', isDarkMode, activeKey);
    const htmlTags = document.getElementsByTagName('html');
    if (htmlTags.length > 0) {
      const htmlTag = htmlTags[0];
      htmlTag.setAttribute('data-color-scheme', isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode]);

  const onThemeChange = () => {
    setIsDarkMode((previousValue) => !previousValue);
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

  useHotkeys(
    'shift+right',
    () => {
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

    for (const tabKey of tabs) {
      const tabLabel = TabService.getTabLabel(tabKey);
      const tabRepoPath = TabService.getTabRepoPath(tabKey);
      const label = tabRepoPath ? (
        <Tooltip
          arrow={false}
          title={tabRepoPath}
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
  }, []);

  const onChange = (newActiveKey: string) => {
    setActiveKey(newActiveKey);
    TabService.setActiveTab(newActiveKey);
  };

  const add = () => {
    const newActiveKey = `tab${newTabIndex.current++}`;
    const newPanes = [...items];
    newPanes.push({
      label: 'New Tab',
      children: <ContentTab keyTab={newActiveKey} />,
      key: newActiveKey,
      icon: <FolderOutlined />,
    });
    updateItems(newPanes);
    window.localStorage.setItem(newActiveKey, JSON.stringify({}));
    setActiveKey(newActiveKey);
    TabService.setActiveTab(newActiveKey);
  };

  const remove = (targetKey: TargetKey) => {
    if (items.length >= 2) {
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

  useHotkeys('shift+s', openSettingsPage, {
    preventDefault: true,
  });

  useHotkeys('shift+k', openKeyboardShortcuts, {
    preventDefault: true,
  });

  const openMenu = () => {
    setMenuOpen(!isMenuOpen);
  };

  useHotkeys('shift+m', () => openMenu(), {
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
      theme={{ algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm }}
    >
      <AntdApp>
        <Tabs
          type="editable-card"
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
        <FloatButton.Group
          trigger="click"
          type="primary"
          style={{ right: '18px', bottom: '2vh' }}
          icon={
            <Tooltip
              title={
                <Space>
                  <span>Menu</span>
                  <small style={{ color: 'grey' }}>Shift+M</small>
                </Space>
              }
              placement="left"
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
            >
              <MoreOutlined />
            </Tooltip>
          }
          badge={{ dot: true }}
          open={isMenuOpen}
          onClick={openMenu}
        >
          <FloatButton
            icon={
              <Tooltip
                title={
                  <Space>
                    <span>Settings</span>
                    <small style={{ color: 'grey' }}>Shift+S</small>
                  </Space>
                }
                placement="left"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <SettingOutlined />
              </Tooltip>
            }
            onClick={openSettingsPage}
          />
          <FloatButton
            icon={
              <Tooltip
                title={
                  <Space>
                    <span>Keyboard shortcuts</span>
                    <small style={{ color: 'grey' }}>Shift+K</small>
                  </Space>
                }
                placement="left"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <CommandIcon size={18} />
              </Tooltip>
            }
            onClick={openKeyboardShortcuts}
          />
          <FloatButton
            icon={
              <Tooltip
                title={
                  <Space>
                    <span>{isDarkMode ? 'Light theme' : 'Dark theme'}</span>
                    <small style={{ color: 'grey' }}>Shift+T</small>
                  </Space>
                }
                placement="left"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                {isDarkMode ? <SunOutlined /> : <MoonOutlined />}
              </Tooltip>
            }
            onClick={onThemeChange}
          />
        </FloatButton.Group>
        <KeyboardShortcuts
          open={openKeyboard}
          onClose={onCloseKeyboardShortcuts}
        />
      </AntdApp>
    </ConfigProvider>
  );
}

const Settings = React.lazy(() => import('./modules/settings/Settings'));
export default function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
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
      </Suspense>
    </Router>
  );
}
