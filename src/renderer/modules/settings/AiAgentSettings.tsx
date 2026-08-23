import React, { useEffect, useState } from 'react';
import {
  Button,
  Divider,
  Input,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  PlayCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { AiAgentConfig, AiAgentId, aiAgentsDefault } from '../../../shared/aiAgents';

type TestResult = {
  ok: boolean;
  output: string;
};

type DetectionResult = {
  agentId: AiAgentId;
  found: boolean;
  executablePath: string | null;
  version: string | null;
  command: string | null;
};

function readConfiguredAgents() {
  try {
    const stored = window.localStorage.getItem('aiAgents');
    const saved = stored ? (JSON.parse(stored) as AiAgentConfig[]) : [];
    return aiAgentsDefault.map((defaultAgent) => ({
      ...defaultAgent,
      ...saved.find((agent) => agent.id === defaultAgent.id),
    }));
  } catch {
    return aiAgentsDefault;
  }
}

export default function AiAgentSettings() {
  const [agents, setAgents] = useState<AiAgentConfig[]>(readConfiguredAgents);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [detectingAll, setDetectingAll] = useState(false);
  const [detectingId, setDetectingId] = useState<string | null>(null);
  const [detections, setDetections] = useState<Record<string, DetectionResult>>({});

  useEffect(() => {
    const removeTestResult = window.electron.ipcRenderer.on(
      'ai-agent-tested',
      (id: string, code: number, output: string) => {
        setTestingId((current) => (current === id ? null : current));
        setResults((current) => ({
          ...current,
          [id]: { ok: code === 0, output },
        }));
      },
    );
    return () => removeTestResult();
  }, []);

  const updateAgent = (id: string, patch: Partial<AiAgentConfig>) => {
    setAgents((current) => {
      const next = current.map((agent) =>
        agent.id === id ? { ...agent, ...patch } : agent,
      );
      window.localStorage.setItem('aiAgents', JSON.stringify(next));
      return next;
    });
  };

  const handleDetectAll = async () => {
    setDetectingAll(true);
    try {
      const detectedMap: Record<AiAgentId, DetectionResult> =
        await window.electron.ipcRenderer.invoke('ai-agents:detect-all');
      setDetections(detectedMap);
      setAgents((current) => {
        const next = current.map((agent) => {
          const det = detectedMap[agent.id];
          if (det && det.found && det.executablePath) {
            return {
              ...agent,
              command: det.executablePath,
              enabled: true,
            };
          }
          return agent;
        });
        window.localStorage.setItem('aiAgents', JSON.stringify(next));
        return next;
      });
    } catch {
      // Ignore detection errors
    } finally {
      setDetectingAll(false);
    }
  };

  const handleDetectOne = async (id: AiAgentId) => {
    setDetectingId(id);
    try {
      const det: DetectionResult =
        await window.electron.ipcRenderer.invoke('ai-agents:detect-one', id);
      setDetections((current) => ({ ...current, [id]: det }));
      if (det && det.found && det.executablePath) {
        updateAgent(id, { command: det.executablePath, enabled: true });
      }
    } catch {
      // Ignore detection errors
    } finally {
      setDetectingId(null);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <Space
        align="center"
        style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          AI Agents
        </Typography.Title>
        <Button
          type="primary"
          icon={<SearchOutlined />}
          loading={detectingAll}
          onClick={handleDetectAll}
        >
          Auto-Detect All
        </Button>
      </Space>

      <Typography.Paragraph type="secondary">
        Configure the CLI executable used when an AI Agent panel starts in a
        worktree. Click <strong>Auto-Detect All</strong> to automatically search
        and configure installed agent paths across Windows, macOS, and Linux.
      </Typography.Paragraph>

      {agents.map((agent, index) => {
        const det = detections[agent.id];
        return (
          <React.Fragment key={agent.id}>
            {index > 0 && <Divider />}
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space
                align="center"
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <Space align="center" size={8}>
                  <Typography.Text strong>{agent.label}</Typography.Text>
                  {det && det.found && (
                    <Tag color="success">
                      <CheckCircleOutlined /> Auto-Detected{' '}
                      {det.version ? `(${det.version})` : ''}
                    </Tag>
                  )}
                  {det && !det.found && (
                    <Tag color="default">Not detected</Tag>
                  )}
                </Space>
                <Switch
                  checked={agent.enabled}
                  checkedChildren="Enabled"
                  unCheckedChildren="Disabled"
                  onChange={(enabled) => updateAgent(agent.id, { enabled })}
                />
              </Space>

              <Space.Compact style={{ width: '100%' }}>
                <Input
                  aria-label={`${agent.label} executable`}
                  value={agent.command}
                  placeholder="Executable command or path"
                  onChange={(event) =>
                    updateAgent(agent.id, { command: event.target.value })
                  }
                />
                <Input
                  aria-label={`${agent.label} arguments`}
                  value={agent.args}
                  placeholder="Optional startup arguments"
                  onChange={(event) =>
                    updateAgent(agent.id, { args: event.target.value })
                  }
                />
                <Button
                  icon={<SearchOutlined />}
                  loading={detectingId === agent.id}
                  onClick={() => handleDetectOne(agent.id)}
                >
                  Auto-Detect
                </Button>
                <Button
                  icon={<PlayCircleOutlined />}
                  loading={testingId === agent.id}
                  disabled={!agent.command.trim()}
                  onClick={() => {
                    setTestingId(agent.id);
                    window.electron.ipcRenderer.send('test-ai-agent', agent);
                  }}
                >
                  Test
                </Button>
              </Space.Compact>

              {det && det.found && det.executablePath && agent.command !== det.executablePath && (
                <Space align="center" size={8}>
                  <Typography.Text type="secondary">
                    Detected path: <code>{det.executablePath}</code>
                  </Typography.Text>
                  <Button
                    size="small"
                    type="link"
                    onClick={() =>
                      updateAgent(agent.id, {
                        command: det.executablePath!,
                        enabled: true,
                      })
                    }
                  >
                    Apply path
                  </Button>
                </Space>
              )}

              {results[agent.id] && (
                <Typography.Text type={results[agent.id].ok ? 'success' : 'danger'}>
                  {results[agent.id].ok && <CheckCircleOutlined />}{' '}
                  {results[agent.id].output}
                </Typography.Text>
              )}
              {!agent.enabled && (
                <Tag>Enable to make this agent available in terminals</Tag>
              )}
            </Space>
          </React.Fragment>
        );
      })}
    </div>
  );
}
