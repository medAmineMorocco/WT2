import { App as AntdApp, Button, Form } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import React from 'react';

export default function CacheSettings() {
  const { modal } = AntdApp.useApp();

  const clear = () => {
    modal.confirm({
      title: 'Confirm Cache Clearing ?',
      icon: <ExclamationCircleFilled />,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      centered: true,
      onOk() {
        window.localStorage.clear();
      },
    });
  };

  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ span: 8 }}
      wrapperCol={{ span: 8 }}
    >
      <Form.Item
        label=" "
        extra="Please be aware that clicking the 'Clear Cache' button will reset all settings to their default state and close all tabs."
      >
        <Button danger onClick={clear}>
          Clear cache
        </Button>
      </Form.Item>
    </Form>
  );
}
