import {
  CloseOutlined,
  FileAddOutlined,
  FileTextOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Empty, Spin, Tag, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  CommitChangedFile,
  CommitChangedFilesResult,
} from '../../../shared/gitCommit';

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
}: {
  commit: string;
  repositoryPath: string;
  selectedFile: CommitChangedFile | null;
  onFileSelect: (file: CommitChangedFile) => void;
  onClose: () => void;
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
