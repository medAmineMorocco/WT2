import { Form, Switch } from 'antd';

export default function NotificationSettings() {
  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ span: 12 }}
      wrapperCol={{ span: 8 }}
    >
      <Form.Item label="Enable Desktop Notifications" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
}
