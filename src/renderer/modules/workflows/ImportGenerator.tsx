import React, { useState } from 'react';
import { Breadcrumb, Modal, Table } from 'antd';

export default function ImportGenerator({
  isOpen,
  onConfirm,
  onCancel,
  generators,
}: {
  isOpen: boolean;
  onConfirm: any;
  onCancel: any;
  generators: any[];
}) {
  const [selectedGenerators, setSelectedGenerators] = useState<any[]>([]);

  const onSelectChange = (newSelectedRowKeys: any[]) => {
    setSelectedGenerators(
      generators.filter((item: any) => newSelectedRowKeys.includes(item.key)),
    );
  };
  return (
    <Modal
      title="Import Generator"
      okText="Confirm"
      open={isOpen}
      onOk={() => onConfirm(selectedGenerators)}
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
            dataIndex: 'generatorName',
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
        ]}
        dataSource={generators}
        pagination={false}
        scroll={{ y: 400 }}
      />
    </Modal>
  );
}
