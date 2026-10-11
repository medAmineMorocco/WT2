import {
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import { Popover, Select, Tooltip, theme } from 'antd';
import { useEffect, useState } from 'react';
import { Tree02Icon } from 'hugeicons-react';
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
    if (
      !targetBranch ||
      worktreeName === defaultBranch ||
      targetBranch === worktreeName
    ) {
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

  // If default worktree or target is self, render default uncolored tree icon
  if (worktreeName === defaultBranch || targetBranch === worktreeName) {
    return <Tree02Icon size={18} />;
  }

  if (loading) {
    return (
      <Tooltip
        title={`Checking merge status into ${targetBranch}...`}
        placement="right"
      >
        <span
          className="worktree-tree-icon-wrapper loading"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Checking merge status for ${worktreeName}`}
        >
          <Tree02Icon size={18} />
        </span>
      </Tooltip>
    );
  }

  // If analysis is unavailable or errored, render default tree icon
  if (!result || !result.ok) {
    return <Tree02Icon size={18} />;
  }

  const isClean = result.conflictFree;
  const iconColor = isClean ? token.colorSuccess : token.colorError;

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
            <CheckCircleFilled
              style={{ color: token.colorSuccess, fontSize: 13 }}
            />
            <span>Clean (no conflicts)</span>
          </>
        ) : (
          <>
            <CloseCircleFilled
              style={{ color: token.colorError, fontSize: 13 }}
            />
            <span>Conflicts detected</span>
          </>
        )}
      </div>
      {result.details && (
        <div className="worktree-merge-popover-details">{result.details}</div>
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
            ? `Clean merge into ${targetBranch} (click to configure)`
            : `Conflicts detected against ${targetBranch} (click for details)`
        }
        placement="right"
        mouseEnterDelay={0.2}
      >
        <span
          className={`worktree-tree-icon-wrapper ${isClean ? 'clean' : 'conflict'}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          data-testid={`merge-check-${worktreeName}`}
          role="button"
          tabIndex={0}
          aria-label={`${worktreeName}: ${isClean ? 'Clean' : 'Conflicts'} with ${targetBranch}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'pointer',
            color: iconColor,
          }}
        >
          <Tree02Icon size={18} color={iconColor} style={{ color: iconColor }} />
        </span>
      </Tooltip>
    </Popover>
  );
}
