import { Alert, Button, List, Modal, Space, Typography } from 'antd';
import React, { useState } from 'react';
import type { ParsedCommit } from '../../components/log/LogUI';
import type {
  RevertAbortResult,
  RevertActionResult,
  RevertConflictResult,
  RevertResolution,
  RevertCommitResult,
} from '../../../shared/gitResetRevert';

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
  onCompleted: (
    result: Extract<RevertCommitResult, { ok: true; status: 'completed' }>,
  ) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [resolvingFile, setResolvingFile] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<Extract<
    RevertCommitResult,
    { ok: true; status: 'conflicts' }
  > | null>(null);

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
    resolution: RevertResolution,
  ) => {
    if (!conflictState) return;
    setResolvingFile(filePath);
    setError(undefined);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'resolve-revert-conflict',
        conflictState.worktreePath,
        filePath,
        resolution,
      )) as RevertConflictResult;
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

  const continueRevert = async () => {
    if (!conflictState) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'continue-revert',
        conflictState.worktreePath,
        conflictState.commit,
        conflictState.targetBranch,
      )) as RevertActionResult;
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
      setError(reason?.message || 'The revert could not continue.');
    } finally {
      setLoading(false);
    }
  };

  const abortRevert = async () => {
    if (!conflictState) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'abort-revert',
        conflictState.worktreePath,
      )) as RevertAbortResult;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConflictState(null);
      onClose();
    } catch (reason: any) {
      setError(reason?.message || 'The revert could not be aborted.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      centered
      title="Revert Commit"
      open={Boolean(commit && worktree)}
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
                onClick={abortRevert}
                disabled={loading}
              >
                Abort revert
              </Button>,
              <Button
                key="continue"
                type="primary"
                onClick={continueRevert}
                loading={loading}
                disabled={conflictState.conflictedFiles.length > 0}
              >
                Continue revert
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose} disabled={loading}>
                Cancel
              </Button>,
              <Button
                key="submit"
                type="primary"
                loading={loading}
                onClick={submit}
              >
                Revert Commit
              </Button>,
            ]
      }
      destroyOnClose
      width={conflictState ? 540 : 480}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {error && (
          <Alert
            type="error"
            showIcon
            message="Revert failed"
            description={error}
          />
        )}

        {!conflictState && (
          <>
            <div>
              <Typography.Text type="secondary">
                Target Worktree / Branch
              </Typography.Text>
              <div>
                <Typography.Text strong>
                  {worktree?.label || worktree?.value}
                </Typography.Text>
              </div>
            </div>

            <div>
              <Typography.Text type="secondary">
                Commit to Revert
              </Typography.Text>
              <div>
                <Typography.Text code>
                  {commit?.hash.slice(0, 8)}
                </Typography.Text>{' '}
                <Typography.Text>{commit?.subject}</Typography.Text>
              </div>
            </div>

            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              This will create a new commit on the target branch that inverts the
              changes introduced by this commit.
            </Typography.Paragraph>
          </>
        )}

        {conflictState && (
          <>
            <Alert
              type="warning"
              showIcon
              message={`Revert ${conflictState.commit.slice(0, 8)} on ${conflictState.targetBranch} has conflicts`}
              description="Resolve each file below. Original represents the current branch state (ours), and Reverted represents the inverted commit (theirs)."
              style={{ marginBottom: 8 }}
            />
            <List
              bordered
              dataSource={conflictState.conflictedFiles}
              locale={{
                emptyText: 'All conflicts are resolved. Continue the revert.',
              }}
              renderItem={(filePath) => (
                <List.Item>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Typography.Text code>{filePath}</Typography.Text>
                    <Space wrap>
                      <Button
                        size="small"
                        loading={resolvingFile === filePath}
                        onClick={() => resolveConflict(filePath, 'target')}
                      >
                        Use current version
                      </Button>
                      <Button
                        size="small"
                        loading={resolvingFile === filePath}
                        onClick={() => resolveConflict(filePath, 'source')}
                      >
                        Use reverted version
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

