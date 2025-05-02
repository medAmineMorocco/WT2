import {
  App as AntdApp,
  Button,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Tooltip,
  Typography,
} from 'antd';
import {
  BranchesOutlined,
  FolderOutlined,
  InfoCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import log from 'electron-log';
import TabService from '../../services/tab/TabService';
import { useItemsContext } from '../../TabsContext';

export default function AddWorktree({
  isModalOpen,
  handleCancel,
}: {
  isModalOpen: boolean;
  handleCancel: any;
}) {
  const { setIsWorkflowPlaying } = useItemsContext();

  const [createWorktreeMode, setCreateWorktreeMode] = useState('new-branch');

  const [branches, setBranches] = useState<any[]>([]);

  const [tags, setTags] = useState<any[]>([]);

  const [worktreesFolder, setWorktreesFolder] = useState<string>('');

  const [pathSeparator, setPathSeparator] = useState<string>('');

  const [loadingCreateWorktree, setLoadingCreateWorktree] = useState(false);

  const selectTagRef = useRef(null);

  const selectBranchRef = useRef(null);

  const { notification } = AntdApp.useApp();

  const [form] = Form.useForm();

  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const activeTabValue = TabService.getTab(activeTab);
    if (activeTabValue.worktreesPath) {
      ipcRenderer.send('get-worktrees-separator', tabRepoPath);
      setWorktreesFolder(activeTabValue.worktreesPath);
    } else {
      ipcRenderer.send('get-worktrees-folder', tabRepoPath);
    }

    const onWorktreeCreated = (event: any, code: number, result: any) => {
      log.debug(
        `onWorktreeCreated code: ${code} result: ${JSON.stringify(result)}`,
      );
      if (code === 0) {
        form.setFieldValue('name', null);
        notification.success({
          message: 'Worktree Created',
          placement: 'bottomLeft',
          duration: 1,
        });
        setLoadingCreateWorktree(false);
        ipcRenderer.send('get-worktrees', tabRepoPath);
        handleCancel();
      } else {
        setLoadingCreateWorktree(false);
        notification.error({
          message: 'Unable to Create Worktree',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onBranchesFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setBranches(
          JSON.parse(result).map((branch: string) => {
            return {
              label: branch,
              value: branch,
            };
          }),
        );
      }
    };

    const onTagsFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setTags(
          result.map((branch: string) => {
            return {
              label: branch,
              value: branch,
            };
          }),
        );
      }
    };

    const onWorktreesFolderFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        const { folder, separator } = JSON.parse(result);
        setWorktreesFolder(folder);
        setPathSeparator(separator);
      }
    };

    const onWorktreesSeparatorFound = (
      event: any,
      code: number,
      result: any,
    ) => {
      if (code === 0) {
        setPathSeparator(result);
      }
    };

    const onSelectWorktreesDir = (
      event: any,
      code: number,
      dirPath: string,
    ) => {
      if (code === 0) {
        setWorktreesFolder(dirPath);
      }
    };

    ipcRenderer.on('worktree-created', onWorktreeCreated);
    ipcRenderer.on('receive-branches', onBranchesFound);
    ipcRenderer.on('receive-tags', onTagsFound);
    ipcRenderer.on('worktrees-folder-found', onWorktreesFolderFound);
    ipcRenderer.on('worktrees-separator-found', onWorktreesSeparatorFound);
    ipcRenderer.on('selected-worktrees-dir', onSelectWorktreesDir);

    return () => {
      ipcRenderer.removeAllListeners('worktree-created');
      ipcRenderer.removeAllListeners('receive-branches');
      ipcRenderer.removeAllListeners('receive-tags');
      ipcRenderer.removeAllListeners('worktrees-folder-found');
      ipcRenderer.removeAllListeners('worktrees-separator-found');
      ipcRenderer.removeAllListeners('selected-worktrees-dir');
    };
    // do not touch
  }, [form, notification, tabRepoPath]);

  useEffect(() => {
    const activeTabValue = TabService.getTab(activeTab);
    if (activeTabValue.preHook) {
      form.setFieldValue('preHook', activeTabValue.preHook);
    }
    if (activeTabValue.postHook) {
      form.setFieldValue('postHook', activeTabValue.postHook);
    }
  }, [activeTab, form, isModalOpen, tabRepoPath]);

  useEffect(() => {
    if (createWorktreeMode === 'existing-branch' && isModalOpen) {
      ipcRenderer.send('list-branches', tabRepoPath);
    }
    if (createWorktreeMode === 'existing-tag' && isModalOpen) {
      ipcRenderer.send('list-tags', tabRepoPath);
    }
  }, [activeTab, createWorktreeMode, form, isModalOpen, tabRepoPath]);

  const onChangeCreateWorktreeMode = (newVal: string) => {
    setCreateWorktreeMode(newVal);
  };

  function isNotBlank(val: string | null | undefined) {
    return typeof val === 'string' && val.trim() !== '';
  }

  const onFinish = (values: any) => {
    log.debug(`values: ${JSON.stringify(values)}`);
    let worktreeName: any;
    if (createWorktreeMode === 'new-branch') {
      worktreeName = values.name;
    } else if (createWorktreeMode === 'existing-branch') {
      worktreeName = values['existing-branch'];
    } else {
      worktreeName = values['existing-tag'];
    }

    if (!isNotBlank(values.preHook) && !isNotBlank(values.postHook)) {
      log.debug('== create-worktree ==');
      setLoadingCreateWorktree(true);
      ipcRenderer.send(
        'create-worktree',
        worktreeName,
        worktreesFolder + pathSeparator + worktreeName,
        createWorktreeMode,
        tabRepoPath,
      );
    } else {
      log.debug('== create-worktree-workflow ==');
      ipcRenderer.send(
        'create-worktree-workflow',
        values,
        createWorktreeMode,
        worktreeName.replaceAll('.', '-'),
        worktreesFolder,
        tabRepoPath,
      );
      setIsWorkflowPlaying(true);
      handleCancel();
    }

    const activeTabValue = TabService.getTab(activeTab);
    const activeTabNewValue = {
      ...activeTabValue,
      preHook: values.preHook,
      postHook: values.postHook,
      worktreesPath: worktreesFolder,
    };
    window.localStorage.setItem(activeTab, JSON.stringify(activeTabNewValue));
  };

  const getWorktreeName = () => {
    if (createWorktreeMode === 'new-branch') {
      return form.getFieldValue('name') || ' ';
    }
    if (createWorktreeMode === 'existing-branch') {
      return form.getFieldValue('existing-branch') || ' ';
    }
    if (createWorktreeMode === 'existing-tag') {
      const tag = form.getFieldValue('existing-tag');
      if (tag) {
        return tag.replaceAll('.', '-');
      }
      return ' ';
    }
    return '';
  };

  const chooseWorktreesDir = () => {
    ipcRenderer.send('choose-worktrees-dir');
  };

  const onSelectTagChange = () => {
    if (selectTagRef.current) {
      // @ts-ignore
      selectTagRef.current.blur();
    }
  };

  const onSelectBranchChange = () => {
    if (selectBranchRef.current) {
      // @ts-ignore
      selectBranchRef.current.blur();
    }
  };

  return (
    <Modal
      open={isModalOpen}
      footer={null}
      onCancel={handleCancel}
      destroyOnClose
      width={400}
      closeIcon={false}
    >
      <Segmented
        defaultValue={createWorktreeMode}
        onChange={onChangeCreateWorktreeMode}
        block
        options={[
          {
            label: <div style={{ padding: 2 }}>New Worktree</div>,
            value: 'new-branch',
          },
          {
            label: <div style={{ padding: 2 }}>From Branch</div>,
            value: 'existing-branch',
          },
          {
            label: <div style={{ padding: 2 }}>From Tag</div>,
            value: 'existing-tag',
          },
        ]}
      />
      <Form
        layout="vertical"
        requiredMark="optional"
        form={form}
        onFinish={onFinish}
        style={{ marginTop: '8px' }}
      >
        {createWorktreeMode === 'new-branch' && (
          <Form.Item
            label="Name"
            name="name"
            extra="Always created from HEAD of the main worktree"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Please enter the name of your worktree.',
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
          >
            <Input
              prefix={<BranchesOutlined />}
              placeholder="feature-add-sidebar"
              allowClear
            />
          </Form.Item>
        )}
        {createWorktreeMode === 'existing-branch' && (
          <Form.Item
            label="Existing branch"
            name="existing-branch"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Please choose a branch.',
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
          >
            <Select
              ref={selectBranchRef}
              allowClear
              showSearch
              placeholder="Select branch"
              options={branches}
              onChange={onSelectBranchChange}
            />
          </Form.Item>
        )}
        {createWorktreeMode === 'existing-tag' && (
          <Form.Item
            label="Existing tag"
            name="existing-tag"
            extra="A new branch is created from the selected tag, and a worktree is linked to it"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Please choose a tag.',
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
          >
            <Select
              ref={selectTagRef}
              allowClear
              showSearch
              placeholder="Select tag"
              options={tags}
              onChange={onSelectTagChange}
            />
          </Form.Item>
        )}
        <Form.Item
          label="Pre-hook"
          name="preHook"
          tooltip={{
            title: `command will be executed in main worktree : ${tabRepoPath}`,
            icon: <InfoCircleOutlined />,
            placement: 'right',
          }}
        >
          <Input
            prefix={<StepBackwardOutlined />}
            placeholder="git fetch origin main:main"
            allowClear
          />
        </Form.Item>
        <Form.Item
          label="Post-hook"
          name="postHook"
          tooltip={{
            title: `command will be executed in created worktree repository`,
            icon: <InfoCircleOutlined />,
            placement: 'right',
          }}
        >
          <Input
            prefix={<StepForwardOutlined />}
            placeholder="npm install"
            allowClear
          />
        </Form.Item>
        <Form.Item extra="The worktree will be created at the specified directory">
          <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
            <Tooltip
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
              title="Change Location"
              placement="bottom"
            >
              <Button
                size="small"
                icon={<FolderOutlined />}
                onClick={chooseWorktreesDir}
              />
            </Tooltip>
            <Tooltip
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
              title={worktreesFolder + pathSeparator + getWorktreeName()}
              placement="bottom"
            >
              <Typography.Text
                code
                ellipsis={{ rows: 1 }}
                style={{ direction: 'rtl' }}
              >
                {worktreesFolder + pathSeparator + getWorktreeName()}
              </Typography.Text>
            </Tooltip>
          </div>
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            style={{ width: '100%' }}
            loading={loadingCreateWorktree}
          >
            Create Worktree
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
