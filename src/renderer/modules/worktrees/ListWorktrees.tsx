import React, { useEffect, useMemo, useState } from 'react';
import {
  Dropdown,
  Tooltip,
  Space,
  theme,
  App as AntdApp,
  Form,
  Typography,
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
  LockOutlined,
  UnlockOutlined,
  CodeOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import { FolderEditIcon } from 'hugeicons-react';
import TabService from '../../services/tab/TabService';
import { editorIconsMap } from '../config/EditorsConfig';
import TerminalInteractive from '../terminal/TerminalInteractive';
import RenameWorktree from './RenameWorktree';
import MoveWorktree from './MoveWorktree';

const { useToken } = theme;

let items = [
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
    label: 'Open in Terminal',
    key: '-3',
    icon: <CodeOutlined />,
  },
  {
    label: 'Open in',
    key: '0',
    icon: <FolderOpenOutlined />,
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
];

export default function ListWorktrees({ isDarkMode }: { isDarkMode: boolean }) {
  const { token } = useToken();

  const { modal, notification } = AntdApp.useApp();

  const [form] = Form.useForm();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const [worktrees, setWorktrees] = useState([]);

  const [openTerminalModal, setOpenTerminalModal] = useState(false);
  const [repositoryInTerminal, setRepositoryInTerminal] = useState(null);

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    const storedEditors = window.localStorage.getItem('editors');
    if (storedEditors) {
      const enabledEditors = JSON.parse(storedEditors)
        .filter((editor: any) => editor.enabled === true)
        .map((editor: any) => {
          editor.icon = {
            ...editorIconsMap[editor.icon],
            props: {
              width: '22px',
              height: '22px',
            },
          };
          return editor;
        });
      items = items.map((item: any) => {
        if (item.key === '0') {
          item.children = enabledEditors;
        }
        return item;
      });
    }
  }, []);

  useEffect(() => {
    ipcRenderer.send('get-worktrees', tabRepoPath);

    const onOpenEditorError = (event: any, error: any) => {
      notification.error({
        message: 'Unable to Open Web Editor',
        description: <Typography.Text copyable>{error}</Typography.Text>,
        placement: 'bottomLeft',
      });
    };

    const onWorktreesFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setWorktrees(JSON.parse(result));
      } else {
        notification.error({
          message: 'Unable to Fetch Worktrees',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeRemoved = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'Worktree Successfully Removed',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        notification.error({
          message: 'Unable to Remove Worktree',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeRenamed = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'The worktree has been renamed',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        setIsModalOpen(false);
        ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        notification.error({
          message: 'Unable to Rename Worktree',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeChangedLock = (
      event: any,
      code: number,
      toLock: boolean,
      result: any,
    ) => {
      if (code === 0) {
        notification.success({
          message: toLock
            ? 'Access to the worktree has been successfully restricted'
            : 'Access to the worktree has been successfully restored',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        notification.error({
          message: toLock
            ? 'Unable to Lock Worktree'
            : 'Unable to Unlock Worktree',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeMoved = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'The worktree has been moved',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        setIsMoveModalOpen(false);
        ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        notification.error({
          message: 'Unable to Move Worktree to folder',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    ipcRenderer.on('open-editor-error', onOpenEditorError);
    ipcRenderer.on('worktrees-found', onWorktreesFound);
    ipcRenderer.on('worktree-removed', onWorktreeRemoved);
    ipcRenderer.on('worktree-renamed', onWorktreeRenamed);
    ipcRenderer.on('worktrees-changed-lock', onWorktreeChangedLock);
    ipcRenderer.on('worktree-moved-to-folder', onWorktreeMoved);

    return () => {
      ipcRenderer.removeAllListeners('open-editor-error');
      ipcRenderer.removeAllListeners('worktrees-found');
      ipcRenderer.removeAllListeners('worktree-removed');
      ipcRenderer.removeAllListeners('worktree-renamed');
      ipcRenderer.removeAllListeners('worktrees-changed-lock');
      ipcRenderer.removeAllListeners('worktree-moved-to-folder');
    };
  }, [notification, tabRepoPath]);

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const onFinish = (values: any) => {
    console.log('Success:', values);
    ipcRenderer.send(
      'rename-worktree',
      form.getFieldValue('oldWorktreeName'),
      form.getFieldValue('newWorktreeName'),
      form.getFieldValue('oldWorktreePath'),
      tabRepoPath,
    );
  };

  const handleCancelMoveWorktree = () => {
    setIsMoveModalOpen(false);
  };

  const onFinishMoveWorktree = (values: any) => {
    console.log('Success:', values);
    ipcRenderer.send(
      'move-worktree-to-folder',
      form.getFieldValue('nameWorktreeToMove'),
      form.getFieldValue('newWorktreePath'),
      tabRepoPath,
    );
  };

  const getMenuItems = (isWorktreeLocked: boolean) => {
    if (isWorktreeLocked) {
      return [
        ...items,
        {
          label: 'Delete',
          key: '2',
          icon: <DeleteOutlined />,
          disabled: true,
        },
        {
          label: 'Unlock',
          key: '3',
          icon: <UnlockOutlined />,
        },
      ];
    }
    return [
      ...items,
      {
        label: 'Change Folder',
        key: '5',
        icon: <FolderEditIcon size={16} />,
      },
      {
        label: 'Delete',
        key: '2',
        icon: <DeleteOutlined />,
        children: [
          {
            label: 'worktree',
            key: '2-0',
          },
          {
            label: 'worktree and local branch',
            key: '2-1',
          },
        ],
      },
      {
        label: 'Lock',
        key: '4',
        icon: <LockOutlined />,
      },
    ];
  };

  const closeTerminalModal = () => {
    setRepositoryInTerminal(null);
    setOpenTerminalModal(false);
  };

  const onClickWorktree = (worktree: any) => {
    return (event: any) => {
      if (event.key === '-3') {
        setRepositoryInTerminal(worktree.path);
        setOpenTerminalModal(true);
        return;
      }
      if (event.key === '-2') {
        setIsModalOpen(true);
        form.setFieldValue('oldWorktreeName', worktree.name);
        form.setFieldValue('oldWorktreePath', worktree.path);
        form.setFieldValue('newWorktreeName', worktree.name);
        return;
      }
      if (event.key === '-1') {
        ipcRenderer.send('open-explorer', worktree.path);
        return;
      }
      if (event.key === '0-2') {
        ipcRenderer.send('open-intellij', worktree.path);
        return;
      }
      if (event.key === '0-3') {
        ipcRenderer.send('open-webstorm', worktree.path);
        return;
      }
      if (event.key === '0-4') {
        ipcRenderer.send('open-rider', worktree.path);
        return;
      }
      if (event.key === '0-5') {
        ipcRenderer.send('open-pycharm', worktree.path);
        return;
      }
      if (event.key === '0-6') {
        ipcRenderer.send('open-clion', worktree.path);
        return;
      }
      if (event.key === '0-7') {
        ipcRenderer.send('open-phpstorm', worktree.path);
        return;
      }
      if (event.key === '0-8') {
        ipcRenderer.send('open-rubymine', worktree.path);
        return;
      }
      if (event.key === '0-9') {
        ipcRenderer.send('open-goland', worktree.path);
        return;
      }
      if (event.key === '0-10') {
        ipcRenderer.send('open-vscode', worktree.path);
        return;
      }
      if (event.key === '0-11') {
        ipcRenderer.send('open-eclipse', worktree.path);
        return;
      }
      if (event.key === '0-12') {
        ipcRenderer.send('open-brackets', worktree.path);
        return;
      }
      if (event.key === '0-13') {
        ipcRenderer.send('open-android-studio', worktree.path);
        return;
      }
      if (event.key === '0-14') {
        ipcRenderer.send('open-xcode', worktree.path);
        return;
      }
      if (event.key === '0-15') {
        ipcRenderer.send('open-sublime', worktree.path);
        return;
      }
      if (event.key === '0-16') {
        ipcRenderer.send('open-vim', worktree.path);
        return;
      }
      if (event.key === '1-2') {
        navigator.clipboard.writeText(worktree.name);
        return;
      }
      if (event.key === '1-3') {
        navigator.clipboard.writeText(worktree.path);
        return;
      }
      if (event.key === '2-0') {
        modal.confirm({
          title: 'Confirm deletion of this worktree ?',
          icon: <ExclamationCircleFilled />,
          okText: 'Yes',
          okType: 'danger',
          cancelText: 'No',
          centered: true,
          onOk() {
            ipcRenderer.send(
              'remove-worktree',
              worktree.path,
              tabRepoPath,
              true,
            );
          },
          onCancel() {
            console.log('Cancel');
          },
        });
        return;
      }
      if (event.key === '2-1') {
        modal.confirm({
          title: `Confirm deletion of this worktree and ${worktree.name} branch ?`,
          icon: <ExclamationCircleFilled />,
          okText: 'Yes',
          okType: 'danger',
          cancelText: 'No',
          centered: true,
          onOk() {
            ipcRenderer.send(
              'remove-worktree-local-branch',
              worktree.name,
              worktree.path,
              tabRepoPath,
              true,
            );
          },
          onCancel() {
            console.log('Cancel');
          },
        });
        return;
      }
      if (event.key === '3') {
        ipcRenderer.send(
          'change-lock-worktree',
          false,
          worktree.name,
          tabRepoPath,
        );
        return;
      }
      if (event.key === '4') {
        ipcRenderer.send(
          'change-lock-worktree',
          true,
          worktree.name,
          tabRepoPath,
        );
        return;
      }
      if (event.key === '5') {
        setIsMoveModalOpen(true);
        form.setFieldValue('nameWorktreeToMove', worktree.name);
        form.setFieldValue('newWorktreePath', worktree.path);
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
              {/* eslint-disable-next-line no-nested-ternary */}
              {worktree.isLocked ? (
                <LockOutlined />
              ) : worktree.prunable ? (
                <Tooltip
                  title="gitdir file points to non-existent location"
                  placement="right"
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <CloseOutlined style={{ color: token.colorError }} />
                </Tooltip>
              ) : (
                <BranchesOutlined />
              )}
              <span
                style={{ color: worktree.prunable ? token.colorError : '' }}
              >
                {worktree.name}
              </span>
            </Space>
            <Dropdown
              menu={{
                items: getMenuItems(worktree.isLocked),
                onClick: onClickWorktree(worktree),
              }}
              trigger={['click']}
              placement="bottom"
              destroyPopupOnHide
            >
              <Tooltip
                title="actions"
                placement="right"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <MoreOutlined style={{ cursor: 'pointer' }} />
              </Tooltip>
            </Dropdown>
          </li>
        ))}
      </ul>
      {openTerminalModal && (
        <TerminalInteractive
          isModalOpen={openTerminalModal}
          repository={repositoryInTerminal}
          handleCancel={closeTerminalModal}
          isDarkMode={isDarkMode}
        />
      )}
      {isModalOpen && (
        <RenameWorktree
          isModalOpen={isModalOpen}
          form={form}
          onFinish={onFinish}
          handleCancel={handleCancel}
        />
      )}
      {isMoveModalOpen && (
        <MoveWorktree
          isModalOpen={isMoveModalOpen}
          form={form}
          onFinish={onFinishMoveWorktree}
          handleCancel={handleCancelMoveWorktree}
        />
      )}
    </>
  );
}
