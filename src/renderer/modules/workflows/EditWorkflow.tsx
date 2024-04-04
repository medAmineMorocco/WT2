import React, { useEffect } from 'react';
import { Button, Drawer, Form, Input, Tooltip } from 'antd';
import {
  CheckOutlined,
  MinusCircleOutlined,
  PartitionOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';

export default function EditWorkflow({
  openEdit,
  onCloseEdit,
  workflow,
}: {
  openEdit: boolean;
  onCloseEdit: any;
  workflow: any;
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (workflow) {
      form.setFieldValue('name', workflow.name);
      form.setFieldValue('command', workflow.command.value);
      form.setFieldValue('commands', workflow.commands);
    }
  }, [form, workflow]);

  const onFinish = (values: any) => {
    console.log('Received values of form:', values);
  };

  return (
    <Drawer title="Edit Workflow" onClose={onCloseEdit} open={openEdit}>
      <Form
        form={form}
        name="dynamic_form_item"
        onFinish={onFinish}
        style={{ maxWidth: 600 }}
        layout="vertical"
        requiredMark="optional"
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            {
              required: true,
              whitespace: true,
              message: 'Please input your workflow name !',
            },
          ]}
        >
          <Input
            prefix={<PartitionOutlined />}
            style={{ width: '90%' }}
            placeholder="rebase"
          />
        </Form.Item>
        <Form.Item
          label="Command(s)"
          name="command"
          rules={[
            {
              required: true,
              whitespace: true,
              message: 'Please input the command !',
            },
          ]}
        >
          <Input
            prefix={<RightOutlined />}
            style={{ width: '90%' }}
            placeholder="git rebase main"
          />
        </Form.Item>
        <Form.List name="commands">
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map((field) => (
                <Form.Item required={false} key={field.key}>
                  <Form.Item
                    {...field}
                    name={[field.name, 'value']}
                    validateTrigger={['onChange', 'onBlur']}
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message:
                          'Please input the command or delete this field !',
                      },
                    ]}
                    noStyle
                  >
                    <Input
                      prefix={<RightOutlined />}
                      style={{ width: '90%', marginRight: '8px' }}
                    />
                  </Form.Item>
                  <Tooltip placement="top" title="Remove command">
                    <MinusCircleOutlined
                      className="dynamic-delete-button"
                      onClick={() => remove(field.name)}
                    />
                  </Tooltip>
                </Form.Item>
              ))}
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  style={{ width: '90%' }}
                  icon={<PlusOutlined />}
                >
                  Add command
                </Button>
                <Form.ErrorList errors={errors} />
              </Form.Item>
            </>
          )}
        </Form.List>
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<CheckOutlined />}>
            Edit Workflow
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
