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
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  PartitionOutlined,
  PlusOutlined,
  UploadOutlined,
  XFilled,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { ipcRenderer } from 'electron';
import EditWorkflow from './EditWorkflow';
import AddWorkflow from './AddWorkflow';
import ImportWorkflow from './ImportWorkflow';
import TabService from '../../services/tab/TabService';

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

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    ipcRenderer.send('get-workflows', tabRepoPath);
    const onWorkflowsFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setWorkflows(JSON.parse(result));
      } else {
        notification.error({
          message: 'Error fetching workflows',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorkflowStopped = () => {
      setPlayingWorkflow(null);
    };

    const onWorkflowRemoved = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'Workflow deleted',
          description: 'Worktree deleted successfully',
          placement: 'bottomLeft',
        });
        ipcRenderer.send('get-workflows', tabRepoPath);
      } else {
        notification.error({
          message: 'Error deleting workflow',
          description: <Typography.Text copyable>{result}</Typography.Text>,
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

    ipcRenderer.on('workflows-found', onWorkflowsFound);
    ipcRenderer.on('workflow-stopped', onWorkflowStopped);
    ipcRenderer.on('workflow-removed', onWorkflowRemoved);

    ipcRenderer.on('worktrees-found', onWorktreesFound);

    return () => {
      ipcRenderer.removeAllListeners('workflows-found');
      ipcRenderer.removeAllListeners('workflow-stopped');
      ipcRenderer.removeAllListeners('workflow-removed');
      ipcRenderer.removeAllListeners('worktrees-found');
    };
  }, []);

  const screenHeight = useMemo(() => {
    return window.innerHeight;
  }, []);

  const showDrawer = () => {
    setOpenAdd(true);
  };

  const importWorkflow = () => {
    setOpenImport(true);
  };

  useHotkeys('shift+a', () => showDrawer(), { preventDefault: true });
  useHotkeys('shift+i', () => importWorkflow(), { preventDefault: true });

  const showEditDrawer = (record: any) => {
    return () => {
      setWorkflowToEdit(record);
      setOpenEdit(true);
    };
  };

  const onCloseAdd = () => {
    setOpenAdd(false);
  };

  const onConfirmImport = (selected: any[]) => {
    console.log('selected', selected);
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
        title: 'Are you sure delete this workflow ?',
        icon: <ExclamationCircleFilled />,
        okText: 'Yes',
        okType: 'danger',
        cancelText: 'No',
        centered: true,
        onOk() {
          console.log('OK');
          ipcRenderer.send('remove-workflow', record.id, tabRepoPath);
        },
        onCancel() {
          console.log('Cancel');
        },
      });
    };
  };

  const playWorkflow = (record: any) => {
    return () => {
      if (!record.mode) {
        record.mode = 'sequential';
      }
      if (!record.worktrees) {
        record.worktrees = worktrees;
      }
      console.log('play', record);
      ipcRenderer.send('play-workflow', record);
      setPlayingWorkflow(record.name);
    };
  };

  const stopWorkflow = (record: any) => {
    return () => {
      console.log('stop', record);
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
    console.log('workflows', workflows);
  };

  const handleWorktreesChange = (value: any[], workflow: any) => {
    const valuesMapped = value.map((val) =>
      worktrees.find((option: any) => option.value === val),
    );
    setWorkflows(
      workflows.map((item: any) => {
        if (item.key === workflow.key) {
          item.worktrees = valuesMapped.length !== 0 ? valuesMapped : worktrees;
        }
        return item;
      }),
    );
    console.log('workflows', workflows);
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
          <Tooltip placement="top" title="Delete workflow">
            <DeleteOutlined
              onClick={!playingWorkflow ? deleteWorkflow(record) : () => null}
              style={{
                cursor: !playingWorkflow ? 'pointer' : 'no-drop',
                color: !playingWorkflow ? colorError : colorTextDisabled,
              }}
              className={!playingWorkflow ? 'icon-action' : ''}
            />
          </Tooltip>
          <Tooltip placement="top" title="Edit workflow">
            <EditOutlined
              onClick={!playingWorkflow ? showEditDrawer(record) : () => null}
              style={{
                cursor: !playingWorkflow ? 'pointer' : 'no-drop',
                color: !playingWorkflow ? colorPrimary : colorTextDisabled,
              }}
              className={!playingWorkflow ? 'icon-action' : ''}
            />
          </Tooltip>
          {playingWorkflow === record.name && (
            <Tooltip placement="top" title="Stop workflow">
              <XFilled
                onClick={stopWorkflow(record)}
                className="icon-action"
                style={{ cursor: 'pointer', color: colorPrimary }}
              />
            </Tooltip>
          )}
          {playingWorkflow !== record.name && (
            <Tooltip placement="top" title="Play workflow">
              <CaretRightOutlined
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
      <Flex gap={screenHeight < 1080 ? 'middle' : 'large'} vertical>
        <div>
          <Space>
            <PartitionOutlined />
            <Badge count={7} offset={[10, 0]} title="total">
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
          <ImportWorkflow
            isOpen={openImport}
            onConfirm={onConfirmImport}
            onCancel={onCancelImport}
          />
        </div>
        <EditWorkflow
          openEdit={openEdit}
          onCloseEdit={onCloseEdit}
          workflow={workflowToEdit}
        />
        <Table
          columns={columns}
          dataSource={workflows}
          pagination={{
            pageSize: screenHeight < 1080 ? 3 : 4,
            position: ['bottomLeft'],
          }}
          bordered
          size={screenHeight < 1080 ? 'middle' : 'large'}
        />
      </Flex>
    </div>
  );
});

export default Workflows;
