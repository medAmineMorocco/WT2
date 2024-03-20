import React, { useState } from 'react';
import { Modal, Table } from 'antd';

const data = [
  {
    key: 'Workflow 1',
    name: 'Workflow 1',
  },
  {
    key: 'Workflow 2',
    name: 'Workflow 2',
  },
  {
    key: 'Workflow 3',
    name: 'Workflow 3',
  },
  {
    key: 'Workflow 4',
    name: 'Workflow 4',
  },
  {
    key: 'Workflow 5',
    name: 'Workflow 5',
  },
  {
    key: 'Workflow 6',
    name: 'Workflow 6',
  },
];
export default function ImportWorkflow({
  isOpen,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onConfirm: any;
  onCancel: any;
}) {
  const [selectedWorkflows, setSelectedWorkflows] = useState();

  const onSelectChange = (newSelectedRowKeys: any) => {
    setSelectedWorkflows(newSelectedRowKeys);
  };
  const expandedRowRender = () => (
    <Table
      columns={[
        { title: 'Order', dataIndex: 'order', key: 'order' },
        { title: 'Command', dataIndex: 'cmd', key: 'cmd' },
      ]}
      dataSource={[
        {
          key: '1',
          order: 1,
          cmd: 'cmd1',
        },
        {
          key: '2',
          order: 2,
          cmd: 'cmd2',
        },
        {
          key: '3',
          order: 3,
          cmd: 'cmd3',
        },
      ]}
      pagination={false}
    />
  );

  return (
    <Modal
      title="Import Workflow"
      okText="Confirm"
      open={isOpen}
      onOk={() => onConfirm(selectedWorkflows)}
      onCancel={onCancel}
      centered
      destroyOnClose
    >
      <Table
        rowSelection={{
          selectedRowKeys: selectedWorkflows,
          onChange: onSelectChange,
          type: 'checkbox',
        }}
        columns={[
          {
            title: 'Name',
            dataIndex: 'name',
          },
        ]}
        expandable={{ expandedRowRender }}
        dataSource={data}
        pagination={false}
        scroll={{ y: 400 }}
      />
    </Modal>
  );
}
