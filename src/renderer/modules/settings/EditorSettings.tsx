import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Typography } from 'antd';
import { EditOutlined, FolderOutlined } from '@ant-design/icons';
import { CheckCard } from '@ant-design/pro-components';
import { editorIconsMap, editorsCst } from '../config/EditorsConfig';

export default function EditorSettings({
  isDarkMode,
}: {
  isDarkMode: boolean;
}) {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editors, setEditors] = useState<any[]>([]);
  const [editorToEdit, setEditorToEdit] = useState<any>([]);

  useEffect(() => {
    const storedEditors = window.localStorage.getItem('editors');
    const mappedEditors = storedEditors
      ? JSON.parse(storedEditors)
      : JSON.parse(JSON.stringify(editorsCst));
    const optionalParams = mappedEditors.map((item: any) => {
      // @ts-ignore
      item.iconTag = editorIconsMap[item.icon];
      return item;
    });
    setEditors(optionalParams);
  }, []);

  const handleCancel = () => {
    setIsModalOpen(false);
  };
  const onEditPathEditor = (editor: any) => {
    setEditorToEdit(editor);
    form.setFieldValue('path', editor.path);
    form.setFieldValue('editorName', editor.label);
    setIsModalOpen(true);
  };

  const onChangeStatus = (editor: any, checked: boolean) => {
    const editorsChangedStatus = editors.map((item) => {
      if (editor.label === item.label) {
        item.enabled = checked;
      }
      return item;
    });
    window.localStorage.setItem(
      'editors',
      JSON.stringify(editorsChangedStatus),
    );
    setEditors(editorsChangedStatus);
  };

  const onFinish = (values: any) => {
    const editorsChanged = editors.map((item) => {
      if (item.label === values.editorName) {
        item.path = values.path;
      }
      return item;
    });
    window.localStorage.setItem('editors', JSON.stringify(editorsChanged));
    setEditors(editorsChanged);
    setIsModalOpen(false);
  };

  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        Customize your experience by enabling only the editors you want to work
        with.
      </div>
      <div
        style={{
          textAlign: 'center',
        }}
      >
        {editors.map((editor) => {
          return (
            <CheckCard
              key={editor.key}
              className={`editor-card ${isDarkMode ? 'editor-card-dark' : 'editor-card-light'} ${editor.enabled ? 'editor-card-checked' : 'editor-card-unchecked'}`}
              avatar={editor.iconTag}
              title={editor.label}
              onChange={(checked) => {
                onChangeStatus(editor, checked);
              }}
              checked={editor.enabled}
              extra={
                <Button
                  type="text"
                  ghost
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPathEditor(editor);
                  }}
                  icon={<EditOutlined />}
                />
              }
            />
          );
        })}

        <Modal
          open={isModalOpen}
          footer={null}
          onCancel={handleCancel}
          destroyOnClose
          centered
          closeIcon={null}
        >
          <Form
            onFinish={onFinish}
            layout="inline"
            requiredMark="optional"
            form={form}
          >
            <Form.Item label="Path" name="path" style={{ flex: 1 }}>
              <Input prefix={<FolderOutlined />} allowClear />
            </Form.Item>
            <Form.Item name="editorName" hidden />
            <Form.Item style={{ marginRight: 0 }}>
              <Button type="primary" htmlType="submit">
                Edit
              </Button>
            </Form.Item>
            <div style={{ marginTop: '16px' }}>
              <div>Example of Path:</div>
              <ul>
                <li>
                  <strong>Windows: </strong>
                  <Typography.Text copyable>
                    {editorToEdit.pathWindows}
                  </Typography.Text>
                </li>
                <li>
                  <strong>Linux: </strong>
                  <Typography.Text copyable>
                    {editorToEdit.pathLinux}
                  </Typography.Text>
                </li>
                <li>
                  <strong>MacOS: </strong>
                  <Typography.Text copyable>
                    {editorToEdit.pathMacOs}
                  </Typography.Text>
                </li>
              </ul>
            </div>
          </Form>
        </Modal>
      </div>
    </>
  );
}
