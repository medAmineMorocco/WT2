import React, { useEffect, useMemo } from 'react';
import {
  App as AntdApp,
  Button,
  Drawer,
  Form,
  Input,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  MinusCircleOutlined,
  PartitionOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import TabService from '../../services/tab/TabService';

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

  const { notification } = AntdApp.useApp();

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    const onWorkflowUpdated = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'Workflow updated',
          description: 'Worktree updated successfully',
          placement: 'bottomLeft',
        });
        onCloseEdit();
        ipcRenderer.send('get-workflows', tabRepoPath);
      } else {
        notification.error({
          message: 'Error updating workflow',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    ipcRenderer.on('workflow-updated', onWorkflowUpdated);

    return () => {
      ipcRenderer.removeAllListeners('workflow-updated');
    };
  }, []);

  useEffect(() => {
    if (workflow && openEdit) {
      form.setFieldValue('id', workflow.id);
      form.setFieldValue('name', workflow.name);
      form.setFieldValue('command', workflow.command.value);
      form.setFieldValue(
        'commands',
        workflow.commands.map((cmd: any) => cmd.value),
      );
    }
  }, [form, workflow, openEdit]);

  const onFinish = (values: any) => {
    console.log('Received values of form:', values);
    ipcRenderer.send(
      'update-workflow',
      values.id,
      values.name,
      values.command,
      values.commands,
      tabRepoPath,
    );
  };

  return (
    <Drawer
      title="Edit Workflow"
      onClose={onCloseEdit}
      open={openEdit}
      destroyOnClose
    >
      <Form
        form={form}
        name="dynamic_form_item"
        onFinish={onFinish}
        style={{ maxWidth: 600 }}
        layout="vertical"
        requiredMark="optional"
      >
        <Form.Item name="id" hidden />
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
            allowClear
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
            allowClear
          />
        </Form.Item>
        <Form.List name="commands">
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map((field) => (
                <Form.Item required={false} key={field.key}>
                  <Form.Item
                    {...field}
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
                      allowClear
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
