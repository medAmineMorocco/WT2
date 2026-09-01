import { Button, Form, Input, Modal, Space, Tooltip } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import React, { useEffect, useState } from 'react';

export default function MoveWorktree({
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
  const [osSeparator, setOsSeparator] = useState('');

  useEffect(() => {
    window.electron.ipcRenderer.send('get-os-separator');

    const onSelectWorktreesDir = (code: number, dirPath: string) => {
      if (code === 0) {
        const resolvedName = form.getFieldValue('resolvedName');
        form.setFieldValue(
          'newWorktreePath',
          `${dirPath}${osSeparator}${resolvedName}`,
        );
      }
    };

    const onOsSeparatorFound = (separator: string) => {
      setOsSeparator(separator);
    };

    const removeWorktreesDir = window.electron.ipcRenderer.on(
      'selected-worktrees-dir',
      onSelectWorktreesDir,
    );
    const removeOsSeparator = window.electron.ipcRenderer.on('os-separator-found', onOsSeparatorFound);

    return () => {
      if (typeof removeWorktreesDir === 'function') removeWorktreesDir();
      else window.electron.ipcRenderer.removeAllListeners('selected-worktrees-dir');

      if (typeof removeOsSeparator === 'function') removeOsSeparator();
      else window.electron.ipcRenderer.removeAllListeners('os-separator-found');
    };
  }, [form, osSeparator]);

  const chooseWorktreesDir = () => {
    window.electron.ipcRenderer.send('choose-worktrees-dir');
  };

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
            title="Move"
            placement="top"
          >
            <Button icon={<FolderOutlined />} onClick={chooseWorktreesDir} />
          </Tooltip>
          <Form.Item name="newWorktreePath">
            <Input disabled allowClear />
          </Form.Item>
        </Space>
        <Form.Item name="nameWorktreeToMove" hidden />
        <Form.Item name="oldPathWorktreeToMove" hidden />
        <Form.Item style={{ marginRight: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading}>
            Move
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
