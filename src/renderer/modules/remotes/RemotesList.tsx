import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Space,
  Button,
  Tooltip,
  Dropdown,
  Spin,
  Collapse,
  App as AntdApp,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  SyncOutlined,
  MoreOutlined,
  FolderOutlined,
  BranchesOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DownOutlined,
  RightOutlined,
  GlobalOutlined,
  GithubOutlined,
  GitlabOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { GitRemote } from '../../../shared/gitRemote';
import AddRemoteModal, { BitbucketIcon, AzureDevOpsIcon } from './AddRemoteModal';
import EditRemoteModal from './EditRemoteModal';
import './Remotes.css';

interface BranchNode {
  key: string;
  title: string;
  isFolder?: boolean;
  children?: BranchNode[];
}

function buildBranchTree(branches: string[], prefix = ''): BranchNode[] {
  const folders = new Map<string, string[]>();
  const leaves: string[] = [];

  for (const b of branches) {
    const slashIdx = b.indexOf('/');
    if (slashIdx !== -1) {
      const folder = b.slice(0, slashIdx);
      const rest = b.slice(slashIdx + 1);
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder)!.push(rest);
    } else {
      leaves.push(b);
    }
  }

  const result: BranchNode[] = [];
  for (const [folder, subBranches] of folders.entries()) {
    const fullKey = prefix ? `${prefix}/${folder}` : folder;
    result.push({
      key: fullKey,
      title: folder,
      isFolder: true,
      children: buildBranchTree(subBranches, fullKey),
    });
  }

  for (const leaf of leaves) {
    const fullKey = prefix ? `${prefix}/${leaf}` : leaf;
    result.push({
      key: fullKey,
      title: leaf,
      isFolder: false,
    });
  }

  return result;
}

function getProviderIcon(url: string) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('github.com')) {
    return <GithubOutlined className="remote-provider-icon github" />;
  }
  if (lower.includes('gitlab.com')) {
    return <GitlabOutlined className="remote-provider-icon gitlab" />;
  }
  if (lower.includes('bitbucket.org')) {
    return <BitbucketIcon />;
  }
  if (lower.includes('dev.azure.com') || lower.includes('visualstudio.com')) {
    return <AzureDevOpsIcon />;
  }
  return <GlobalOutlined className="remote-provider-icon url" />;
}

