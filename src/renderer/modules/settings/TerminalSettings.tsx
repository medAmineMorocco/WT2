import { Form, Select } from 'antd';

export default function TerminalSettings() {
  return (
    <Form layout="horizontal" colon={false}>
      <Form.Item label="Default Terminal">
        <Select>
          <Select.Option value="demo">Demo</Select.Option>
        </Select>
      </Form.Item>
    </Form>
  );
}
