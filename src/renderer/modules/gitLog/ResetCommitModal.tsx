import { Alert, Button, Modal, Radio, Space, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import type { ParsedCommit } from '../../components/log/LogUI';
import type { ResetCommitResult, ResetMode } from '../../../shared/gitResetRevert';

interface WorktreeInfo {
  label: string;
  value: string;
  path: string;
}

export default function ResetCommitModal({
  commit,
  worktree,
  initialMode = 'mixed',
  onClose,
  onCompleted,
}: {
  commit: ParsedCommit | null;
  worktree: WorktreeInfo | null;
  initialMode?: ResetMode;
  onClose: () => void;
  onCompleted: (result: ResetCommitResult) => void;
}) {
  const [mode, setMode] = useState<ResetMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setMode(initialMode);
    setError(undefined);
  }, [initialMode, commit]);

  const submit = async () => {
    if (!commit || !worktree) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'reset-commit',
        worktree.path,
        commit.hash,
        mode,
      )) as ResetCommitResult;
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
      title="Reset Branch to Commit"
      open={Boolean(commit && worktree)}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={520}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Typography.Text type="secondary">Target Worktree / Branch</Typography.Text>
          <div>
            <Typography.Text strong>{worktree?.label || worktree?.value}</Typography.Text>
          </div>
        </div>

        <div>
          <Typography.Text type="secondary">Reset to Commit</Typography.Text>
          <div>
            <Typography.Text code>{commit?.hash.slice(0, 8)}</Typography.Text>{' '}
            <Typography.Text>{commit?.subject}</Typography.Text>
          </div>
        </div>

        <div>
          <Typography.Text strong>Reset Mode</Typography.Text>
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ width: '100%', marginTop: 8 }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Radio value="soft">
                <Space direction="vertical" size={1}>
                  <Typography.Text strong>Soft (--soft)</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Moves HEAD to this commit. Preserves all changes in the index (staged for commit).
                  </Typography.Text>
                </Space>
              </Radio>

              <Radio value="mixed">
                <Space direction="vertical" size={1}>
                  <Typography.Text strong>Mixed (--mixed) — Default</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Moves HEAD and resets index. Preserves working tree changes (unstaged).
                  </Typography.Text>
                </Space>
              </Radio>

              <Radio value="hard">
                <Space direction="vertical" size={1}>
                  <Typography.Text strong type="danger">Hard (--hard)</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Resets HEAD, index, and working tree. Any uncommitted changes will be discarded.
                  </Typography.Text>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        {mode === 'hard' && (
          <Alert
            type="warning"
            showIcon
            message="Caution: Irreversible Changes"
            description="A hard reset will discard all uncommitted changes in your working tree and index. Ensure you have stashed or committed anything you want to keep."
          />
        )}

        {error && (
          <Alert
            type="error"
            showIcon
            message="Reset failed"
            description={error}
          />
        )}

        <Space style={{ justifyContent: 'flex-end', width: '100%', marginTop: 8 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="primary"
            danger={mode === 'hard'}
            loading={loading}
            onClick={submit}
          >
            {mode === 'hard' ? 'Reset (Hard)' : `Reset (${mode})`}
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
