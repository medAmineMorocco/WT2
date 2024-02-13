import React, { useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { ConfigProvider, Layout, theme } from 'antd';
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
      <Layout style={{ minHeight: '97vh' }}>
        <Worktrees onThemeChange={onThemeChange} />
        <Layout>
          <Content style={{ margin: '8px' }}>
            <Execution />
            <Workflows />
          </Content>
        </Layout>
      </Layout>
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
