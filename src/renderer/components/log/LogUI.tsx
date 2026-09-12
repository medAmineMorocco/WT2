import {
  Dropdown,
  Empty,
  FloatButton,
  MenuProps,
  notification,
  Spin,
  Tag,
  Tooltip,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import log from 'electron-log';
import {
  EditOutlined,
  LoadingOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import TabService from '../../services/tab/TabService';
import type { ResetMode } from '../../../shared/gitResetRevert';

const formatDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function highlightMatch(text: string, query?: string) {
  if (!query || !query.trim() || !text) return text;
  const q = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lowerText.indexOf(lowerQ);
  if (idx === -1) return text;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let lowerRemaining = lowerText;
  let matchIdx = lowerRemaining.indexOf(lowerQ);
  let key = 0;

  while (matchIdx !== -1) {
    if (matchIdx > 0) {
      parts.push(remaining.slice(0, matchIdx));
    }
    parts.push(
      <mark key={key++} className="search-highlight">
        {remaining.slice(matchIdx, matchIdx + q.length)}
      </mark>,
    );
    remaining = remaining.slice(matchIdx + q.length);
    lowerRemaining = lowerRemaining.slice(matchIdx + q.length);
    matchIdx = lowerRemaining.indexOf(lowerQ);
  }
  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return <>{parts}</>;
}

export interface ParsedCommit {
  hash: string;
  parents: string[];
  subject: string;
  refs: string;
  author: string;
  date: string;
  lane: number;
  passingLanes: number[];
  forks: { fromLane: number; toLane: number }[];
  merges: { fromLane: number; toLane: number }[];
  hasTop: boolean;
  hasBottom: boolean;
  isStash?: boolean;
  graph?: string;
  transitionsAbove?: string[];
  transitionsBelow?: string[];
}

export default function LogUI({
  commits,
  searchQuery,
  isAuthorEnabled,
  isCommitDateEnabled,
  isHashEnabled,
  isRefsEnabled,
  shouldHide,
  selectedCommit,
  onCommitSelect,
  hasDetailsPanel = false,
  workingTreeCount = 0,
  workingTreeCounts = { modified: 0, added: 0, deleted: 0 },
  workingTreeSelected = false,
  onWorkingTreeSelect,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onCherryPick,
  selectedWorktree,
  onResetCommit,
  onRevertCommit,
}: {
  commits: string[];
  searchQuery?: string;
  isAuthorEnabled: boolean;
  isCommitDateEnabled: boolean;
  isHashEnabled: boolean;
  isRefsEnabled: boolean;
  shouldHide: boolean;
  selectedCommit?: string | null;
  onCommitSelect?: (hash: string) => void;
  hasDetailsPanel?: boolean;
  workingTreeCount?: number;
  workingTreeCounts?: { modified: number; added: number; deleted: number };
  workingTreeSelected?: boolean;
  onWorkingTreeSelect?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onCherryPick?: (commit: ParsedCommit) => void;
  selectedWorktree?: string | null;
  onResetCommit?: (commit: ParsedCommit, mode: ResetMode) => void;
  onRevertCommit?: (commit: ParsedCommit) => void;
}) {
  const [api, contextHolder] = notification.useNotification();

  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

  const storedWorktreePrefix =
    window.localStorage.getItem('worktreePrefix') != null &&
    window.localStorage.getItem('worktreePrefix')?.trim() !== ''
      ? window.localStorage.getItem('worktreePrefix')
      : '{repo}__wt__{branch}';

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    const onWorktreeCreated = (code: number, result: any) => {
      log.debug(
        `onWorktreeCreated code: ${code} result: ${JSON.stringify(result)}`,
      );
      if (code === 0) {
        window.electron.ipcRenderer.send('show-git-log', tabRepoPath);
        window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
        const t1 = setTimeout(() => {
          api.success({
            key: 'updatable',
            message: 'Worktree Created',
            placement: 'bottomLeft',
            duration: 0.5,
          });
          const t2 = setTimeout(() => {
            api.destroy('updatable');
          }, 1500);
          timers.push(t2);
        }, 500);
        timers.push(t1);
      } else {
        notification.error({
          message: 'Unable to Create Worktree From Commit',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const removeWorktreeCreated = window.electron.ipcRenderer.on(
      'worktree-from-commit-created',
      onWorktreeCreated,
    );

    return () => {
      timers.forEach(clearTimeout);
      if (typeof removeWorktreeCreated === 'function') removeWorktreeCreated();
      else
        window.electron.ipcRenderer.removeAllListeners(
          'worktree-from-commit-created',
        );
    };
  }, [api, tabRepoPath]);

  const menuItems: MenuProps['items'] = useMemo(() => {
    const baseItems: MenuProps['items'] = [
      {
        label: 'Copy commit sha',
        key: '1',
      },
      {
        label: 'Create worktree here',
        key: '2',
      },
      {
        label: 'Cherry-pick',
        key: 'cherry-pick',
      },
    ];

    if (selectedWorktree) {
      baseItems.push(
        {
          type: 'divider',
        },
        {
          label: `Reset ${selectedWorktree} to this commit`,
          key: 'reset-group',
          children: [
            {
              label: 'Soft - keep all changes',
              key: 'reset-commit-soft',
            },
            {
              label: 'Mixed - keep working copy but reset index',
              key: 'reset-commit-mixed',
            },
            {
              label: 'Hard - discard all changes',
              key: 'reset-commit-hard',
              danger: true,
            },
          ],
        },
        {
          label: 'Revert commit',
          key: 'revert-commit',
        },
      );
    }

    return baseItems;
  }, [selectedWorktree]);

  const onClick = (commit: ParsedCommit) => {
    return (event: any) => {
      if (event.key === '1') {
        navigator.clipboard.writeText(commit.hash);
      }
      if (event.key === '2') {
        const activeTabValue = TabService.getTab(activeTab);
        let worktreesPath;
        if (activeTabValue.worktreesPath) {
          worktreesPath = activeTabValue.worktreesPath;
        }
        api.open({
          key: 'updatable',
          icon: <LoadingOutlined />,
          message:
            'Your worktree is being created. Please wait a moment while we complete the process.',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        window.electron.ipcRenderer.send(
          'create-worktree-from-commit',
          commit.hash,
          worktreesPath,
          tabRepoPath,
          storedWorktreePrefix,
        );
      }
      if (event.key === 'cherry-pick') {
        onCherryPick?.(commit);
      }
      if (event.key === 'reset-commit-soft') {
        onResetCommit?.(commit, 'soft');
      }
      if (event.key === 'reset-commit-mixed') {
        onResetCommit?.(commit, 'mixed');
      }
      if (event.key === 'reset-commit-hard') {
        onResetCommit?.(commit, 'hard');
      }
      if (event.key === 'revert-commit') {
        onRevertCommit?.(commit);
      }
    };
  };

  function formatToIsoWithoutSeconds(dateString: string): string {
    const date = new Date(dateString);

    const parts = formatDate.formatToParts(date);
    const { year, month, day, hour, minute } = Object.fromEntries(
      parts.map((p) => [p.type, p.value]),
    );

    const offsetMatch = dateString.match(/([+-])(\d{2})(\d{2})$/);
    let tz = 'UTC';

    if (offsetMatch) {
      const [, sign, hours] = offsetMatch;
      const totalOffset = `UTC${sign}${parseInt(hours, 10)}`;
      tz = totalOffset;
    }

    return `${year}-${month}-${day} ${hour}:${minute} ${tz}`;
  }

  function formatCommitDate(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  function renderRefs(value: string) {
    const refs = value
      .split(',')
      .map((ref) => ref.trim())
      .filter(Boolean);
    if (refs.length === 0) return null;

    // Prioritize HEAD, stash, and branch refs before tags
    const sortedRefs = [...refs].sort((a, b) => {
      const score = (r: string) => {
        if (r.includes('HEAD')) return 0;
        if (r.startsWith('stash') || r.includes('refs/stash')) return 1;
        if (!r.startsWith('tag:') && !r.includes('/')) return 2;
        if (r.includes('/')) return 3;
        return 4;
      };
      return score(a) - score(b);
    });

    const maxVisible = sortedRefs.length <= 3 ? 3 : 2;
    const visibleRefs = sortedRefs.slice(0, maxVisible);
    const remainingRefs = sortedRefs.slice(maxVisible);

    const renderedTags = visibleRefs.map((ref) => {
      let refType = 'branch';
      if (ref.includes('HEAD')) {
        refType = 'head';
      } else if (ref.startsWith('stash') || ref.includes('refs/stash')) {
        refType = 'stash';
      } else if (ref.startsWith('tag:')) {
        refType = 'tag';
      } else if (ref.includes('/')) {
        refType = 'remote';
      }

      let displayRef = ref;
      if (ref === 'refs/stash') {
        displayRef = 'stash@{0}';
      } else if (ref.startsWith('refs/stash')) {
        displayRef = ref.replace(/^refs\/stash/, 'stash');
      }

      return (
        <Tooltip key={ref} title={ref} mouseEnterDelay={0} mouseLeaveDelay={0}>
          <span style={{ display: 'inline-flex', maxWidth: '120px' }}>
            <Tag bordered={false} className={`commit-ref-chip ${refType}`}>
              {displayRef}
            </Tag>
          </span>
        </Tooltip>
      );
    });

    if (remainingRefs.length > 0) {
      const remainingTitle = (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxWidth: '340px',
            maxHeight: '280px',
            overflowY: 'auto',
            padding: '2px 0',
            wordBreak: 'break-all',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              borderBottom: '1px solid rgba(255,255,255,0.2)',
              paddingBottom: '3px',
              marginBottom: '2px',
            }}
          >
            {remainingRefs.length} More Reference
            {remainingRefs.length > 1 ? 's' : ''}:
          </div>
          {remainingRefs.map((r) => (
            <div key={r} style={{ fontSize: '12px', lineHeight: '16px' }}>
              {r}
            </div>
          ))}
        </div>
      );

      renderedTags.push(
        <Tooltip
          key="remaining-refs"
          title={remainingTitle}
          mouseEnterDelay={0}
          mouseLeaveDelay={0}
        >
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>
            <Tag bordered={false} className="commit-ref-chip remaining">
              +{remainingRefs.length}
            </Tag>
          </span>
        </Tooltip>,
      );
    }

    return renderedTags;
  }

  const GRAPH_COLORS = [
    '#00b4d8', // 0: Vibrant Cyan / Turquoise (main)
    '#3b82f6', // 1: Vibrant Blue
    '#a855f7', // 2: Vibrant Purple / Magenta
    '#f97316', // 3: Vibrant Orange
    '#ec4899', // 4: Vibrant Pink / Rose
    '#10b981', // 5: Vibrant Emerald Green
    '#f59e0b', // 6: Vibrant Amber / Gold
    '#6366f1', // 7: Vibrant Indigo
  ];

  const laneSpacing = 20;
  const laneOffset = 16;
  const laneX = (lane: number) => lane * laneSpacing + laneOffset;

  const parsedCommits = useMemo(() => {
    const rawList: {
      hash: string;
      parents: string[];
      subject: string;
      refs: string;
      author: string;
      date: string;
    }[] = [];

    const regex =
      /^(?:[*|/\\ ]*)?(.*?)(?: \(([^)]+)\))? <([^>]+)> \[([^\]]+)\]\s+([a-f0-9]{7,40})(?:\s+parents:\[(.*?)\])?$/;

    commits.forEach((line) => {
      if (!line || !line.trim()) return;
      // Filter out internal Git stash index/untracked commits
      if (/^(?:[*|/\\ ]*)?(?:index|untracked files) on [^:]+:\s/i.test(line)) {
        return;
      }

      const match = line.match(regex);
      if (match) {
        const [
          ,
          subject = '',
          refs = '',
          author = '',
          date = '',
          hash = '',
          parentsStr = '',
        ] = match;

        let parents = parentsStr
          ? parentsStr.trim().split(/\s+/).filter(Boolean)
          : [];

        const isStash = Boolean(
          refs.includes('stash') ||
          refs.includes('refs/stash') ||
          /^WIP on /i.test(subject),
        );

        // Keep only first parent (the base commit on the branch) for single-node stash
        if (isStash && parents.length > 0) {
          parents = parents.slice(0, 1);
        }

        rawList.push({ hash, parents, subject, refs, author, date, isStash });
      }
    });

    // Topological Lane Allocation (GitKraken style)
    const result: ParsedCommit[] = [];
    const activeLanes: (string | null)[] = [];

    rawList.forEach((c) => {
      // 1. Determine lane for current commit
      let lane = activeLanes.indexOf(c.hash);
      let hasTop = true;

      if (lane === -1) {
        const emptyIdx = activeLanes.indexOf(null);
        if (emptyIdx !== -1) {
          lane = emptyIdx;
        } else {
          lane = activeLanes.length;
        }
        hasTop = false;
      }

      activeLanes[lane] = null;

      // 2. Snapshot passing lanes at this row
      const passingLanes: number[] = [];
      activeLanes.forEach((head, lIdx) => {
        if (head !== null && lIdx !== lane) {
          passingLanes.push(lIdx);
        }
      });

      // 3. Connect to parents
      const forks: { fromLane: number; toLane: number }[] = [];
      const merges: { fromLane: number; toLane: number }[] = [];
      let hasBottom = false;

      if (c.parents.length > 0) {
        const p0 = c.parents[0];
        const existingP0Lane = activeLanes.indexOf(p0);

        if (existingP0Lane !== -1) {
          merges.push({ fromLane: lane, toLane: existingP0Lane });
          hasBottom = false;
        } else {
          activeLanes[lane] = p0;
          hasBottom = true;
        }

        // Secondary parents (merge commits)
        for (let pIdx = 1; pIdx < c.parents.length; pIdx += 1) {
          const pj = c.parents[pIdx];
          const existingPjLane = activeLanes.indexOf(pj);

          if (existingPjLane !== -1) {
            forks.push({ fromLane: lane, toLane: existingPjLane });
          } else {
            const emptyIdx = activeLanes.indexOf(null);
            const parentLane = emptyIdx !== -1 ? emptyIdx : activeLanes.length;
            activeLanes[parentLane] = pj;
            forks.push({ fromLane: lane, toLane: parentLane });
          }
        }
      }

      // 4. Trim trailing nulls
      while (
        activeLanes.length > 0 &&
        activeLanes[activeLanes.length - 1] === null
      ) {
        activeLanes.pop();
      }

      result.push({
        hash: c.hash,
        parents: c.parents,
        subject: c.subject,
        refs: c.refs,
        author: c.author,
        date: c.date,
        lane,
        passingLanes,
        forks,
        merges,
        hasTop,
        hasBottom,
        isStash: (c as any).isStash,
        graph: '',
        transitionsAbove: [],
        transitionsBelow: [],
      });
    });

    return result;
  }, [commits]);

  const visibleColumns = [
    !shouldHide && isAuthorEnabled ? 'minmax(120px, 0.24fr)' : '',
    !shouldHide && isCommitDateEnabled ? '135px' : '',
    !shouldHide && isHashEnabled ? '76px' : '',
  ].filter(Boolean);

  const graphLaneWidth = useMemo(() => {
    let maxLane = 1;
    parsedCommits.forEach((item) => {
      maxLane = Math.max(
        maxLane,
        item.lane,
        ...item.passingLanes,
        ...item.forks.map((f) => f.toLane),
        ...item.merges.map((m) => m.fromLane),
      );
    });
    // Ensure generous right margin (24px) past the rightmost lane to separate from commit messages
    return Math.max(64, (maxLane + 1) * laneSpacing + laneOffset + 24);
  }, [parsedCommits]);

  const firstColumnMin = Math.max(360, graphLaneWidth + 280);
  const rowTemplate = `minmax(${firstColumnMin}px, 1fr) ${visibleColumns.join(' ')}`;

  function renderGraph(item: ParsedCommit, height = 39) {
    const yMid = height / 2;
    const { lane, passingLanes, forks, merges, hasTop, hasBottom } = item;
    const commitColor = GRAPH_COLORS[lane % GRAPH_COLORS.length];

    const cx = laneX(lane);
    const cy = yMid;
    const isSelected = selectedCommit === item.hash;

    return (
      <svg
        className="commit-graph-svg"
        viewBox={`0 0 ${graphLaneWidth} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Passing straight branch lines */}
        {passingLanes.map((pLane) => {
          const x = laneX(pLane);
          const color = GRAPH_COLORS[pLane % GRAPH_COLORS.length];
          return (
            <line
              key={`passing-${pLane}`}
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Outgoing forks branching to another lane */}
        {forks.map((f, idx) => {
          const x1 = laneX(f.fromLane);
          const x2 = laneX(f.toLane);
          const color = GRAPH_COLORS[f.toLane % GRAPH_COLORS.length];
          return (
            <path
              key={`fork-${idx}-${f.fromLane}-${f.toLane}`}
              d={`M ${x1} ${yMid} C ${x1} ${yMid + (height - yMid) * 0.65}, ${x2} ${yMid + (height - yMid) * 0.35}, ${x2} ${height}`}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Outgoing merges converging into another lane */}
        {merges.map((m, idx) => {
          const x1 = laneX(m.fromLane);
          const x2 = laneX(m.toLane);
          const color = GRAPH_COLORS[m.fromLane % GRAPH_COLORS.length];
          return (
            <path
              key={`merge-${idx}-${m.fromLane}-${m.toLane}`}
              d={`M ${x1} ${yMid} C ${x1} ${yMid + (height - yMid) * 0.65}, ${x2} ${yMid + (height - yMid) * 0.35}, ${x2} ${height}`}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Vertical line through the commit dot */}
        {(() => {
          const y1 = hasTop ? 0 : yMid;
          const y2 = hasBottom ? height : yMid;
          if (y1 === y2) return null;
          return (
            <line
              x1={cx}
              y1={y1}
              x2={cx}
              y2={y2}
              stroke={commitColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })()}

        {/* Commit dot / Stash box (GitKraken style) */}
        {item.isStash ? (
          <g>
            <rect
              x={cx - 8}
              y={cy - 6}
              width={16}
              height={12}
              rx={2.5}
              fill="var(--commit-node-stroke, #fff)"
              stroke={isSelected ? '#ffffff' : '#10b981'}
              strokeWidth="1.5"
            />
            <line
              x1={cx - 8}
              y1={cy - 2}
              x2={cx + 8}
              y2={cy - 2}
              stroke={isSelected ? '#ffffff' : '#10b981'}
              strokeWidth="1"
            />
            <rect
              x={cx - 2}
              y={cy - 3}
              width={4}
              height={2.5}
              rx={0.5}
              fill={isSelected ? '#ffffff' : '#10b981'}
            />
            {isSelected && (
              <rect
                x={cx - 10}
                y={cy - 8}
                width={20}
                height={16}
                rx={4}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            )}
          </g>
        ) : (
          <>
            <circle
              cx={cx}
              cy={cy}
              r="6.5"
              fill="var(--commit-node-stroke, #fff)"
            />
            <circle
              cx={cx}
              cy={cy}
              r="4.5"
              fill={isSelected ? '#ffffff' : commitColor}
            />
            {isSelected && (
              <circle
                cx={cx}
                cy={cy}
                r="8"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
              />
            )}
          </>
        )}
      </svg>
    );
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || !onLoadMore || loadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - (scrollTop + clientHeight) < 400) {
      onLoadMore();
    }
  }, [onLoadMore, loadingMore, hasMore]);

  useEffect(() => {
    const container = containerRef.current;
    const sentinel = sentinelRef.current;
    if (!container || !sentinel || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          if (hasMore && !loadingMore) {
            onLoadMore();
          }
        }
      },
      {
        root: container,
        rootMargin: '400px',
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore]);

  useEffect(() => {
    if (!selectedCommit || !containerRef.current) return;
    const targetRow = containerRef.current.querySelector(
      `[data-commit-hash="${selectedCommit}"]`,
    );
    if (targetRow) {
      targetRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedCommit]);

  return (
    <div ref={containerRef} className="log-container" onScroll={handleScroll}>
      {contextHolder}
      <div
        className="git-log-list-header"
        style={{ gridTemplateColumns: rowTemplate }}
      >
        <span>Commit</span>
        {!shouldHide && isAuthorEnabled && <span>Author</span>}
        {!shouldHide && isCommitDateEnabled && <span>Date</span>}
        {!shouldHide && isHashEnabled && <span>SHA</span>}
      </div>
      {workingTreeCount > 0 && (
        <div
          className={`commit-row working-tree-row ${workingTreeSelected ? 'selected' : ''}`}
          style={{ gridTemplateColumns: rowTemplate }}
          role="button"
          tabIndex={0}
          onClick={onWorkingTreeSelect}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ')
              onWorkingTreeSelect?.();
          }}
        >
          <div className="commit-summary">
            <span
              className="commit-graph working-tree-graph"
              style={{ flexBasis: graphLaneWidth, width: graphLaneWidth }}
            >
              <span className="working-tree-node" />
            </span>
            <span className="commit-msg">Working tree changes</span>
            <Tag bordered={false} className="working-tree-count">
              {workingTreeCount}
            </Tag>
            <span className="working-tree-graph-counts">
              {workingTreeCounts.modified > 0 && (
                <Tooltip title={`${workingTreeCounts.modified} modified`}>
                  <span className="modified">
                    <EditOutlined /> {workingTreeCounts.modified}
                  </span>
                </Tooltip>
              )}
              {workingTreeCounts.added > 0 && (
                <Tooltip title={`${workingTreeCounts.added} added`}>
                  <span className="added">
                    <PlusOutlined /> {workingTreeCounts.added}
                  </span>
                </Tooltip>
              )}
              {workingTreeCounts.deleted > 0 && (
                <Tooltip title={`${workingTreeCounts.deleted} deleted`}>
                  <span className="deleted">
                    <MinusOutlined /> {workingTreeCounts.deleted}
                  </span>
                </Tooltip>
              )}
            </span>
          </div>
        </div>
      )}
      {parsedCommits.map((item, idx) => {
        const prevItem = idx > 0 ? parsedCommits[idx - 1] : undefined;
        const nextItem =
          idx < parsedCommits.length - 1 ? parsedCommits[idx + 1] : undefined;

        return (
          <Dropdown
            key={item.hash || idx}
            menu={{ items: menuItems, onClick: onClick(item) }}
            trigger={['contextMenu']}
            overlayClassName="commit-dropdown"
            placement="bottom"
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
            <div
              role="button"
              tabIndex={0}
              data-commit-hash={item.hash}
              className={`commit-row ${selectedCommit === item.hash ? 'selected' : ''}`}
              style={{ gridTemplateColumns: rowTemplate }}
              onClick={(event) => {
                event.preventDefault();
                onCommitSelect?.(item.hash);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onCommitSelect?.(item.hash);
                }
              }}
            >
              <div className="commit-summary">
                <span
                  className="commit-graph"
                  style={{ flexBasis: graphLaneWidth, width: graphLaneWidth }}
                >
                  {renderGraph(item, 39)}
                </span>
                <span className="commit-msg" title={item.subject}>
                  {highlightMatch(item.subject, searchQuery)}
                </span>
                {isRefsEnabled && item.refs && (
                  <span className="commit-refs">{renderRefs(item.refs)}</span>
                )}
              </div>
              {!shouldHide && isAuthorEnabled && (
                <span
                  className="commit-column commit-column-author"
                  title={item.author}
                >
                  {item.author}
                </span>
              )}
              {!shouldHide && isCommitDateEnabled && (
                <Tooltip
                  title={formatToIsoWithoutSeconds(item.date)}
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <span className="commit-column commit-column-date">
                    {formatCommitDate(item.date)}
                  </span>
                </Tooltip>
              )}
              {!shouldHide && isHashEnabled && (
                <span className="commit-column commit-column-hash">
                  {highlightMatch(item.hash.slice(0, 8), searchQuery)}
                </span>
              )}
            </div>
          </Dropdown>
        );
      })}
      {parsedCommits.length === 0 && workingTreeCount === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            searchQuery
              ? `No commits found matching "${searchQuery}"`
              : 'No commits found'
          }
          style={{ margin: '48px 0' }}
        />
      )}
      {loadingMore && (
        <div className="git-log-loading-more-row">
          <Spin size="small" />
          <span>Loading more commits...</span>
        </div>
      )}
      {hasMore && <div ref={sentinelRef} className="git-log-scroll-sentinel" />}
      <FloatButton.BackTop
        style={{
          insetInlineEnd: hasDetailsPanel
            ? 'calc(clamp(300px, 26vw, 400px) + 26px)'
            : '36px',
        }}
        target={() =>
          containerRef.current ||
          (document.querySelector('.log-container') as HTMLElement) ||
          window
        }
      />
    </div>
  );
}
