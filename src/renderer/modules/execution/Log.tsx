import React, { useEffect, useState } from 'react';
import {
  Alert,
  Collapse,
  Segmented,
  Space,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import {
  ExpandOutlined,
  CodeOutlined,
  FileOutlined,
  BarsOutlined,
  BorderOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import LogFullscreen from './LogFullscreen';
import TerminalUI from '../../components/terminal/TerminalUI';

export default function Log() {
  const [isFullScreenMode, setFullScreenMode] = useState(false);

  const [activeTabKey, setActiveTabKey] = useState('1');

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

  const toggleFullScreenMode = () => {
    setFullScreenMode(!isFullScreenMode);
  };

  const onChangeTab = (activeKey: string) => {
    setActiveTabKey(activeKey);
  };

  useHotkeys('shift+f', () => toggleFullScreenMode(), {
    preventDefault: true,
  });

  const onChangeLogMode = (value: string) => {
    setLogMode(value);
  };

  return (
    <>
      <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
        <Space>
          <Segmented
            value={logMode}
            onChange={onChangeLogMode}
            options={[
              { value: 'segment', icon: <BarsOutlined /> },
              { value: 'sequence', icon: <BorderOutlined /> },
            ]}
            size="small"
          />
          <Tooltip
            title={
              <Space>
                <span>Enter fullscreen mode</span>
                <small style={{ color: 'grey' }}>Shift+F</small>
              </Space>
            }
            placement="left"
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
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
          position: 'relative',
          marginTop: '8px',
          height: 'calc(41.5vh - 20px)',
          overflowY: 'auto',
        }}
      >
        {logMode === 'segment' ? (
          <Tabs
            tabPosition="left"
            style={{
              height: 'calc(41.5vh - 20px)',
            }}
            className="log-tabs"
            onChange={onChangeTab}
            items={data}
          />
        ) : (
          <Collapse ghost defaultActiveKey="0" items={data} />
        )}
      </div>
      <LogFullscreen
        isFullScreenMode={isFullScreenMode}
        toggleFullScreenMode={toggleFullScreenMode}
        activeKey={activeTabKey}
      />
    </>
  );
}
