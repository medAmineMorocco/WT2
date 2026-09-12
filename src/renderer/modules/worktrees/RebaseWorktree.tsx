import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  List,
  Modal,
  Select,
  Space,
  Typography,
} from 'antd';
import {
  WorktreeRebaseAbortResult,
  WorktreeRebaseActionResult,
  WorktreeRebaseConflictResult,
  WorktreeRebaseResolution,
  WorktreeRebaseResult,
} from '../../../shared/worktreeRebase';

type RebaseWorktreeItem = {
  name: string;
  path: string;
  isPrimary?: boolean;
  directoryExists?: boolean;
  prunable?: boolean;
};

type RebaseWorktreeProps = {
  open: boolean;
  repositoryPath: string;
  worktrees: RebaseWorktreeItem[];
  initialSourcePath: string;
  onClose: () => void;
  onCompleted: (
    result: Extract<WorktreeRebaseResult, { ok: true; status: 'completed' }>,
  ) => void;
};

export default function RebaseWorktree({
  open,
  repositoryPath,
  worktrees,
  initialSourcePath,
  onClose,
  onCompleted,
}: RebaseWorktreeProps) {
  const healthyWorktrees = useMemo(
    () =>
      worktrees.filter(
        (item) =>
          item.directoryExists !== false &&
          !item.prunable &&
          item.name &&
          item.name !== 'DETACHED HEAD',
      ),
    [worktrees],
  );
  const initialTarget =
    healthyWorktrees.find(
      (item) => item.isPrimary && item.path !== initialSourcePath,
    ) || healthyWorktrees.find((item) => item.path !== initialSourcePath);
  const [sourcePath, setSourcePath] = useState(initialSourcePath);
  const [targetPath, setTargetPath] = useState(initialTarget?.path);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingFile, setResolvingFile] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<Extract<
    WorktreeRebaseResult,
    { ok: true; status: 'conflicts' }
  > | null>(null);

  const options = healthyWorktrees.map((item) => ({
    label: item.isPrimary ? `${item.name} (main)` : item.name,
    value: item.path,
  }));
  const sourceName = healthyWorktrees.find(
    (item) => item.path === sourcePath,
  )?.name;
  const targetName = healthyWorktrees.find(
    (item) => item.path === targetPath,
  )?.name;

  const rebase = async () => {
    if (!sourcePath || !targetPath || sourcePath === targetPath) return;
    setSaving(true);
    setError(null);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'rebase-worktree-onto-worktree',
        repositoryPath,
        sourcePath,
        targetPath,
      )) as WorktreeRebaseResult;
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
      setError(reason?.message || 'The rebase failed.');
    } finally {
      setSaving(false);
    }
  };

  const resolveConflict = async (
    filePath: string,
    resolution: WorktreeRebaseResolution,
  ) => {
    if (!conflictState) return;
    setResolvingFile(filePath);
    setError(null);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'resolve-rebase-conflict',
        conflictState.sourceWorktreePath,
        filePath,
        resolution,
      )) as WorktreeRebaseConflictResult;
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

  const continueRebase = async () => {
    if (!conflictState) return;
    setSaving(true);
    setError(null);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'continue-worktree-rebase',
        conflictState.sourceWorktreePath,
        conflictState.sourceBranch,
        conflictState.targetBranch,
      )) as WorktreeRebaseActionResult;
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
      setError(reason?.message || 'The rebase could not continue.');
    } finally {
      setSaving(false);
    }
  };

  const abortRebase = async () => {
    if (!conflictState) return;
    setSaving(true);
    setError(null);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'abort-worktree-rebase',
        conflictState.sourceWorktreePath,
      )) as WorktreeRebaseAbortResult;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    } catch (reason: any) {
      setError(reason?.message || 'The rebase could not be aborted.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Rebase worktree"
      open={open}
      onCancel={() => {
        if (!conflictState) onClose();
      }}
      onOk={conflictState ? continueRebase : rebase}
      okText="Rebase"
      confirmLoading={saving}
      okButtonProps={{
        disabled: !sourcePath || !targetPath || sourcePath === targetPath,
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
                onClick={abortRebase}
                disabled={saving}
              >
                Abort rebase
              </Button>,
              <Button
                key="continue"
                type="primary"
                onClick={continueRebase}
                loading={saving}
                disabled={conflictState.conflictedFiles.length > 0}
              >
                Continue rebase
              </Button>,
            ]
          : undefined
      }
      destroyOnClose
    >
      {error && (
        <Alert
          type="error"
          showIcon
          message="Unable to rebase"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}
      {!conflictState && (
        <Form layout="vertical">
          <Form.Item label="Source worktree" required>
            <Select
              value={sourcePath}
              options={options.map((option) => ({
                ...option,
                disabled: option.value === targetPath,
              }))}
              onChange={setSourcePath}
              aria-label="Source worktree"
            />
          </Form.Item>
          <Form.Item label="Target worktree" required>
            <Select
              value={targetPath}
              options={options.map((option) => ({
                ...option,
                disabled: option.value === sourcePath,
              }))}
              onChange={setTargetPath}
              aria-label="Target worktree"
            />
          </Form.Item>
        </Form>
      )}
      {!conflictState && sourceName && targetName && (
        <Typography.Text type="secondary">
          Rebase <strong>{sourceName}</strong> onto{' '}
          <strong>{targetName}</strong>. The source worktree must be clean.
        </Typography.Text>
      )}
      {conflictState && (
        <>
          <Alert
            type="warning"
            showIcon
            message={`Rebase ${conflictState.sourceBranch} onto ${conflictState.targetBranch} has conflicts`}
            description="Resolve each file below. During a rebase, Source means the commit being replayed and Target means the branch being rebased onto."
            style={{ marginBottom: 16 }}
          />
          <List
            bordered
            dataSource={conflictState.conflictedFiles}
            locale={{
              emptyText: 'All conflicts are resolved. Continue the rebase.',
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
