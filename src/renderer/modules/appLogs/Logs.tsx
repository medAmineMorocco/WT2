import {
  Button,
  ConfigProvider,
  Layout,
  Typography,
  theme,
  Row,
  Col,
  Empty,
  Tooltip,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { ClearOutlined, CloseOutlined } from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import { useHotkeys } from 'react-hotkeys-hook';

const { defaultAlgorithm, darkAlgorithm } = theme;

export default function Logs() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const [loading, setLoading] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    setIsDarkMode(window.localStorage.getItem('isDarkMode') === 'true');
    ipcRenderer.send('get-logs');

    const onLogsFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setLogs(JSON.parse(result));
      }
      setLoading(false);
    };

    const onLogsCleared = (event: any, code: number) => {
      if (code === 0) {
        ipcRenderer.send('get-logs');
      }
    };

    ipcRenderer.on('logs-found', onLogsFound);
    ipcRenderer.on('logs-cleared', onLogsCleared);

    return () => {
      ipcRenderer.removeAllListeners('logs-found');
      ipcRenderer.removeAllListeners('logs-cleared');
    };
  }, []);

  const onClose = () => {
    navigate('/');
  };

  useHotkeys('esc', onClose, {
    preventDefault: true,
  });

  const clearLogs = () => {
    ipcRenderer.send('clear-logs');
  };

  return (
    <ConfigProvider
      theme={{ algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm }}
    >
      <Layout>
        <Layout style={{ height: '100vh' }}>
          <Layout style={{ padding: '24px' }}>
            <Layout.Content
              style={{
                margin: 0,
                minHeight: 280,
                borderRadius: borderRadiusLG,
                overflowY: 'auto',
                backgroundColor: isDarkMode
                  ? 'rgb(20, 20, 20)'
                  : colorBgContainer,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  backgroundColor: isDarkMode
                    ? 'rgb(20, 20, 20)'
                    : colorBgContainer,
                  zIndex: 1,
                  position: 'sticky',
                  top: 0,
                }}
              >
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={onClose}
                />
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <strong>Logs</strong>
                </div>
                <Tooltip
                  title="Clear Logs"
                  placement="left"
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <Button
                    type="text"
                    icon={<ClearOutlined />}
                    style={{ marginLeft: 'auto' }}
                    onClick={clearLogs}
                  />
                </Tooltip>
              </div>
              <div style={{ padding: 12 }}>
                {logs.length === 0 && (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={loading ? 'Loading logs ...' : 'No logs found'}
                  />
                )}
                <Row gutter={[8, 8]}>
                  {logs.map((log, index) => (
                    <React.Fragment key={index}>
                      <Col span={3}>
                        <Typography.Text>{log.time}</Typography.Text>
                      </Col>
                      <Col span={2} style={{ fontFamily: 'Fira Mono' }}>
                        <Typography.Text>{log.level}</Typography.Text>
                      </Col>
                      <Col span={2}>
                        <Typography.Text>{log.repository}</Typography.Text>
                      </Col>
                      <Col span={17}>
                        {log.level === 'ERROR' || log.level === 'WARNING' ? (
                          <Typography.Text type="danger" copyable>
                            {log.message}
                          </Typography.Text>
                        ) : (
                          <Typography.Text copyable>
                            {log.message}
                          </Typography.Text>
                        )}
                      </Col>
                    </React.Fragment>
                  ))}
                </Row>
              </div>
            </Layout.Content>
          </Layout>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
