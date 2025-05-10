import { Button, Form, Input, Modal } from 'antd';
import { BranchesOutlined } from '@ant-design/icons';
import React from 'react';

export default function RenameWorktree({
  isModalOpen,
  form,
  onFinish,
  handleCancel,
  loading,
}: {
  isModalOpen: boolean;
  form: any;
  onFinish: any;
  handleCancel: any;
  loading: boolean;
}) {
  return (
    <Modal
      open={isModalOpen}
      footer={null}
      onCancel={handleCancel}
      destroyOnClose
      centered
      closeIcon={null}
    >
      <Form
        onFinish={onFinish}
        layout="inline"
        requiredMark="optional"
        form={form}
      >
        <Form.Item
          label="Name"
          name="newWorktreeName"
          rules={[
            {
              required: true,
              whitespace: true,
              message: 'Please enter the name of your worktree.',
            },
          ]}
          extra="The folder and associated branch will be renamed"
          style={{ flex: 1 }}
        >
          <Input prefix={<BranchesOutlined />} allowClear />
        </Form.Item>
        <Form.Item name="oldWorktreeName" hidden />
        <Form.Item name="oldWorktreePath" hidden />
        <Form.Item style={{ marginRight: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading}>
            Rename
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
