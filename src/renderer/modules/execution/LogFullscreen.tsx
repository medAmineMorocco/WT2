import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Space, Tabs, Tooltip } from 'antd';
import {
  CheckOutlined,
  CodeOutlined,
  CopyOutlined,
  FileOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';

export default function LogFullscreen({
  isFullScreenMode,
  toggleFullScreenMode,
  activeKey,
}: {
  isFullScreenMode: boolean;
  toggleFullScreenMode: any;
  activeKey: string;
}) {
  const [isCopied, setCopied] = useState(false);

  const logFullscreenRef = useRef();

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

  const onCopyFullscreenClick = () => {
    navigator.clipboard.writeText(logFullscreenRef.current.innerHTML);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  useHotkeys('shift+s', () => toggleFullScreenMode(), {
    preventDefault: true,
  });

  return (
    <Modal
      title={
        <Space>
          <FileOutlined />
          <strong>Log</strong>
        </Space>
      }
      centered
      open={isFullScreenMode}
      className="fullSsceen-modal"
      width="100vw"
      style={{ height: '98vh' }}
      closeIcon={
        <Tooltip
          title={
            <Space>
              <span>Exit fullscreen mode</span>
              <small style={{ color: 'grey' }}>Shift+S</small>
            </Space>
          }
          placement="left"
        >
          <FullscreenExitOutlined
            style={{ cursor: 'pointer' }}
            onClick={toggleFullScreenMode}
            className="icon-action"
          />
        </Tooltip>
      }
      maskClosable
      onCancel={toggleFullScreenMode}
      destroyOnClose
      footer={null}
    >
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
            style={{
              cursor: 'pointer',
              position: 'absolute',
              top: '21px',
              right: '44px',
            }}
            onClick={onCopyFullscreenClick}
          />
        ) : (
          <CheckOutlined
            style={{
              position: 'absolute',
              top: '21px',
              right: '44px',
            }}
          />
        )}
      </Tooltip>
      <div style={{ marginTop: '8px', height: '86vh', overflowY: 'auto' }}>
        <Tabs
          tabPosition="top"
          centered
          defaultActiveKey={activeKey}
          items={data}
        />
      </div>
    </Modal>
  );
}
