import {
  App as AntdApp,
  Button,
  Checkbox,
  Empty,
  Input,
  Popconfirm,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  WorkingTreeAction,
  WorkingTreeFile,
  WorkingTreeStatus,
} from '../../../shared/workingTree';

const { TextArea } = Input;

const cleanErrorMessage = (error: any): string => {
  const raw = error?.message || String(error || '');
  return raw
    .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
    .trim();
};

export default function WorkingTreePanel({
  repositoryPath,
  refreshToken,
  onStatusChange,
  onClose,
  onCommitted,
  selectedFile,
  onFileSelect,
}: {
  repositoryPath: string;
  refreshToken: number;
  onStatusChange: (status: WorkingTreeStatus) => void;
  onClose: () => void;
  onCommitted: () => void;
  selectedFile: { file: WorkingTreeFile; staged: boolean } | null;
  onFileSelect: (selection: { file: WorkingTreeFile; staged: boolean }) => void;
}) {
  const { notification } = AntdApp.useApp();
  const [status, setStatus] = useState<WorkingTreeStatus>({
    branch: '',
    files: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [amend, setAmend] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const hasLoaded = useRef(false);

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const next = await window.electron.ipcRenderer.invoke(
          'get-working-tree-status',
          repositoryPath,
        );
        setStatus(next);
        onStatusChange(next);
      } catch (error: any) {
        notification.error({
          message: 'Unable to load working tree',
          description: error?.message || String(error),
          placement: 'bottomLeft',
        });
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [onStatusChange, repositoryPath],
  );

  useEffect(() => {
    load(!hasLoaded.current);
    hasLoaded.current = true;
  }, [load, refreshToken]);

  const staged = useMemo(
    () => status.files.filter((file) => file.staged),
    [status],
  );
  const unstaged = useMemo(
    () => status.files.filter((file) => file.unstaged),
    [status],
  );

  const fileKind = (
    file: WorkingTreeFile,
    isStaged: boolean,
  ): 'added' | 'deleted' | 'modified' => {
    let statusCode = file.worktreeStatus;
    if (file.untracked) statusCode = 'A';
    else if (isStaged) statusCode = file.indexStatus;
    if (statusCode === 'A' || statusCode === '?') return 'added';
    if (statusCode === 'D') return 'deleted';
    return 'modified';
  };

  const changeCounts = (files: WorkingTreeFile[], isStaged: boolean) =>
    files.reduce(
      (counts, file) => {
        counts[fileKind(file, isStaged)] += 1;
        return counts;
      },
      { modified: 0, added: 0, deleted: 0 },
    );

  const unstagedCounts = changeCounts(unstaged, false);
  const stagedCounts = changeCounts(staged, true);

  const renderChangeCounts = (counts: {
    modified: number;
    added: number;
    deleted: number;
  }) => (
    <span className="working-tree-change-counts">
      {counts.modified > 0 && (
        <Tooltip title={`${counts.modified} modified`}>
          <span className="working-tree-change-count modified">
            <EditOutlined /> {counts.modified}
          </span>
        </Tooltip>
      )}
      {counts.added > 0 && (
        <Tooltip title={`${counts.added} added`}>
          <span className="working-tree-change-count added">
            <PlusOutlined /> {counts.added}
          </span>
        </Tooltip>
      )}
      {counts.deleted > 0 && (
        <Tooltip title={`${counts.deleted} deleted`}>
          <span className="working-tree-change-count deleted">
            <MinusOutlined /> {counts.deleted}
          </span>
        </Tooltip>
      )}
    </span>
  );

  const runAction = async (action: WorkingTreeAction, paths: string[] = []) => {
    setBusy(true);
    try {
      await window.electron.ipcRenderer.invoke(
        'run-working-tree-action',
        repositoryPath,
        action,
        paths,
      );
      await load(false);
    } catch (error: any) {
      const errorDetail = cleanErrorMessage(error);
      notification.error({
        message: `Git ${action} failed`,
        description: errorDetail || `Git ${action} failed.`,
        placement: 'bottomLeft',
      });
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      await window.electron.ipcRenderer.invoke(
        'commit-working-tree',
        repositoryPath,
        summary,
        description,
        amend,
      );
      setSummary('');
      setDescription('');
      setAmend(false);
      await load(false);
      onCommitted();
      notification.success({
        message: 'Changes committed',
        placement: 'bottomLeft',
      });
    } catch (error: any) {
      notification.error({
        message: 'Commit failed',
        description: error?.message || String(error),
        placement: 'bottomLeft',
      });
    } finally {
      setBusy(false);
    }
  };

  const discardFile = async (file: WorkingTreeFile) => {
    setBusy(true);
    try {
      await window.electron.ipcRenderer.invoke(
        'discard-working-tree-file',
        repositoryPath,
        file.path,
        file.untracked,
      );
      await load(false);
    } catch (error: any) {
      notification.error({
        message: 'Unable to discard file changes',
        description: error?.message || String(error),
        placement: 'bottomLeft',
      });
    } finally {
      setBusy(false);
    }
  };

  const renderFile = (file: WorkingTreeFile, isStaged: boolean) => (
    <div
      className={`working-tree-file ${selectedFile?.file.path === file.path && selectedFile.staged === isStaged ? 'selected' : ''}`}
      key={`${isStaged ? 's' : 'u'}-${file.path}`}
      role="button"
      tabIndex={0}
      onClick={() => onFileSelect({ file, staged: isStaged })}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onFileSelect({ file, staged: isStaged });
        }
      }}
    >
      <Tooltip title={fileKind(file, isStaged)}>
        <span className={`working-tree-status ${fileKind(file, isStaged)}`}>
          {fileKind(file, isStaged) === 'added' && <PlusOutlined />}
          {fileKind(file, isStaged) === 'deleted' && <MinusOutlined />}
          {fileKind(file, isStaged) === 'modified' && <EditOutlined />}
        </span>
      </Tooltip>
      <span className="working-tree-file-path" title={file.path}>
        {file.path}
      </span>
      <span className="working-tree-file-actions">
        {!isStaged && (
          <Popconfirm
            title="Discard changes?"
            description={
              file.untracked
                ? 'This untracked file will be permanently deleted.'
                : 'All unstaged changes in this file will be lost.'
            }
            okText="Discard"
            okButtonProps={{ danger: true }}
            onConfirm={() => discardFile(file)}
          >
            <Tooltip title="Discard file changes">
              <Button
                danger
                type="text"
                size="small"
                aria-label={`Discard changes in ${file.path}`}
                icon={<DeleteOutlined />}
                onClick={(event) => event.stopPropagation()}
                disabled={busy}
              />
            </Tooltip>
          </Popconfirm>
        )}
        <Tooltip title={isStaged ? 'Unstage file' : 'Stage file'}>
          <Button
            type="text"
            size="small"
            aria-label={
              isStaged ? `Unstage ${file.path}` : `Stage ${file.path}`
            }
            icon={isStaged ? <MinusOutlined /> : <PlusOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              runAction(isStaged ? 'unstage' : 'stage', [file.path]);
            }}
            disabled={busy}
          />
        </Tooltip>
      </span>
    </div>
  );

  return (
    <aside className="working-tree-panel">
      <header className="working-tree-panel-header">
        <div>
          <Typography.Text strong>Working tree changes</Typography.Text>
          <Typography.Text type="secondary">
            {status.branch || 'Detached HEAD'}
          </Typography.Text>
        </div>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
          aria-label="Close working tree panel"
        />
      </header>
      {loading ? (
        <div className="working-tree-loading">
          <Spin />
        </div>
      ) : (
        <>
          <section className="working-tree-section">
            <div className="working-tree-section-title">
              <span>
                Unstaged files <b>{unstaged.length}</b>
              </span>
              {renderChangeCounts(unstagedCounts)}
              <Button
                size="small"
                onClick={() => {
                  runAction('stage-all');
                }}
                disabled={!unstaged.length || busy}
              >
                Stage all
              </Button>
            </div>
            <div className="working-tree-files">
              {unstaged.length ? (
                unstaged.map((file) => renderFile(file, false))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No unstaged files"
                />
              )}
            </div>
          </section>
          <section className="working-tree-section staged">
            <div className="working-tree-section-title">
              <span>
                Staged files <b>{staged.length}</b>
              </span>
              {renderChangeCounts(stagedCounts)}
              <Button
                size="small"
                onClick={() => {
                  runAction('unstage-all');
                }}
                disabled={!staged.length || busy}
              >
                Unstage all
              </Button>
            </div>
            <div className="working-tree-files">
              {staged.length ? (
                staged.map((file) => renderFile(file, true))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No staged files"
                />
              )}
            </div>
          </section>
          <section className="working-tree-commit-form">
            <Checkbox
              checked={amend}
              disabled={loadingMessage}
              onChange={async (event) => {
                const { checked } = event.target;
                setAmend(checked);
                if (!checked) return;
                setLoadingMessage(true);
                try {
                  const message = await window.electron.ipcRenderer.invoke(
                    'get-head-commit-message',
                    repositoryPath,
                  );
                  setSummary(message.summary);
                  setDescription(message.description);
                } catch (error: any) {
                  setAmend(false);
                  notification.error({
                    message: 'Unable to load previous commit message',
                    description: error?.message || String(error),
                    placement: 'bottomLeft',
                  });
                } finally {
                  setLoadingMessage(false);
                }
              }}
            >
              Amend previous commit
            </Checkbox>
            <Input
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={72}
              showCount
              placeholder="Commit summary"
            />
            <TextArea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              autoSize={{ minRows: 3, maxRows: 7 }}
              placeholder="Description (optional)"
            />
            <Button
              type="primary"
              block
              icon={<CheckOutlined />}
              onClick={() => {
                commit();
              }}
              loading={busy}
              disabled={!staged.length || !summary.trim()}
            >
              {amend ? 'Amend commit' : `Commit ${staged.length || ''}`}
            </Button>
          </section>
        </>
      )}
    </aside>
  );
}
