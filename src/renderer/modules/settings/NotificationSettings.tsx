import { Form, Switch } from 'antd';

export default function NotificationSettings() {
  return (
    <Form layout="horizontal" colon={false}>
      <Form.Item label="Enable Desktop Notifications" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
}
