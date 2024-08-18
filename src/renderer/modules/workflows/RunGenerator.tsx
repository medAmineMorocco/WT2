import React, { useMemo } from 'react';
import {
  Button,
  Checkbox,
  Divider,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Tag,
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import TabService from '../../services/tab/TabService';

export default function RunGenerator({
  openPlay,
  onClosePlay,
  generator,
  worktrees,
}: {
  openPlay: boolean;
  onClosePlay: any;
  generator: any;
  worktrees: any[];
}) {
  const [form] = Form.useForm();

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  function capitalizeFirstLetterAndLowercaseRest(text: string): string {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  const onFinish = (values: any) => {
    const foundWorktree = worktrees.find(
      (worktree: any) => worktree.value === values.worktree,
    );
    const parameters = {} as any;
    Object.entries(values).forEach(([key, value]) => {
      if (key !== 'worktree') {
        parameters[key] = value;
      }
    });
    ipcRenderer.send(
      'run-generator',
      generator.generatorName,
      parameters,
      foundWorktree,
      tabRepoPath,
    );
    onClosePlay();
  };

  const buildInput = (
    key: number,
    paramName: string,
    paramType: string,
    values: string,
  ) => {
    if (paramType === 'input') {
      return (
        <Form.Item
          key={key}
          label={capitalizeFirstLetterAndLowercaseRest(paramName)}
          name={paramName}
          rules={[
            {
              required: true,
              whitespace: true,
              message: `Please enter a value for ${paramName}`,
            },
          ]}
        >
          <Input allowClear />
        </Form.Item>
      );
    }
    if (paramType === 'select') {
      const options = values?.split(',').map((val: string) => {
        return {
          key: val.trim(),
          label: val.trim(),
          value: val.trim(),
        };
      });
      return (
        <Form.Item
          key={key}
          label={capitalizeFirstLetterAndLowercaseRest(paramName)}
          name={paramName}
          rules={[
            {
              required: true,
              whitespace: true,
              message: `Please enter a value for ${paramName}`,
            },
          ]}
        >
          <Select options={options} allowClear showSearch />
        </Form.Item>
      );
    }
    if (paramType === 'multiselect') {
      const options = values?.split(',').map((val: string) => {
        return {
          key: val.trim(),
          label: val.trim(),
          value: val.trim(),
        };
      });
      return (
        <Form.Item
          key={key}
          label={capitalizeFirstLetterAndLowercaseRest(paramName)}
          name={paramName}
          rules={[
            {
              required: true,
              whitespace: true,
              message: `Please enter a value for ${paramName}`,
            },
          ]}
        >
          <Select options={options} mode="multiple" allowClear showSearch />
        </Form.Item>
      );
    }
    if (paramType === 'confirm') {
      return (
        <Form.Item
          key={key}
          name={paramName}
          valuePropName="checked"
          rules={[
            {
              required: true,
              message: `Please enter a value for ${paramName}`,
            },
          ]}
          initialValue={false}
        >
          <Checkbox>
            {capitalizeFirstLetterAndLowercaseRest(paramName)}
          </Checkbox>
        </Form.Item>
      );
    }
    return null;
  };

  return (
    <Drawer
      title={
        <Space>
          <span>Run Generator</span>
          <Tag color="blue">{generator.generatorName}</Tag>
        </Space>
      }
      onClose={onClosePlay}
      open={openPlay}
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
        <Form.Item
          label="Worktree"
          name="worktree"
          tooltip="This is the worktree where the code will be generated"
          rules={[
            {
              required: true,
              whitespace: true,
              message: 'Please select a worktree',
            },
          ]}
        >
          <Select options={worktrees} allowClear showSearch />
        </Form.Item>
        <Divider orientation="left">Parameters</Divider>
        {generator &&
          generator.parameters?.map((parameter: any) =>
            buildInput(
              parameter.key,
              parameter.parameterName,
              parameter.parameterType,
              parameter.parameterValues,
            ),
          )}

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<CheckOutlined />}>
            Run
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
