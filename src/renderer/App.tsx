import React, { useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { ConfigProvider, Layout, theme } from 'antd';
import Worktrees from './modules/worktrees/Worktrees';

const { Content } = Layout;
const { defaultAlgorithm, darkAlgorithm } = theme;

function Hello() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

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
            <div
              style={{
                padding: 12,
                height: '47vh',
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
              }}
            >
              Bill is a cat.
            </div>
            <div
              style={{
                padding: 12,
                height: '47vh',
                marginTop: '1vh',
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
              }}
            >
              Bill is a cat.
            </div>
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
