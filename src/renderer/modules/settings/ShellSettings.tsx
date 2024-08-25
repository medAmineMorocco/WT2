import { Form, Input } from 'antd';
import { useEffect } from 'react';

export default function ShellSettings() {
  useEffect(() => {
    const storedShell = window.localStorage.getItem('shell');
    if (storedShell) {
      console.log('storedShell', storedShell);
    }

    return () => {
      console.log('save shell settings');
    };
  }, []);

  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ span: 10 }}
      wrapperCol={{ span: 6 }}
    >
      <Form.Item
        label="Default Shell"
        extra="Please enter the full path to your shell executable "
      >
        <Input allowClear />
      </Form.Item>
    </Form>
  );
}
