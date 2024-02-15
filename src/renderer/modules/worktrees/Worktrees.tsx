import React, { useState } from 'react';
import {
  Button,
  Divider,
  Dropdown,
  Form,
  Input,
  Layout,
  MenuProps,
  Modal,
  theme,
  Tooltip,
  Space,
  App as AntdApp,
} from 'antd';
import {
  CheckOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  SisternodeOutlined,
  MoreOutlined,
  BranchesOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;
const { useToken } = theme;

export default function Worktrees() {
  const [collapsed, setCollapsed] = useState(false);

  const { token } = useToken();

  const { modal } = AntdApp.useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form] = Form.useForm();

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const items = [
    {
      label: 'Delete',
      key: '0',
      icon: <DeleteOutlined />,
      danger: true,
    },
  ];

  const onClick: MenuProps['onClick'] = () => {
    modal.confirm({
      title: 'Are you sure delete this worktree ?',
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

  return (
    <Sider
      theme="light"
      collapsible
      collapsed={collapsed}
      onCollapse={(value) => setCollapsed(value)}
    >
      {!collapsed && (
        <Divider orientation="left">
          <Space>
            Worktrees
            <Tooltip title="Add new worktree" placement="right">
              <SisternodeOutlined
                style={{ cursor: 'pointer' }}
                onClick={showModal}
              />
            </Tooltip>
          </Space>
          <Modal
            open={isModalOpen}
            centered
            footer={null}
            onCancel={handleCancel}
            destroyOnClose
            width={400}
          >
            <Form layout="vertical" form={form}>
              <Form.Item
                label="Name"
                name="name"
                rules={[
                  {
                    required: true,
                    message: 'Please input your worktree name!',
                  },
                ]}
              >
                <Input prefix={<BranchesOutlined />} />
              </Form.Item>
              <Form.Item label="Pre-hook" name="preHook">
                <Input prefix={<StepBackwardOutlined />} />
              </Form.Item>
              <Form.Item label="Post-hook" name="postHook">
                <Input prefix={<StepForwardOutlined />} />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<CheckOutlined />}
                >
                  Submit
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </Divider>
      )}
      {!collapsed && (
        <div>
          <ul style={{ paddingLeft: '8px' }}>
            <li
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '24px',
                color: token.colorTextBase,
              }}
            >
              worktree1
              <Dropdown
                menu={{ items, onClick }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Tooltip title="Worktree actions" placement="right">
                  <MoreOutlined style={{ cursor: 'pointer' }} />
                </Tooltip>
              </Dropdown>
            </li>
            <li
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '24px',
                color: token.colorTextBase,
              }}
            >
              worktree2
              <Dropdown
                menu={{ items, onClick }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Tooltip title="Worktree actions" placement="right">
                  <MoreOutlined style={{ cursor: 'pointer' }} />
                </Tooltip>
              </Dropdown>
            </li>
          </ul>
        </div>
      )}
    </Sider>
  );
}
