import { Button, Form, Input, Modal, Space, Tooltip } from 'antd';
import { CheckOutlined, FolderOutlined } from '@ant-design/icons';
import { ipcRenderer } from 'electron';
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

  function sanitizeWorktreeName(worktreeName: string) {
    return worktreeName.replace(/\//g, '-').replace(/[:*?"<>|\\]/g, '-');
  }

  useEffect(() => {
    ipcRenderer.send('get-os-separator');

    const onSelectWorktreesDir = (
      event: any,
      code: number,
      dirPath: string,
    ) => {
      if (code === 0) {
        const nameWorktreeToMove = form.getFieldValue('nameWorktreeToMove');
        const sanitizedWorktreeName = sanitizeWorktreeName(nameWorktreeToMove);
        form.setFieldValue(
          'newWorktreePath',
          `${dirPath}${osSeparator}${sanitizedWorktreeName}`,
        );
      }
    };

    const onOsSeparatorFound = (event: any, separator: string) => {
      setOsSeparator(separator);
    };

    ipcRenderer.on('selected-worktrees-dir', onSelectWorktreesDir);
    ipcRenderer.on('os-separator-found', onOsSeparatorFound);

    return () => {
      ipcRenderer.removeAllListeners('selected-worktrees-dir');
      ipcRenderer.removeAllListeners('os-separator-found');
    };
  }, [form, osSeparator]);

  const chooseWorktreesDir = () => {
    ipcRenderer.send('choose-worktrees-dir');
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
            title="Change Folder"
            placement="top"
          >
            <Button icon={<FolderOutlined />} onClick={chooseWorktreesDir} />
          </Tooltip>
          <Form.Item name="newWorktreePath">
            <Input disabled allowClear />
          </Form.Item>
        </Space>
        <Form.Item name="nameWorktreeToMove" hidden />
        <Form.Item style={{ marginRight: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<CheckOutlined />}
          >
            Move
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
