import {
  CaretDownOutlined,
  CaretRightOutlined,
  CloseOutlined,
  DownOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  SearchOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { Button, Empty, Input, Segmented, Spin, Tooltip, Typography } from 'antd';
import {
  Diff2HtmlUI,
  Diff2HtmlUIConfig,
} from 'diff2html/lib/ui/js/diff2html-ui';
import { ColorSchemeType } from 'diff2html/lib/types';
import { style } from 'dynamic-import';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github.min.css';
import 'diff2html/bundles/css/diff2html.min.css';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  WorktreeFileChange,
  WorktreeFileEntry,
  WorktreeFilePreview,
  WorktreeFilesSnapshot,
} from '../../../shared/worktreeFiles';

type TreeNode = {
  name: string;
  path: string;
  folders: Map<string, TreeNode>;
  files: WorktreeFileEntry[];
  changedCount: number;
};

function buildTree(files: WorktreeFileEntry[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    folders: new Map(),
    files: [],
    changedCount: 0,
  };
  files.forEach((file) => {
    const segments = file.path.split('/');
    const fileName = segments.pop();
    if (!fileName) return;
    let node = root;
    if (file.change) node.changedCount += 1;
    segments.forEach((segment) => {
      const folderPath = node.path ? `${node.path}/${segment}` : segment;
      if (!node.folders.has(segment)) {
        node.folders.set(segment, {
          name: segment,
          path: folderPath,
          folders: new Map(),
          files: [],
          changedCount: 0,
        });
      }
      node = node.folders.get(segment)!;
      if (file.change) node.changedCount += 1;
    });
    node.files.push(file);
  });
  return root;
}

function changeLabel(change?: WorktreeFileChange) {
  if (change === 'added') return 'A';
  if (change === 'deleted') return 'D';
  if (change === 'modified') return 'M';
  return null;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  bash: 'bash',
  c: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  go: 'go',
  h: 'cpp',
  hpp: 'cpp',
  html: 'xml',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  kt: 'kotlin',
  kts: 'kotlin',
  md: 'markdown',
  php: 'php',
  ps1: 'powershell',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'xml',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
};

function languageForFile(filePath: string, kind: WorktreeFilePreview['kind']) {
  if (kind === 'diff') return 'diff';
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  if (fileName === 'dockerfile') return 'dockerfile';
  if (fileName === 'makefile') return 'makefile';
  const extension = fileName.includes('.') ? fileName.split('.').pop()! : '';
  return LANGUAGE_BY_EXTENSION[extension] || 'plaintext';
}

function highlightedHtml(
  content: string,
  language: string,
  query: string,
): { html: string; matchCount: number } {
  const highlighted = hljs.highlight(content, {
    language: hljs.getLanguage(language) ? language : 'plaintext',
    ignoreIllegals: true,
  }).value;
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return { html: highlighted, matchCount: 0 };

  const container = document.createElement('div');
  container.innerHTML = highlighted;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  let matchIndex = 0;
  textNodes.forEach((textNode) => {
    if (matchIndex >= 5_000) return;
    const text = textNode.data;
    const lowerText = text.toLocaleLowerCase();
    let position = 0;
    let start = lowerText.indexOf(needle, position);
    if (start === -1) return;
    const fragment = document.createDocumentFragment();
    while (start !== -1 && matchIndex < 5_000) {
      if (start > position) fragment.append(text.slice(position, start));
      const mark = document.createElement('mark');
      mark.dataset.fileSearchMatch = String(matchIndex);
      mark.textContent = text.slice(start, start + needle.length);
      fragment.append(mark);
      matchIndex += 1;
      position = start + needle.length;
      start = lowerText.indexOf(needle, position);
    }
    if (position < text.length) fragment.append(text.slice(position));
    textNode.replaceWith(fragment);
  });
  return { html: container.innerHTML, matchCount: matchIndex };
}

function FileNode({
  file,
  depth,
  selected,
  onSelect,
}: {
  file: WorktreeFileEntry;
  depth: number;
  selected: boolean;
  onSelect: (file: WorktreeFileEntry) => void;
}) {
  const fileName = file.path.split('/').pop() || file.path;
  const status = changeLabel(file.change);
  return (
    <button
      type="button"
      className={`worktree-file-row worktree-file-leaf${
        file.change ? ` is-${file.change}` : ''
      }${selected ? ' is-selected' : ''}`}
      style={{ paddingLeft: depth * 14 + 24 }}
      title={file.path}
      aria-label={`Preview ${file.path}`}
      onClick={() => onSelect(file)}
    >
      <FileOutlined />
      <span className="worktree-file-name">{fileName}</span>
      {status && (
        <Tooltip title={`${file.change} file`}>
          <span className="worktree-file-status">{status}</span>
        </Tooltip>
      )}
    </button>
  );
}

