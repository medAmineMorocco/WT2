import React, { useState } from 'react';
import { Modal, Table } from 'antd';

export default function ImportWorkflow({
  isOpen,
  onConfirm,
  onCancel,
  workflows,
}: {
  isOpen: boolean;
  onConfirm: any;
  onCancel: any;
  workflows: any[];
}) {
  const [selectedWorkflows, setSelectedWorkflows] = useState<any[]>([]);

  const onSelectChange = (newSelectedRowKeys: any[]) => {
    setSelectedWorkflows(
      workflows.filter((item: any) => newSelectedRowKeys.includes(item.key)),
    );
  };

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
          onChange: onSelectChange,
          type: 'checkbox',
        }}
        columns={[
          {
            title: 'Name',
            dataIndex: 'name',
          },
          {
            title: 'Command(s)',
            render: (el: any) => (
              <ul>
                {[el.command, ...el.commands].map((cmd: any) => (
                  <li>{cmd.value}</li>
                ))}
              </ul>
            ),
          },
        ]}
        dataSource={workflows}
        pagination={false}
        scroll={{ y: 400 }}
      />
    </Modal>
  );
}
