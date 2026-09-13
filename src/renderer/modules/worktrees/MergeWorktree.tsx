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
import {
  WorktreeMergeAbortResult,
  WorktreeMergeActionResult,
  WorktreeMergeConflictResult,
  WorktreeMergeResolution,
  WorktreeMergeResult,
  WorktreeMergeStrategy,
} from '../../../shared/worktreeMerge';

type MergeWorktreeItem = {
  name: string;
  path: string;
  isPrimary?: boolean;
  directoryExists?: boolean;
  prunable?: boolean;
};

type MergeWorktreeProps = {
  open: boolean;
  repositoryPath: string;
  worktrees: MergeWorktreeItem[];
  initialTargetPath: string;
  onClose: () => void;
  onCompleted: (
    result: Extract<WorktreeMergeResult, { ok: true; status: 'completed' }>,
  ) => void;
};

const STRATEGY_OPTIONS: { label: string; value: WorktreeMergeStrategy }[] = [
  { label: 'Default (Fast-forward if possible)', value: 'default' },
  { label: 'Create merge commit (--no-ff)', value: 'no-ff' },
  { label: 'Fast-forward only (--ff-only)', value: 'ff-only' },
  { label: 'Squash commits (--squash)', value: 'squash' },
];

export default function MergeWorktree({
  open,
  repositoryPath,
  worktrees,
  initialTargetPath,
  onClose,
  onCompleted,
}: MergeWorktreeProps) {
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

  const initialSource =
    healthyWorktrees.find(
      (item) => item.isPrimary && item.path !== initialTargetPath,
    ) || healthyWorktrees.find((item) => item.path !== initialTargetPath);

  const [targetPath, setTargetPath] = useState(initialTargetPath);
  const [sourcePath, setSourcePath] = useState(initialSource?.path);
  const [strategy, setStrategy] = useState<WorktreeMergeStrategy>('default');
  const [customMessage, setCustomMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingFile, setResolvingFile] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<Extract<
    WorktreeMergeResult,
    { ok: true; status: 'conflicts' }
  > | null>(null);

  const options = healthyWorktrees.map((item) => ({
    label: item.isPrimary ? `${item.name} (main)` : item.name,
    value: item.path,
  }));

  const targetName = healthyWorktrees.find(
    (item) => item.path === targetPath,
  )?.name;
  const sourceName = healthyWorktrees.find(
    (item) => item.path === sourcePath,
  )?.name;

  const merge = async () => {
    if (!targetPath || !sourcePath || targetPath === sourcePath) return;
    setSaving(true);
    setError(null);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'merge-worktree-into-worktree',
        repositoryPath,
        targetPath,
        sourcePath,
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
      setSaving(false);
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
    setSaving(true);
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
      setSaving(false);
    }
  };

  const abortMerge = async () => {
    if (!conflictState) return;
    setSaving(true);
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
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Merge worktree"
      open={open}
      onCancel={() => {
        if (!conflictState) onClose();
      }}
      onOk={conflictState ? continueMerge : merge}
      okText="Merge"
      confirmLoading={saving}
      okButtonProps={{
        disabled: !targetPath || !sourcePath || targetPath === sourcePath,
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
                onClick={abortMerge}
                disabled={saving}
              >
                Abort merge
              </Button>,
              <Button
                key="continue"
                type="primary"
                onClick={continueMerge}
                loading={saving}
                disabled={conflictState.conflictedFiles.length > 0}
              >
                Complete merge
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
          message="Unable to merge"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}
      {!conflictState && (
        <Form layout="vertical">
          <Form.Item
            label="Target worktree (receives changes)"
            required
            tooltip="The worktree whose branch will be updated with the merged changes"
          >
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
          <Form.Item
            label="Source worktree (to merge)"
            required
            tooltip="The branch/worktree that contains the changes you want to bring in"
          >
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
                placeholder={`Merge branch '${sourceName || 'source'}' into ${targetName || 'target'}`}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                allowClear
              />
            </Form.Item>
          )}
        </Form>
      )}
      {!conflictState && targetName && sourceName && (
        <Typography.Text type="secondary">
          Merge <strong>{sourceName}</strong> into{' '}
          <strong>{targetName}</strong>. The target worktree must have a clean
          working tree.
        </Typography.Text>
      )}
      {conflictState && (
        <>
          <Alert
            type="warning"
            showIcon
            message={`Merge ${conflictState.sourceBranch} into ${conflictState.targetBranch} has conflicts`}
            description={`Resolve each file below. Target represents ${conflictState.targetBranch} (ours), and Source represents ${conflictState.sourceBranch} (theirs).`}
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
                      Use source version ({conflictState.sourceBranch})
                    </Button>
                    <Button
                      size="small"
                      loading={resolvingFile === filePath}
                      onClick={() => resolveConflict(filePath, 'target')}
                    >
                      Use target version ({conflictState.targetBranch})
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
