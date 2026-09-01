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
import log from 'electron-log';
import TerminalUI from '../../components/terminal/TerminalUI';
import { useItemsContext } from '../../TabsContext';

export default function Log({ initialLogStates }: { initialLogStates: any[] }) {
  const { isWorkflowPlaying } = useItemsContext();

  const [isFullScreenMode, setFullScreenMode] = useState(false);

  const [activeTabKey, setActiveTabKey] = useState('0');

  const [data, setData] = useState<any[]>();

  const [logMode, setLogMode] = useState('segment');

  const latestLogsRef = React.useRef<any[]>(initialLogStates || []);

  const removeANSI = useCallback((str: string) => {
    if (!str) return '';
    return str
      // OSC sequences: ESC ] ... (BEL or ESC \)
      .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
      // CSI / ANSI control sequences
      .replace(
        // eslint-disable-next-line no-control-regex
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        '',
      )
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
      .replace(/\r\n/g, '\n');
  }, []);

  const buildLog = useCallback(
    (logStatesReceived: any[]) => {
      if (!logStatesReceived) return [];
      return logStatesReceived.map((item) => {
        const copy = { ...item };
        copy.children = Object.entries(item.data || {}).map(
          ([commandKey, value]) => {
            const commandLog = value as any;
            const isCommandFinished =
              commandLog.status &&
              (commandLog.status === 'finished' || commandLog.status === 'error');
            const plainTextOutput = removeANSI(commandLog.output || '');
            const rawOutput = commandLog.output || '';
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
                          text: plainTextOutput,
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
                  <TerminalUI output={rawOutput} />
                </div>
                {commandLog.suggestedCommands?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Typography.Title level={5}>
                      Suggested commands
                    </Typography.Title>
                    {commandLog.suggestedCommands.map((suggestion: any) => (
                      <div key={suggestion.id} style={{ marginBottom: 10 }}>
                        <Typography.Text strong>
                          {suggestion.label}
                        </Typography.Text>
                        {suggestion.description && (
                          <Typography.Paragraph
                            type="secondary"
                            style={{ marginBottom: 4 }}
                          >
                            {suggestion.description}
                          </Typography.Paragraph>
                        )}
                        <Typography.Paragraph
                          code
                          copyable={{ text: suggestion.command }}
                          style={{ marginBottom: 0 }}
                        >
                          {suggestion.command}
                        </Typography.Paragraph>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          },
        );
        return copy;
      });
    },
    [removeANSI],
  );

  useEffect(() => {
    if (isWorkflowPlaying === true) {
      setActiveTabKey('0');
    }
  }, [isWorkflowPlaying]);

  useEffect(() => {
    if (
      initialLogStates &&
      initialLogStates.length > 0 &&
      (!latestLogsRef.current || latestLogsRef.current.length === 0)
    ) {
      latestLogsRef.current = initialLogStates;
      setData(buildLog(initialLogStates));
    }
  }, [initialLogStates, buildLog]);

  useEffect(() => {
    const onReceiveLog = (logStatesReceived: any[]) => {
      log.debug('logStatesReceived: ', JSON.stringify(logStatesReceived));
      if (!logStatesReceived || logStatesReceived.length === 0) {
        return;
      }
      latestLogsRef.current = logStatesReceived;
      const mappedLogStates = buildLog(logStatesReceived);
      if (mappedLogStates && mappedLogStates.length > 0) {
        setData(mappedLogStates);
      }
    };

    if (latestLogsRef.current && latestLogsRef.current.length > 0) {
      setData(buildLog(latestLogsRef.current));
    } else if (initialLogStates && initialLogStates.length > 0) {
      latestLogsRef.current = initialLogStates;
      setData(buildLog(initialLogStates));
    }

    const removeLogListener = window.electron.ipcRenderer.on(
      'workflow-started-log-received',
      onReceiveLog,
    );

    return () => {
      if (typeof removeLogListener === 'function') {
        removeLogListener();
      } else {
        window.electron.ipcRenderer.removeAllListeners(
          'workflow-started-log-received',
        );
      }
    };
  }, [buildLog, initialLogStates]);

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
