import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  Radio,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleFilled,
  CloseCircleOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { ShellDetectionResult } from '../../../shared/shells';
import { getShellIcon } from '../../components/shells/ShellIcons';

export default function ShellSettings() {
  const [form] = Form.useForm();
  const [shells, setShells] = useState<ShellDetectionResult[]>([]);
  const [activeShellPath, setActiveShellPath] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  const loadShells = async (autoDetect = true) => {
    try {
      const active: string =
        (await window.electron.ipcRenderer.invoke('shells:get-active')) ||
        window.localStorage.getItem('shellPath') ||
        '';
      setActiveShellPath(active);
      form.setFieldValue('customShellPath', active);

      if (autoDetect) {
        await handleAutoDetect(active);
      }
    } catch (err: any) {
      console.warn('Failed to load shell settings:', err);
    }
  };

  useEffect(() => {
    loadShells(true);
  }, []);

  const handleAutoDetect = async (currentActive?: string) => {
    setIsDetecting(true);
    try {
      const detected: ShellDetectionResult[] =
        await window.electron.ipcRenderer.invoke('shells:detect-all');
      setShells(detected || []);

      const active = currentActive !== undefined ? currentActive : activeShellPath;
      if (!active && detected && detected.length > 0) {
        const firstFound = detected.find((s) => s.found);
        if (firstFound) {
          handleSelectShell(firstFound.path, firstFound.name);
        }
      }
      if (currentActive === undefined) {
        const count = (detected || []).filter((s) => s.found).length;
        message.success(
          `Auto-detection complete: found ${count} shell${count === 1 ? '' : 's'} on this system.`,
        );
      }
    } catch (err: any) {
      message.error(`Shell detection failed: ${err?.message || err}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSelectShell = async (path: string, shellName?: string) => {
    if (!path) return;
    try {
      setActiveShellPath(path);
      form.setFieldValue('customShellPath', path);
      window.localStorage.setItem('shellPath', path);
      await window.electron.ipcRenderer.invoke('shells:set-active', path);
      message.success(`Active shell changed to: ${shellName || path}`);
    } catch (err: any) {
      message.error(`Failed to activate shell: ${err?.message || err}`);
    }
  };

  const handleCustomSubmit = (values: any) => {
    const custom = (values.customShellPath || '').trim();
    if (!custom) {
      message.warning('Please enter a shell executable path.');
      return;
    }
    handleSelectShell(custom, 'Custom Shell');
  };

  const isPathMatching = (candidatePath: string, activePath: string) => {
    if (!candidatePath || !activePath) return false;
    const normA = candidatePath.toLowerCase().replace(/\\/g, '/').trim();
    const normB = activePath.toLowerCase().replace(/\\/g, '/').trim();
    return (
      normA === normB ||
      normA.endsWith(`/${normB}`) ||
      normB.endsWith(`/${normA}`)
    );
  };

  const installedShells = shells.filter((s) => s.found);
  const otherShells = shells.filter((s) => !s.found);

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
            Shell & Terminal Environment
          </Typography.Title>
          <Typography.Text type="secondary">
            Select the active default shell for the Integrated Terminal and Workflows.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={isDetecting ? <ReloadOutlined spin /> : <ScanOutlined />}
          loading={isDetecting}
          onClick={() => handleAutoDetect()}
        >
          {isDetecting ? 'Detecting Shells...' : 'Auto Detect Shells'}
        </Button>
      </div>

      <Typography.Title level={5} style={{ marginTop: 10, marginBottom: 12 }}>
        Installed & Available Shells
      </Typography.Title>

      {installedShells.length === 0 && !isDetecting && (
        <div style={{ padding: '20px 0', color: 'gray' }}>
          No detected shells found. Click &quot;Auto Detect Shells&quot; above or enter a custom path below.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {installedShells.map((shell) => {
          const isActive = isPathMatching(shell.path, activeShellPath);

          return (
            <Card
              key={shell.id}
              hoverable
              onClick={() => handleSelectShell(shell.path, shell.name)}
              style={{
                cursor: 'pointer',
                borderRadius: '8px',
                border: isActive
                  ? '2px solid #1677ff'
                  : '1px solid var(--ant-color-border-secondary, #e8e8e8)',
                boxShadow: isActive ? '0 0 8px rgba(22, 119, 255, 0.25)' : 'none',
                position: 'relative',
              }}
              bodyStyle={{ padding: '16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ marginTop: 2 }}>{getShellIcon(shell.icon, 34)}</div>
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
                      {shell.name}
                    </Typography.Text>
                    {isActive ? (
                      <Tag
                        color="blue"
                        icon={<CheckCircleFilled />}
                        style={{ margin: 0, fontSize: 11 }}
                      >
                        Active
                      </Tag>
                    ) : (
                      <Radio checked={false} />
                    )}
                  </div>
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, display: 'block', marginTop: 2 }}
                  >
                    {shell.description}
                  </Typography.Text>
                  {shell.version && (
                    <Tag
                      color="green"
                      style={{
                        marginTop: 6,
                        marginBottom: 4,
                        fontSize: 11,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {shell.version}
                    </Tag>
                  )}
                  <Typography.Text
                    ellipsis
                    copyable={{ text: shell.path }}
                    style={{
                      fontSize: 11,
                      color: '#888',
                      display: 'block',
                      marginTop: 2,
                    }}
                    title={shell.path}
                  >
                    {shell.path}
                  </Typography.Text>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {otherShells.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 12 }}>
            Other Known Shells (Not Installed)
          </Typography.Title>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            {otherShells.map((shell) => (
              <Card
                key={shell.id}
                style={{
                  borderRadius: '8px',
                  opacity: 0.75,
                  border: '1px dashed var(--ant-color-border-secondary, #d9d9d9)',
                }}
                bodyStyle={{ padding: '12px 14px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getShellIcon(shell.icon, 26)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {shell.name}
                      </Typography.Text>
                      <Tag
                        color="error"
                        icon={<CloseCircleOutlined />}
                        style={{ margin: 0, fontSize: 10 }}
                      >
                        Not Recognized
                      </Tag>
                    </div>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 11, display: 'block', marginTop: 2 }}
                    >
                      {shell.description}
                    </Typography.Text>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Divider style={{ margin: '20px 0' }} />

      <Typography.Title level={5} style={{ marginBottom: 12 }}>
        Custom Shell Path
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Have a custom shell build, Cygwin, MSYS2, or custom terminal wrapper? Provide its absolute executable path below:
      </Typography.Paragraph>

      <Form
        form={form}
        layout="inline"
        onFinish={handleCustomSubmit}
        style={{ gap: '10px', alignItems: 'center' }}
      >
        <Form.Item
          name="customShellPath"
          style={{ flex: 1, minWidth: 320, marginRight: 0 }}
        >
          <Input
            prefix={<FolderOpenOutlined />}
            placeholder="e.g. C:\Program Files\PowerShell\7\pwsh.exe or /usr/bin/fish"
            allowClear
          />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Activate Custom Shell
        </Button>
      </Form>
    </div>
  );
}
