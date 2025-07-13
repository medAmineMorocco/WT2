import { Form, Input, Typography } from 'antd';
import React, { useEffect } from 'react';

export default function GitSettings() {
  const [form] = Form.useForm();
  const [formGitLog] = Form.useForm();

  useEffect(() => {
    const storedGitExecutable =
      window.localStorage.getItem('gitExecutablePath');
    if (storedGitExecutable) {
      form.setFieldValue('gitExecutablePath', storedGitExecutable);
    }

    return () => {
      const gitExecutablePath = form.getFieldValue('gitExecutablePath');
      window.localStorage.setItem('gitExecutablePath', gitExecutablePath || '');
    };
  }, [form, formGitLog]);

  return (
    <div>
      <Form
        form={form}
        layout="horizontal"
        colon={false}
        labelCol={{ span: 10 }}
        wrapperCol={{ span: 7 }}
      >
        <Form.Item
          label="Git executable"
          name="gitExecutablePath"
          extra={
            <div>
              <div>
                Please enter the full path to the Git executable, Example:{' '}
              </div>
              <ul>
                <li>
                  <span>Windows: </span>
                  <Typography.Text copyable>
                    C:\Program Files\Git\bin\git.exe
                  </Typography.Text>
                </li>
                <li>
                  <span>MacOS/Linux: </span>
                  <Typography.Text copyable>/usr/bin/git</Typography.Text>
                </li>
              </ul>
            </div>
          }
        >
          <Input allowClear />
        </Form.Item>
      </Form>
    </div>
  );
}
