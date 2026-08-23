import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import {
  AiAgentConfig,
  AiAgentId,
  aiAgentsDefault,
} from '../../../shared/aiAgents';
import { getAiAgentIcon } from '../../components/aiAgents/AiAgentIcons';

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

function readConfiguredAgents(): AiAgentConfig[] {
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

export default function AiAgentSettings({
  isDarkMode,
}: {
  isDarkMode?: boolean;
}) {
  const [agents, setAgents] = useState<AiAgentConfig[]>(readConfiguredAgents);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [detectingAll, setDetectingAll] = useState(false);
  const [detectingId, setDetectingId] = useState<string | null>(null);
  const [detections, setDetections] = useState<
    Record<string, DetectionResult>
  >({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgentConfig | null>(null);
  const [form] = Form.useForm();

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
    return () => {
      if (typeof removeTestResult === 'function') {
        removeTestResult();
      }
    };
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
      setDetections(detectedMap || {});

      let foundCount = 0;
      setAgents((current) => {
        const next = current.map((agent) => {
          const det = detectedMap?.[agent.id];
          if (det && det.found && det.executablePath) {
            foundCount += 1;
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

      message.success(
        `Auto-detection complete: found ${foundCount} AI agent${foundCount === 1 ? '' : 's'}.`,
      );
    } catch (err: any) {
      message.error(`Detection failed: ${err?.message || err}`);
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
        form.setFieldValue('command', det.executablePath);
        message.success(`Found executable for ${id}: ${det.executablePath}`);
      } else {
        message.warning(`Could not find installed binary for ${id}`);
      }
    } catch (err: any) {
      message.error(`Detection error: ${err?.message || err}`);
    } finally {
      setDetectingId(null);
    }
  };

  const onOpenEditModal = (agent: AiAgentConfig) => {
    setEditingAgent(agent);
    form.setFieldsValue({
      command: agent.command,
      args: agent.args,
    });
    setIsModalOpen(true);
  };

  const handleModalSave = (values: any) => {
    if (!editingAgent) return;
    updateAgent(editingAgent.id, {
      command: values.command || '',
      args: values.args || '',
    });
    setIsModalOpen(false);
    message.success(`Saved configuration for ${editingAgent.label}`);
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            AI Coding Agents
          </Typography.Title>
          <Typography.Text type="secondary">
            Configure CLI assistants and autonomous agents used inside your worktree terminals.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={detectingAll ? <ReloadOutlined spin /> : <ScanOutlined />}
          loading={detectingAll}
          onClick={handleDetectAll}
        >
          {detectingAll ? 'Detecting Agents...' : 'Auto Detect Agents'}
        </Button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {agents.map((agent) => {
          const det = detections[agent.id];
          const isDetected = (det && det.found) || (agent.command && agent.command.trim().length > 0);
          const isTesting = testingId === agent.id;
          const testRes = results[agent.id];

          return (
            <Card
              key={agent.id}
              style={{
                borderRadius: '8px',
                border: agent.enabled
                  ? '2px solid #1677ff'
                  : '1px solid var(--ant-color-border-secondary, #e8e8e8)',
                boxShadow: agent.enabled
                  ? '0 0 8px rgba(22, 119, 255, 0.2)'
                  : 'none',
                position: 'relative',
              }}
              bodyStyle={{ padding: '16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ marginTop: 2 }}>{getAiAgentIcon(agent.id, 34)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 4,
                    }}
                  >
                    <Typography.Text strong style={{ fontSize: 14 }}>
                      {agent.label}
                    </Typography.Text>
                    <Switch
                      size="small"
                      checked={agent.enabled}
                      onChange={(enabled) => updateAgent(agent.id, { enabled })}
                    />
                  </div>

                  <div style={{ marginTop: 4, marginBottom: 6 }}>
                    {isDetected ? (
                      <Tag
                        color="success"
                        icon={<CheckCircleOutlined />}
                        style={{
                          margin: 0,
                          fontSize: 11,
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {det?.version &&
                          !det.version.includes('Error') &&
                          !det.version.includes('Cannot find')
                            ? `Detected (${det.version})`
                            : 'Detected'}
                        </span>
                      </Tag>
                    ) : (
                      <Tag
                        color="error"
                        icon={<CloseCircleOutlined />}
                        style={{ margin: 0, fontSize: 11 }}
                      >
                        Not Recognized
                      </Tag>
                    )}
                  </div>

                  {agent.command ? (
                    <Typography.Text
                      ellipsis
                      copyable={{ text: agent.command }}
                      style={{
                        fontSize: 11,
                        color: '#888',
                        display: 'block',
                        marginTop: 2,
                      }}
                      title={agent.command}
                    >
                      {agent.command}
                    </Typography.Text>
                  ) : (
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 11, fontStyle: 'italic', display: 'block' }}
                    >
                      No command configured
                    </Typography.Text>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '12px',
                    }}
                  >
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => onOpenEditModal(agent)}
                    >
                      Configure
                    </Button>
                    <Button
                      size="small"
                      icon={<PlayCircleOutlined />}
                      loading={isTesting}
                      disabled={!agent.command.trim()}
                      onClick={() => {
                        setTestingId(agent.id);
                        window.electron.ipcRenderer.send('test-ai-agent', agent);
                      }}
                    >
                      Test
                    </Button>
                  </div>

                  {testRes && (
                    <div style={{ marginTop: 8 }}>
                      <Tag color={testRes.ok ? 'green' : 'red'} style={{ fontSize: 10, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {testRes.ok ? 'Verified OK' : 'Test Failed'}
                      </Tag>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={isModalOpen}
        footer={null}
        onCancel={() => setIsModalOpen(false)}
        destroyOnClose
        centered
        title={`Configure ${editingAgent?.label || 'AI Agent'}`}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleModalSave}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="Executable Command / Path"
            name="command"
            rules={[{ required: true, message: 'Please specify the executable command' }]}
            extra="e.g. claude, codex, cursor-agent, antigravity"
          >
            <Input allowClear />
          </Form.Item>

          <Form.Item
            label="Default Arguments (Optional)"
            name="args"
            extra="Additional flags passed to the CLI on startup."
          >
            <Input placeholder="e.g. --dangerously-skip-permissions" allowClear />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
            <Button
              icon={<ScanOutlined />}
              loading={detectingId === editingAgent?.id}
              onClick={() => {
                if (editingAgent) handleDetectOne(editingAgent.id);
              }}
            >
              Auto Detect Binary
            </Button>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
