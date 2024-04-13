import React, { useEffect, useState } from 'react';
import {
  Alert,
  Collapse,
  Modal,
  Segmented,
  Space,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import {
  BarsOutlined,
  BorderOutlined,
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
  const [logMode, setLogMode] = useState('segment');

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

  const onChangeLogMode = (value: string) => {
    setLogMode(value);
  };

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
      <Segmented
        value={logMode}
        onChange={onChangeLogMode}
        style={{ position: 'absolute', top: '16px', right: '46px' }}
        options={[
          { value: 'segment', icon: <BarsOutlined /> },
          { value: 'sequence', icon: <BorderOutlined /> },
        ]}
        size="small"
      />
      <div style={{ marginTop: '8px', height: '86vh', overflowY: 'auto' }}>
        {logMode === 'segment' ? (
          <Tabs
            tabPosition="top"
            centered
            defaultActiveKey={activeKey}
            items={data}
          />
        ) : (
          <Collapse ghost items={data} />
        )}
      </div>
    </Modal>
  );
}
