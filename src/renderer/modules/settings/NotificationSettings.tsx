import { Form, Switch } from 'antd';
import { useEffect, useState } from 'react';

export default function NotificationSettings() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(window.localStorage.getItem('notificationsEnabled') === 'true');
  }, []);
  const onChange = (checked: boolean) => {
    window.localStorage.setItem('notificationsEnabled', checked.toString());
    setEnabled(checked);
  };

  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ span: 12 }}
      wrapperCol={{ span: 8 }}
    >
      <Form.Item
        label="Enable Desktop Notifications"
        name="notificationsEnabled"
        valuePropName="checked"
        extra="Get notified instantly when your workflow finishes."
      >
        <Switch onChange={onChange} value={enabled} />
      </Form.Item>
    </Form>
  );
}
