import React, { useState } from 'react';
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
  Grid,
  App as AntdApp,
} from 'antd';
import {
  PlusOutlined,
  MinusCircleOutlined,
  PartitionOutlined,
  ExclamationCircleFilled,
  EditOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import EditWorkflow from './EditWorkflow';
import AddWorkflow from './AddWorkflow';

const { useToken } = theme;
const { useBreakpoint } = Grid;

export default function Workflows() {
  const breakpoints = useBreakpoint();
  const {
    token: { colorBgContainer, borderRadiusLG, colorPrimary, colorError },
  } = theme.useToken();

  const { token } = useToken();

  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [workflowToEdit, setWorkflowToEdit] = useState();
  const { modal } = AntdApp.useApp();

  const showDrawer = () => {
    setOpenAdd(true);
  };

  useHotkeys('shift+a', () => showDrawer(), { preventDefault: true });

  const showEditDrawer = (record: any) => {
    return () => {
      setWorkflowToEdit(record);
      setOpenEdit(true);
    };
  };

  const onCloseAdd = () => {
    setOpenAdd(false);
  };

  const onCloseEdit = () => {
    setOpenEdit(false);
  };
  const tableSize = () => {
    if (breakpoints.xl || breakpoints.xxl) {
      return 'large';
    }
    if (breakpoints.lg) {
      return 'small';
    }
    if (breakpoints.md) {
      return 'small';
    }
    return 'small';
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
    };
  };

  const stopWorkflow = (record: any) => {
    return () => {
      console.log('stop', record);
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
            <MinusCircleOutlined
              onClick={deleteWorkflow(record)}
              style={{ color: colorError }}
              className="icon-action"
            />
          </Tooltip>
          <Tooltip placement="top" title="Edit workflow">
            <EditOutlined
              onClick={showEditDrawer(record)}
              style={{ color: colorPrimary }}
              className="icon-action"
            />
          </Tooltip>
          <Tooltip placement="top" title="Stop workflow">
            <CloseCircleOutlined
              onClick={stopWorkflow(record)}
              className="icon-action"
              style={{ cursor: 'pointer', color: colorPrimary }}
            />
          </Tooltip>
          <Tooltip placement="top" title="Play workflow">
            <PlayCircleOutlined
              onClick={playWorkflow(record)}
              className="icon-action"
              style={{ cursor: 'pointer', color: colorPrimary }}
            />
          </Tooltip>
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
      <Flex gap="small" vertical align="space-around">
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
              <Button type="primary" icon={<UploadOutlined />}>
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
                onClick={showDrawer}
                type="primary"
                icon={<PlusOutlined />}
              >
                Add
              </Button>
            </Tooltip>
          </Space>
          <AddWorkflow openAdd={openAdd} onCloseAdd={onCloseAdd} />
        </div>
        <EditWorkflow
          openEdit={openEdit}
          onCloseEdit={onCloseEdit}
          workflow={workflowToEdit}
        />
        <Table
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 3, position: ['bottomLeft'] }}
          bordered
          size={tableSize()}
        />
      </Flex>
    </div>
  );
}
