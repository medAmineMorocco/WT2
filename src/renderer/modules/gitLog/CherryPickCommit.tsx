import { Alert, Button, List, Modal, Select, Space, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import type { ParsedCommit } from '../../components/log/LogUI';
import type {
  CherryPickAbortResult,
  CherryPickActionResult,
  CherryPickConflictResult,
  CherryPickResolution,
  CherryPickResult,
} from '../../../shared/cherryPick';

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
  onCompleted: (
    result: Extract<CherryPickResult, { ok: true; status: 'completed' }>,
  ) => void;
}) {
  const [destination, setDestination] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [resolvingFile, setResolvingFile] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<Extract<
    CherryPickResult,
    { ok: true; status: 'conflicts' }
  > | null>(null);

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
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.status === 'conflicts') {
        setConflictState(result);
        return;
      }
      onCompleted(result);
    } catch (reason: any) {
      setError(reason?.message || String(reason));
    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async (
    filePath: string,
    resolution: CherryPickResolution,
  ) => {
    if (!conflictState) return;
    setResolvingFile(filePath);
    setError(undefined);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'resolve-cherry-pick-conflict',
        conflictState.destinationPath,
        filePath,
        resolution,
      )) as CherryPickConflictResult;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConflictState({
        ...conflictState,
        conflictedFiles: result.conflictedFiles,
      });
    } catch (reason: any) {
      setError(reason?.message || 'The conflict could not be resolved.');
    } finally {
      setResolvingFile(null);
    }
  };

  const continueCherryPick = async () => {
    if (!conflictState) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'continue-cherry-pick',
        conflictState.destinationPath,
        conflictState.commit,
        conflictState.targetBranch,
      )) as CherryPickActionResult;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.status === 'conflicts') {
        setConflictState(result);
        return;
      }
      onCompleted(result);
    } catch (reason: any) {
      setError(reason?.message || 'The cherry-pick could not continue.');
    } finally {
      setLoading(false);
    }
  };

  const abortCherryPick = async () => {
    if (!conflictState) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'abort-cherry-pick',
        conflictState.destinationPath,
      )) as CherryPickAbortResult;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConflictState(null);
      onClose();
    } catch (reason: any) {
      setError(reason?.message || 'The cherry-pick could not be aborted.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      centered
      title="Cherry-pick Commit"
      open={Boolean(commit)}
      onCancel={() => {
        if (!conflictState) onClose();
      }}
      closable={!conflictState}
      maskClosable={!conflictState}
      keyboard={!conflictState}
      footer={
        conflictState
          ? [
              <Button
                key="abort"
                danger
                onClick={abortCherryPick}
                disabled={loading}
              >
                Abort cherry-pick
              </Button>,
              <Button
                key="continue"
                type="primary"
                onClick={continueCherryPick}
                loading={loading}
                disabled={conflictState.conflictedFiles.length > 0}
              >
                Continue cherry-pick
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose} disabled={loading}>
                Cancel
              </Button>,
              <Button
                key="submit"
                type="primary"
                disabled={!selected}
                loading={loading}
                onClick={submit}
              >
                Cherry-pick
              </Button>,
            ]
      }
      destroyOnClose
      width={conflictState ? 540 : 480}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {error ? (
          <Alert
            type="error"
            showIcon
            message="Cherry-pick failed"
            description={error}
          />
        ) : null}

        {!conflictState && (
          <>
            <div>
              <Typography.Text type="secondary">Source commit</Typography.Text>
              <div>
                <Typography.Text code>
                  {commit?.hash.slice(0, 8)}
                </Typography.Text>{' '}
                <Typography.Text>{commit?.subject}</Typography.Text>
              </div>
              {commit?.refs ? (
                <Typography.Text type="secondary">
                  {commit.refs}
                </Typography.Text>
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
          </>
        )}

        {conflictState && (
          <>
            <Alert
              type="warning"
              showIcon
              message={`Cherry-pick ${conflictState.commit.slice(0, 8)} onto ${conflictState.targetBranch} has conflicts`}
              description="Resolve each file below. Source represents the cherry-picked commit (theirs), and Target represents the destination branch (ours)."
              style={{ marginBottom: 8 }}
            />
            <List
              bordered
              dataSource={conflictState.conflictedFiles}
              locale={{
                emptyText:
                  'All conflicts are resolved. Continue the cherry-pick.',
              }}
              renderItem={(filePath) => (
                <List.Item>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Typography.Text code>{filePath}</Typography.Text>
                    <Space wrap>
                      <Button
                        size="small"
                        loading={resolvingFile === filePath}
                        onClick={() => resolveConflict(filePath, 'source')}
                      >
                        Use source version
                      </Button>
                      <Button
                        size="small"
                        loading={resolvingFile === filePath}
                        onClick={() => resolveConflict(filePath, 'target')}
                      >
                        Use target version
                      </Button>
                      <Button
                        size="small"
                        loading={resolvingFile === filePath}
                        onClick={() => resolveConflict(filePath, 'staged')}
                      >
                        Mark edited file resolved
                      </Button>
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}

