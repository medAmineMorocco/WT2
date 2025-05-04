import React, { useCallback, useEffect, useState } from 'react';
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
  ExpandOutlined,
  CodeOutlined,
  FileOutlined,
  BarsOutlined,
  BorderOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import TerminalUI from '../../components/terminal/TerminalUI';
import { useItemsContext } from '../../TabsContext';

export default function Log({ initialLogStates }: { initialLogStates: any[] }) {
  const { isWorkflowPlaying } = useItemsContext();

  const [isFullScreenMode, setFullScreenMode] = useState(false);

  const [activeTabKey, setActiveTabKey] = useState('0');

  const [data, setData] = useState<any[]>();

  const [logMode, setLogMode] = useState('segment');

  const removeANSI = useCallback((str: string) => {
    return str.replace(
      // eslint-disable-next-line no-control-regex
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      '',
    );
  }, []);

  useEffect(() => {
    if (isWorkflowPlaying === true) {
      setActiveTabKey('0');
    }
  }, [isWorkflowPlaying]);

  useEffect(() => {
    const buildLog = (logStatesReceived: any[]) => {
      return logStatesReceived.map((item) => {
        item.children = Object.entries(item.data).map(([commandKey, value]) => {
          const commandLog = value as any;
          const isCommandFinished =
            commandLog.status && commandLog.status === 'finished';
          const commandOutput = removeANSI(commandLog.output);
          return (
            <div key={commandKey}>
              <Alert
                showIcon
                icon={
                  isCommandFinished ? (
                    <Typography.Text
                      copyable={{
                        text: commandLog.command,
                        icon: <CodeOutlined />,
                      }}
                    />
                  ) : (
                    <CodeOutlined />
                  )
                }
                message={commandLog.command}
                action={
                  isCommandFinished ? (
                    <Typography.Text
                      copyable={{
                        text: commandOutput,
                        icon: <FileOutlined />,
                      }}
                    />
                  ) : null
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
                <TerminalUI output={commandOutput} />
              </div>
            </div>
          );
        });
        return item;
      });
    };

    if (initialLogStates) {
      const mappedLogStates = buildLog(initialLogStates);
      setData(mappedLogStates);
    }
    const onReceiveLog = (event: any, logStatesReceived: any[]) => {
      const mappedLogStates = buildLog(logStatesReceived);
      setData(mappedLogStates);
    };

    ipcRenderer.on('workflow-started-log-received', onReceiveLog);

    return () => {
      ipcRenderer.removeAllListeners('workflow-started-log-received');
    };
  }, [initialLogStates, removeANSI]);

  const toggleFullScreenMode = () => {
    setFullScreenMode(!isFullScreenMode);
  };

  const onChangeTab = (activeKey: string) => {
    setActiveTabKey(activeKey);
    const tabsDiv = document.getElementsByClassName('log-tabs');
    if (!isFullScreenMode && tabsDiv) {
      const contentHolderDiv = tabsDiv[0].querySelector(
        '.ant-tabs-content-holder',
      );
      if (contentHolderDiv) {
        contentHolderDiv.scroll({
          top: 0,
          left: 0,
          behavior: 'smooth',
        });
      }
    }
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
                <span>Enter Fullscreen Mode</span>
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
      {!isFullScreenMode ? (
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
              defaultActiveKey="0"
              activeKey={activeTabKey}
              className="log-tabs"
              onChange={onChangeTab}
              items={data}
            />
          ) : (
            <Collapse ghost defaultActiveKey="0" items={data} />
          )}
        </div>
      ) : (
        <Modal
          title={
            <Space>
              <FileOutlined />
              <strong>Log</strong>
            </Space>
          }
          centered
          open={isFullScreenMode}
          className="fullscreen-modal"
          width="100vw"
          style={{ height: '98vh' }}
          closeIcon={
            <Tooltip
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
              title={
                <Space>
                  <span>Exit Fullscreen Mode</span>
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
                defaultActiveKey="0"
                activeKey={activeTabKey}
                onChange={onChangeTab}
                items={data}
              />
            ) : (
              <Collapse ghost defaultActiveKey="0" items={data} />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
