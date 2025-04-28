import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Badge,
  Button,
  Flex,
  Radio,
  Select,
  Space,
  Table,
  theme,
  Tooltip,
  Typography,
} from 'antd';
import {
  ExclamationCircleFilled,
  PartitionOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  PlayIcon,
  StopIcon,
  Edit02Icon,
  Delete02Icon,
  Copy01Icon,
} from 'hugeicons-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import EditWorkflow from './EditWorkflow';
import AddWorkflow from './AddWorkflow';
import ImportWorkflow from './ImportWorkflow';
import TabService from '../../services/tab/TabService';
import { useItemsContext } from '../../TabsContext';

const { useToken } = theme;

const Workflows = forwardRef<HTMLDivElement, {}>((props, ref) => {
  const {
    token: {
      colorBgContainer,
      borderRadiusLG,
      colorPrimary,
      colorError,
      colorTextDisabled,
    },
  } = theme.useToken();

  const { token } = useToken();

  const [openAdd, setOpenAdd] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [workflowToEdit, setWorkflowToEdit] = useState();
  const [playingWorkflow, setPlayingWorkflow] = useState(null);
  const { modal, notification } = AntdApp.useApp();
  const [workflows, setWorkflows] = useState<any>([]);
  const [worktrees, setWorktrees] = useState([]);
  const [workflowsToImport, setWorkflowsToImport] = useState([]);
  const [uuid, setUuid] = useState<string>(new Date().toString());
  const { setIsWorkflowPlaying } = useItemsContext();

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    ipcRenderer.send('get-workflows', tabRepoPath);
    const onWorkflowsFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setWorkflows(JSON.parse(result));
        setUuid(new Date().toString());
      } else {
        notification.error({
          message: 'Unable to Fetch Workflows',
          placement: 'bottomLeft',
        });
      }
    };

    const onWorkflowsImported = (event: any, code: number, result: any) => {
      if (code === 0) {
        ipcRenderer.send('get-workflows', tabRepoPath);

        notification.success({
          message: `${result} workflow(s) have been imported`,
          placement: 'bottomLeft',
          duration: 0.5,
        });
      }
    };

    const onWorkflowStopped = () => {
      setIsWorkflowPlaying(false);
      setPlayingWorkflow(null);
    };

    const onWorkflowRemoved = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'The workflow has been removed',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        ipcRenderer.send('get-workflows', tabRepoPath);
      } else {
        notification.error({
          message: 'Unable to Delete Workflow',
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreesFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setWorktrees(
          JSON.parse(result).map((item: any) => {
            return {
              label: item.name,
              value: item.name,
              path: item.path,
            };
          }),
        );
      }
    };

    const onWorkflowsToImportFound = (
      event: any,
      code: number,
      result: any,
    ) => {
      if (code === 0) {
        setWorkflowsToImport(JSON.parse(result));
        setOpenImport(true);
      }
    };

    const onWorkflowDuplicated = (event: any, code: number) => {
      if (code === 0) {
        ipcRenderer.send('get-workflows', tabRepoPath);
      }
    };

    const onWorkflowStartedFailed = (event: any, errorMsg: string) => {
      notification.error({
        message: errorMsg,
        placement: 'bottomLeft',
      });
    };

    ipcRenderer.on('workflows-found', onWorkflowsFound);
    ipcRenderer.on('workflows-imported', onWorkflowsImported);
    ipcRenderer.on('workflow-stopped', onWorkflowStopped);
    ipcRenderer.on('workflow-removed', onWorkflowRemoved);
    ipcRenderer.on('worktrees-found', onWorktreesFound);
    ipcRenderer.on('workflows-to-import-found', onWorkflowsToImportFound);
    ipcRenderer.on('workflow-duplicated', onWorkflowDuplicated);
    ipcRenderer.on(
      'workflow-started-failed-worktree-not-found',
      onWorkflowStartedFailed,
    );

    return () => {
      ipcRenderer.removeAllListeners('workflows-found');
      ipcRenderer.removeAllListeners('workflows-imported');
      ipcRenderer.removeAllListeners('workflow-stopped');
      ipcRenderer.removeAllListeners('workflow-removed');
      ipcRenderer.removeAllListeners('worktrees-found');
      ipcRenderer.removeAllListeners('workflows-to-import-found');
      ipcRenderer.removeAllListeners('workflow-duplicated');
      ipcRenderer.removeAllListeners(
        'workflow-started-failed-worktree-not-found',
      );
    };
  }, [notification, tabRepoPath]);

  const showDrawer = () => {
    setOpenAdd(true);
  };

  const importWorkflow = () => {
    ipcRenderer.send('open-dialog-import-workflows');
  };

  useHotkeys('shift+a', () => showDrawer(), { preventDefault: true });
  useHotkeys('shift+i', () => importWorkflow(), { preventDefault: true });

  const showEditDrawer = (record: any) => {
    return () => {
      setWorkflowToEdit(record);
      setOpenEdit(true);
    };
  };

  const duplicateWorkflow = (record: any) => {
    return () => {
      ipcRenderer.send('duplicate-workflow', record, tabRepoPath);
    };
  };

  const onCloseAdd = () => {
    setOpenAdd(false);
  };

  const onConfirmImport = (selected: any[]) => {
    ipcRenderer.send('import-workflows', selected, tabRepoPath);
    setOpenImport(false);
  };

  const onCancelImport = () => {
    setOpenImport(false);
  };

  const onCloseEdit = () => {
    setOpenEdit(false);
  };

  const deleteWorkflow = (record: any) => {
    return () => {
      modal.confirm({
        title: 'Confirm deletion of this workflow ?',
        icon: <ExclamationCircleFilled />,
        okText: 'Yes',
        okType: 'danger',
        cancelText: 'No',
        centered: true,
        onOk() {
          ipcRenderer.send('remove-workflow', record.name, tabRepoPath);
        },
      });
    };
  };

  const playWorkflow = (record: any) => {
    return () => {
      const workflow = { ...record };
      if (!record.mode) {
        workflow.mode = 'sequential';
      }
      if (!record.worktrees || record.worktrees.length === 0) {
        workflow.worktrees = worktrees;
      }
      ipcRenderer.send('play-workflow', workflow, tabRepoPath);
      setPlayingWorkflow(workflow.name);
      setIsWorkflowPlaying(true);
    };
  };

  const stopWorkflow = (record: any) => {
    return () => {
      ipcRenderer.send('stop-workflow', record);
      setPlayingWorkflow(null);
    };
  };

  const handleModeChange = (value: any, workflow: any) => {
    setWorkflows(
      workflows.map((item: any) => {
        if (item.key === workflow.key) {
          item.mode = value;
        }
        return item;
      }),
    );
  };

  const handleWorktreesChange = (values: any[], workflow: any) => {
    const valuesMapped = values.map((val) =>
      worktrees.find((option: any) => option.value === val),
    );
    setWorkflows(
      workflows.map((item: any) => {
        if (item.name === workflow.name) {
          item.worktrees = valuesMapped;
        }
        return item;
      }),
    );
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
    },
    {
      title: 'Running mode',
      dataIndex: 'mode',
      key: 'mode',
      render: (_: any, record: any) => (
        <Radio.Group
          defaultValue="sequential"
          buttonStyle="solid"
          size="small"
          onChange={(e) => handleModeChange(e.target.value, record)}
        >
          <Radio.Button value="sequential">Sequential</Radio.Button>
          <Radio.Button value="parallel">Parallel</Radio.Button>
        </Radio.Group>
      ),
    },
    {
      title: 'Worktrees',
      dataIndex: 'worktrees',
      key: 'worktrees',
      render: (_: any, record: any) => (
        <Select
          mode="multiple"
          allowClear
          style={{ width: '100%' }}
          placeholder="Select worktrees"
          defaultValue={[]}
          onChange={(value) => handleWorktreesChange(value, record)}
          options={worktrees}
          size="small"
        />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', justifyContent: 'space-evenly' }}>
          <Tooltip
            placement="top"
            title="Delete workflow"
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
          >
            <Delete02Icon
              size={16}
              onClick={!playingWorkflow ? deleteWorkflow(record) : () => null}
              style={{
                cursor: !playingWorkflow ? 'pointer' : 'no-drop',
                color: !playingWorkflow ? colorError : colorTextDisabled,
              }}
              className={!playingWorkflow ? 'icon-action' : ''}
            />
          </Tooltip>
          <Tooltip
            placement="top"
            title="Duplicate workflow"
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
          >
            <Copy01Icon
              size={16}
              onClick={
                !playingWorkflow ? duplicateWorkflow(record) : () => null
              }
              style={{
                cursor: !playingWorkflow ? 'pointer' : 'no-drop',
                color: !playingWorkflow ? colorPrimary : colorTextDisabled,
              }}
              className={!playingWorkflow ? 'icon-action' : ''}
            />
          </Tooltip>
          <Tooltip
            placement="top"
            title="Edit workflow"
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
          >
            <Edit02Icon
              size={16}
              onClick={!playingWorkflow ? showEditDrawer(record) : () => null}
              style={{
                cursor: !playingWorkflow ? 'pointer' : 'no-drop',
                color: !playingWorkflow ? colorPrimary : colorTextDisabled,
              }}
              className={!playingWorkflow ? 'icon-action' : ''}
            />
          </Tooltip>
          {playingWorkflow === record.name && (
            <Tooltip
              placement="top"
              title="Stop workflow"
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
            >
              <StopIcon
                size={16}
                onClick={stopWorkflow(record)}
                className="icon-action"
                style={{ cursor: 'pointer', color: colorPrimary }}
              />
            </Tooltip>
          )}
          {playingWorkflow !== record.name && (
            <Tooltip
              placement="top"
              title="Play workflow"
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
            >
              <PlayIcon
                size={16}
                onClick={
                  !playingWorkflow || record.name === playingWorkflow
                    ? playWorkflow(record)
                    : () => null
                }
                className={!playingWorkflow ? 'icon-action' : ''}
                style={{
                  cursor:
                    !playingWorkflow || record.name === playingWorkflow
                      ? 'pointer'
                      : 'no-drop',
                  color: !playingWorkflow ? colorPrimary : colorTextDisabled,
                }}
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <div
      style={{
        position: 'relative',
        padding: 12,
        height: 'calc(48.5vh - 20px)',
        marginTop: '1vh',
        background: colorBgContainer,
        borderRadius: borderRadiusLG,
        color: token.colorTextBase,
      }}
    >
      <Flex gap="middle" vertical style={{ height: '100%' }}>
        <div>
          <Space>
            <PartitionOutlined />
            <Badge
              count={workflows.length}
              offset={[10, 0]}
              title="total"
              color="#FAAD14"
            >
              <strong>Workflows</strong>
            </Badge>
          </Space>
        </div>
        <div>
          <Space style={{ float: 'right' }}>
            <Tooltip
              placement="top"
              title={
                <Space>
                  <span>Import workflow</span>
                  <small style={{ color: 'grey' }}>Shift+I</small>
                </Space>
              }
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
            >
              <Button
                onClick={importWorkflow}
                type="primary"
                icon={<UploadOutlined />}
              >
                Import
              </Button>
            </Tooltip>
            <Tooltip
              placement="top"
              title={
                <Space>
                  <span>Add workflow</span>
                  <small style={{ color: 'grey' }}>Shift+A</small>
                </Space>
              }
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
            >
              <Button
                ref={ref}
                onClick={showDrawer}
                type="primary"
                icon={<PlusOutlined />}
              >
                Add
              </Button>
            </Tooltip>
          </Space>
          <AddWorkflow openAdd={openAdd} onCloseAdd={onCloseAdd} />
          {openImport && (
            <ImportWorkflow
              isOpen={openImport}
              onConfirm={onConfirmImport}
              onCancel={onCancelImport}
              workflows={workflowsToImport}
            />
          )}
        </div>
        <EditWorkflow
          openEdit={openEdit}
          onCloseEdit={onCloseEdit}
          workflow={workflowToEdit}
        />
        <div
          style={{
            flexGrow: 1,
            flexShrink: 0,
            height: 'calc(44.5vh - 12px - (22px + 16px + 32px + 16px))',
          }}
        >
          <Table
            key={uuid}
            className="workflows-table"
            columns={columns}
            dataSource={workflows}
            pagination={false}
            scroll={{ y: 'calc(44.5vh -12px - (22px + 16px + 32px + 16px))' }}
            bordered
            size="middle"
          />
        </div>
      </Flex>
    </div>
  );
});

export default Workflows;