export default function RemotesList({
  repositoryPath,
  isDarkMode,
  activeKey,
  onChangeActiveKey,
}: {
  repositoryPath: string;
  isDarkMode: boolean;
  activeKey?: string[];
  onChangeActiveKey?: (keys: string[]) => void;
}) {
  const { notification, modal } = AntdApp.useApp();
  const [internalActiveKey, setInternalActiveKey] = useState<string[]>(['remotes']);
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingRemote, setFetchingRemote] = useState<string | null>(null);
  const [expandedRemotes, setExpandedRemotes] = useState<Record<string, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [hiddenRemotes, setHiddenRemotes] = useState<Record<string, boolean>>({});
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRemote, setEditingRemote] = useState<GitRemote | null>(null);

  const currentActiveKey = activeKey !== undefined ? activeKey : internalActiveKey;

  const handleActiveKeyChange = (keys: string | string[]) => {
    const normalized = Array.isArray(keys) ? keys : keys ? [keys] : [];
    if (onChangeActiveKey) {
      onChangeActiveKey(normalized);
    } else {
      setInternalActiveKey(normalized);
    }
  };

  const loadRemotes = useCallback(async () => {
    if (!repositoryPath) return;
    setLoading(true);
    try {
      const data: GitRemote[] = await window.electron.ipcRenderer.invoke(
        'get-remotes',
        repositoryPath,
      );
      setRemotes(data || []);
      // Expand all remotes by default
      setExpandedRemotes((prev) => {
        const next = { ...prev };
        data.forEach((r) => {
          if (next[r.name] === undefined) {
            next[r.name] = true;
          }
        });
        return next;
      });
    } catch (err: any) {
      const clean = (err?.message || String(err)).replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        '',
      );
      notification.error({
        message: 'Failed to load remotes',
        description: clean,
        placement: 'bottomLeft',
      });
    } finally {
      setLoading(false);
    }
  }, [repositoryPath, notification]);

  useEffect(() => {
    loadRemotes();
  }, [loadRemotes]);

  const totalBranchesCount = useMemo(() => {
    return remotes.reduce((acc, r) => acc + (r.branches?.length || 0), 0);
  }, [remotes]);

  const toggleRemoteExpand = (name: string) => {
    setExpandedRemotes((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleFolderExpand = (folderKey: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderKey]: !prev[folderKey] }));
  };

  const toggleHide = (name: string) => {
    setHiddenRemotes((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleFetch = async (name: string) => {
    setFetchingRemote(name);
    try {
      const output = await window.electron.ipcRenderer.invoke(
        'fetch-remote',
        repositoryPath,
        name,
      );
      notification.success({
        message: `Fetch complete (${name})`,
        description: output || `Fetched latest refs from ${name}.`,
        placement: 'bottomLeft',
      });
      loadRemotes();
    } catch (err: any) {
      const clean = (err?.message || String(err)).replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        '',
      );
      notification.error({
        message: `Fetch failed (${name})`,
        description: clean,
        placement: 'bottomLeft',
      });
    } finally {
      setFetchingRemote(null);
    }
  };

  const handleRemove = (name: string) => {
    modal.confirm({
      title: `Remove remote "${name}"?`,
      content: `Are you sure you want to remove remote "${name}"? This removes remote-tracking branches and configuration for this remote.`,
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await window.electron.ipcRenderer.invoke(
            'remove-remote',
            repositoryPath,
            name,
          );
          notification.success({
            message: 'Remote removed',
            description: `Remote "${name}" was successfully removed.`,
            placement: 'bottomLeft',
          });
          loadRemotes();
        } catch (err: any) {
          const clean = (err?.message || String(err)).replace(
            /^Error invoking remote method '[^']+': (?:Error: )?/,
            '',
          );
          notification.error({
            message: 'Failed to remove remote',
            description: clean,
            placement: 'bottomLeft',
          });
        }
      },
    });
  };

  const handleCopyLink = (remote: GitRemote) => {
    const url = remote.fetchUrl || remote.pushUrl;
    if (url) {
      navigator.clipboard.writeText(url);
      notification.info({
        message: 'Link copied',
        description: `Copied "${url}" to clipboard.`,
        placement: 'bottomLeft',
        duration: 2,
      });
    }
  };

  const renderBranchNodes = (nodes: BranchNode[], depth = 1): React.ReactNode => {
    return (
      <div className="remote-branches-list" style={{ paddingLeft: depth * 14 }}>
        {nodes.map((node) => {
          if (node.isFolder) {
            const isOpen = expandedFolders[node.key] ?? true;
            return (
              <div key={node.key} className="remote-branch-folder-container">
                <div
                  className="remote-branch-folder-item"
                  onClick={() => toggleFolderExpand(node.key)}
                >
                  <span className="remote-folder-caret">
                    {isOpen ? <DownOutlined /> : <RightOutlined />}
                  </span>
                  <FolderOutlined className="remote-folder-icon" />
                  <span className="remote-folder-title">{node.title}</span>
                </div>
                {isOpen && node.children && renderBranchNodes(node.children, depth + 1)}
              </div>
            );
          }
          return (
            <div key={node.key} className="remote-branch-leaf-item">
              <BranchesOutlined className="remote-branch-icon" />
              <span className="remote-branch-title">{node.title}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getContextMenuItems = (remote: GitRemote): MenuProps['items'] => [
    {
      key: 'fetch',
      label: `Fetch ${remote.name}`,
      onClick: () => handleFetch(remote.name),
    },
    {
      type: 'divider',
    },
    {
      key: 'edit',
      label: `Edit ${remote.name}`,
      onClick: () => setEditingRemote(remote),
    },
    {
      key: 'remove',
      label: `Remove ${remote.name}`,
      danger: true,
      onClick: () => handleRemove(remote.name),
    },
    {
      type: 'divider',
    },
    {
      key: 'hide',
      label: hiddenRemotes[remote.name] ? `Unhide ${remote.name}` : `Hide ${remote.name}`,
      onClick: () => toggleHide(remote.name),
    },
    {
      key: 'copy',
      label: `Copy link to remote: ${remote.name}`,
      onClick: () => handleCopyLink(remote),
    },
  ];

  return (
    <div className={`remotes-container ${isDarkMode ? 'dark' : 'light'}`}>
      <Collapse
        ghost
        activeKey={currentActiveKey}
        onChange={handleActiveKeyChange}
        className="sidebar-section-collapse"
      >
        <Collapse.Panel
          key="remotes"
          className="worktrees-panel-header"
          header={
            <Space size={6} className="remotes-header-title">
              <strong className="remotes-title-text">REMOTE</strong>
              {totalBranchesCount > 0 && (
                <span className="remotes-count-badge">{totalBranchesCount}</span>
              )}
            </Space>
          }
          extra={
            <Space style={{ marginRight: '6px' }} onClick={(e) => e.stopPropagation()}>
              {!loading ? (
                <Tooltip
                  title={
                    <Space>
                      <span>Refresh Remotes</span>
                    </Space>
                  }
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <SyncOutlined
                    className="icon-action"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      loadRemotes();
                    }}
                  />
                </Tooltip>
              ) : (
                <LoadingOutlined />
              )}
              <Tooltip
                title={
                  <Space>
                    <span>Add Remote</span>
                  </Space>
                }
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <PlusOutlined
                  className="icon-action"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddModalOpen(true);
                  }}
                />
              </Tooltip>
            </Space>
          }
        >
          <div className="remotes-body remotes-body-scrollable">
            {loading && remotes.length === 0 ? (
              <div className="remotes-loading">
                <Spin size="small" />
              </div>
        ) : remotes.length === 0 ? (
          <div className="remotes-empty">
            <span className="remotes-empty-text">No remotes configured</span>
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setAddModalOpen(true)}
            >
              Add Remote
            </Button>
          </div>
        ) : (
          <div className="remotes-tree">
            {remotes.map((remote) => {
              const isExpanded = expandedRemotes[remote.name] ?? true;
              const isHidden = hiddenRemotes[remote.name];
              const isFetching = fetchingRemote === remote.name;
              const branchTree = buildBranchTree(remote.branches || []);

              return (
                <div
                  key={remote.name}
                  className={`remote-node ${isHidden ? 'hidden-remote' : ''}`}
                >
                  <div className="remote-node-row">
                    <span
                      className="remote-caret"
                      onClick={() => toggleRemoteExpand(remote.name)}
                    >
                      {isExpanded ? <DownOutlined /> : <RightOutlined />}
                    </span>

                    <Tooltip
                      title={isHidden ? 'Hidden' : 'Visible'}
                      mouseEnterDelay={0.5}
                    >
                      <span
                        className="remote-eye-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHide(remote.name);
                        }}
                      >
                        {isHidden ? (
                          <EyeInvisibleOutlined style={{ color: '#8c8c8c' }} />
                        ) : (
                          <EyeOutlined style={{ color: '#2ea043' }} />
                        )}
                      </span>
                    </Tooltip>

                    <span className="remote-provider-wrap">
                      {getProviderIcon(remote.fetchUrl || remote.pushUrl)}
                    </span>

                    <span
                      className="remote-name"
                      onClick={() => toggleRemoteExpand(remote.name)}
                      title={`${remote.name} (${remote.fetchUrl})`}
                    >
                      {remote.name}
                    </span>

                    {isFetching ? (
                      <LoadingOutlined style={{ fontSize: 12, marginRight: 6 }} />
                    ) : (
                      <Dropdown
                        menu={{ items: getContextMenuItems(remote) }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<MoreOutlined />}
                          className="remote-kebab-btn"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Dropdown>
                    )}
                  </div>

                  {isExpanded && !isHidden && (
                    <div className="remote-node-children">
                      {branchTree.length > 0 ? (
                        renderBranchNodes(branchTree, 1)
                      ) : (
                        <div className="remote-no-branches">
                          <span>No remote branches</span>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => handleFetch(remote.name)}
                          >
                            Fetch
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
        </Collapse.Panel>
      </Collapse>

      <AddRemoteModal
        open={addModalOpen}
        repositoryPath={repositoryPath}
        onClose={() => setAddModalOpen(false)}
        onAdded={loadRemotes}
      />

      <EditRemoteModal
        open={Boolean(editingRemote)}
        remote={editingRemote}
        repositoryPath={repositoryPath}
        onClose={() => setEditingRemote(null)}
        onUpdated={loadRemotes}
      />
    </div>
  );
}
