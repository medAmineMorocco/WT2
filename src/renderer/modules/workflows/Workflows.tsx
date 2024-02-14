import React, { useState } from 'react';
import {
  theme,
  Table,
  Radio,
  Select,
  Tooltip,
  Button,
  Drawer,
  Form,
  Input,
} from 'antd';
import {
  PlusOutlined,
  MinusCircleOutlined,
  RightOutlined,
  PartitionOutlined,
} from '@ant-design/icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrash,
  faInfo,
  faStop,
  faPlay,
} from '@fortawesome/free-solid-svg-icons';

const { useToken } = theme;

export default function Workflows() {
  const {
    token: { colorBgContainer, borderRadiusLG, colorPrimary, colorError },
  } = theme.useToken();

  const { token } = useToken();

  const [open, setOpen] = useState(false);

  const showDrawer = () => {
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
  };

  const options = [
    {
      label: 'Worktree1',
      value: 'Worktree1',
    },
    {
      label: 'Worktree2',
      value: 'Worktree2',
    },
    {
      label: 'Worktree3',
      value: 'Worktree3',
    },
  ];

  const handleChange = (value: string[]) => {
    console.log(`selected ${value}`);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Running mode',
      dataIndex: 'mode',
      key: 'mode',
      render: () => (
        <Radio.Group defaultValue="sequential" buttonStyle="solid" size="small">
          <Radio.Button value="sequential">Sequential</Radio.Button>
          <Radio.Button value="parallel">Parallel</Radio.Button>
        </Radio.Group>
      ),
    },
    {
      title: 'Worktrees',
      dataIndex: 'worktrees',
      key: 'worktrees',
      render: () => (
        <Select
          mode="multiple"
          allowClear
          style={{ width: '100%' }}
          placeholder="Select worktrees"
          defaultValue={[]}
          onChange={handleChange}
          options={options}
          size="small"
        />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: () => (
        <div style={{ display: 'flex', justifyContent: 'space-evenly' }}>
          <Tooltip placement="top" title="Delete workflow">
            <FontAwesomeIcon
              icon={faTrash}
              style={{ cursor: 'pointer', color: colorError }}
            />
          </Tooltip>
          <Tooltip placement="top" title="View workflow">
            <FontAwesomeIcon
              icon={faInfo}
              style={{ cursor: 'pointer', color: colorPrimary }}
            />
          </Tooltip>
          <Tooltip placement="top" title="Stop workflow">
            <FontAwesomeIcon
              icon={faStop}
              style={{ cursor: 'pointer', color: colorPrimary }}
            />
          </Tooltip>
          <Tooltip placement="top" title="Play workflow">
            <FontAwesomeIcon
              icon={faPlay}
              style={{ cursor: 'pointer', color: colorPrimary }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const data = [
    {
      key: '1',
      name: 'Worktree1',
    },
    {
      key: '2',
      name: 'Worktree2',
    },
    {
      key: '3',
      name: 'Worktree3',
    },
    {
      key: '4',
      name: 'Worktree3',
    },
    {
      key: '5',
      name: 'Worktree3',
    },
    {
      key: '6',
      name: 'Worktree3',
    },
    {
      key: '7',
      name: 'Worktree3',
    },
  ];
  const onFinish = (values: any) => {
    console.log('Received values of form:', values);
  };

  return (
    <div
      style={{
        position: 'relative',
        padding: 12,
        height: '47vh',
        marginTop: '1vh',
        background: colorBgContainer,
        borderRadius: borderRadiusLG,
        color: token.colorTextBase,
      }}
    >
      <div>
        <strong>Workflows</strong>
      </div>
      <div>
        <Tooltip placement="left" title="Add workflow">
          <Button
            onClick={showDrawer}
            type="primary"
            style={{ float: 'right' }}
            icon={<PlusOutlined />}
          />
        </Tooltip>
        <Drawer
          title="Add New Workflow"
          onClose={onClose}
          open={open}
          destroyOnClose
        >
          <Form
            name="dynamic_form_item"
            onFinish={onFinish}
            style={{ maxWidth: 600 }}
            layout="vertical"
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
              <Input prefix={<PartitionOutlined />} style={{ width: '90%' }} />
            </Form.Item>
            <Form.Item
              label="Command"
              name="command"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Please input the command !',
                },
              ]}
            >
              <Input prefix={<RightOutlined />} style={{ width: '90%' }} />
            </Form.Item>
            <Form.List name="names">
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
                        />
                      </Form.Item>
                      <MinusCircleOutlined
                        className="dynamic-delete-button"
                        onClick={() => remove(field.name)}
                      />
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
              <Button type="primary" htmlType="submit">
                Add
              </Button>
            </Form.Item>
          </Form>
        </Drawer>
      </div>
      <div
        style={{ position: 'absolute', left: '8px', right: '8px', top: '80px' }}
      >
        <Table
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 3 }}
          bordered
        />
      </div>
    </div>
  );
}
