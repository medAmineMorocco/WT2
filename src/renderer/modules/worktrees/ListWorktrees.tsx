import React, { useEffect, useMemo, useState } from 'react';
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
import EclipseIcon from '../../components/editors/EclipseIcon';
import BracketsIcon from '../../components/editors/BracketsIcon';
import AndroidStudioIcon from '../../components/editors/AndroidStudioIcon';
import XcodeIcon from '../../components/editors/XcodeIcon';
import SublimeIcon from '../../components/editors/SublimeIcon';
import VimIcon from '../../components/editors/VimIcon';
import TabService from '../../services/tab/TabService';

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
      {
        key: '0-11',
        label: 'Eclipse',
        icon: <EclipseIcon />,
      },
      {
        key: '0-12',
        label: 'Brackets',
        icon: <BracketsIcon />,
      },
      {
        key: '0-13',
        label: 'Android Studio',
        icon: <AndroidStudioIcon />,
      },
      {
        key: '0-14',
        label: 'Xcode',
        icon: <XcodeIcon />,
      },
      {
        key: '0-15',
        label: 'Sublime Text',
        icon: <SublimeIcon />,
      },
      {
        key: '0-16',
        label: 'Vim',
        icon: <VimIcon />,
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

export default function ListWorktrees({ isDarkMode }: { isDarkMode: boolean }) {
  const { token } = useToken();

  const { modal, notification } = AntdApp.useApp();

  const [form] = Form.useForm();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [worktrees, setWorktrees] = useState([]);

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    ipcRenderer.send('get-worktrees', tabRepoPath);

    const onOpenEditorError = (event: any, error: any) => {
      notification.error({
        message: 'Error opening directory',
        description: error,
        placement: 'bottomLeft',
      });
    };

    const onWorktreesFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setWorktrees(JSON.parse(result));
      } else {
        notification.error({
          message: 'Error fetching worktrees',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeRemoved = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'Worktree removed',
          description: 'Worktree removed successfully',
          placement: 'bottomLeft',
        });
        ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        notification.error({
          message: 'Error fetching worktrees',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    ipcRenderer.on('open-editor-error', onOpenEditorError);
    ipcRenderer.on('worktrees-found', onWorktreesFound);
    ipcRenderer.on('worktree-removed', onWorktreeRemoved);

    return () => {
      ipcRenderer.removeAllListeners('open-editor-error');
      ipcRenderer.removeAllListeners('worktrees-found');
      ipcRenderer.removeAllListeners('worktree-removed');
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
      if (event.key === '0-11') {
        ipcRenderer.send('open-eclipse', worktree.path);
      }
      if (event.key === '0-12') {
        ipcRenderer.send('open-brackets', worktree.path);
      }
      if (event.key === '0-13') {
        ipcRenderer.send('open-android-studio', worktree.path);
      }
      if (event.key === '0-14') {
        ipcRenderer.send('open-xcode', worktree.path);
      }
      if (event.key === '0-15') {
        ipcRenderer.send('open-sublime', worktree.path);
      }
      if (event.key === '0-16') {
        ipcRenderer.send('open-vim', worktree.path);
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
            ipcRenderer.send(
              'remove-worktree',
              worktree.name,
              tabRepoPath,
              true,
            );
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
        {worktrees.map((worktree: any) => (
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
                whitespace: true,
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
