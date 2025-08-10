import React, { useEffect, useMemo, useState } from 'react';
import {
  Tooltip,
  Space,
  theme,
  App as AntdApp,
  Form,
  Cascader,
  notification,
} from 'antd';
import {
  MoreOutlined,
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
  LoadingOutlined,
  FieldStringOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import { FolderEditIcon, Tree02Icon } from 'hugeicons-react';
import log from 'electron-log';
import TabService from '../../services/tab/TabService';
import { editorIconsMap, editorsCst } from '../config/EditorsConfig';
import TerminalInteractive from '../terminal/TerminalInteractive';
import RenameWorktree from './RenameWorktree';
import MoveWorktree from './MoveWorktree';
import ChangePatternWorktree from './ChangePatternWorktree';

const { useToken } = theme;

const items = [
  {
    label: 'Open in Explorer',
    value: '-1',
    icon: <ExportOutlined />,
  },
  {
    label: 'Open in Terminal',
    value: '-3',
    icon: <CodeOutlined />,
  },
  {
    label: 'Open in',
    value: '0',
    icon: <FolderOpenOutlined />,
    children: [
      {
        value: '',
        label: '',
      },
    ],
  },
  {
    label: 'Copy',
    value: '1',
    icon: <CopyOutlined />,
    children: [
      {
        value: '1-2',
        label: 'name',
      },
      {
        label: 'path',
        value: '1-3',
      },
    ],
  },
];

export default function ListWorktrees({ isDarkMode }: { isDarkMode: boolean }) {
  const { token } = useToken();

  const { modal } = AntdApp.useApp();

  const [api, contextHolder] = notification.useNotification();

  const [form] = Form.useForm();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const [isChangePatternModalOpen, setIsChangePatternModalOpen] =
    useState(false);

  const [worktrees, setWorktrees] = useState([]);

  const [openTerminalModal, setOpenTerminalModal] = useState(false);
  const [repositoryInTerminal, setRepositoryInTerminal] = useState(null);

  const [enabledEditors, setEnabledEditors] = useState([]);

  const [loadingRenameWorktree, setLoadingRenameWorktree] = useState(false);

  const [loadingMoveWorktree, setLoadingMoveWorktree] = useState(false);

  const [loadingChangePatternWorktree, setLoadingChangePatternWorktree] = useState(false);

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    const storedEditors = window.localStorage.getItem('editors');
    const editors = storedEditors
      ? JSON.parse(storedEditors)
      : JSON.parse(JSON.stringify(editorsCst));
    const enabledEditorsReceived = editors
      .filter((editor: any) => editor.enabled === true)
      .map((editor: any) => {
        editor.icon = {
          // @ts-ignore
          ...editorIconsMap[editor.icon],
          props: {
            width: '24px',
            height: '24px',
          },
        };
        return editor;
      });
    setEnabledEditors(enabledEditorsReceived);
  }, []);

  useEffect(() => {
    ipcRenderer.send('get-worktrees', tabRepoPath);

    const onOpenEditorError = (event: any, error: any) => {
      notification.error({
        message: 'Error During Web Editor Launch',
        description: error,
        placement: 'bottomLeft',
      });
    };

    const onWorktreesFound = (event: any, code: number, result: any) => {
      log.debug(`worktrees found: ${result}`);
      if (code === 0) {
        setWorktrees(JSON.parse(result));
      } else {
        notification.error({
          message: 'Unable to Fetch Worktrees',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeRemoved = (
      event: any,
      code: number,
      result: any,
      worktreePath: string,
      worktreeName: string,
      withLocalBranch: boolean,
    ) => {
      log.debug(`onWorktreeRemoved: code: ${code} result: ${result}`);
      if (code === 0) {
        setTimeout(() => {
          api.success({
            key: 'updatable',
            message: 'Worktree Successfully Removed',
            placement: 'bottomLeft',
            duration: 0.5,
          });
          setTimeout(() => {
            api.destroy('updatable');
          }, 1500);
        }, 50);
        ipcRenderer.send('show-git-log', tabRepoPath);
        ipcRenderer.send('get-worktrees', tabRepoPath);
      } else if (result.includes('--force')) {
        setTimeout(() => {
          api.destroy('updatable');
          modal.confirm({
            title: withLocalBranch
              ? 'changes have been found in the worktree. Confirm deletion of this worktree and local branch ?'
              : 'changes have been found in the worktree. Confirm deletion of this worktree ?',
            icon: <ExclamationCircleFilled />,
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            centered: true,
            onOk() {
              if (withLocalBranch) {
                api.open({
                  key: 'updatable',
                  icon: <LoadingOutlined />,
                  message:
                    'Your worktree is being deleted. Please wait a moment while we complete the process.',
                  placement: 'bottomLeft',
                  duration: 0.5,
                });
                ipcRenderer.send(
                  'remove-worktree-local-branch',
                  worktreeName,
                  worktreePath,
                  tabRepoPath,
                  true,
                );
              } else {
                api.open({
                  key: 'updatable',
                  icon: <LoadingOutlined />,
                  message:
                    'Your worktree is being deleted. Please wait a moment while we complete the process.',
                  placement: 'bottomLeft',
                  duration: 0.5,
                });
                ipcRenderer.send(
                  'remove-worktree',
                  worktreeName,
                  worktreePath,
                  tabRepoPath,
                  true,
                );
              }
            },
          });
        }, 500);
      } else {
        setTimeout(() => {
          api.error({
            key: 'updatable',
            message: 'Unable to Remove Worktree',
            description: result,
            placement: 'bottomLeft',
          });
        }, 500);
      }
    };

    const onWorktreeRenamed = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'The worktree has been renamed',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        setLoadingRenameWorktree(false);
        setIsModalOpen(false);
        ipcRenderer.send('show-git-log', tabRepoPath);
        ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        setLoadingRenameWorktree(false);
        notification.error({
          message: 'Unable to Rename Worktree',
          description: result,
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
          description: result,
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
        setLoadingMoveWorktree(false);
        setLoadingChangePatternWorktree(false);
        setIsMoveModalOpen(false);
        setIsChangePatternModalOpen(false);
        ipcRenderer.send('get-worktrees', tabRepoPath);
      } else {
        setLoadingMoveWorktree(false);
        setLoadingChangePatternWorktree(false);
        notification.error({
          message: 'Unable to Move Worktree to folder',
          description: result,
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
  }, [api, modal, tabRepoPath]);

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const onFinish = () => {
    setLoadingRenameWorktree(true);
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

  const onFinishMoveWorktree = () => {
    setLoadingMoveWorktree(true);
    ipcRenderer.send(
      'move-worktree-to-folder',
      form.getFieldValue('nameWorktreeToMove'),
      form.getFieldValue('newWorktreePath'),
      form.getFieldValue('oldPathWorktreeToMove'),
      tabRepoPath,
    );
  };

  const onFinishChangePatternWorktree = () => {
    setLoadingChangePatternWorktree(true);
    ipcRenderer.send(
      'move-worktree-to-folder',
      form.getFieldValue('worktreeToChange').name,
      form.getFieldValue('worktreeToChangePatternNewPath'),
      form.getFieldValue('worktreeToChange').path,
      tabRepoPath,
    );
  };

  const handleCancelChangePatternWorktree = () => {
    setIsChangePatternModalOpen(false);
  };

  const getMenuItems = (
    isWorktreeLocked: boolean,
    isPrimaryWorktree: boolean,
  ) => {
    if (isWorktreeLocked) {
      return [
        ...items,
        {
          label: 'Unlock',
          value: '3',
          icon: <UnlockOutlined />,
        },
        {
          label: 'Rename',
          value: '-2',
          icon: <EditOutlined />,
          disabled: true,
        },
        {
          label: 'Change Naming Pattern',
          value: '-6',
          icon: <FieldStringOutlined />,
          disabled: true,
        },
        {
          label: 'Change Folder',
          value: '5',
          icon: <FolderEditIcon size={16} />,
          disabled: true,
        },
        {
          label: 'Delete',
          value: '2',
          icon: <DeleteOutlined />,
          disabled: true,
        },
      ];
    }
    return [
      ...items,
      {
        label: 'Rename',
        value: '-2',
        icon: <EditOutlined />,
        disabled: isPrimaryWorktree,
      },
      {
        label: 'Change Naming Pattern',
        value: '-6',
        icon: <FieldStringOutlined />,
        disabled: isPrimaryWorktree,
      },
      {
        label: 'Change Folder',
        value: '5',
        icon: <FolderEditIcon size={16} />,
        disabled: isPrimaryWorktree,
      },
      {
        label: 'Delete',
        value: '2',
        icon: <DeleteOutlined />,
        disabled: isPrimaryWorktree,
        children: [
          {
            label: 'worktree',
            value: '2-0',
          },
          {
            label: 'worktree and local branch',
            value: '2-1',
          },
        ],
      },
      {
        label: 'Lock',
        value: '4',
        icon: <LockOutlined />,
        disabled: isPrimaryWorktree,
      },
    ];
  };

  const closeTerminalModal = () => {
    setRepositoryInTerminal(null);
    setOpenTerminalModal(false);
  };

  const onClickWorktree = (worktree: any) => {
    return (event: any) => {
      const key = event[event.length - 1];
      if (key === '-6') {
        setIsChangePatternModalOpen(true);
        form.setFieldValue('worktreeToChange', worktree);
        form.setFieldValue('repo', tabRepoPath);
        return;
      }
      if (key === '-3') {
        setRepositoryInTerminal(worktree.path);
        setOpenTerminalModal(true);
        return;
      }
      if (key === '-2') {
        setIsModalOpen(true);
        form.setFieldValue('oldWorktreeName', worktree.name);
        form.setFieldValue('oldWorktreePath', worktree.path);
        form.setFieldValue('newWorktreeName', worktree.name);
        return;
      }
      if (key === '-1') {
        ipcRenderer.send('open-explorer', worktree.path);
        return;
      }
      if (key === '0-2') {
        ipcRenderer.send('open-editor', 'Intellij', worktree.path, tabRepoPath);
        return;
      }
      if (key === '0-3') {
        ipcRenderer.send('open-editor', 'Webstorm', worktree.path, tabRepoPath);
        return;
      }
      if (key === '0-4') {
        ipcRenderer.send('open-editor', 'Rider', worktree.path, tabRepoPath);
        return;
      }
      if (key === '0-5') {
        ipcRenderer.send('open-editor', 'PyCharm', worktree.path, tabRepoPath);
        return;
      }
      if (key === '0-6') {
        ipcRenderer.send('open-editor', 'CLion', worktree.path, tabRepoPath);
        return;
      }
      if (key === '0-7') {
        ipcRenderer.send('open-editor', 'PhpStorm', worktree.path, tabRepoPath);
        return;
      }
      if (key === '0-8') {
        ipcRenderer.send('open-editor', 'RubyMine', worktree.path, tabRepoPath);
        return;
      }
      if (key === '0-9') {
        ipcRenderer.send('open-editor', 'GoLand', worktree.path, tabRepoPath);
        return;
      }
      if (key === '0-10') {
        ipcRenderer.send(
          'open-editor',
          'Visual Studio',
          worktree.path,
          tabRepoPath,
        );
        return;
      }
      if (key === '0-12') {
        ipcRenderer.send('open-editor', 'Brackets', worktree.path, tabRepoPath);
        return;
      }
      if (key === '0-13') {
        ipcRenderer.send(
          'open-editor',
          'Android Studio',
          worktree.path,
          tabRepoPath,
        );
        return;
      }
      if (key === '0-14') {
        ipcRenderer.send(
          'open-editor',
          'Sublime Text',
          worktree.path,
          tabRepoPath,
        );
        return;
      }
      if (key === '1-2') {
        navigator.clipboard.writeText(worktree.name);
        return;
      }
      if (key === '1-3') {
        navigator.clipboard.writeText(worktree.path);
        return;
      }
      if (key === '2-0') {
        api.open({
          key: 'updatable',
          icon: <LoadingOutlined />,
          message:
            'Your worktree is being deleted. Please wait a moment while we complete the process.',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        ipcRenderer.send(
          'remove-worktree',
          worktree.name,
          worktree.path,
          tabRepoPath,
          false,
        );
        return;
      }
      if (key === '2-1') {
        api.open({
          key: 'updatable',
          icon: <LoadingOutlined />,
          message:
            'Your worktree is being deleted. Please wait a moment while we complete the process.',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        ipcRenderer.send(
          'remove-worktree-local-branch',
          worktree.name,
          worktree.path,
          tabRepoPath,
          false,
        );
        return;
      }
      if (key === '3') {
        ipcRenderer.send(
          'change-lock-worktree',
          false,
          worktree.path,
          tabRepoPath,
        );
        return;
      }
      if (key === '4') {
        ipcRenderer.send(
          'change-lock-worktree',
          true,
          worktree.path,
          tabRepoPath,
        );
        return;
      }
      if (key === '5') {
        setIsMoveModalOpen(true);
        form.setFieldValue('nameWorktreeToMove', worktree.name);
        form.setFieldValue('newWorktreePath', worktree.path);
        form.setFieldValue('oldPathWorktreeToMove', worktree.path);
        form.setFieldValue('resolvedName', worktree.resolvedName);
      }
    };
  };

  const loadData = (selectedOptions: any[]) => {
    const targetOption = selectedOptions[selectedOptions.length - 1];

    if (targetOption.value === '0') {
      targetOption.children = enabledEditors.map((editor: any) => {
        editor.value = editor.key;
        return editor;
      });
    }
  };

  const renderOption = (option: any) => {
    return (
      <Space>
        {option.icon && React.cloneElement(option.icon)}
        <span>{option.label}</span>
      </Space>
    );
  };

  return (
    <>
      {contextHolder}
      <ul style={{ margin: '0', paddingLeft: '8px', paddingRight: '2px' }}>
        {worktrees.map((worktree: any) => (
          <li
            key={worktree.name}
            className={!isDarkMode ? 'worktree-item' : 'worktree-item-dark'}
            style={{
              color: token.colorTextBase,
            }}
          >
            <Space
              className="worktree-container"
              style={{ overflowX: 'hidden', whiteSpace: 'nowrap' }}
            >
              {/* eslint-disable-next-line no-nested-ternary */}
              {worktree.isLocked ? (
                <LockOutlined />
              ) : worktree.prunable ? (
                <Tooltip
                  title="Gitdir file points to non-existent location"
                  placement="right"
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <CloseOutlined style={{ color: token.colorError }} />
                </Tooltip>
              ) : (
                <Tree02Icon size={18} />
              )}
              <span
                style={{ color: worktree.prunable ? token.colorError : '' }}
              >
                <Tooltip
                  title={worktree.name}
                  placement="right"
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  {worktree.name}
                </Tooltip>
              </span>
            </Space>
            <Cascader
              options={getMenuItems(worktree.isLocked, worktree.isPrimary)}
              onChange={onClickWorktree(worktree)}
              loadData={loadData}
              optionRender={renderOption}
              expandTrigger="hover"
              popupClassName="worktree-menu"
            >
              <Tooltip
                title="actions"
                placement="right"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <MoreOutlined style={{ cursor: 'pointer' }} />
              </Tooltip>
            </Cascader>
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
          loading={loadingRenameWorktree}
        />
      )}
      {isMoveModalOpen && (
        <MoveWorktree
          isModalOpen={isMoveModalOpen}
          form={form}
          onFinish={onFinishMoveWorktree}
          handleCancel={handleCancelMoveWorktree}
          loading={loadingMoveWorktree}
        />
      )}
      {isChangePatternModalOpen && (
        <ChangePatternWorktree
          isModalOpen={isChangePatternModalOpen}
          form={form}
          onFinish={onFinishChangePatternWorktree}
          handleCancel={handleCancelChangePatternWorktree}
          loading={loadingChangePatternWorktree}
        />
      )}
    </>
  );
}
