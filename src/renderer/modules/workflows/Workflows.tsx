import React, { forwardRef, useMemo, useState } from 'react';
import {
  theme,
  Table,
  Radio,
  Select,
  Tooltip,
  Button,
  Badge,
  Space,
  Flex,
  App as AntdApp,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  PartitionOutlined,
  ExclamationCircleFilled,
  EditOutlined,
  XFilled,
  CaretRightOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import EditWorkflow from './EditWorkflow';
import AddWorkflow from './AddWorkflow';
import ImportWorkflow from './ImportWorkflow';

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
  const { modal } = AntdApp.useApp();

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

  const options = [
    {
      label: 'Worktree1',
      value: 'Worktree1',
    },
    {
      label: 'Worktree2',
      value: 'Worktree2',
    },
    {
      label: 'Worktree3',
      value: 'Worktree3',
    },
  ];

  const handleChange = (value: string[]) => {
    console.log(`selected ${value}`);
  };

  const deleteWorkflow = (record: any) => {
    return () => {
      console.log('delete', record);
      modal.confirm({
        title: 'Are you sure delete this workflow ?',
        icon: <ExclamationCircleFilled />,
        okText: 'Yes',
        okType: 'danger',
        cancelText: 'No',
        centered: true,
        onOk() {
          console.log('OK');
        },
        onCancel() {
          console.log('Cancel');
        },
      });
    };
  };

  const playWorkflow = (record: any) => {
    return () => {
      console.log('play', record);
      setPlayingWorkflow(record.name);
    };
  };

  const stopWorkflow = (record: any) => {
    return () => {
      console.log('stop', record);
      setPlayingWorkflow(null);
    };
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
      render: () => (
        <Radio.Group defaultValue="sequential" buttonStyle="solid" size="small">
          <Radio.Button value="sequential">Sequential</Radio.Button>
          <Radio.Button value="parallel">Parallel</Radio.Button>
        </Radio.Group>
      ),
    },
    {
      title: 'Worktrees',
      dataIndex: 'worktrees',
      key: 'worktrees',
      render: () => (
        <Select
          mode="multiple"
          allowClear
          style={{ width: '100%' }}
          placeholder="Select worktrees"
          defaultValue={[]}
          onChange={handleChange}
          options={options}
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

  const data = [
    {
      key: '1',
      name: 'Workflow1',
      command: 'cmd1',
      commands: ['cmd2', 'cmd3'],
    },
    {
      key: '2',
      name: 'Workflow2',
      command: 'cmd1',
      commands: ['cmd2'],
    },
    {
      key: '3',
      name: 'Workflow3',
      command: 'cmd1',
      commands: [],
    },
    {
      key: '4',
      name: 'Workflow4',
      command: 'cmd1',
      commands: ['cmd2', 'cmd3'],
    },
    {
      key: '5',
      name: 'Workflow5',
      command: 'cmd1',
      commands: ['cmd2', 'cmd3'],
    },
    {
      key: '6',
      name: 'Workflow6',
      command: 'cmd1',
      commands: ['cmd2', 'cmd3'],
    },
    {
      key: '7',
      name: 'Workflow7',
      command: 'cmd1',
      commands: ['cmd2', 'cmd3'],
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
          dataSource={data}
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
