import { ConfigProvider, Layout, Menu, MenuProps, theme } from 'antd';
import {
  RollbackOutlined,
  NotificationOutlined,
  ApiOutlined,
  ClearOutlined,
  CodeOutlined,
  NodeIndexOutlined,
  FontSizeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import EditorSettings from './EditorSettings';
import CacheSettings from './CacheSettings';
import GitSettings from './GitSettings';
import ShellSettings from './ShellSettings';
import EncodingSettings from './EncodingSettings';

const { defaultAlgorithm, darkAlgorithm } = theme;

const itemsMenu: MenuProps['items'] = [
  {
    key: '-1',
    label: 'Exit Settings',
    icon: <RollbackOutlined />,
    danger: true,
  },
  {
    key: '2',
    label: 'Editors',
    icon: <ApiOutlined />,
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

  const [keyNavigation, setKeyNavigation] = useState('0');
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
    return <CacheSettings />;
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
              defaultSelectedKeys={['0']}
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
              {getContent()}
            </Layout.Content>
          </Layout>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
