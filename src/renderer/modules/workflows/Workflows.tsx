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
  Badge,
  Space,
  App as AntdApp,
} from 'antd';
import {
  PlusOutlined,
  MinusCircleOutlined,
  RightOutlined,
  PartitionOutlined,
  CheckOutlined,
  ExclamationCircleFilled,
  EditOutlined,
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
  const [openDetails, setOpenDetails] = useState(false);
  const { modal } = AntdApp.useApp();

  const showDrawer = () => {
    setOpen(true);
  };

  const showDetailsDrawer = () => {
    setOpenDetails(true);
  };

  const onClose = () => {
    setOpen(false);
  };

  const onCloseDetails = () => {
    setOpenDetails(false);
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

  const onDeleteWorkflow = () => {
    modal.confirm({
      title: 'Are you sure delete this workflow ?',
      icon: <ExclamationCircleFilled />,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      centered: true,
      onOk() {
        console.log('OK');
      },
      onCancel() {
        console.log('Cancel');
      },
    });
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
              onClick={onDeleteWorkflow}
            />
          </Tooltip>
          <Tooltip placement="top" title="View workflow">
            <FontAwesomeIcon
              icon={faInfo}
              style={{ cursor: 'pointer', color: colorPrimary }}
              onClick={showDetailsDrawer}
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
      name: 'Workflow1',
    },
    {
      key: '2',
      name: 'Workflow2',
    },
    {
      key: '3',
      name: 'Workflow3',
    },
    {
      key: '4',
      name: 'Workflow4',
    },
    {
      key: '5',
      name: 'Workflow5',
    },
    {
      key: '6',
      name: 'Workflow6',
    },
    {
      key: '7',
      name: 'Workflow7',
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
        <Space>
          <PartitionOutlined />
          <Badge count={7} offset={[10, 0]} title="total">
            <strong>Workflows</strong>
          </Badge>
        </Space>
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
                Submit
              </Button>
            </Form.Item>
          </Form>
        </Drawer>
      </div>
      <Drawer
        title="Workflow Details"
        onClose={onCloseDetails}
        open={openDetails}
      >
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <Button type="primary" icon={<EditOutlined />}>
          Edit
        </Button>
      </Drawer>
      <div
        style={{ position: 'absolute', left: '8px', right: '8px', top: '80px' }}
      >
        <Table
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 3, position: ['bottomLeft'] }}
          bordered
        />
      </div>
    </div>
  );
}
