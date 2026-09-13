import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Typography,
} from 'antd';
import type { ParsedCommit } from '../../components/log/LogUI';
import {
  WorktreeMergeAbortResult,
  WorktreeMergeActionResult,
  WorktreeMergeConflictResult,
  WorktreeMergeResolution,
  WorktreeMergeResult,
  WorktreeMergeStrategy,
} from '../../../shared/worktreeMerge';
import TabService from '../../services/tab/TabService';

interface WorktreeInfo {
  label: string;
  value: string;
  path: string;
}

const STRATEGY_OPTIONS: { label: string; value: WorktreeMergeStrategy }[] = [
  { label: 'Default (Fast-forward if possible)', value: 'default' },
  { label: 'Create merge commit (--no-ff)', value: 'no-ff' },
  { label: 'Fast-forward only (--ff-only)', value: 'ff-only' },
  { label: 'Squash commits (--squash)', value: 'squash' },
];

export default function MergeCommitModal({
  commit,
  worktree,
  onClose,
  onCompleted,
}: {
  commit: ParsedCommit | null;
  worktree: WorktreeInfo | null;
  onClose: () => void;
  onCompleted: (
    result: Extract<WorktreeMergeResult, { ok: true; status: 'completed' }>,
  ) => void;
}) {
  const activeTab = useMemo(() => TabService.getActiveTab(), []);
  const tabRepoPath = useMemo(
    () => TabService.getTabRepoPath(activeTab),
    [activeTab],
  );

  const [strategy, setStrategy] = useState<WorktreeMergeStrategy>('default');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingFile, setResolvingFile] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<Extract<
    WorktreeMergeResult,
    { ok: true; status: 'conflicts' }
  > | null>(null);

  const merge = async () => {
    if (!commit || !worktree) return;
    setLoading(true);
    setError(null);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'merge-worktree-into-worktree',
        tabRepoPath,
        worktree.path,
        commit.hash,
        {
          strategy,
          message: customMessage.trim() ? customMessage.trim() : undefined,
        },
      )) as WorktreeMergeResult;

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
      setError(reason?.message || 'The merge failed.');
    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async (
    filePath: string,
    resolution: WorktreeMergeResolution,
  ) => {
    if (!conflictState) return;
    setResolvingFile(filePath);
    setError(null);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'resolve-merge-conflict',
        conflictState.targetWorktreePath,
        filePath,
        resolution,
      )) as WorktreeMergeConflictResult;

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

  const continueMerge = async () => {
    if (!conflictState) return;
    setLoading(true);
    setError(null);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'continue-worktree-merge',
        conflictState.targetWorktreePath,
        conflictState.sourceBranch,
        conflictState.targetBranch,
        customMessage.trim() ? customMessage.trim() : undefined,
      )) as WorktreeMergeActionResult;

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
      setError(reason?.message || 'The merge could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const abortMerge = async () => {
    if (!conflictState) return;
    setLoading(true);
    setError(null);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'abort-worktree-merge',
        conflictState.targetWorktreePath,
      )) as WorktreeMergeAbortResult;

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    } catch (reason: any) {
      setError(reason?.message || 'The merge could not be aborted.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      centered
      title="Merge Commit into Worktree"
      open={Boolean(commit && worktree)}
      onCancel={() => {
        if (!conflictState) onClose();
      }}
      onOk={conflictState ? continueMerge : merge}
      okText="Merge"
      confirmLoading={loading}
      closable={!conflictState}
      maskClosable={!conflictState}
      keyboard={!conflictState}
      footer={
        conflictState
          ? [
              <Button
                key="abort"
                danger
                onClick={abortMerge}
                disabled={loading}
              >
                Abort merge
              </Button>,
              <Button
                key="continue"
                type="primary"
                onClick={continueMerge}
                loading={loading}
                disabled={conflictState.conflictedFiles.length > 0}
              >
                Complete merge
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose} disabled={loading}>
                Cancel
              </Button>,
              <Button
                key="submit"
                type="primary"
                onClick={merge}
                loading={loading}
              >
                Merge
              </Button>,
            ]
      }
      destroyOnClose
      width={520}
    >
      {error && (
        <Alert
          type="error"
          showIcon
          message="Unable to merge"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}
      {!conflictState && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
            <Typography.Text type="secondary">Source Commit</Typography.Text>
            <div>
              <Typography.Text code>{commit?.hash.slice(0, 8)}</Typography.Text>{' '}
              <Typography.Text>{commit?.subject}</Typography.Text>
            </div>
            {commit?.refs ? (
              <Typography.Text type="secondary">{commit.refs}</Typography.Text>
            ) : null}
          </div>

          <Form layout="vertical">
            <Form.Item label="Merge strategy">
              <Select
                value={strategy}
                options={STRATEGY_OPTIONS}
                onChange={setStrategy}
                aria-label="Merge strategy"
              />
            </Form.Item>
            {strategy !== 'ff-only' && (
              <Form.Item
                label="Commit message (optional)"
                tooltip="Leave empty to use Git's standard merge commit message"
              >
                <Input
                  placeholder={`Merge commit '${commit?.hash.slice(0, 8)}' into ${worktree?.value || 'target'}`}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  allowClear
                />
              </Form.Item>
            )}
          </Form>

          <Typography.Text type="secondary">
            Merge commit <strong>{commit?.hash.slice(0, 8)}</strong> into{' '}
            <strong>{worktree?.label}</strong>.
          </Typography.Text>
        </Space>
      )}

      {conflictState && (
        <>
          <Alert
            type="warning"
            showIcon
            message={`Merge ${conflictState.sourceBranch.slice(0, 8)} into ${conflictState.targetBranch} has conflicts`}
            description={`Resolve each file below. Target represents ${conflictState.targetBranch} (ours), and Source represents the incoming commit (theirs).`}
            style={{ marginBottom: 16 }}
          />
          <List
            bordered
            dataSource={conflictState.conflictedFiles}
            locale={{
              emptyText: 'All conflicts are resolved. Complete the merge.',
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
    </Modal>
  );
}
