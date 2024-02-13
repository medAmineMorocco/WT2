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
  Switch,
  theme,
  Tooltip,
} from 'antd';
import {
  CheckOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  FolderAddOutlined,
  MoonOutlined,
  MoreOutlined,
  SunOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;
const { useToken } = theme;
const { confirm } = Modal;

export default function Worktrees({
  onThemeChange,
}: {
  onThemeChange: (newVal: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const { token } = useToken();

  const onChange = (newValue: boolean) => {
    onThemeChange(newValue);
  };

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
    confirm({
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
        <div>
          <Divider orientation="left">Preferences</Divider>
          <Tooltip title="Change theme" placement="right">
            <Switch
              defaultChecked
              onChange={onChange}
              checkedChildren={<SunOutlined />}
              unCheckedChildren={<MoonOutlined />}
              style={{ marginLeft: '8px' }}
            />
          </Tooltip>
        </div>
      )}
      {!collapsed && (
        <Divider orientation="left">
          Worktrees{' '}
          <Tooltip title="Add new worktree" placement="right">
            <FolderAddOutlined
              style={{ marginLeft: '4px', cursor: 'pointer' }}
              onClick={showModal}
            />
          </Tooltip>
          <Modal
            open={isModalOpen}
            centered
            footer={null}
            onCancel={handleCancel}
            destroyOnClose
            width={400}
          >
            <Form layout="inline" form={form}>
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
                <Input />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<CheckOutlined />}
                />
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
