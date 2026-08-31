import { ConfigProvider, Layout, Menu, MenuProps, Spin, theme } from 'antd';
import {
  RollbackOutlined,
  ApiOutlined,
  ClearOutlined,
  CodeOutlined,
  NodeIndexOutlined,
  FontSizeOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Tree02Icon } from 'hugeicons-react';

const EditorSettings = lazy(() => import('./EditorSettings'));
const CacheSettings = lazy(() => import('./CacheSettings'));
const GitSettings = lazy(() => import('./GitSettings'));
const ShellSettings = lazy(() => import('./ShellSettings'));
const EncodingSettings = lazy(() => import('./EncodingSettings'));
const WorktreeSettings = lazy(() => import('./WorktreeSettings'));
const AiAgentSettings = lazy(() => import('./AiAgentSettings'));

const { defaultAlgorithm, darkAlgorithm } = theme;

const itemsMenu: MenuProps['items'] = [
  {
    key: '-1',
    label: 'Exit Settings',
    icon: <RollbackOutlined />,
    danger: true,
  },
  {
    key: '1',
    label: 'Worktrees',
    icon: <Tree02Icon size={17} />,
  },
  {
    key: '2',
    label: 'Editors',
    icon: <ApiOutlined />,
  },
  {
    key: '7',
    label: 'AI Agents',
    icon: <RobotOutlined />,
  },
  {
    key: '3',
    label: 'Shell',
    icon: <CodeOutlined />,
  },
  {
    key: '4',
    label: 'Git',
    icon: <NodeIndexOutlined />,
  },
  {
    key: '5',
    label: 'Encoding',
    icon: <FontSizeOutlined />,
  },
  {
    key: '6',
    label: 'Clear cache',
    icon: <ClearOutlined />,
  },
];

export default function Settings() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const [keyNavigation, setKeyNavigation] = useState('1');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsDarkMode(window.localStorage.getItem('isDarkMode') === 'true');
  }, []);

  // @ts-ignore
  const onMenuClick = ({ key }) => {
    setKeyNavigation(key);
  };

  const getContent = () => {
    if (keyNavigation === '-1') {
      navigate('/');
    }
    if (keyNavigation === '1') {
      return <WorktreeSettings />;
    }
    if (keyNavigation === '2') {
      return <EditorSettings isDarkMode={isDarkMode} />;
    }
    if (keyNavigation === '3') {
      return <ShellSettings />;
    }
    if (keyNavigation === '4') {
      return <GitSettings />;
    }
    if (keyNavigation === '5') {
      return <EncodingSettings />;
    }
    if (keyNavigation === '6') {
      return <CacheSettings />;
    }
    return <AiAgentSettings />;
  };

  return (
    <ConfigProvider
      theme={{ algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm }}
    >
      <Layout>
        <Layout style={{ height: '100vh' }}>
          <Layout.Sider width={200} style={{ background: colorBgContainer }}>
            <Menu
              mode="inline"
              defaultSelectedKeys={['1']}
              style={{ height: '100%', borderRight: 0 }}
              items={itemsMenu}
              onClick={onMenuClick}
            />
          </Layout.Sider>
          <Layout style={{ padding: '24px' }}>
            <Layout.Content
              style={{
                padding: 24,
                margin: 0,
                minHeight: 280,
                borderRadius: borderRadiusLG,
                overflowY: 'auto',
                backgroundColor: isDarkMode
                  ? 'rgb(20, 20, 20)'
                  : colorBgContainer,
              }}
            >
              <Suspense fallback={<Spin size="large" />}>
                {getContent()}
              </Suspense>
            </Layout.Content>
          </Layout>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
