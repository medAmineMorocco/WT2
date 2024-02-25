import React, { useState } from 'react';
import {
  Dropdown,
  Tooltip,
  Space,
  theme,
  App as AntdApp,
  Form,
  Input,
  Button,
  Modal,
} from 'antd';
import {
  MoreOutlined,
  BranchesOutlined,
  EditOutlined,
  FolderOpenOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons';

const { useToken } = theme;

const items = [
  {
    label: 'Rename',
    key: '-1',
    icon: <EditOutlined />,
  },
  {
    label: 'Open Worktree in',
    key: '0',
    icon: <FolderOpenOutlined />,
    children: [
      {
        key: '0-1',
        label: 'Explorer',
      },
      {
        key: '0-2',
        label: 'Intellij',
      },
      {
        key: '0-3',
        label: 'VS Code',
      },
    ],
  },
  {
    label: 'Copy Worktree Name',
    key: '1',
    icon: <CopyOutlined />,
  },
  {
    label: 'Delete',
    key: '2',
    icon: <DeleteOutlined />,
    danger: true,
  },
];

export default function ListWorktrees({ isDarkMode }: { isDarkMode: boolean }) {
  const { token } = useToken();

  const { modal } = AntdApp.useApp();

  const [form] = Form.useForm();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const worktrees = [
    {
      name: 'worktree1',
    },
    {
      name: 'worktree2',
    },
  ];

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const onFinish = (values: any) => {
    console.log('Success:', values);
  };

  const onClickWorktree = (worktreeName: string) => {
    return (event: any) => {
      if (event.key === '2') {
        modal.confirm({
          title: 'Are you sure delete this worktree ?',
          icon: <ExclamationCircleFilled />,
          okText: 'Yes',
          okType: 'danger',
          cancelText: 'No',
          centered: true,
          onOk() {
            console.log('OK', worktreeName);
          },
          onCancel() {
            console.log('Cancel');
          },
        });
      }
      if (event.key === '-1') {
        setIsModalOpen(true);
        form.setFieldValue('oldWorktreeName', worktreeName);
        form.setFieldValue('newWorktreeName', worktreeName);
      }
    };
  };

  return (
    <>
      <ul style={{ paddingLeft: '8px', paddingRight: '2px' }}>
        {worktrees.map((worktree) => (
          <li
            key={worktree.name}
            className={!isDarkMode ? 'worktree-item' : 'worktree-item-dark'}
            style={{
              color: token.colorTextBase,
            }}
          >
            <Space>
              <BranchesOutlined /> {worktree.name}
            </Space>
            <Dropdown
              menu={{ items, onClick: onClickWorktree(worktree.name) }}
              trigger={['click']}
              placement="bottom"
            >
              <Tooltip title="Worktree actions" placement="right">
                <MoreOutlined style={{ cursor: 'pointer' }} />
              </Tooltip>
            </Dropdown>
          </li>
        ))}
      </ul>
      <Modal
        open={isModalOpen}
        footer={null}
        onCancel={handleCancel}
        destroyOnClose
        centered
        closeIcon={null}
      >
        <Form
          onFinish={onFinish}
          layout="inline"
          requiredMark="optional"
          form={form}
        >
          <Form.Item
            label="Name"
            name="newWorktreeName"
            rules={[
              {
                required: true,
                message: 'Please input your worktree name!',
              },
            ]}
            style={{ flex: 1 }}
          >
            <Input prefix={<BranchesOutlined />} />
          </Form.Item>
          <Form.Item name="oldWorktreeName" hidden />
          <Form.Item style={{ marginRight: 0 }}>
            <Button type="primary" htmlType="submit" icon={<EditOutlined />}>
              Rename
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
