import React, { useEffect, useState } from 'react';
import { Button, Divider, Input, Space, Switch, Tag, Typography } from 'antd';
import { CheckCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { AiAgentConfig, aiAgentsDefault } from '../../../shared/aiAgents';

type TestResult = {
  ok: boolean;
  output: string;
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

  return (
    <div style={{ maxWidth: 900 }}>
      <Typography.Title level={3}>AI Agents</Typography.Title>
      <Typography.Paragraph type="secondary">
        Configure the CLI executable used when an AI Agent panel starts in a
        worktree. WorktreeWise runs the selected command inside that
        worktree&apos;s terminal and shows its output there. Arguments are passed
        exactly as written.
      </Typography.Paragraph>

      {agents.map((agent, index) => (
        <React.Fragment key={agent.id}>
          {index > 0 && <Divider />}
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
              <Typography.Text strong>{agent.label}</Typography.Text>
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
                placeholder="Executable command"
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
            {results[agent.id] && (
              <Typography.Text type={results[agent.id].ok ? 'success' : 'danger'}>
                {results[agent.id].ok && <CheckCircleOutlined />} {' '}
                {results[agent.id].output}
              </Typography.Text>
            )}
            {!agent.enabled && <Tag>Enable to make this agent available in terminals</Tag>}
          </Space>
        </React.Fragment>
      ))}
    </div>
  );
}
