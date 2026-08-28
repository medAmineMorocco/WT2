import {
  Dropdown,
  FloatButton,
  MenuProps,
  notification,
  Tag,
  Tooltip,
} from 'antd';
import React, { useEffect, useMemo } from 'react';
import log from 'electron-log';
import {
  EditOutlined,
  LoadingOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import TabService from '../../services/tab/TabService';

const formatDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const items: MenuProps['items'] = [
  {
    label: 'Copy commit sha',
    key: '1',
  },
  {
    label: 'Create worktree here',
    key: '2',
  },
];
interface ParsedCommit {
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
  graph?: string;
  transitionsAbove?: string[];
  transitionsBelow?: string[];
}

export default function LogUI({
  commits,
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
}: {
  commits: string[];
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

  const onClick = (hash: string) => {
    return (event: any) => {
      if (event.key === '1') {
        navigator.clipboard.writeText(hash);
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
          hash,
          worktreesPath,
          tabRepoPath,
          storedWorktreePrefix,
        );
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

    // Prioritize HEAD and branch refs before tags
    const sortedRefs = [...refs].sort((a, b) => {
      const score = (r: string) =>
        r.includes('HEAD') ? 0 : !r.startsWith('tag:') ? 1 : 2;
      return score(a) - score(b);
    });

    const maxVisible = sortedRefs.length <= 3 ? 3 : 2;
    const visibleRefs = sortedRefs.slice(0, maxVisible);
    const remainingRefs = sortedRefs.slice(maxVisible);

    const renderedTags = visibleRefs.map((ref) => {
      const refType = ref.includes('HEAD')
        ? 'head'
        : ref.startsWith('tag:')
          ? 'tag'
          : ref.includes('/')
            ? 'remote'
            : 'branch';

      return (
        <Tooltip key={ref} title={ref} mouseEnterDelay={0} mouseLeaveDelay={0}>
          <span style={{ display: 'inline-flex', maxWidth: '120px' }}>
            <Tag bordered={false} className={`commit-ref-chip ${refType}`}>
              {ref}
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
      /^(?:[*|\/\\ ]*)?(.*?)(?: \(([^)]+)\))? <([^>]+)> \[([^\]]+)\]\s+([a-f0-9]{7,40})(?:\s+parents:\[(.*?)\])?$/;

    commits.forEach((line) => {
      if (!line || !line.trim()) return;
      const match = line.match(regex);
      if (match) {
        const [
          _,
          subject = '',
          refs = '',
          author = '',
          date = '',
          hash = '',
          parentsStr = '',
        ] = match;
        const parents = parentsStr
          ? parentsStr.trim().split(/\s+/).filter(Boolean)
          : [];
        rawList.push({ hash, parents, subject, refs, author, date });
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

        {/* Commit dot (GitKraken style: clean background cutout disc + solid colored core) */}
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
      </svg>
    );
  }

  return (
    <div className="log-container">
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
            menu={{ items, onClick: onClick(item.hash) }}
            trigger={['contextMenu']}
            overlayClassName="commit-dropdown"
            placement="bottom"
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
            <div
              role="button"
              tabIndex={0}
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
                  {item.subject}
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
                  {item.hash.slice(0, 8)}
                </span>
              )}
            </div>
          </Dropdown>
        );
      })}
      <FloatButton.BackTop
        style={{
          insetInlineEnd: hasDetailsPanel
            ? 'calc(clamp(300px, 26vw, 400px) + 26px)'
            : '36px',
        }}
        target={() =>
          (document.querySelector('.log-container') as HTMLElement) || window
        }
      />
    </div>
  );
}
