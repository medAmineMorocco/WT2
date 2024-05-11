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
import TerminalUI from '../../components/terminal/TerminalUI';

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

  const [logStates, setLogStates] = useState<any[]>();

  function removeANSI(str: string) {
    return str.replace(
      // eslint-disable-next-line no-control-regex
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      '',
    );
  }

  useEffect(() => {
    const buildLog = (logStatesReceived: any[]) => {
      return logStatesReceived.map((item) => {
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
                      text: removeANSI(commandLog.output),
                      icon: <FileOutlined />,
                    }}
                  />
                }
                type="info"
                style={{
                  position: 'sticky',
                  top: 0,
                  marginTop: '8px',
                  marginBottom: '8px',
                  borderRadius: 0,
                  zIndex: 88,
                }}
              />
              <div>
                <TerminalUI output={removeANSI(commandLog.output)} />
              </div>
            </div>
          );
        });
        return item;
      });
    };

    if (logStates) {
      const mappedLogStates = buildLog(logStates);
      setData(mappedLogStates);
    }

    const onReceiveLog = (event: any, logStatesReceived: any[]) => {
      setLogStates(logStatesReceived);
      const mappedLogStates = buildLog(logStatesReceived);
      setData(mappedLogStates);
    };

    ipcRenderer.on('workflow-started-log-received', onReceiveLog);

    return () => {
      ipcRenderer.removeAllListeners('workflow-started-log-received');
    };
  }, [logStates]);

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
          mouseEnterDelay={0}
          mouseLeaveDelay={0}
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
      <div
        style={{
          position: 'relative',
          marginTop: '8px',
          height: '86vh',
          overflowY: 'auto',
        }}
      >
        {logMode === 'segment' ? (
          <Tabs
            tabPosition="top"
            centered
            defaultActiveKey={activeKey}
            items={data}
          />
        ) : (
          <Collapse ghost defaultActiveKey="0" items={data} />
        )}
      </div>
    </Modal>
  );
}
