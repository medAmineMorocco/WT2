import React, { useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { MoonOutlined, MoreOutlined, SunOutlined } from '@ant-design/icons';
import {
  ConfigProvider,
  Layout,
  theme,
  FloatButton,
  App as AntdApp,
} from 'antd';
import Worktrees from './modules/worktrees/Worktrees';
import Workflows from './modules/workflows/Workflows';
import Execution from './modules/execution/Execution';

const { Content } = Layout;
const { defaultAlgorithm, darkAlgorithm } = theme;

function Hello() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const onThemeChange = () => {
    setIsDarkMode((previousValue) => !previousValue);
  };

  return (
    <ConfigProvider
      theme={{ algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm }}
    >
      <AntdApp>
        <Layout style={{ minHeight: '97vh' }}>
          <Worktrees />
          <Layout>
            <Content style={{ margin: '8px' }}>
              <Execution />
              <Workflows />
            </Content>
          </Layout>
          <FloatButton.Group
            trigger="click"
            type="primary"
            style={{ right: '18px', bottom: '38px' }}
            icon={<MoreOutlined />}
            badge={{ dot: true }}
            tooltip="Preferences"
          >
            <FloatButton
              icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
              tooltip={isDarkMode ? 'Light theme' : 'Dark theme'}
              onClick={onThemeChange}
            />
          </FloatButton.Group>
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
