import React, { useEffect, useMemo, useState } from 'react';
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

  const [loadingEditWorkflow, setLoadingEditWorkflow] = useState(false);

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    const onWorkflowUpdated = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'Your workflow changes have been applied',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        setLoadingEditWorkflow(false);
        onCloseEdit();
        ipcRenderer.send('get-workflows', tabRepoPath);
      } else {
        setLoadingEditWorkflow(false);
        notification.error({
          message: 'Unable to Update Workflow',
          placement: 'bottomLeft',
        });
      }
    };

    ipcRenderer.on('workflow-updated', onWorkflowUpdated);

    return () => {
      ipcRenderer.removeAllListeners('workflow-updated');
    };
  }, [notification, onCloseEdit, tabRepoPath]);

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
    setLoadingEditWorkflow(true);
    ipcRenderer.send(
      'update-workflow',
      workflow.name,
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
              message: 'Please enter the name of your workflow.',
            },
            () => ({
              validator(_, value) {
                if (value && value.includes('/')) {
                  return Promise.reject(
                    new Error(
                      'The name of workflow should not contains / character !',
                    ),
                  );
                }
                return Promise.resolve();
              },
            }),
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
              message: 'Please enter the command.',
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
                          'Please enter the command, or delete this field.',
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
                  <Tooltip
                    placement="top"
                    title="Remove Command"
                    mouseEnterDelay={0}
                    mouseLeaveDelay={0}
                  >
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
                  Add Command
                </Button>
                <Form.ErrorList errors={errors} />
              </Form.Item>
            </>
          )}
        </Form.List>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loadingEditWorkflow}
            icon={<CheckOutlined />}
          >
            Edit Workflow
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
