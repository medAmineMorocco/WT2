import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
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
  FolderOutlined,
  ReloadOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { editorIconsMap, editorsCst } from '../config/EditorsConfig';
import { EditorDetectionResult } from '../../../shared/editors';

export default function EditorSettings({
  isDarkMode,
}: {
  isDarkMode?: boolean;
}) {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editors, setEditors] = useState<any[]>([]);
  const [editorToEdit, setEditorToEdit] = useState<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedMap, setDetectedMap] = useState<
    Record<string, EditorDetectionResult>
  >({});

  const loadEditors = async () => {
    try {
      const storedEditors = window.localStorage.getItem('editors');
      let mappedEditors = storedEditors
        ? JSON.parse(storedEditors)
        : JSON.parse(JSON.stringify(editorsCst));

      // Ensure newly added default editors exist in stored config
      editorsCst.forEach((defaultItem) => {
        const exists = mappedEditors.some(
          (m: any) =>
            m.label.toLowerCase() === defaultItem.label.toLowerCase() ||
            m.key === defaultItem.key,
        );
        if (!exists) {
          mappedEditors.push(JSON.parse(JSON.stringify(defaultItem)));
        }
      });

      const populated = mappedEditors.map((item: any) => ({
        ...item,
        iconTag: editorIconsMap[item.icon] || editorIconsMap.VsCodeIcon,
      }));

      setEditors(populated);
      await handleAutoDetect(populated);
    } catch (e) {
      console.error('Failed to load editors config:', e);
    }
  };

  useEffect(() => {
    loadEditors();
  }, []);

  const handleAutoDetect = async (currentEditors?: any[]) => {
    setIsDetecting(true);
    try {
      const detected: Record<string, EditorDetectionResult> =
        await window.electron.ipcRenderer.invoke('editors:detect-all');
      setDetectedMap(detected || {});

      const targetEditors = currentEditors || editors;
      let foundCount = 0;

      const updated = targetEditors.map((editor) => {
        const found =
          detected?.[editor.label] ||
          Object.values(detected || {}).find(
            (d) =>
              d.label.toLowerCase() === editor.label.toLowerCase() ||
              d.key === editor.key,
          );

        if (found && found.found && found.path) {
          foundCount += 1;
          return {
            ...editor,
            path: found.path,
            enabled: true,
            detectedVersion: found.version,
          };
        }
        return editor;
      });

      window.localStorage.setItem('editors', JSON.stringify(updated));
      window.electron.ipcRenderer
        .invoke('editors:save-all', updated)
        .catch(() => {});

      const withIcons = updated.map((item: any) => ({
        ...item,
        iconTag: editorIconsMap[item.icon] || editorIconsMap.VsCodeIcon,
      }));

      setEditors(withIcons);

      if (currentEditors === undefined) {
        message.success(
          `Auto-detection complete: found ${foundCount} installed editor${foundCount === 1 ? '' : 's'}.`,
        );
      }
    } catch (err: any) {
      message.error(`Auto-detection failed: ${err?.message || err}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditorToEdit(null);
  };

  const onEditPathEditor = (editor: any) => {
    setEditorToEdit(editor);
    form.setFieldsValue({
      path: editor.path || '',
      editorName: editor.label,
    });
    setIsModalOpen(true);
  };

  const onChangeStatus = (editor: any, enabled: boolean) => {
    const updated = editors.map((item) => {
      if (
        item.label.toLowerCase() === editor.label.toLowerCase() ||
        item.key === editor.key
      ) {
        return { ...item, enabled };
      }
      return item;
    });
    window.localStorage.setItem('editors', JSON.stringify(updated));
    window.electron.ipcRenderer
      .invoke('editors:save-all', updated)
      .catch(() => {});
    setEditors(updated);
  };

  const onFinish = (values: any) => {
    if (!editorToEdit) return;
    const newPath = (values.path || '').trim();
    const updated = editors.map((item) => {
      if (
        item.label.toLowerCase() === editorToEdit.label.toLowerCase() ||
        item.key === editorToEdit.key
      ) {
        return {
          ...item,
          path: newPath,
          enabled: newPath ? true : item.enabled,
        };
      }
      return item;
    });

    window.localStorage.setItem('editors', JSON.stringify(updated));
    window.electron.ipcRenderer
      .invoke('editors:save-all', updated)
      .catch(() => {});
    setEditors(updated);
    setIsModalOpen(false);
    setEditorToEdit(null);
    message.success(`Path updated for ${editorToEdit.label}`);
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
            Web & Code Editors
          </Typography.Title>
          <Typography.Text type="secondary">
            Auto-detect installed IDEs and editors or configure custom executable paths.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={isDetecting ? <ReloadOutlined spin /> : <ScanOutlined />}
          loading={isDetecting}
          onClick={() => handleAutoDetect()}
        >
          {isDetecting ? 'Detecting Editors...' : 'Auto Detect Editors'}
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
        {editors.map((editor) => {
          const det =
            detectedMap[editor.label] ||
            Object.values(detectedMap || {}).find(
              (d) =>
                d.label.toLowerCase() === editor.label.toLowerCase() ||
                d.key === editor.key,
            );

          const isDetected =
            (det && det.found) ||
            (editor.path && editor.path.trim().length > 0);

          return (
            <Card
              key={editor.key}
              style={{
                borderRadius: '8px',
                border: editor.enabled
                  ? '2px solid #1677ff'
                  : '1px solid var(--ant-color-border-secondary, #e8e8e8)',
                boxShadow: editor.enabled
                  ? '0 0 8px rgba(22, 119, 255, 0.2)'
                  : 'none',
                position: 'relative',
              }}
              bodyStyle={{ padding: '16px' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div style={{ marginTop: 2 }}>{editor.iconTag}</div>
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
                      {editor.label}
                    </Typography.Text>
                    <Switch
                      size="small"
                      checked={editor.enabled}
                      onChange={(checked) => onChangeStatus(editor, checked)}
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
                        Detected
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

                  {editor.path ? (
                    <Typography.Text
                      ellipsis
                      copyable={{ text: editor.path }}
                      style={{
                        fontSize: 11,
                        color: '#888',
                        display: 'block',
                        marginTop: 2,
                      }}
                      title={editor.path}
                    >
                      {editor.path}
                    </Typography.Text>
                  ) : (
                    <Typography.Text
                      type="secondary"
                      style={{
                        fontSize: 11,
                        fontStyle: 'italic',
                        display: 'block',
                      }}
                    >
                      Path not set
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
                      onClick={() => onEditPathEditor(editor)}
                    >
                      Configure Path
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={isModalOpen}
        footer={null}
        onCancel={handleCancel}
        destroyOnClose
        centered
        title={`Configure Path for ${editorToEdit?.label || 'Editor'}`}
      >
        <Form
          onFinish={onFinish}
          layout="vertical"
          requiredMark="optional"
          form={form}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="Executable Path"
            name="path"
            extra="Specify the full path to the editor executable (e.g. idea.bat, webstorm.bat, code.cmd, subl.exe)."
          >
            <Input
              prefix={<FolderOutlined />}
              placeholder={editorToEdit?.defaultCommand || 'Executable path'}
              allowClear
            />
          </Form.Item>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 20,
            }}
          >
            <Button onClick={handleCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              Save Path
            </Button>
          </div>
          <div style={{ marginTop: '16px' }}>
            <Typography.Text strong>Default Path Examples:</Typography.Text>
            <ul style={{ paddingLeft: 20, marginTop: 6 }}>
              <li>
                <strong>Windows: </strong>
                <Typography.Text copyable style={{ fontSize: 12 }}>
                  {editorToEdit?.pathWindows || 'C:\\Program Files\\...'}
                </Typography.Text>
              </li>
              <li>
                <strong>macOS: </strong>
                <Typography.Text copyable style={{ fontSize: 12 }}>
                  {editorToEdit?.pathMacOs || '/Applications/...'}
                </Typography.Text>
              </li>
              <li>
                <strong>Linux: </strong>
                <Typography.Text copyable style={{ fontSize: 12 }}>
                  {editorToEdit?.pathLinux || '/usr/bin/...'}
                </Typography.Text>
              </li>
            </ul>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
