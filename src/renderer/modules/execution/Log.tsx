import React, { useEffect, useState } from 'react';
import { Alert, Space, Tabs, Tooltip, Typography } from 'antd';
import { ExpandOutlined, CodeOutlined, FileOutlined } from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import LogFullscreen from './LogFullscreen';

export default function Log() {
  const [isFullScreenMode, setFullScreenMode] = useState(false);

  const [activeTabKey, setActiveTabKey] = useState('1');

  const [data, setData] = useState<any[]>();

  useEffect(() => {
    const onReceiveLog = (event: any, logStates: any[]) => {
      const mappedLogStates = logStates.map((item) => {
        item.children = Object.entries(item.data).map(([commandKey, value]) => {
          const commandLog = value as any;
          return (
            <div key={commandKey}>
              <Alert
                showIcon
                icon={<CodeOutlined />}
                message={commandLog.command}
                action={
                  <Space>
                    <Typography.Text copyable={{ text: commandLog.command }} />
                    <Typography.Text
                      copyable={{
                        text: commandLog.output,
                        icon: <FileOutlined />,
                      }}
                    />
                  </Space>
                }
                type="info"
                style={{ marginTop: '8px', marginBottom: '8px' }}
              />
              {commandLog.output.split('\n').map((splitted: string) => (
                <div>{splitted}</div>
              ))}
            </div>
          );
        });
        return item;
      });
      setData(mappedLogStates);
    };

    ipcRenderer.on('workflow-started-log-received', onReceiveLog);

    return () => {
      ipcRenderer.removeAllListeners('workflow-started-log-received');
    };
  }, []);

  const toggleFullScreenMode = () => {
    setFullScreenMode(!isFullScreenMode);
  };

  const onChangeTab = (activeKey: string) => {
    setActiveTabKey(activeKey);
  };

  useHotkeys('shift+s', () => toggleFullScreenMode(), {
    preventDefault: true,
  });

  return (
    <>
      <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
        <Space>
          <Tooltip
            title={
              <Space>
                <span>Enter fullscreen mode</span>
                <small style={{ color: 'grey' }}>Shift+S</small>
              </Space>
            }
            placement="left"
          >
            <ExpandOutlined
              style={{ cursor: 'pointer' }}
              onClick={toggleFullScreenMode}
              className="icon-action"
            />
          </Tooltip>
        </Space>
      </div>
      <div
        style={{
          marginTop: '8px',
          height: 'calc(41.5vh - 20px)',
        }}
      >
        <Tabs
          tabPosition="left"
          style={{
            height: 'calc(41.5vh - 20px)',
          }}
          className="log-tabs"
          onChange={onChangeTab}
          items={data}
        />
      </div>
      <LogFullscreen
        isFullScreenMode={isFullScreenMode}
        toggleFullScreenMode={toggleFullScreenMode}
        activeKey={activeTabKey}
      />
    </>
  );
}
