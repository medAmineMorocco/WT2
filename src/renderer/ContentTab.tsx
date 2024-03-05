import React, { useEffect, useState } from 'react';
import { FloatButton, Layout, message, Space } from 'antd';
import {
  MoonOutlined,
  MoreOutlined,
  SunOutlined,
  UnorderedListOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import Worktrees from './modules/worktrees/Worktrees';
import Execution from './modules/execution/Execution';
import Workflows from './modules/workflows/Workflows';
import KeyboardShortcuts from './modules/KeyboardShortcuts';
import TabService from './services/tab/TabService';

const { Content } = Layout;

export default function ContentTab({
  keyTab,
  isDarkMode,
  onThemeChange,
  tabsItems,
  setTabsItems,
}: {
  keyTab: string;
  isDarkMode: boolean;
  onThemeChange: any;
  tabsItems: any;
  setTabsItems: any;
}) {
  const [openKeyboard, setOpenKeyboard] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isRepoSelected, setIsRepoSelected] = useState(false);

  useEffect(() => {
    const tabRepoPath = TabService.getTabRepoPath(keyTab);
    if (tabRepoPath) {
      setIsRepoSelected(true);
    } else {
      setIsRepoSelected(false);
    }
  }, [keyTab]);

  const openMenu = () => {
    setMenuOpen(!isMenuOpen);
  };

  useHotkeys('shift+m', () => openMenu(), {
    preventDefault: true,
  });
  const openKeyboardShortcuts = () => {
    setOpenKeyboard(true);
  };

  const onCloseKeyboardShortcuts = () => {
    setOpenKeyboard(false);
  };

  useHotkeys('shift+k', openKeyboardShortcuts, {
    preventDefault: true,
  });

  const onimportAreaClick = () => {
    ipcRenderer.send('choose-dir');
  };

  useHotkeys('shift+o', () => onimportAreaClick(), { preventDefault: true });

  ipcRenderer.on('selected-repo', function (event, isGitRepo, path, name) {
    if (isGitRepo) {
      if (path && name) {
        const activeTab = TabService.getActiveTab();
        if (keyTab === activeTab) {
          const updatedTabsItems = tabsItems.map((tabItem: any) => {
            if (tabItem.key === activeTab) {
              tabItem.label = name;
            }
            return tabItem;
          });
          setTabsItems(updatedTabsItems);
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
  });

  return isRepoSelected ? (
    <Layout style={{ height: 'calc(100vh - 40px)' }}>
      <Worktrees isDarkMode={isDarkMode} />
      <Layout>
        <Content style={{ margin: '8px' }}>
          <Execution />
          <Workflows />
        </Content>
      </Layout>
      <FloatButton.Group
        trigger="click"
        type="primary"
        style={{ right: '18px', bottom: '2vh' }}
        icon={<MoreOutlined />}
        badge={{ dot: true }}
        tooltip={
          <Space>
            <span>Menu</span>
            <small style={{ color: 'grey' }}>Shift+M</small>
          </Space>
        }
        open={isMenuOpen}
        onClick={openMenu}
      >
        <FloatButton
          icon={<UnorderedListOutlined />}
          tooltip={
            <Space>
              <span>Keyboard shortcuts</span>
              <small style={{ color: 'grey' }}>Shift+K</small>
            </Space>
          }
          onClick={openKeyboardShortcuts}
        />
        <FloatButton
          icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
          tooltip={
            <Space>
              <span>{isDarkMode ? 'Light theme' : 'Dark theme'}</span>
              <small style={{ color: 'grey' }}>Shift+T</small>
            </Space>
          }
          onClick={onThemeChange}
        />
      </FloatButton.Group>
      <KeyboardShortcuts
        open={openKeyboard}
        onClose={onCloseKeyboardShortcuts}
      />
    </Layout>
  ) : (
    <div
      style={{
        width: '100vw',
        height: 'calc(100vh - 40px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div className="import-area" onClick={onimportAreaClick}>
        <p style={{ textAlign: 'center' }}>
          <InboxOutlined style={{ fontSize: '46px', color: '#1677ff' }} />
          <p className="ant-upload-text">Open a repository</p>
        </p>
      </div>
    </div>
  );
}