function FolderNode({
  node,
  depth,
  expanded,
  toggle,
  selectedPath,
  onFileSelect,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  selectedPath: string | null;
  onFileSelect: (file: WorktreeFileEntry) => void;
}) {
  const isExpanded = expanded.has(node.path);
  const folders = [...node.folders.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const files = [...node.files].sort((a, b) => a.path.localeCompare(b.path));
  return (
    <div className="worktree-file-folder">
      <button
        type="button"
        className="worktree-file-row worktree-folder-row"
        style={{ paddingLeft: depth * 14 + 6 }}
        onClick={() => toggle(node.path)}
        aria-expanded={isExpanded}
        title={node.path}
      >
        {isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        {isExpanded ? <FolderOpenOutlined /> : <FolderOutlined />}
        <span className="worktree-file-name">{node.name}</span>
        {node.changedCount > 0 && (
          <span className="worktree-folder-change-count">
            {node.changedCount}
          </span>
        )}
      </button>
      {isExpanded && (
        <div role="group">
          {folders.map((folder) => (
            <FolderNode
              key={folder.path}
              node={folder}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selectedPath={selectedPath}
              onFileSelect={onFileSelect}
            />
          ))}
          {files.map((file) => (
            <FileNode
              key={file.path}
              file={file}
              depth={depth + 1}
              selected={selectedPath === file.path}
              onSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorktreeFileExplorer({
  worktreePath,
  active,
  isDarkMode,
  children,
  headerAction,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: {
  worktreePath: string;
  active: boolean;
  isDarkMode: boolean;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [snapshot, setSnapshot] = useState<WorktreeFilesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<WorktreeFilePreview | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [diffLayout, setDiffLayout] = useState<'line-by-line' | 'side-by-side'>(
    () => {
      try {
        return window.localStorage.getItem('worktreeFileDiffLayout') ===
          'side-by-side'
          ? 'side-by-side'
          : 'line-by-line';
      } catch {
        return 'line-by-line';
      }
    },
  );
  const [diffMatchCount, setDiffMatchCount] = useState(0);
  const previewContentRef = useRef<HTMLPreElement>(null);
  const diffContentRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (showSpinner = false) => {
      if (!worktreePath) return;
      if (showSpinner) setLoading(true);
      try {
        const next = (await window.electron.ipcRenderer.invoke(
          'get-worktree-files',
          worktreePath,
        )) as WorktreeFilesSnapshot;
        setSnapshot(next);
        setError('');
        setExpanded((current) => {
          if (current.size > 0) return current;
          const initial = new Set<string>();
          next.files.forEach((file) => {
            if (!file.change) return;
            const segments = file.path.split('/');
            segments.pop();
            let folder = '';
            segments.forEach((segment) => {
              folder = folder ? `${folder}/${segment}` : segment;
              initial.add(folder);
            });
          });
          return initial;
        });
      } catch (reason: any) {
        setError(reason?.message || 'Unable to load worktree files.');
      } finally {
        setLoading(false);
      }
    },
    [worktreePath],
  );

  useEffect(() => {
    let serverPort = Number(window.localStorage.getItem('server-port'));
    if (!serverPort) serverPort = 3201;
    const darkStyle = `http://localhost:${serverPort}/styles/github-dark.min.css`;
    if (isDarkMode) style.import([darkStyle]);
    else style.unload([darkStyle]);
  }, [isDarkMode]);

  useEffect(() => {
    load(true);
    if (!active) return undefined;
    const timer = window.setInterval(() => load(false), 2000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  const tree = useMemo(() => buildTree(snapshot?.files || []), [snapshot]);
  const folders = [...tree.folders.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const toggle = (folderPath: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const loadPreview = useCallback(
    async (filePath: string) => {
      setPreviewPath(filePath);
      setPreview(null);
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const next = (await window.electron.ipcRenderer.invoke(
          'get-worktree-file-preview',
          worktreePath,
          filePath,
        )) as WorktreeFilePreview;
        setPreview(next);
      } catch (reason: any) {
        setPreview(null);
        setPreviewError(reason?.message || 'Unable to preview this file.');
      } finally {
        setPreviewLoading(false);
      }
    },
    [worktreePath],
  );

  const closePreview = () => {
    setPreview(null);
    setPreviewPath(null);
    setPreviewError('');
    setSearchQuery('');
    setActiveMatch(0);
  };

  const previewLanguage = preview
    ? languageForFile(preview.path, preview.kind)
    : 'plaintext';
  const highlightedPreview = useMemo(
    () => highlightedHtml(preview?.content || '', previewLanguage, searchQuery),
    [preview?.content, previewLanguage, searchQuery],
  );

  useEffect(() => {
    setActiveMatch(0);
  }, [preview?.content, searchQuery]);

  useEffect(() => {
    const marks = previewContentRef.current?.querySelectorAll(
      '[data-file-search-match]',
    );
    marks?.forEach((mark) => mark.classList.remove('is-active'));
    const activeElement = previewContentRef.current?.querySelector(
      `[data-file-search-match="${activeMatch}"]`,
    );
    activeElement?.classList.add('is-active');
    activeElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [activeMatch, highlightedPreview]);

  useEffect(() => {
    if (preview?.kind !== 'diff' || !diffContentRef.current) {
      setDiffMatchCount(0);
      return;
    }
    const config: Diff2HtmlUIConfig = {
      drawFileList: false,
      fileListToggle: false,
      outputFormat: diffLayout,
      synchronisedScroll: true,
      highlight: true,
      colorScheme: isDarkMode
        ? ColorSchemeType.DARK
        : ColorSchemeType.LIGHT,
    };
    const ui = new Diff2HtmlUI(diffContentRef.current, preview.content, config);
    ui.draw();
    ui.highlightCode();
    if (diffLayout === 'side-by-side') ui.synchronisedScroll();

    const needle = searchQuery.trim().toLocaleLowerCase();
    if (!needle) {
      setDiffMatchCount(0);
      return;
    }
    const walker = document.createTreeWalker(
      diffContentRef.current,
      NodeFilter.SHOW_TEXT,
    );
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    let matchIndex = 0;
    nodes.forEach((textNode) => {
      if (matchIndex >= 5_000) return;
      const text = textNode.data;
      const lowerText = text.toLocaleLowerCase();
      let position = 0;
      let start = lowerText.indexOf(needle);
      if (start < 0) return;
      const fragment = document.createDocumentFragment();
      while (start >= 0 && matchIndex < 5_000) {
        if (start > position) fragment.append(text.slice(position, start));
        const mark = document.createElement('mark');
        mark.dataset.fileSearchMatch = String(matchIndex++);
        mark.textContent = text.slice(start, start + needle.length);
        fragment.append(mark);
        position = start + needle.length;
        start = lowerText.indexOf(needle, position);
      }
      if (position < text.length) fragment.append(text.slice(position));
      textNode.replaceWith(fragment);
    });
    setDiffMatchCount(matchIndex);
  }, [diffLayout, isDarkMode, preview, searchQuery]);

  useEffect(() => {
    if (preview?.kind !== 'diff') return;
    const marks = diffContentRef.current?.querySelectorAll(
      '[data-file-search-match]',
    );
    marks?.forEach((mark) => mark.classList.remove('is-active'));
    const activeElement = diffContentRef.current?.querySelector(
      `[data-file-search-match="${activeMatch}"]`,
    );
    activeElement?.classList.add('is-active');
    activeElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [activeMatch, diffMatchCount, preview?.kind]);

  const currentMatchCount =
    preview?.kind === 'diff'
      ? diffMatchCount
      : highlightedPreview.matchCount;

  const moveMatch = (direction: 1 | -1) => {
    if (!currentMatchCount) return;
    setActiveMatch(
      (current) =>
        (current + direction + currentMatchCount) % currentMatchCount,
    );
  };

  const isCollapsed =
    controlledCollapsed !== undefined ? controlledCollapsed : filesCollapsed;
  const handleToggleCollapse =
    onToggleCollapse || (() => setFilesCollapsed((current) => !current));

  return (
    <div
      className={`worktree-file-layout${isDarkMode ? ' is-dark' : ''}${
        isCollapsed ? ' is-files-collapsed' : ''
      }`}
    >
      <aside className="worktree-file-explorer" aria-label="Worktree files">
        <header className="worktree-file-explorer-header">
          <div>
            <Typography.Text strong>Files</Typography.Text>
            <Typography.Text type="secondary" ellipsis>
              {snapshot?.branch || 'Current worktree'}
            </Typography.Text>
          </div>
          <div className="worktree-file-explorer-actions">
            {Boolean(snapshot?.changedCount) && (
              <Tooltip title="Modified files">
                <span className="worktree-file-change-total">
                  {snapshot?.changedCount}
                </span>
              </Tooltip>
            )}
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={loading} />}
              aria-label="Refresh worktree files"
              onClick={() => load(true)}
            />
            {headerAction}
            <Tooltip title={isCollapsed ? 'Expand files' : 'Collapse files'}>
              <Button
                type="text"
                size="small"
                icon={
                  isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
                }
                aria-label={isCollapsed ? 'Expand files' : 'Collapse files'}
                onClick={handleToggleCollapse}
              />
            </Tooltip>
          </div>
        </header>
        <div className="worktree-file-tree" data-testid="worktree-file-tree">
          {loading && !snapshot ? (
            <div className="worktree-file-state">
              <Spin size="small" />
            </div>
          ) : error ? (
            <div className="worktree-file-state is-error">{error}</div>
          ) : folders.length || tree.files.length ? (
            <>
              {folders.map((folder) => (
                <FolderNode
                  key={folder.path}
                  node={folder}
                  depth={0}
                  expanded={expanded}
                  toggle={toggle}
                  selectedPath={previewPath}
                  onFileSelect={(file) => loadPreview(file.path)}
                />
              ))}
              {tree.files.map((file) => (
                <FileNode
                  key={file.path}
                  file={file}
                  depth={0}
                  selected={previewPath === file.path}
                  onSelect={(selectedFile) => loadPreview(selectedFile.path)}
                />
              ))}
            </>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No files"
            />
          )}
        </div>
      </aside>
      <div className="worktree-file-content-stage">
        {children}
        {previewPath && (
          <section
            className="worktree-file-preview-panel"
            aria-label={`Preview ${previewPath}`}
          >
            <header className="worktree-file-preview-header">
              <div className="worktree-file-preview-title">
                <FileOutlined />
                <span title={previewPath}>{previewPath}</span>
                {preview && (
                  <span className="worktree-file-preview-kind">
                    {preview.kind === 'diff' ? 'Diff' : previewLanguage}
                  </span>
                )}
              </div>
              <div className="worktree-file-preview-actions">
                {preview?.kind === 'diff' && (
                  <Segmented
                    size="small"
                    value={diffLayout}
                    aria-label="Diff layout"
                    options={[
                      { value: 'line-by-line', label: 'Inline' },
                      { value: 'side-by-side', label: 'Split' },
                    ]}
                    onChange={(value) => {
                      const next = value as 'line-by-line' | 'side-by-side';
                      setDiffLayout(next);
                      try {
                        window.localStorage.setItem(
                          'worktreeFileDiffLayout',
                          next,
                        );
                      } catch {}
                    }}
                  />
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined spin={previewLoading} />}
                  aria-label="Refresh file preview"
                  onClick={() => loadPreview(previewPath)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  aria-label="Close file preview"
                  onClick={closePreview}
                />
              </div>
            </header>
            <div className="worktree-file-find-bar">
              <Input
                size="small"
                allowClear
                autoFocus
                prefix={<SearchOutlined />}
                placeholder="Find in file"
                aria-label="Find in file"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  moveMatch(event.shiftKey ? -1 : 1);
                }}
              />
              <span className="worktree-file-find-count">
                {searchQuery.trim()
                  ? `${currentMatchCount ? activeMatch + 1 : 0} of ${currentMatchCount}`
                  : '0 of 0'}
              </span>
              <Button
                type="text"
                size="small"
                icon={<UpOutlined />}
                aria-label="Previous match"
                disabled={!currentMatchCount}
                onClick={() => moveMatch(-1)}
              />
              <Button
                type="text"
                size="small"
                icon={<DownOutlined />}
                aria-label="Next match"
                disabled={!currentMatchCount}
                onClick={() => moveMatch(1)}
              />
            </div>
            {previewLoading && !preview ? (
              <div className="worktree-file-preview-state">
                <Spin />
              </div>
            ) : previewError ? (
              <div className="worktree-file-preview-state is-error">
                {previewError}
              </div>
            ) : preview ? (
              <>
                {preview.kind === 'diff' ? (
                  <div
                    ref={diffContentRef}
                    className="worktree-file-preview-content worktree-file-diff-content"
                    aria-label={`Diff for ${preview.path}`}
                  />
                ) : (
                  <pre
                  ref={previewContentRef}
                  className={`worktree-file-preview-content is-${preview.kind}`}
                  aria-label={`${preview.kind === 'diff' ? 'Diff' : 'Content'} for ${preview.path}`}
                >
                  <code
                    className={`hljs language-${previewLanguage}`}
                    // highlight.js escapes source text before producing markup.
                    // Search marks are then added through DOM text nodes only.
                    dangerouslySetInnerHTML={{
                      __html: highlightedPreview.html,
                    }}
                  />
                  </pre>
                )}
                {preview.truncated && (
                  <div className="worktree-file-preview-truncated">
                    Preview truncated because this file is large.
                  </div>
                )}
              </>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
