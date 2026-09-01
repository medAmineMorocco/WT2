import React, { lazy, Suspense, useEffect, useState } from 'react';
import { theme, Space, Spin, Splitter, StepProps } from 'antd';
import { FileOutlined, BlockOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useItemsContext } from '../../TabsContext';

const Log = lazy(() => import('./Log'));
const Visualization = lazy(() => import('./Visualization'));
const LogIllustration = lazy(() => import('../../components/LogIllustration'));
const VisualizationIllustration = lazy(
  () => import('../../components/VisualizationIllustration'),
);

const { useToken } = theme;

export default function Execution() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { isWorkflowPlaying } = useItemsContext();

  const [isWorkflowStarted, setIsWorkflowStarted] = useState<boolean | null>(
    null,
  );
  const [commands, setCommands] = useState<StepProps[]>([]);
  const [initialWorktreesStates, setInitialWorktreesStates] = useState<any[]>(
    [],
  );

  const [initialLogStates, setInitialLogStates] = useState<any[]>([]);

  const { token } = useToken();

  useEffect(() => {
    if (isWorkflowPlaying === true) {
      setIsWorkflowStarted(true);
    }
  }, [isWorkflowPlaying]);

  useEffect(() => {
    const onWorkflowStarted = (
      executedCommands: any[],
      receivedInitialWorktreesStates: any[],
      receivedInitialLogStates: any[],
    ) => {
      setCommands(executedCommands);
      setInitialWorktreesStates(receivedInitialWorktreesStates);
      setInitialLogStates(receivedInitialLogStates);
    };

    const onWorkflowStopped = () => {
      setIsWorkflowStarted(false);
    };

    window.electron.ipcRenderer.on('workflow-started', onWorkflowStarted);
    window.electron.ipcRenderer.on('workflow-stopped', onWorkflowStopped);

    return () => {
      window.electron.ipcRenderer.removeAllListeners('workflow-started');
      window.electron.ipcRenderer.removeAllListeners('workflow-stopped');
    };
  }, []);

  return (
    <Splitter style={{ display: 'flex', gap: '8px' }}>
      <Splitter.Panel
        collapsible
        className="execution-panel-splitter"
        style={{
          flex: 1,
          padding: 12,
          width: 0,
          height: 'calc(48.5vh - 20px)',
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          color: token.colorTextBase,
        }}
      >
        <Space>
          <BlockOutlined />
          <strong>Execution</strong>
        </Space>
        <div
          style={{
            height: '42vh',
            overflowX: 'auto',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          {isWorkflowStarted !== null ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 1,
                ease: 'easeInOut',
              }}
            >
              <Suspense fallback={<Spin size="large" />}>
                <Visualization
                  commands={commands}
                  initialWorktreesStates={initialWorktreesStates}
                />
              </Suspense>
            </motion.div>
          ) : (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }}
            >
              <Suspense fallback={<Spin size="large" />}>
                <VisualizationIllustration />
              </Suspense>
            </div>
          )}
        </div>
      </Splitter.Panel>
      <Splitter.Panel
        collapsible
        className="execution-panel-splitter"
        style={{
          position: 'relative',
          flex: 1,
          padding: 12,
          width: 0,
          height: 'calc(48.5vh - 20px)',
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          color: token.colorTextBase,
        }}
      >
        <Space>
          <FileOutlined />
          <strong>Log</strong>
        </Space>

        {isWorkflowStarted !== null ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 1,
              ease: 'easeInOut',
            }}
          >
            <Suspense fallback={<Spin size="large" />}>
              <Log initialLogStates={initialLogStates} />
            </Suspense>
          </motion.div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            <Suspense fallback={<Spin size="large" />}>
              <LogIllustration />
            </Suspense>
          </div>
        )}
      </Splitter.Panel>
    </Splitter>
  );
}
