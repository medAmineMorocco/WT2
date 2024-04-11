import React, { useEffect, useState } from 'react';
import { Alert, Modal, Space, Tabs, Tooltip, Typography } from 'antd';
import {
  CodeOutlined,
  FileOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
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
                icon={
                  <Typography.Text
                    copyable={{
                      text: commandLog.command,
                      icon: <CodeOutlined />,
                    }}
                  />
                }
                message={commandLog.command}
                action={
                  <Typography.Text
                    copyable={{
                      text: commandLog.output,
                      icon: <FileOutlined />,
                    }}
                  />
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
              <small style={{ color: 'grey' }}>ESC</small>
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
