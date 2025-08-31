import React, { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Button, Drawer, Form, Input, Tooltip } from 'antd';
import {
  MinusCircleOutlined,
  PartitionOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import TabService from '../../services/tab/TabService';

export default function AddWorkflow({
  openAdd,
  onCloseAdd,
}: {
  openAdd: boolean;
  onCloseAdd: any;
}) {
  const { notification } = AntdApp.useApp();

  const [loadingCreateWorkflow, setLoadingCreateWorkflow] = useState(false);

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    const onWorkflowCreated = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'Your new workflow is ready to use',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        setLoadingCreateWorkflow(false);
        onCloseAdd();
        ipcRenderer.send('get-workflows', tabRepoPath);
      } else {
        setLoadingCreateWorkflow(false);
        notification.error({
          message: 'Unable to Create Workflow',
          placement: 'bottomLeft',
        });
      }
    };

    ipcRenderer.on('workflow-created', onWorkflowCreated);

    return () => {
      ipcRenderer.removeAllListeners('workflow-created');
    };
  }, [notification, onCloseAdd, tabRepoPath]);

  const onFinish = (values: any) => {
    setLoadingCreateWorkflow(true);
    ipcRenderer.send(
      'add-workflow',
      values.name,
      values.command,
      values.commands,
      tabRepoPath,
    );
  };

  return (
    <Drawer
      title="Add New Workflow"
      onClose={onCloseAdd}
      open={openAdd}
      destroyOnClose
    >
      <Form
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
            loading={loadingCreateWorkflow}
          >
            Save
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
