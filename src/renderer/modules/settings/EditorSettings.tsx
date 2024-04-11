import { Button, Form, Input, Modal, Space, Switch, Typography } from 'antd';
import { BranchesOutlined, EditOutlined } from '@ant-design/icons';
import React, { useState } from 'react';
import IntellijIcon from '../../components/editors/IntellijIcon';
import WebstormIcon from '../../components/editors/WebstormIcon';
import RiderIcon from '../../components/editors/RiderIcon';
import PycharmIcon from '../../components/editors/PyCharmIcon';
import ClionIcon from '../../components/editors/ClionIcon';
import PhpstormIcon from '../../components/editors/PhpStormIcon';
import RubymineIcon from '../../components/editors/RubyMineIcon';
import GoLandIcon from '../../components/editors/GoLandIcon';
import VsCodeIcon from '../../components/editors/VsCodeIcon';
import EclipseIcon from '../../components/editors/EclipseIcon';
import BracketsIcon from '../../components/editors/BracketsIcon';
import AndroidStudioIcon from '../../components/editors/AndroidStudioIcon';
import XcodeIcon from '../../components/editors/XcodeIcon';
import SublimeIcon from '../../components/editors/SublimeIcon';
import VimIcon from '../../components/editors/VimIcon';

const editorsCst = [
  {
    name: 'Intellij',
    icon: <IntellijIcon width="30px" height="30px" />,
    path: 'C:Program Files\\JetBrains\\IntelliJ IDEA 2021.3.3\\bin\\idea64.exe',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'Webstorm',
    icon: <WebstormIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'Rider',
    icon: <RiderIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'PyCharm',
    icon: <PycharmIcon width="30px" height="30px" />,
    path: 'path',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'CLion',
    icon: <ClionIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'PhpStorm',
    icon: <PhpstormIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'RubyMine',
    icon: <RubymineIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'GoLand',
    icon: <GoLandIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'Visual Studio',
    icon: <VsCodeIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'Eclipse',
    icon: <EclipseIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'Brackets',
    icon: <BracketsIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'Android Studio',
    icon: <AndroidStudioIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'Xcode',
    icon: <XcodeIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'Sublime Text',
    icon: <SublimeIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
  {
    name: 'Vim',
    icon: <VimIcon width="30px" height="30px" />,
    path: '',
    description: 'Import java project in Intellij',
    enabled: true,
  },
];

export default function EditorSettings() {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editors, setEditors] = useState(editorsCst);

  const handleCancel = () => {
    setIsModalOpen(false);
  };
  const onEditPathEditor = (editor: any) => {
    form.setFieldValue('path', editor.path);
    form.setFieldValue('editorName', editor.name);
    setIsModalOpen(true);
  };

  const onChangeStatus = (editor: any, checked: boolean) => {
    setEditors(
      editors.map((item) => {
        if (editor.name === item.name) {
          item.enabled = checked;
        }
        return item;
      }),
    );
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
                {editor.icon}
                <span style={{ fontWeight: 'bold' }}>{editor.name}</span>
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
