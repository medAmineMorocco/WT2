import { Alert, Button, Modal, Select, Space, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import type { ParsedCommit } from '../../components/log/LogUI';
import type { CherryPickResult } from '../../../shared/cherryPick';

interface WorktreeOption {
  label: string;
  value: string;
  path: string;
}

export default function CherryPickCommit({
  commit,
  worktrees,
  onClose,
  onCompleted,
}: {
  commit: ParsedCommit | null;
  worktrees: WorktreeOption[];
  onClose: () => void;
  onCompleted: (result: CherryPickResult) => void;
}) {
  const [destination, setDestination] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const selected = useMemo(
    () => worktrees.find((worktree) => worktree.value === destination),
    [destination, worktrees],
  );

  const submit = async () => {
    if (!commit || !selected) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'cherry-pick-commit',
        selected.path,
        commit.hash,
      )) as CherryPickResult;
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
      title="Cherry-pick Commit"
      open={Boolean(commit)}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Typography.Text type="secondary">Source commit</Typography.Text>
          <div>
            <Typography.Text code>{commit?.hash.slice(0, 8)}</Typography.Text>{' '}
            <Typography.Text>{commit?.subject}</Typography.Text>
          </div>
          {commit?.refs ? (
            <Typography.Text type="secondary">{commit.refs}</Typography.Text>
          ) : null}
        </div>
        <div>
          <Typography.Text strong>
            Destination worktree / branch
          </Typography.Text>
          <Select
            aria-label="Destination worktree"
            placeholder="Select the branch that receives this commit"
            options={worktrees}
            value={destination}
            onChange={setDestination}
            style={{ width: '100%', marginTop: 6 }}
          />
        </div>
        {selected && commit ? (
          <Typography.Text type="secondary">
            Cherry-pick {commit.hash.slice(0, 8)} onto {selected.label}.
          </Typography.Text>
        ) : null}
        {error ? (
          <Alert
            type="error"
            showIcon
            message="Cherry-pick failed"
            description={error}
          />
        ) : null}
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            disabled={!selected}
            loading={loading}
            onClick={submit}
          >
            Cherry-pick
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
