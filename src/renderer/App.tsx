import React, { useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import {
  ConfigProvider,
  Layout,
  theme,
  Switch,
  Divider,
  Modal,
  Form,
  Input,
  Button,
  Dropdown,
  Tooltip,
  MenuProps,
} from 'antd';
import {
  FolderAddOutlined,
  MoreOutlined,
  DeleteOutlined,
  SunOutlined,
  MoonOutlined,
  ExclamationCircleFilled,
  CheckOutlined,
} from '@ant-design/icons';

const { Content, Sider } = Layout;
const { defaultAlgorithm, darkAlgorithm } = theme;
const { confirm } = Modal;
const { useToken } = theme;

function Hello() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const { token } = useToken();

  const [isDarkMode, setIsDarkMode] = useState(false);

  const onChange = () => {
    setIsDarkMode((previousValue) => !previousValue);
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
    <ConfigProvider
      theme={{ algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm }}
    >
      <Layout style={{ minHeight: '97vh' }}>
        <Sider
          theme="light"
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
        >
          <div style={{ marginLeft: '8px', marginTop: '8px' }}>
            <Tooltip title="Change theme" placement="right">
              <Switch
                defaultChecked
                onChange={onChange}
                checkedChildren={<SunOutlined />}
                unCheckedChildren={<MoonOutlined />}
              />
            </Tooltip>
          </div>
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
                    color: isDarkMode ? token.colorBgBase : token.colorTextBase,
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
                    color: isDarkMode ? token.colorBgBase : token.colorTextBase,
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
        <Layout>
          <Content style={{ margin: '8px' }}>
            <div
              style={{
                padding: 12,
                height: '47vh',
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
              }}
            >
              Bill is a cat.
            </div>
            <div
              style={{
                padding: 12,
                height: '47vh',
                marginTop: '1vh',
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
              }}
            >
              Bill is a cat.
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
