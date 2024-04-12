import { Form, Select } from 'antd';

export default function TerminalSettings() {
  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ span: 10 }}
      wrapperCol={{ span: 6 }}
    >
      <Form.Item label="Default Terminal">
        <Select>
          <Select.Option value="demo">Demo</Select.Option>
        </Select>
      </Form.Item>
    </Form>
  );
}
