import React, {
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  App as AntdApp,
  Button,
  Select,
  Space,
  Table,
  theme,
  Tooltip,
  Spin,
  Segmented,
  Tag,
  Typography,
  Empty,
} from 'antd';
import {
  ExclamationCircleFilled,
  PlusOutlined,
  UploadOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  BranchesOutlined,
  BarsOutlined,
  PartitionOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  PlayIcon,
  StopIcon,
  Edit02Icon,
  Delete02Icon,
  Copy01Icon,
} from 'hugeicons-react';
import TabService from '../../services/tab/TabService';
import { useItemsContext } from '../../TabsContext';
import './Workflows.css';

const { useToken } = theme;

const EditWorkflow = lazy(() => import('./EditWorkflow'));
const AddWorkflow = lazy(() => import('./AddWorkflow'));
const ImportWorkflow = lazy(() => import('./ImportWorkflow'));

const Workflows = forwardRef<any, {}>((props, ref) => {
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
  const [mode, setMode] = useState('workflows');

  const tabRepoPath = useMemo(() => {
    const activeTab = TabService.getActiveTab();
    return TabService.getTabRepoPath(activeTab);
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.send('check-trial-expiration');
    window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
    window.electron.ipcRenderer.send('get-workflows', tabRepoPath);
    const onWorkflowsFound = (code: number, result: any) => {
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

    const onWorkflowsImported = (code: number, result: any) => {
      if (code === 0) {
        window.electron.ipcRenderer.send('get-workflows', tabRepoPath);

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

    const onWorkflowRemoved = (code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'The workflow has been removed',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        window.electron.ipcRenderer.send('get-workflows', tabRepoPath);
      } else {
        notification.error({
          message: 'Unable to Delete Workflow',
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreesFound = (code: number, result: any) => {
      if (code === 0) {
        const rawWorktrees = JSON.parse(result);
        const validWorktrees = rawWorktrees.filter(
          (item: any) => !item.prunable && item.directoryExists !== false,
        );
        setWorktrees(
          validWorktrees.map((item: any) => {
            return {
              label: item.name,
              value: item.name,
              path: item.path,
            };
          }),
        );
      } else {
        notification.error({
          message: 'Unable to Fetch Worktrees',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorkflowsToImportFound = (code: number, result: any) => {
      if (code === 0) {
        setWorkflowsToImport(JSON.parse(result));
        setOpenImport(true);
      }
    };

    const onWorkflowDuplicated = (code: number) => {
      if (code === 0) {
        window.electron.ipcRenderer.send('get-workflows', tabRepoPath);
      }
    };

    const onWorkflowStartedFailed = (errorMsg: string) => {
      notification.error({
        message: errorMsg,
        placement: 'bottomLeft',
      });
    };

    const onReceiveSubscriptionInfos = (
      _event: any,
      _hasTrial: boolean,
      packReceived: any,
    ) => {
      if (
        packReceived &&
        packReceived.pack &&
        packReceived.pack.toUpperCase() === 'PRO'
      ) {
        setMode('workflows');
      }
    };

    window.electron.ipcRenderer.on('workflows-found', onWorkflowsFound);
    window.electron.ipcRenderer.on('workflows-imported', onWorkflowsImported);
    window.electron.ipcRenderer.on('workflow-stopped', onWorkflowStopped);
    window.electron.ipcRenderer.on('workflow-removed', onWorkflowRemoved);
    window.electron.ipcRenderer.on('worktrees-found', onWorktreesFound);
    window.electron.ipcRenderer.on(
      'workflows-to-import-found',
      onWorkflowsToImportFound,
    );
    window.electron.ipcRenderer.on('workflow-duplicated', onWorkflowDuplicated);
    window.electron.ipcRenderer.on(
      'workflow-started-failed-worktree-not-found',
      onWorkflowStartedFailed,
    );
    window.electron.ipcRenderer.on('is-subscribed', onReceiveSubscriptionInfos);

    return () => {
      window.electron.ipcRenderer.removeAllListeners('workflows-found');
      window.electron.ipcRenderer.removeAllListeners('workflows-imported');
      window.electron.ipcRenderer.removeAllListeners('workflow-stopped');
      window.electron.ipcRenderer.removeAllListeners('workflow-removed');
      window.electron.ipcRenderer.removeAllListeners(
        'workflows-to-import-found',
      );
      window.electron.ipcRenderer.removeAllListeners('workflow-duplicated');
      window.electron.ipcRenderer.removeAllListeners(
        'workflow-started-failed-worktree-not-found',
      );
      window.electron.ipcRenderer.removeAllListeners('is-expired');
    };
  }, [notification, setIsWorkflowPlaying, tabRepoPath]);

  const showDrawer = () => {
    setOpenAdd(true);
  };

  const importWorkflow = () => {
    window.electron.ipcRenderer.send('open-dialog-import-workflows');
  };

  useHotkeys(
    'shift+i',
    () => (importWorkflow()),
    { preventDefault: true },
  );

  const showEditDrawer = (record: any) => {
    return () => {
      setWorkflowToEdit(record);
      setOpenEdit(true);
    };
  };

  const duplicateWorkflow = (record: any) => {
    return () => {
      window.electron.ipcRenderer.send(
        'duplicate-workflow',
        record,
        tabRepoPath,
      );
    };
  };

  const onCloseAdd = () => {
    setOpenAdd(false);
  };

  const onConfirmImport = (selected: any[]) => {
    window.electron.ipcRenderer.send('import-workflows', selected, tabRepoPath);
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
          window.electron.ipcRenderer.send(
            'remove-workflow',
            record.name,
            tabRepoPath,
          );
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
      } else {
        workflow.worktrees = record.worktrees.filter((w: any) => {
          const val =
            typeof w === 'object' && w !== null ? w.value || w.name || w.label : w;
          return worktrees.some((opt: any) => opt.value === val);
        });
      }
      window.electron.ipcRenderer.send('play-workflow', workflow, tabRepoPath);
      setPlayingWorkflow(workflow.name);
      setIsWorkflowPlaying(true);
    };
  };

  const stopWorkflow = (record: any) => {
    return () => {
      window.electron.ipcRenderer.send('stop-workflow', record);
      setPlayingWorkflow(null);
      setIsWorkflowPlaying(false);
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
      title: 'Workflow',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
      render: (name: string, record: any) => {
        const isRunning = playingWorkflow === record.name;
        const mainCmd =
          typeof record?.command === 'object' && record?.command !== null
            ? record.command.value
            : typeof record?.command === 'string'
              ? record.command
              : '';
        const totalSteps =
          (mainCmd ? 1 : 0) +
          (Array.isArray(record?.commands) ? record.commands.length : 0);

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={`workflow-name-avatar ${isRunning ? 'running' : ''}`}>
              {isRunning ? (
                <SyncOutlined spin style={{ color: '#52c41a', fontSize: 16 }} />
              ) : (
                <ThunderboltOutlined style={{ color: colorPrimary, fontSize: 16 }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {name}
                </Typography.Text>
                {isRunning && (
                  <Tag
                    color="success"
                    style={{
                      margin: 0,
                      fontSize: 10,
                      lineHeight: '18px',
                      padding: '0 6px',
                      borderRadius: 10,
                    }}
                  >
                    Running
                  </Tag>
                )}
              </div>
              <Typography.Text
                type="secondary"
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  maxWidth: 240,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {mainCmd || (totalSteps > 0 ? `${totalSteps} step(s)` : 'Workflow')}
              </Typography.Text>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Running Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 220,
      render: (_: any, record: any) => (
        <Segmented
          value={record.mode || 'sequential'}
          size="small"
          options={[
            {
              label: 'Sequential',
              value: 'sequential',
              icon: <BarsOutlined style={{ fontSize: 11 }} />,
            },
            {
              label: 'Parallel',
              value: 'parallel',
              icon: <PartitionOutlined style={{ fontSize: 11 }} />,
            },
          ]}
          onChange={(val) => handleModeChange(val, record)}
          disabled={Boolean(playingWorkflow)}
          className="workflow-mode-segmented"
        />
      ),
    },
    {
      title: 'Target Worktrees',
      dataIndex: 'worktrees',
      key: 'worktrees',
      render: (_: any, record: any) => {
        const selectedValues = Array.isArray(record.worktrees)
          ? record.worktrees
              .map((w: any) =>
                typeof w === 'object' && w !== null ? w.value : w,
              )
              .filter((val: string) =>
                worktrees.some((opt: any) => opt.value === val),
              )
          : [];
        return (
          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            style={{ width: '100%' }}
            placeholder="All Worktrees (Default)"
            value={selectedValues}
            onChange={(value) => handleWorktreesChange(value, record)}
            options={worktrees}
            size="small"
            disabled={Boolean(playingWorkflow)}
          />
        );
      },
    },
    {
      title: 'Actions',
      key: 'action',
      width: 200,
      align: 'right' as const,
      render: (_: any, record: any) => {
        const isRunning = playingWorkflow === record.name;
        const isAnyRunning = Boolean(playingWorkflow);
        return (
          <div className="workflow-action-cell">
            {isRunning ? (
              <Button
                danger
                type="primary"
                size="small"
                icon={<StopIcon size={14} />}
                onClick={stopWorkflow(record)}
                style={{ fontWeight: 500, borderRadius: 6 }}
              >
                Stop
              </Button>
            ) : (
              <Button
                type="primary"
                size="small"
                icon={<PlayIcon size={14} />}
                onClick={playWorkflow(record)}
                disabled={isAnyRunning}
                className="workflow-run-btn"
              >
                Run
              </Button>
            )}

            <div className="workflow-secondary-actions">
              <Tooltip title="Duplicate workflow" mouseEnterDelay={0.2}>
                <Button
                  type="text"
                  shape="circle"
                  size="small"
                  icon={<Copy01Icon size={15} />}
                  disabled={isAnyRunning}
                  onClick={duplicateWorkflow(record)}
                />
              </Tooltip>
              <Tooltip title="Edit workflow" mouseEnterDelay={0.2}>
                <Button
                  type="text"
                  shape="circle"
                  size="small"
                  icon={<Edit02Icon size={15} />}
                  disabled={isAnyRunning}
                  onClick={showEditDrawer(record)}
                />
              </Tooltip>
              <Tooltip title="Delete workflow" mouseEnterDelay={0.2}>
                <Button
                  type="text"
                  danger
                  shape="circle"
                  size="small"
                  icon={<Delete02Icon size={15} />}
                  disabled={isAnyRunning}
                  onClick={deleteWorkflow(record)}
                />
              </Tooltip>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div
      className="workflows-card-container"
      style={{
        background: colorBgContainer,
        color: token.colorTextBase,
      }}
    >
      <div className="workflows-header-row">
        <div className="workflows-header-left">
          <div className="workflows-title-wrap">
            <ApartmentOutlined style={{ fontSize: 18, color: colorPrimary }} />
            <Typography.Title level={4} style={{ margin: 0, fontWeight: 600 }}>
              Workflows
            </Typography.Title>
            <Tag className="workflows-count-tag">
              {workflows.length} configured
            </Tag>
          </div>
          <Typography.Text type="secondary" className="workflows-subtitle">
            Automate builds, tests, and task pipelines across your worktrees.
          </Typography.Text>
        </div>

        <Space size={8}>
          <Tooltip
            placement="top"
            title={
              <Space>
                <span>Import Workflows</span>
                <small style={{ color: '#aaa' }}>Shift+I</small>
              </Space>
            }
          >
            <Button
              onClick={importWorkflow}
              icon={<UploadOutlined />}
              className="workflows-action-btn"
            >
              Import
            </Button>
          </Tooltip>

          <Tooltip
            placement="top"
            title={
              <Space>
                <span>New Workflow</span>
                <small style={{ color: '#aaa' }}>Shift+A</small>
              </Space>
            }
          >
            <Button
              ref={ref}
              onClick={showDrawer}
              type="primary"
              icon={<PlusOutlined />}
              className="workflows-action-btn-primary"
            >
              New Workflow
            </Button>
          </Tooltip>
        </Space>
      </div>

      {openAdd && (
        <Suspense fallback={<Spin size="large" />}>
          <AddWorkflow openAdd={openAdd} onCloseAdd={onCloseAdd} />
        </Suspense>
      )}
      {openImport && (
        <Suspense fallback={<Spin size="large" />}>
          <ImportWorkflow
            isOpen={openImport}
            onConfirm={onConfirmImport}
            onCancel={onCancelImport}
            workflows={workflowsToImport}
          />
        </Suspense>
      )}
      {openEdit && (
        <Suspense fallback={<Spin size="large" />}>
          <EditWorkflow
            openEdit={openEdit}
            onCloseEdit={onCloseEdit}
            workflow={workflowToEdit}
          />
        </Suspense>
      )}

      <div className="workflows-table-wrap">
        <Table
          key={uuid}
          className="workflows-table"
          columns={columns}
          dataSource={workflows}
          pagination={false}
          scroll={{ y: 'calc(44.5vh - 12px - 90px)' }}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: '#8c8c8c' }}>
                    No workflows configured for this repository yet.
                  </span>
                }
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={showDrawer}
                  style={{ borderRadius: 6 }}
                >
                  Create Workflow
                </Button>
              </Empty>
            ),
          }}
        />
      </div>
    </div>
  );
});

export default Workflows;
