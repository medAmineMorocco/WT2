import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Badge,
  Breadcrumb,
  Button,
  Flex,
  Radio,
  Segmented,
  Select,
  Space,
  Table,
  theme,
  Tooltip,
} from 'antd';
import {
  ExclamationCircleFilled,
  PartitionOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  PlayIcon,
  StopIcon,
  Edit02Icon,
  Delete02Icon,
  CodeIcon,
  Copy01Icon,
} from 'hugeicons-react';
import { ipcRenderer } from 'electron';
import EditWorkflow from './EditWorkflow';
import AddWorkflow from './AddWorkflow';
import ImportWorkflow from './ImportWorkflow';
import TabService from '../../services/tab/TabService';
import { useItemsContext } from '../../TabsContext';
import AddGenerator from './AddGenerator';
import RunGenerator from './RunGenerator';
import ImportGenerator from './ImportGenerator';

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
  const [openAddGenerator, setOpenAddGenerator] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openImportGenerators, setOpenImportGenerators] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openPlayGenerator, setOpenPlayGenerator] = useState(false);
  const [workflowToEdit, setWorkflowToEdit] = useState();
  const [generatorToEdit, setGeneratorToEdit] = useState<any | null>();
  const [generatorToPlay, setGeneratorToPlay] = useState<any>({});
  const [playingWorkflow, setPlayingWorkflow] = useState(null);
  const { modal, notification } = AntdApp.useApp();
  const [workflows, setWorkflows] = useState<any>([]);
  const [generators, setGenerators] = useState<any>([]);
  const [worktrees, setWorktrees] = useState([]);
  const [workflowsToImport, setWorkflowsToImport] = useState([]);
  const [uuid, setUuid] = useState<string>(new Date().toString());
  const [generatorsToImport, setGeneratorsToImport] = useState([]);
  const { setIsWorkflowPlaying } = useItemsContext();
  const [mode, setMode] = useState('workflows');

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

    const onGeneratorsImported = (event: any, code: number, result: any) => {
      if (code === 0) {
        ipcRenderer.send('get-generators', tabRepoPath);

        notification.success({
          message: `${result} generator(s) have been imported`,
          placement: 'bottomLeft',
          duration: 0.5,
        });
      }
    };

    const onGeneratorDuplicated = (event: any, code: number) => {
      if (code === 0) {
        ipcRenderer.send('get-generators', tabRepoPath);
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
      } else {
        notification.error({
          message: 'Unable to Fetch Worktrees',
          description: result,
          placement: 'bottomLeft',
        });
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

    const onGeneratorsToImportFound = (
      event: any,
      code: number,
      result: any,
    ) => {
      if (code === 0) {
        setGeneratorsToImport(
          JSON.parse(result).map((generator: any) => {
            generator.key = generator.generatorName;
            return generator;
          }),
        );
        setOpenImportGenerators(true);
      }
    };

    const onGeneratorsFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setGenerators(JSON.parse(result));
      } else {
        notification.error({
          message: 'Unable to Fetch Generators',
          placement: 'bottomLeft',
        });
      }
    };

    const onGeneratorRemoved = (event: any, code: number, result: any) => {
      if (code === 0) {
        notification.success({
          message: 'The generator has been removed',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        ipcRenderer.send('get-generators', tabRepoPath);
      } else {
        notification.error({
          message: 'Unable to Delete Generator',
          placement: 'bottomLeft',
        });
      }
    };

    const onGeneratorCreated = (event: any, code: number) => {
      if (code === 0) {
        ipcRenderer.send('get-generators', tabRepoPath);
      }
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
    ipcRenderer.on('generators-found', onGeneratorsFound);
    ipcRenderer.on('generator-removed', onGeneratorRemoved);
    ipcRenderer.on('generator-created', onGeneratorCreated);
    ipcRenderer.on('generators-to-import-found', onGeneratorsToImportFound);
    ipcRenderer.on('generators-imported', onGeneratorsImported);
    ipcRenderer.on('generator-duplicated', onGeneratorDuplicated);

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
      ipcRenderer.removeAllListeners('generators-found');
      ipcRenderer.removeAllListeners('generator-removed');
      ipcRenderer.removeAllListeners('generator-created');
      ipcRenderer.removeAllListeners('generators-to-import-found');
      ipcRenderer.removeAllListeners('generators-imported');
      ipcRenderer.removeAllListeners('generator-duplicated');
    };
  }, [notification, setIsWorkflowPlaying, tabRepoPath]);

  const showDrawer = () => {
    setOpenAdd(true);
  };

  const importWorkflow = () => {
    ipcRenderer.send('open-dialog-import-workflows');
  };

  const importGenerator = () => {
    ipcRenderer.send('open-dialog-import-generators');
  };

  const showGeneratorDrawer = () => {
    setOpenAddGenerator(true);
  };

  useHotkeys(
    'shift+a',
    () => (mode === 'workflows' ? showDrawer() : showGeneratorDrawer()),
    { preventDefault: true },
  );
  useHotkeys(
    'shift+i',
    () => (mode === 'workflows' ? importWorkflow() : importGenerator()),
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
      ipcRenderer.send('duplicate-workflow', record, tabRepoPath);
    };
  };

  const onCloseAdd = () => {
    setOpenAdd(false);
  };

  const onCloseAddGenerator = () => {
    setOpenAddGenerator(false);
    setGeneratorToEdit(null);
    ipcRenderer.send('get-generators', tabRepoPath);
  };

  const onConfirmImport = (selected: any[]) => {
    ipcRenderer.send('import-workflows', selected, tabRepoPath);
    setOpenImport(false);
  };

  const onCancelImport = () => {
    setOpenImport(false);
  };

  const onConfirmImportGenerators = (selected: any[]) => {
    ipcRenderer.send('import-generators', selected, tabRepoPath);
    setOpenImportGenerators(false);
  };

  const onCancelImportGenerators = () => {
    setOpenImportGenerators(false);
  };

  const onCloseEdit = () => {
    setOpenEdit(false);
  };

  const onClosePlayGenerator = () => {
    setOpenPlayGenerator(false);
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

  const deleteGenerator = (record: any) => {
    return () => {
      modal.confirm({
        title: 'Confirm deletion of this generator ?',
        icon: <ExclamationCircleFilled />,
        okText: 'Yes',
        okType: 'danger',
        cancelText: 'No',
        centered: true,
        onOk() {
          ipcRenderer.send(
            'remove-generator',
            record.generatorName,
            tabRepoPath,
          );
        },
      });
    };
  };

  const showEditGeneratorDrawer = (record: any) => {
    return () => {
      setGeneratorToEdit(record);
      setOpenAddGenerator(true);
    };
  };

  const duplicateGenerator = (record: any) => {
    return () => {
      ipcRenderer.send('duplicate-generator', record, tabRepoPath);
    };
  };

  const runGenerator = (record: any) => {
    return () => {
      setOpenPlayGenerator(true);
      setGeneratorToPlay(record);
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
      title: 'Running Mode',
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
            title="Delete Workflow"
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
            title="Duplicate Workflow"
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
            title="Edit Workflow"
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
              title="Stop Workflow"
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
              title="Play Workflow"
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

  const columnsGenerator = [
    {
      title: 'Name',
      dataIndex: 'generatorName',
      key: 'name',
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
    },
    {
      title: 'Files to Generate',
      key: 'files',
      render: (_: any, record: any) => {
        const items = record.files?.map((file: any) => {
          return {
            title: file.fileName,
          };
        });
        return record.files && record.files.length > 0 ? (
          <Breadcrumb items={items} />
        ) : (
          <span>No File</span>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', justifyContent: 'space-evenly' }}>
          <Tooltip
            placement="top"
            title="Delete Generator"
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
          >
            <Delete02Icon
              size={16}
              onClick={deleteGenerator(record)}
              style={{
                cursor: 'pointer',
                color: colorError,
              }}
              className="icon-action"
            />
          </Tooltip>
          <Tooltip
            placement="top"
            title="Duplicate Generator"
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
          >
            <Copy01Icon
              size={16}
              onClick={duplicateGenerator(record)}
              style={{
                cursor: 'pointer',
                color: colorPrimary,
              }}
              className="icon-action"
            />
          </Tooltip>
          <Tooltip
            placement="top"
            title="Edit Generator"
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
          >
            <Edit02Icon
              size={16}
              onClick={showEditGeneratorDrawer(record)}
              style={{
                cursor: 'pointer',
                color: colorPrimary,
              }}
              className="icon-action"
            />
          </Tooltip>
          <Tooltip
            placement="top"
            title="Run Generator"
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
          >
            <PlayIcon
              size={16}
              onClick={runGenerator(record)}
              className="icon-action"
              style={{
                cursor: 'pointer',
                color: colorPrimary,
              }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const onChangeMode = (value: string) => {
    setMode(value);
    if (value === 'generators') {
      ipcRenderer.send('get-generators', tabRepoPath);
    }
  };

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
          <Badge
            count={mode === 'workflows' ? workflows.length : generators.length}
            showZero
            style={{ right: mode === 'workflows' ? '100%' : 0 }}
            title="total"
            color="#FAAD14"
          >
            <Segmented
              className="workflows-segmented"
              options={[
                {
                  label: <strong>Workflows</strong>,
                  value: 'workflows',
                  icon: <PartitionOutlined />,
                },
                {
                  label: <strong>Generators</strong>,
                  value: 'generators',
                  icon: <CodeIcon size="1em" />,
                },
              ]}
              defaultValue="workflows"
              onChange={onChangeMode}
            />
          </Badge>
        </div>
        <div>
          <Space style={{ float: 'right' }}>
            <Tooltip
              placement="top"
              title={
                <Space>
                  <span>
                    {mode === 'generators'
                      ? 'Import Generator'
                      : 'Import Workflow'}
                  </span>
                  <small style={{ color: 'grey' }}>Shift+I</small>
                </Space>
              }
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
            >
              <Button
                onClick={
                  mode === 'generators' ? importGenerator : importWorkflow
                }
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
                  <span>
                    {mode === 'generators' ? 'Add Generator' : 'Add Workflow'}
                  </span>
                  <small style={{ color: 'grey' }}>Shift+A</small>
                </Space>
              }
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
            >
              <Button
                ref={ref}
                onClick={
                  mode === 'generators' ? showGeneratorDrawer : showDrawer
                }
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
          {openImportGenerators && (
            <ImportGenerator
              isOpen={openImportGenerators}
              onConfirm={onConfirmImportGenerators}
              onCancel={onCancelImportGenerators}
              generators={generatorsToImport}
            />
          )}
        </div>
        <EditWorkflow
          openEdit={openEdit}
          onCloseEdit={onCloseEdit}
          workflow={workflowToEdit}
        />
        {openPlayGenerator && (
          <RunGenerator
            openPlay={openPlayGenerator}
            onClosePlay={onClosePlayGenerator}
            generator={generatorToPlay}
            worktrees={worktrees}
          />
        )}
        {openAddGenerator && (
          <AddGenerator
            isModalOpen={openAddGenerator}
            handleCancel={onCloseAddGenerator}
            generatorToEdit={generatorToEdit}
          />
        )}
        {mode === 'workflows' && (
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
        )}
        {mode === 'generators' && (
          <div
            style={{
              flexGrow: 1,
              flexShrink: 0,
              height: 'calc(44.5vh - 12px - (22px + 16px + 32px + 16px))',
            }}
          >
            <Table
              className="generators-table"
              columns={columnsGenerator}
              dataSource={generators}
              pagination={false}
              scroll={{ y: 'calc(44.5vh -12px - (22px + 16px + 32px + 16px))' }}
              bordered
              size="middle"
            />
          </div>
        )}
      </Flex>
    </div>
  );
});

export default Workflows;
