import React, { useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import {
  MoonOutlined,
  MoreOutlined,
  SunOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  ConfigProvider,
  Layout,
  theme,
  FloatButton,
  Space,
  App as AntdApp,
} from 'antd';
import { useHotkeys } from 'react-hotkeys-hook';
import Worktrees from './modules/worktrees/Worktrees';
import Workflows from './modules/workflows/Workflows';
import Execution from './modules/execution/Execution';
import KeyboardShortcuts from './modules/KeyboardShortcuts';

const { Content } = Layout;
const { defaultAlgorithm, darkAlgorithm } = theme;

function Hello() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [openKeyboard, setOpenKeyboard] = useState(false);

  const onThemeChange = () => {
    setIsDarkMode((previousValue) => !previousValue);
  };

  const openMenu = () => {
    setMenuOpen(!isMenuOpen);
  };

  const openKeyboardShortcuts = () => {
    setOpenKeyboard(true);
  };

  const onCloseKeyboardShortcuts = () => {
    setOpenKeyboard(false);
  };

  useHotkeys('shift+m', () => openMenu(), {
    preventDefault: true,
  });

  useHotkeys('shift+t', () => onThemeChange(), {
    preventDefault: true,
  });

  useHotkeys('shift+k', () => setOpenKeyboard(true), {
    preventDefault: true,
  });

  return (
    <ConfigProvider
      theme={{ algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm }}
    >
      <AntdApp>
        <Layout style={{ height: '100vh' }}>
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
      </AntdApp>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
