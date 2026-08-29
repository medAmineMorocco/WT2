import { Button, Form, Input, Modal } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import React from 'react';

export default function LockWorktree({
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
      title="Lock worktree"
      footer={null}
      onCancel={handleCancel}
      destroyOnClose
      centered
    >
      <Form
        onFinish={onFinish}
        layout="vertical"
        requiredMark="optional"
        form={form}
      >
        <Form.Item
          label="Reason"
          name="lockReason"
          extra="Optional. This reason is stored in Git worktree metadata."
        >
          <Input
            prefix={<LockOutlined />}
            placeholder="Why is this worktree locked?"
            allowClear
            maxLength={200}
          />
        </Form.Item>
        <Form.Item name="lockWorktreePath" hidden />
        <Form.Item name="lockWorktreeName" hidden />
        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Button onClick={handleCancel} style={{ marginRight: 8 }}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Lock
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
