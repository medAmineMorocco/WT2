import { Form, Input, Typography } from 'antd';
import { useEffect } from 'react';

export default function ShellSettings() {
  const [form] = Form.useForm();

  useEffect(() => {
    const storedShell = window.localStorage.getItem('shellPath');
    if (storedShell) {
      form.setFieldValue('shellPath', storedShell);
    }

    return () => {
      const shellPath = form.getFieldValue('shellPath');
      window.localStorage.setItem('shellPath', shellPath || '');
    };
  }, [form]);

  return (
    <Form
      form={form}
      layout="horizontal"
      colon={false}
      labelCol={{ span: 10 }}
      wrapperCol={{ span: 7 }}
    >
      <Form.Item
        label="Default Shell"
        name="shellPath"
        extra={
          <div>
            <div>
              Please enter the full path to your shell executable, Example:{' '}
            </div>
            <ul>
              <li>
                <Typography.Text copyable>
                  C:\Windows\System32\cmd.exe
                </Typography.Text>{' '}
              </li>
              <li>
                <Typography.Text copyable>
                  C:\Program Files\Git\bin\bash.exe
                </Typography.Text>
              </li>
              <li>
                <Typography.Text copyable>/bin/bash</Typography.Text>{' '}
              </li>
              <li>
                <Typography.Text copyable>/bin/zsh</Typography.Text>
              </li>
              <li>
                <Typography.Text copyable>/bin/sh</Typography.Text>
              </li>
            </ul>
          </div>
        }
      >
        <Input allowClear />
      </Form.Item>
    </Form>
  );
}
