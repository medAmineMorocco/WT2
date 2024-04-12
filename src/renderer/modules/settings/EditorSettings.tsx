import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Space, Switch, Typography } from 'antd';
import { BranchesOutlined, EditOutlined } from '@ant-design/icons';
import { editorIconsMap, editorsCst } from '../config/EditorsConfig';

export default function EditorSettings() {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editors, setEditors] = useState<any[]>([]);

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
    console.log('Success:', values);
  };

  return (
    <div
      style={{
        display: 'grid',
        gap: '20px',
        justifyContent: 'center',
        gridTemplateColumns: '20% 20% 20%',
      }}
    >
      {editors.map((editor) => {
        return (
          <div
            className="card"
            key={editor.name}
            style={{
              boxShadow: editor.enabled ? '0 0 4px #69b1ff' : '0 0 4px grey',
            }}
          >
            <div
              className="editor-card-container"
              style={{ borderColor: editor.enabled ? '#69b1ff' : 'grey' }}
            >
              <Space>
                {editor.iconTag}
                <span style={{ fontWeight: 'bold' }}>{editor.label}</span>
              </Space>

              <Switch
                className="editor-card-enabled"
                size="small"
                onChange={(checked: boolean) => onChangeStatus(editor, checked)}
                value={editor.enabled}
              />

              <div className="editor-card-path">
                <Typography.Text style={{ width: '100%' }}>
                  {editor.description}
                </Typography.Text>
              </div>
            </div>
            <div
              className="editor-card-footer"
              style={{ borderColor: editor.enabled ? '#69b1ff' : 'grey' }}
            >
              <EditOutlined
                style={{ cursor: 'pointer' }}
                onClick={() => onEditPathEditor(editor)}
              />
            </div>
          </div>
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
          <Form.Item
            label="Path"
            name="path"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Please input your worktree name!',
              },
            ]}
            style={{ flex: 1 }}
          >
            <Input prefix={<BranchesOutlined />} allowClear />
          </Form.Item>
          <Form.Item name="editorName" hidden />
          <Form.Item style={{ marginRight: 0 }}>
            <Button type="primary" htmlType="submit" icon={<EditOutlined />}>
              Edit
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
