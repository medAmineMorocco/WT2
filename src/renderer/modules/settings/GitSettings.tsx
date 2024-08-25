import { Form, Input, Typography } from 'antd';
import React, { useEffect } from 'react';

export default function GitSettings() {
  useEffect(() => {
    const storedGitExecutable = window.localStorage.getItem('git-executable');
    if (storedGitExecutable) {
      console.log('storedGitExecutable', storedGitExecutable);
    }

    return () => {
      console.log('save git settings');
    };
  }, []);

  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ span: 10 }}
      wrapperCol={{ span: 7 }}
    >
      <Form.Item
        label="Git executable"
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
  );
}
