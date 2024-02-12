import React, { useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { ConfigProvider, Layout, theme, Switch } from 'antd';

const { Content, Sider } = Layout;
const { defaultAlgorithm, darkAlgorithm } = theme;

function Hello() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const [isDarkMode, setIsDarkMode] = useState(false);

  const onChange = () => {
    setIsDarkMode((previousValue) => !previousValue);
  };

  return (
    <ConfigProvider
      theme={{ algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm }}
    >
      <Layout style={{ minHeight: '97vh' }}>
        <Sider
          theme="light"
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
        >
          <div style={{ marginLeft: '8px', marginTop: '8px' }}>
            <Switch
              defaultChecked
              onChange={onChange}
              checkedChildren="Light"
              unCheckedChildren="Dark"
            />
          </div>
        </Sider>
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
