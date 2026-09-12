import {
  CloseOutlined,
  DownOutlined,
  FileAddOutlined,
  FileTextOutlined,
  MinusOutlined,
  PlusOutlined,
  RollbackOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Empty, Spin, Tag, Tooltip, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  CommitChangedFile,
  CommitChangedFilesResult,
} from '../../../shared/gitCommit';
import type { ResetMode } from '../../../shared/gitResetRevert';

function statusDetails(status: string) {
  if (status.startsWith('A')) {
    return { label: 'Added', color: 'green', icon: <FileAddOutlined /> };
  }
  if (status.startsWith('D')) {
    return { label: 'Deleted', color: 'red', icon: <MinusOutlined /> };
  }
  return { label: 'Modified', color: 'blue', icon: <FileTextOutlined /> };
}

export default function CommitDetailsPanel({
  commit,
  repositoryPath,
  selectedFile,
  onFileSelect,
  onClose,
  selectedWorktree,
  onReset,
  onRevert,
}: {
  commit: string;
  repositoryPath: string;
  selectedFile: CommitChangedFile | null;
  onFileSelect: (file: CommitChangedFile) => void;
  onClose: () => void;
  selectedWorktree?: string | null;
  onReset?: (mode: ResetMode) => void;
  onRevert?: () => void;
}) {
  const [result, setResult] = useState<CommitChangedFilesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);

  useEffect(() => {
    const onFiles = (
      code: number,
      payload: CommitChangedFilesResult | string,
      requestId: number,
    ) => {
      if (requestId !== request.current) return;
      setLoading(false);
      if (code === 0) setResult(payload as CommitChangedFilesResult);
      else setError(payload as string);
    };
    window.electron.ipcRenderer.on('receive-commit-changed-files', onFiles);
    return () => {
      window.electron.ipcRenderer.removeAllListeners(
        'receive-commit-changed-files',
      );
    };
  }, []);

  useEffect(() => {
    const requestId = request.current + 1;
    request.current = requestId;
    setResult(null);
    setError('');
    setLoading(true);
    window.electron.ipcRenderer.send(
      'get-commit-changed-files',
      requestId,
      commit,
      repositoryPath,
    );
  }, [commit, repositoryPath]);

  return (
    <aside className="commit-details-panel">
      <div className="commit-details-header">
        <div>
          <Typography.Text strong>Commit {commit.slice(0, 8)}</Typography.Text>
          {result && (
            <div className="commit-diff-totals">
              <span>{result.files.length} files</span>
              <span className="diff-additions">
                <PlusOutlined /> {result.additions}
              </span>
              <span className="diff-deletions">
                <MinusOutlined /> {result.deletions}
              </span>
            </div>
          )}
        </div>
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
      </div>
      <div
        className="commit-details-actions"
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          gap: '8px',
        }}
      >
        <Tooltip
          title={
            selectedWorktree
              ? `Reset ${selectedWorktree} to this commit`
              : 'Select a worktree in Git Log toolbar to enable Reset'
          }
        >
          <Dropdown
            disabled={!selectedWorktree}
            menu={{
              items: [
                {
                  key: 'soft',
                  label: 'Soft - keep all changes',
                  onClick: () => onReset?.('soft'),
                },
                {
                  key: 'mixed',
                  label: 'Mixed - keep working copy but reset index',
                  onClick: () => onReset?.('mixed'),
                },
                {
                  key: 'hard',
                  label: 'Hard - discard all changes',
                  danger: true,
                  onClick: () => onReset?.('hard'),
                },
              ],
            }}
          >
            <Button
              size="small"
              icon={<RollbackOutlined />}
              disabled={!selectedWorktree}
            >
              Reset {selectedWorktree || 'branch'}{' '}
              <DownOutlined style={{ fontSize: 9, marginLeft: 2 }} />
            </Button>
          </Dropdown>
        </Tooltip>
        <Tooltip
          title={
            selectedWorktree
              ? 'Revert this commit on the current branch'
              : 'Select a worktree in Git Log toolbar to enable Revert'
          }
        >
          <Button
            size="small"
            icon={<UndoOutlined />}
            disabled={!selectedWorktree}
            onClick={onRevert}
          >
            Revert
          </Button>
        </Tooltip>
      </div>
      <div className="commit-files-list">
        {loading && (
          <div className="commit-files-loading">
            <Spin size="large" />
          </div>
        )}
        {!loading && result?.files.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No changed files"
          />
        )}
        {result?.files.map((file) => {
          const status = statusDetails(file.status);
          return (
            <button
              type="button"
              key={file.path}
              className={`commit-file-row ${selectedFile?.path === file.path ? 'selected' : ''}`}
              onClick={() => onFileSelect(file)}
            >
              <span className="commit-file-status">{status.icon}</span>
              <span className="commit-file-path" title={file.path}>
                {file.path}
              </span>
              <Tag bordered={false} color={status.color}>
                {status.label}
              </Tag>
              {file.binary ? (
                <span className="commit-file-binary">binary</span>
              ) : (
                <span className="commit-file-stats">
                  <span className="diff-additions">+{file.additions}</span>
                  <span className="diff-deletions">-{file.deletions}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
    </aside>
  );
}
