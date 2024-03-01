import React, { useState } from 'react';
import { FloatButton, Layout, Space } from 'antd';
import {
  MoonOutlined,
  MoreOutlined,
  SunOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import Worktrees from './modules/worktrees/Worktrees';
import Execution from './modules/execution/Execution';
import Workflows from './modules/workflows/Workflows';
import KeyboardShortcuts from './modules/KeyboardShortcuts';

const { Content } = Layout;

export default function ContentTab({
  keyTab,
  isDarkMode,
  onThemeChange,
}: {
  keyTab: string;
  isDarkMode: boolean;
  onThemeChange: any;
}) {
  const [openKeyboard, setOpenKeyboard] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);

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

  return (
    <Layout style={{ height: 'calc(100vh - 40px)' }}>
      <Worktrees isDarkMode={isDarkMode} keyTab={keyTab} />
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
  );
}
