import {
  Alert,
  Badge,
  Button,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  notification,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TabService from '../../services/tab/TabService';
import {
  WorktreeDashboardDiskUsage,
  WorktreeDashboardItem,
} from '../../../shared/worktreeDashboard';

type StatusFilter =
  'all' | 'clean' | 'dirty' | 'detached' | 'behind' | 'ahead' | 'stale';

function changeTotal(item: WorktreeDashboardItem) {
  return item.changedFiles.length;
}

function relativeTime(dateValue?: string | null) {
  if (!dateValue) return 'Not available';
  const elapsedMinutes = Math.round(
    (new Date(dateValue).getTime() - Date.now()) / 60000,
  );
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(elapsedMinutes) < 60) {
    return formatter.format(elapsedMinutes, 'minute');
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) {
    return formatter.format(elapsedHours, 'hour');
  }
  const elapsedDays = Math.round(elapsedHours / 24);
  if (Math.abs(elapsedDays) < 365) {
    return formatter.format(elapsedDays, 'day');
  }
  return formatter.format(Math.round(elapsedDays / 365), 'year');
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function statusLabel(item: WorktreeDashboardItem) {
  if (item.needsPrune || item.changes.conflicted > 0) {
    return <Badge status="error" text="Attention" />;
  }
  return changeTotal(item) > 0 ? (
    <Badge status="warning" text="Dirty" />
  ) : (
    <Badge status="success" text="Clean" />
  );
}

function filterMatches(item: WorktreeDashboardItem, filter: StatusFilter) {
  if (filter === 'clean') return changeTotal(item) === 0;
  if (filter === 'dirty') return changeTotal(item) > 0;
  if (filter === 'detached') return item.isDetached;
  if (filter === 'behind') return item.behind > 0;
  if (filter === 'ahead') return item.ahead > 0;
  if (filter === 'stale') return item.isStale || item.needsPrune;
  return true;
}

export default function WorktreeOverview() {
  const repositoryPath = useMemo(
    () => TabService.getTabRepoPath(TabService.getActiveTab()),
    [],
  );
  const [items, setItems] = useState<WorktreeDashboardItem[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    window.electron.ipcRenderer.send('get-worktree-dashboard', repositoryPath);
  }, [repositoryPath]);

  useEffect(() => {
    const onDashboardFound = (code: number, result: unknown) => {
      setLoading(false);
      if (code !== 0) {
        notification.error({
          message: 'Unable to load worktree overview',
          description: String(result),
          placement: 'bottomLeft',
        });
        return;
      }
      const dashboardItems = result as WorktreeDashboardItem[];
      setItems(dashboardItems);
      setSelectedPath((current) =>
        dashboardItems.some((item) => item.path === current)
          ? current
          : dashboardItems[0]?.path || '',
      );
      setLastUpdated(new Date());
    };
    const onDiskUsageFound = (
      worktreePath: string,
      diskUsage: WorktreeDashboardDiskUsage,
    ) => {
      setItems((current) =>
        current.map((item) =>
          item.path === worktreePath
            ? {
                ...item,
                diskUsage,
                diskUsageBytes: diskUsage.total,
                diskUsagePending: false,
              }
            : item,
        ),
      );
    };
    window.electron.ipcRenderer.on(
      'worktree-dashboard-found',
      onDashboardFound,
    );
    window.electron.ipcRenderer.on(
      'worktree-dashboard-disk-usage-found',
      onDiskUsageFound,
    );
    refresh();
    return () => {
      window.electron.ipcRenderer.removeAllListeners(
        'worktree-dashboard-found',
      );
      window.electron.ipcRenderer.removeAllListeners(
        'worktree-dashboard-disk-usage-found',
      );
    };
  }, [refresh]);

  const metrics = useMemo(() => {
    const dirty = items.filter((item) => changeTotal(item) > 0).length;
    return {
      clean: items.length - dirty,
      dirty,
      detached: items.filter((item) => item.isDetached).length,
      staged: items.filter((item) => item.changes.staged > 0).length,
      untracked: items.filter((item) => item.changes.untracked > 0).length,
      disk: items.reduce((total, item) => total + item.diskUsageBytes, 0),
      projectFiles: items.reduce(
        (total, item) => total + item.diskUsage.projectFiles,
        0,
      ),
      dependencies: items.reduce(
        (total, item) => total + item.diskUsage.dependencies,
        0,
      ),
      buildAndCache: items.reduce(
        (total, item) => total + item.diskUsage.buildAndCache,
        0,
      ),
      git: items.reduce((total, item) => total + item.diskUsage.git, 0),
      diskPending: items.some((item) => item.diskUsagePending),
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => filterMatches(item, filter));
  }, [filter, items]);

  const selected = items.find((item) => item.path === selectedPath) || null;
  const cleanPercent = items.length
    ? Math.round((metrics.clean / items.length) * 100)
    : 0;
  const filters: Array<{
    value: StatusFilter;
    label: string;
    count: number;
    icon: React.ReactNode;
  }> = [
    {
      value: 'all',
      label: 'All worktrees',
      count: items.length,
      icon: <AppstoreOutlined />,
    },
    {
      value: 'clean',
      label: 'Clean',
      count: metrics.clean,
      icon: <CheckCircleOutlined />,
    },
    {
      value: 'dirty',
      label: 'Dirty',
      count: metrics.dirty,
      icon: <WarningOutlined />,
    },
    {
      value: 'detached',
      label: 'Detached HEAD',
      count: metrics.detached,
      icon: <DisconnectOutlined />,
    },
    {
      value: 'behind',
      label: 'Behind upstream',
      count: items.filter((item) => item.behind > 0).length,
      icon: <CloudDownloadOutlined />,
    },
    {
      value: 'ahead',
      label: 'Ahead upstream',
      count: items.filter((item) => item.ahead > 0).length,
      icon: <CloudUploadOutlined />,
    },
    {
      value: 'stale',
      label: 'Needs prune',
      count: items.filter((item) => item.needsPrune).length,
      icon: <DeleteOutlined />,
    },
  ];

  const columns: TableColumnsType<WorktreeDashboardItem> = [
    {
      title: 'Worktree',
      key: 'worktree',
      width: '42%',
      sorter: (left, right) => left.name.localeCompare(right.name),
      render: (_, item) => (
        <div className="overview-worktree-cell">
          <Typography.Text strong>{item.name}</Typography.Text>
          <Typography.Text type="secondary" ellipsis title={item.path}>
            {item.path}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: '14%',
      sorter: (left, right) => changeTotal(left) - changeTotal(right),
      render: (_, item) => statusLabel(item),
    },
    {
      title: 'Upstream',
      key: 'upstream',
      width: '20%',
      sorter: (left, right) =>
        left.ahead + left.behind - (right.ahead + right.behind),
      render: (_, item) => (
        <div className="overview-upstream-cell">
          <Typography.Text ellipsis title={item.upstream || undefined}>
            {item.upstream || 'Not configured'}
          </Typography.Text>
          <span>
            <b className="overview-ahead">
              <ArrowUpOutlined /> {item.ahead}
            </b>
            <b className="overview-behind">
              <ArrowDownOutlined /> {item.behind}
            </b>
          </span>
        </div>
      ),
    },
    {
      title: 'Last activity',
      key: 'activity',
      width: '13%',
      sorter: (left, right) =>
        new Date(left.lastActivity || left.latestCommit?.date || 0).getTime() -
        new Date(right.lastActivity || right.latestCommit?.date || 0).getTime(),
      render: (_, item) =>
        relativeTime(item.lastActivity || item.latestCommit?.date),
    },
    {
      title: 'Disk',
      key: 'diskUsage',
      width: '11%',
      sorter: (left, right) => left.diskUsageBytes - right.diskUsageBytes,
      render: (_, item) =>
        item.diskUsagePending ? (
          <Typography.Text
            className="overview-disk-calculating"
            type="secondary"
          >
            Calculating…
          </Typography.Text>
        ) : (
          formatBytes(item.diskUsageBytes)
        ),
    },
  ];

  return (
    <div className="worktree-overview">
      <header className="worktree-overview-title">
        <Space>
          <BranchesOutlined />
          <Typography.Text strong>Overview</Typography.Text>
        </Space>
        <Space>
          <Typography.Text type="secondary">
            {lastUpdated
              ? `Updated ${relativeTime(lastUpdated.toISOString())}`
              : 'Loading'}
          </Typography.Text>
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            Refresh
          </Button>
        </Space>
      </header>

      <div className="worktree-overview-summary">
        <div>
          <strong>{items.length}</strong>
          <span>Total worktrees</span>
        </div>
        <div>
          <strong>
            {items.length - metrics.detached} / {metrics.detached}
          </strong>
          <span>Branches / detached</span>
        </div>
        <div>
          <strong>
            {metrics.clean} / {metrics.dirty}
          </strong>
          <span>Clean / dirty</span>
        </div>
        <div>
          <strong>{metrics.staged}</strong>
          <span>With staged changes</span>
        </div>
        <div>
          <strong>{metrics.untracked}</strong>
          <span>With untracked files</span>
        </div>
        <div>
          <strong>
            {metrics.diskPending ? 'Calculating…' : formatBytes(metrics.disk)}
          </strong>
          <span
            title={`Project ${formatBytes(metrics.projectFiles)}; dependencies ${formatBytes(metrics.dependencies)}; build/cache ${formatBytes(metrics.buildAndCache)}; Git ${formatBytes(metrics.git)}`}
          >
            Worktree files; .git included
          </span>
        </div>
      </div>

      <div className="worktree-overview-workspace">
        <aside className="worktree-overview-filters">
          <Typography.Text strong>Filters</Typography.Text>
          <div className="overview-filter-list">
            {filters.map((option) => (
              <Button
                key={option.value}
                type={filter === option.value ? 'primary' : 'text'}
                onClick={() => setFilter(option.value)}
              >
                <span className="overview-filter-icon">{option.icon}</span>
                <span className="overview-filter-label">{option.label}</span>
                <span className="overview-filter-count">{option.count}</span>
              </Button>
            ))}
          </div>
          <div className="overview-status-chart">
            <Typography.Text strong>Status distribution</Typography.Text>
            <div
              className="overview-donut"
              style={
                { '--clean-percent': `${cleanPercent}%` } as React.CSSProperties
              }
              aria-label={`${cleanPercent}% clean worktrees`}
            >
              <span>
                <strong>{cleanPercent}%</strong>clean
              </span>
            </div>
            <div className="overview-chart-legend">
              <span>
                <i className="clean" />
                Clean {metrics.clean}
              </span>
              <span>
                <i className="dirty" />
                Dirty {metrics.dirty}
              </span>
            </div>
          </div>
        </aside>

        <main className="worktree-overview-table">
          <Table
            size="small"
            rowKey="path"
            pagination={false}
            loading={loading}
            tableLayout="fixed"
            columns={columns}
            dataSource={filteredItems}
            scroll={{ y: 'calc(100vh - 300px)' }}
            locale={{
              emptyText: <Empty description="No matching worktrees" />,
            }}
            onRow={(item) => ({
              onClick: () => setSelectedPath(item.path),
              className: item.path === selectedPath ? 'selected' : '',
            })}
          />
        </main>

        <aside className="worktree-overview-details">
          {!selected ? (
            <Empty description="Select a worktree" />
          ) : (
            <>
              <div className="overview-detail-header">
                <div className="overview-detail-title-row">
                  <Typography.Text strong>{selected.name}</Typography.Text>
                  {statusLabel(selected)}
                </div>
                <Typography.Text
                  className="overview-detail-path"
                  type="secondary"
                  copyable={{ text: selected.path }}
                  ellipsis={{ tooltip: selected.path }}
                >
                  {selected.path}
                </Typography.Text>
              </div>

              {(selected.warning || selected.nudges.length > 0) && (
                <Alert
                  type={selected.needsPrune ? 'error' : 'warning'}
                  showIcon
                  message={selected.warning || 'Recommended attention'}
                  description={selected.nudges.map((nudge) => (
                    <div key={nudge}>{nudge}</div>
                  ))}
                />
              )}

              <section>
                <Typography.Text strong>Health</Typography.Text>
                <div className="overview-health-tags">
                  <Tag color={selected.directoryExists ? 'green' : 'red'}>
                    Directory{' '}
                    {selected.directoryExists ? 'available' : 'missing'}
                  </Tag>
                  {selected.isLocked && <Tag>Locked</Tag>}
                  {selected.isPrimary && <Tag color="blue">Primary</Tag>}
                  {selected.needsPrune && <Tag color="red">Needs prune</Tag>}
                  {selected.isStale && <Tag color="orange">Stale</Tag>}
                </div>
              </section>

              <section>
                <Typography.Text strong>Latest commit</Typography.Text>
                {selected.latestCommit ? (
                  <div className="overview-latest-commit">
                    <Typography.Text>
                      {selected.latestCommit.subject}
                    </Typography.Text>
                    <Typography.Text
                      type="secondary"
                      copyable={{ text: selected.latestCommit.hash }}
                    >
                      <code>{selected.latestCommit.hash.slice(0, 8)}</code> by{' '}
                      {selected.latestCommit.author} -{' '}
                      {relativeTime(selected.latestCommit.date)}
                    </Typography.Text>
                  </div>
                ) : (
                  <Typography.Text type="secondary">No commits</Typography.Text>
                )}
              </section>

              <section>
                <Typography.Text strong>Upstream status</Typography.Text>
                <Typography.Text type="secondary" ellipsis>
                  {selected.upstream || 'No remote-tracking branch'}
                </Typography.Text>
                <div className="overview-divergence">
                  <div>
                    <b>
                      <ArrowUpOutlined />
                      <span>{selected.ahead} ahead</span>
                    </b>
                  </div>
                  <div>
                    <b>
                      <ArrowDownOutlined />
                      <span>{selected.behind} behind</span>
                    </b>
                  </div>
                </div>
                <dl className="overview-facts">
                  <div>
                    <dt>Last fetch</dt>
                    <dd>{relativeTime(selected.lastFetch)}</dd>
                  </div>
                  <div>
                    <dt>Last pull</dt>
                    <dd>{relativeTime(selected.lastPull)}</dd>
                  </div>
                  <div>
                    <dt>Last activity</dt>
                    <dd>{relativeTime(selected.lastActivity)}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <div className="overview-disk-heading">
                  <Typography.Text strong>Disk breakdown</Typography.Text>
                  <Typography.Text strong>
                    {selected.diskUsagePending
                      ? 'Calculating…'
                      : formatBytes(selected.diskUsage.total)}
                  </Typography.Text>
                </div>
                {selected.diskUsagePending ? (
                  <div className="overview-disk-loading">
                    <Spin size="small" />
                    <Typography.Text type="secondary">
                      Measuring files in the background
                    </Typography.Text>
                  </div>
                ) : (
                  <div className="overview-disk-breakdown">
                    {[
                      {
                        label: 'Project files',
                        value: selected.diskUsage.projectFiles,
                        className: 'project',
                      },
                      {
                        label: 'Dependencies',
                        value: selected.diskUsage.dependencies,
                        className: 'dependencies',
                      },
                      {
                        label: 'Build & cache',
                        value: selected.diskUsage.buildAndCache,
                        className: 'build',
                      },
                      {
                        label: 'Git data',
                        value: selected.diskUsage.git,
                        className: 'git',
                      },
                    ].map((category) => (
                      <div key={category.label}>
                        <span className="overview-disk-label">
                          <span>{category.label}</span>
                          <b>{formatBytes(category.value)}</b>
                        </span>
                        <span className="overview-disk-track">
                          <span
                            className={category.className}
                            style={{
                              width: `${selected.diskUsage.total ? (category.value / selected.diskUsage.total) * 100 : 0}%`,
                            }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Typography.Text
                  type="secondary"
                  className="overview-disk-note"
                >
                  Directory totals by folder type. Git data includes the .git
                  folder or linked-worktree pointer file.
                </Typography.Text>
              </section>

              <section>
                <Typography.Text strong>Local changes</Typography.Text>
                <div className="overview-metric-grid">
                  <span>
                    <b>{selected.changes.modified}</b>Modified
                  </span>
                  <span>
                    <b>{selected.changes.unstaged}</b>Unstaged
                  </span>
                  <span>
                    <b>{selected.changes.staged}</b>Staged
                  </span>
                  <span>
                    <b>{selected.changes.untracked}</b>Untracked
                  </span>
                </div>
                {selected.largeUntrackedFiles.map((file) => (
                  <Typography.Text key={file.path} type="warning" ellipsis>
                    Large: {file.path} ({formatBytes(file.sizeBytes)})
                  </Typography.Text>
                ))}
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
