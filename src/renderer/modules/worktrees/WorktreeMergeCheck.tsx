import {
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
} from '@ant-design/icons';
import { Popover, Select, Tooltip, theme } from 'antd';
import { useEffect, useState } from 'react';
import type { MergeProbabilityResult } from '../../../shared/mergeProbability';

type WorktreeMergeCheckProps = {
  repositoryPath: string;
  worktreePath: string;
  worktreeName: string;
  branches: string[];
  defaultBranch: string;
};

export default function WorktreeMergeCheck({
  repositoryPath,
  worktreePath,
  worktreeName,
  branches,
  defaultBranch,
}: WorktreeMergeCheckProps) {
  const { token } = theme.useToken();
  const [targetBranch, setTargetBranch] = useState(defaultBranch);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<MergeProbabilityResult>();

  useEffect(() => {
    if (!targetBranch || !branches.includes(targetBranch)) {
      setTargetBranch(defaultBranch);
    }
  }, [branches, defaultBranch, targetBranch]);

  useEffect(() => {
    if (!targetBranch || worktreeName === defaultBranch || targetBranch === worktreeName) {
      setLoading(false);
      setResult(undefined);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setResult(undefined);
    window.electron.ipcRenderer
      .invoke(
        'calculate-merge-probability',
        repositoryPath,
        worktreePath,
        targetBranch,
      )
      .then((nextResult: MergeProbabilityResult) => {
        if (!cancelled) setResult(nextResult);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setResult({
            ok: false,
            error: error?.message || 'Merge analysis failed.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [defaultBranch, repositoryPath, targetBranch, worktreeName, worktreePath]);

  // Do not show conflict status on the default worktree itself or if targetBranch is self
  if (worktreeName === defaultBranch || targetBranch === worktreeName) {
    return null;
  }

  if (loading) {
    return (
      <Tooltip title={`Checking conflicts against ${targetBranch}...`} placement="top">
        <span
          className="worktree-merge-badge loading"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Checking conflicts for ${worktreeName}`}
        >
          <LoadingOutlined spin style={{ fontSize: 11, color: token.colorTextTertiary }} />
        </span>
      </Tooltip>
    );
  }

  // If analysis is unavailable or errored, do not render noisy pills
  if (!result || !result.ok) {
    return null;
  }

  const isClean = result.conflictFree;

  const popoverContent = (
    <div
      className="worktree-merge-popover"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="worktree-merge-popover-header">
        <span className="worktree-merge-popover-title">Target:</span>
        {branches.length > 1 ? (
          <Select
            size="small"
            value={targetBranch}
            options={branches.map((b) => ({ label: b, value: b }))}
            onChange={(val) => setTargetBranch(val)}
            style={{ minWidth: 120 }}
            popupMatchSelectWidth={false}
          />
        ) : (
          <span className="worktree-merge-popover-branch">{targetBranch}</span>
        )}
      </div>
      <div
        className={`worktree-merge-popover-status ${isClean ? 'clean' : 'conflict'}`}
      >
        {isClean ? (
          <>
            <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 13 }} />
            <span>Clean (no conflicts)</span>
          </>
        ) : (
          <>
            <CloseCircleFilled style={{ color: token.colorError, fontSize: 13 }} />
            <span>Conflicts detected</span>
          </>
        )}
      </div>
      {result.details && (
        <div className="worktree-merge-popover-details">
          {result.details}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      placement="right"
      destroyTooltipOnHide
    >
      <Tooltip
        title={
          isClean
            ? `Clean merge into ${targetBranch}`
            : `Conflicts detected against ${targetBranch} (click for details)`
        }
        placement="top"
        mouseEnterDelay={0.2}
      >
        <span
          className={`worktree-merge-badge ${isClean ? 'clean' : 'conflict'}`}
          onClick={(e) => e.stopPropagation()}
          data-testid={`merge-check-${worktreeName}`}
          role="button"
          tabIndex={0}
          aria-label={`${worktreeName}: ${isClean ? 'Clean' : 'Conflicts'} with ${targetBranch}`}
        >
          {isClean ? (
            <CheckCircleFilled
              className="worktree-merge-icon success"
              style={{ color: token.colorSuccess, fontSize: 12 }}
            />
          ) : (
            <CloseCircleFilled
              className="worktree-merge-icon conflict"
              style={{ color: token.colorError, fontSize: 12 }}
            />
          )}
        </span>
      </Tooltip>
    </Popover>
  );
}
