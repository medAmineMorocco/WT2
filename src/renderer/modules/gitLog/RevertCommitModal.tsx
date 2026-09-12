import { Alert, Button, Modal, Space, Typography } from 'antd';
import React, { useState } from 'react';
import type { ParsedCommit } from '../../components/log/LogUI';
import type { RevertCommitResult } from '../../../shared/gitResetRevert';

interface WorktreeInfo {
  label: string;
  value: string;
  path: string;
}

export default function RevertCommitModal({
  commit,
  worktree,
  onClose,
  onCompleted,
}: {
  commit: ParsedCommit | null;
  worktree: WorktreeInfo | null;
  onClose: () => void;
  onCompleted: (result: RevertCommitResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!commit || !worktree) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'revert-commit',
        worktree.path,
        commit.hash,
      )) as RevertCommitResult;
      onCompleted(result);
    } catch (reason: any) {
      setError(reason?.message || String(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      centered
      title="Revert Commit"
      open={Boolean(commit && worktree)}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={480}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Typography.Text type="secondary">Target Worktree / Branch</Typography.Text>
          <div>
            <Typography.Text strong>{worktree?.label || worktree?.value}</Typography.Text>
          </div>
        </div>

        <div>
          <Typography.Text type="secondary">Commit to Revert</Typography.Text>
          <div>
            <Typography.Text code>{commit?.hash.slice(0, 8)}</Typography.Text>{' '}
            <Typography.Text>{commit?.subject}</Typography.Text>
          </div>
        </div>

        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          This will create a new commit on the target branch that inverts the changes introduced by this commit.
        </Typography.Paragraph>

        {error && (
          <Alert
            type="error"
            showIcon
            message="Revert failed"
            description={error}
          />
        )}

        <Space orientation="horizontal" style={{ justifyContent: 'flex-end', width: '100%', marginTop: 8 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="primary"
            loading={loading}
            onClick={submit}
          >
            Revert Commit
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
