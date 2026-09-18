import React, { lazy, Suspense, useEffect, useState } from 'react';
import { theme, Spin, Splitter, StepProps, Typography } from 'antd';
import {
  FileOutlined,
  BlockOutlined,
  ApartmentOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useItemsContext } from '../../TabsContext';
import './Execution.css';

const Log = lazy(() => import('./Log'));
const Visualization = lazy(() => import('./Visualization'));

const { useToken } = theme;

function ExecutionEmptyState() {
  return (
    <div className="execution-empty-container">
      <div className="execution-pipeline-graphic">
        <div className="pipeline-node">
          <ApartmentOutlined />
          <span>Stage 1</span>
        </div>
        <div className="pipeline-connector" />
        <div className="pipeline-node">
          <BranchesOutlined />
          <span>Multi-Worktree</span>
        </div>
        <div className="pipeline-connector" />
        <div className="pipeline-node">
          <CheckCircleOutlined />
          <span>Complete</span>
        </div>
      </div>
      <Typography.Text className="execution-empty-title">
        Execution Pipeline Idle
      </Typography.Text>
      <Typography.Text className="execution-empty-subtitle">
        Trigger a workflow from the table below to monitor real-time command execution across worktrees.
      </Typography.Text>
      <div className="execution-pill-row">
        <span className="execution-badge-pill">⚡ Sequential & Parallel</span>
        <span className="execution-badge-pill">📁 Per-Worktree Progress</span>
        <span className="execution-badge-pill">🔄 Live Step Status</span>
      </div>
    </div>
  );
}

function LogEmptyState() {
  return (
    <div className="log-empty-wrapper">
      <div className="log-terminal-body">
        <div className="log-terminal-line">
          <span className="log-prompt">$</span>
          <span className="log-text-muted">worktreewise workflow --daemon</span>
        </div>
        <div className="log-terminal-line">
          <span className="log-text-success">[ready]</span>
          <span>Workflow runner daemon initialized (v1.0.0)</span>
        </div>
        <div className="log-terminal-line">
          <span className="log-text-muted">[workspace]</span>
          <span>Monitoring active worktrees for execution triggers</span>
        </div>
        <div className="log-terminal-line">
          <span className="log-text-muted">[info]</span>
          <span>Select a workflow below and click Run to stream real-time logs</span>
        </div>
        <div className="log-terminal-line" style={{ marginTop: 10 }}>
          <span className="log-prompt">$</span>
          <span className="log-cursor" />
        </div>
      </div>
    </div>
  );
}

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
        className="execution-panel-card"
        style={{
          flex: 1,
          width: 0,
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          color: token.colorTextBase,
        }}
      >
        <div className="execution-panel-header">
          <div className="execution-header-title">
            <BlockOutlined style={{ color: token.colorPrimary }} />
            <span>Execution Pipeline</span>
          </div>
          {isWorkflowStarted && (
            <span
              className="execution-status-tag"
              style={{
                background: 'rgba(82,196,26,0.1)',
                color: '#52c41a',
                border: '1px solid rgba(82,196,26,0.2)',
              }}
            >
              <span className="execution-status-dot active" />
              Running
            </span>
          )}
        </div>

        <div className="execution-body-scroll">
          {isWorkflowStarted !== null ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.5,
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
            <ExecutionEmptyState />
          )}
        </div>
      </Splitter.Panel>

      <Splitter.Panel
        collapsible
        className="execution-panel-card"
        style={{
          flex: 1,
          width: 0,
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          color: token.colorTextBase,
          padding: '10px 14px',
        }}
      >
        <div className="execution-panel-header">
          <div className="terminal-dots-row">
            <span className="terminal-dot close" />
            <span className="terminal-dot minimize" />
            <span className="terminal-dot maximize" />
          </div>
          <div
            id="console-logs-header-actions"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {isWorkflowStarted && (
              <span
                className="execution-status-tag"
                style={{
                  background: 'rgba(24,144,255,0.1)',
                  color: '#1890ff',
                  border: '1px solid rgba(24,144,255,0.2)',
                }}
              >
                <SyncOutlined spin style={{ fontSize: 10 }} />
                Live Stream
              </span>
            )}
          </div>
        </div>

        <div className="execution-body-scroll">
          {isWorkflowStarted !== null ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.5,
                ease: 'easeInOut',
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                height: '100%',
              }}
            >
              <Suspense fallback={<Spin size="large" />}>
                <Log initialLogStates={initialLogStates} />
              </Suspense>
            </motion.div>
          ) : (
            <LogEmptyState />
          )}
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}
