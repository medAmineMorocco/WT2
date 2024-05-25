import { Button, Form, Input, Modal, Space, Tooltip } from 'antd';
import { CheckOutlined, FolderOutlined } from '@ant-design/icons';

export default function MoveWorktree({
  isModalOpen,
  form,
  onFinish,
  handleCancel,
}: {
  isModalOpen: boolean;
  form: any;
  onFinish: any;
  handleCancel: any;
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
        <Space style={{ flex: 1 }} className="move-worktree-space">
          <Tooltip
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
            title="Change Folder"
            placement="top"
          >
            <Button icon={<FolderOutlined />} />
          </Tooltip>
          <Form.Item name="newWorktreePath">
            <Input disabled allowClear />
          </Form.Item>
        </Space>
        <Form.Item name="nameWorktreeToMove" hidden />
        <Form.Item style={{ marginRight: 0 }}>
          <Button type="primary" htmlType="submit" icon={<CheckOutlined />}>
            Move
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
