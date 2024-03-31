import React, { useEffect, useRef, useState } from 'react';
import { Alert, Space, Tabs, Tooltip } from 'antd';
import {
  CheckOutlined,
  CopyOutlined,
  ExpandOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import LogFullscreen from './LogFullscreen';

export default function Log() {
  const [isCopied, setCopied] = useState(false);

  const [isFullScreenMode, setFullScreenMode] = useState(false);

  const logRef = useRef();

  const [activeTabKey, setActiveTabKey] = useState('1');

  const [data, setData] = useState<any[]>();

  useEffect(() => {
    const onReceiveLog = (event: any, logStates: any[]) => {
      const mappedLogStates = logStates.map((item) => {
        item.children = item.data.map((child: string) => {
          return child.split('\n').map((splitted) => {
            if (splitted.includes(':::: ')) {
              return (
                <Alert
                  showIcon
                  icon={<CodeOutlined />}
                  message={splitted.replaceAll('::::', '')}
                  type="info"
                />
              );
            }
            return <div>{splitted}</div>;
          });
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

  const onCopyClick = () => {
    navigator.clipboard.writeText(logRef.current.innerHTML);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const toggleFullScreenMode = () => {
    setFullScreenMode(!isFullScreenMode);
  };

  const onChangeTab = (activeKey: string) => {
    setActiveTabKey(activeKey);
  };

  useHotkeys('shift+s', () => toggleFullScreenMode(), {
    preventDefault: true,
  });

  useHotkeys('shift+l', () => onCopyClick(), {
    preventDefault: true,
  });

  return (
    <>
      <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
        <Space>
          <Tooltip
            title={
              !isCopied ? (
                <Space>
                  <span>Copy</span>
                  <small style={{ color: 'grey' }}>Shift+L</small>
                </Space>
              ) : (
                'Copied!'
              )
            }
            placement="left"
          >
            {!isCopied ? (
              <CopyOutlined
                style={{ cursor: 'pointer' }}
                onClick={onCopyClick}
              />
            ) : (
              <CheckOutlined />
            )}
          </Tooltip>
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
