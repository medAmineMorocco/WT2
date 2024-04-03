import React, { useEffect, useState } from 'react';
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
  ExportOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import IntellijIcon from '../../components/editors/IntellijIcon';
import WebstormIcon from '../../components/editors/WebstormIcon';
import RiderIcon from '../../components/editors/RiderIcon';
import PycharmIcon from '../../components/editors/PyCharmIcon';
import ClionIcon from '../../components/editors/ClionIcon';
import PhpstormIcon from '../../components/editors/PhpStormIcon';
import RubymineIcon from '../../components/editors/RubyMineIcon';
import GoLandIcon from '../../components/editors/GoLandIcon';
import VsCodeIcon from '../../components/editors/VsCodeIcon';

const { useToken } = theme;

const items = [
  {
    label: 'Rename',
    key: '-2',
    icon: <EditOutlined />,
  },
  {
    label: 'Open in Explorer',
    key: '-1',
    icon: <ExportOutlined />,
  },
  {
    label: 'Open in',
    key: '0',
    icon: <FolderOpenOutlined />,
    children: [
      {
        key: '0-2',
        label: 'Intellij',
        icon: <IntellijIcon />,
      },
      {
        key: '0-3',
        label: 'WebStorm',
        icon: <WebstormIcon />,
      },
      {
        key: '0-4',
        label: 'Rider',
        icon: <RiderIcon />,
      },
      {
        key: '0-5',
        label: 'PyCharm',
        icon: <PycharmIcon />,
      },
      {
        key: '0-6',
        label: 'CLion',
        icon: <ClionIcon />,
      },
      {
        key: '0-7',
        label: 'PhpStorm',
        icon: <PhpstormIcon />,
      },
      {
        key: '0-8',
        label: 'RubyMine',
        icon: <RubymineIcon />,
      },
      {
        key: '0-9',
        label: 'GoLand',
        icon: <GoLandIcon />,
      },
      {
        key: '0-10',
        label: 'Visual Studio',
        icon: <VsCodeIcon />,
      },
    ],
  },
  {
    label: 'Copy',
    key: '1',
    icon: <CopyOutlined />,
    children: [
      {
        key: '1-2',
        label: 'name',
      },
      {
        label: 'path',
        key: '1-3',
      },
    ],
  },
  {
    label: 'Delete',
    key: '2',
    icon: <DeleteOutlined />,
    danger: true,
  },
];

const worktrees = [
  {
    name: 'worktree1',
    path: 'C:\\Users\\moham\\OneDrive\\Desktop\\jo-gui',
  },
  {
    name: 'worktree2',
    path: 'C:\\Users\\moham\\OneDrive\\Desktop\\jo-gui',
  },
];

export default function ListWorktrees({ isDarkMode }: { isDarkMode: boolean }) {
  const { token } = useToken();

  const { modal, notification } = AntdApp.useApp();

  const [form] = Form.useForm();

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const onOpenEditorError = (event: any, error: any) => {
      notification.error({
        message: 'Error opening directory',
        description: error,
        placement: 'bottomLeft',
      });
    };

    ipcRenderer.on('open-editor-error', onOpenEditorError);

    return () => {
      ipcRenderer.removeAllListeners('open-editor-error');
    };
  }, []);

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const onFinish = (values: any) => {
    console.log('Success:', values);
  };

  const onClickWorktree = (worktree: any) => {
    return (event: any) => {
      if (event.key === '-2') {
        setIsModalOpen(true);
        form.setFieldValue('oldWorktreeName', worktree.name);
        form.setFieldValue('newWorktreeName', worktree.name);
      }
      if (event.key === '0-3') {
        ipcRenderer.send('open-intellij', worktree.path);
      }
      if (event.key === '0-3') {
        ipcRenderer.send('open-webstorm', worktree.path);
      }
      if (event.key === '0-4') {
        ipcRenderer.send('open-rider', worktree.path);
      }
      if (event.key === '0-5') {
        ipcRenderer.send('open-pycharm', worktree.path);
      }
      if (event.key === '0-6') {
        ipcRenderer.send('open-clion', worktree.path);
      }
      if (event.key === '0-7') {
        ipcRenderer.send('open-phpstorm', worktree.path);
      }
      if (event.key === '0-8') {
        ipcRenderer.send('open-rubymine', worktree.path);
      }
      if (event.key === '0-9') {
        ipcRenderer.send('open-goland', worktree.path);
      }
      if (event.key === '0-10') {
        ipcRenderer.send('open-vscode', worktree.path);
      }
      if (event.key === '1-2') {
        navigator.clipboard.writeText(worktree.name);
      }
      if (event.key === '1-3') {
        navigator.clipboard.writeText('path');
      }
      if (event.key === '2') {
        modal.confirm({
          title: 'Are you sure delete this worktree ?',
          icon: <ExclamationCircleFilled />,
          okText: 'Yes',
          okType: 'danger',
          cancelText: 'No',
          centered: true,
          onOk() {
            console.log('OK', worktree.name);
          },
          onCancel() {
            console.log('Cancel');
          },
        });
      }
    };
  };

  return (
    <>
      <ul style={{ marginTop: '4px', paddingLeft: '8px', paddingRight: '2px' }}>
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
              menu={{ items, onClick: onClickWorktree(worktree) }}
              trigger={['click']}
              placement="bottom"
              destroyPopupOnHide
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
              () => ({
                validator(_, value) {
                  if (value && value.includes('/')) {
                    return Promise.reject(
                      new Error(
                        'The name of worktree should not contains / character !',
                      ),
                    );
                  }
                  return Promise.resolve();
                },
              }),
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
