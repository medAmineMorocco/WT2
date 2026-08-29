import { CloseOutlined } from '@ant-design/icons';
import { Button, Spin, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Diff2HtmlUI,
  Diff2HtmlUIConfig,
} from 'diff2html/lib/ui/js/diff2html-ui';
import { ColorSchemeType } from 'diff2html/lib/types';
import { style } from 'dynamic-import';
import 'highlight.js/styles/github.min.css';
import 'diff2html/bundles/css/diff2html.min.css';
import { WorkingTreeFile } from '../../../shared/workingTree';
import { useItemsContext } from '../../TabsContext';

const configuration: Diff2HtmlUIConfig = {
  drawFileList: false,
  fileListToggle: false,
  outputFormat: 'side-by-side',
  highlight: true,
  diffMaxChanges: 5000,
};

export type SelectedWorkingTreeFile = {
  file: WorkingTreeFile;
  staged: boolean;
};

export default function WorkingTreeFileDiffPane({
  selection,
  repositoryPath,
  onClose,
  onChanged,
}: {
  selection: SelectedWorkingTreeFile;
  repositoryPath: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [patch, setPatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const diffElement = useRef<HTMLDivElement>(null);
  const silentRefresh = useRef(false);
  const { isDarkMode } = useItemsContext();

  useEffect(() => {
    let serverPort = Number(window.localStorage.getItem('server-port'));
    if (!serverPort) serverPort = 3201;
    const darkStyle = `http://localhost:${serverPort}/styles/github-dark.min.css`;
    if (isDarkMode) style.import([darkStyle]);
    else style.unload([darkStyle]);
  }, [isDarkMode]);

  useEffect(() => {
    let cancelled = false;
    const silent = silentRefresh.current;
    silentRefresh.current = false;
    if (!silent) setLoading(true);
    if (!silent) setPatch('');
    setError('');
    const load = async () => {
      try {
        const contents = await window.electron.ipcRenderer.invoke(
          'get-working-tree-file-diff',
          repositoryPath,
          selection.file.path,
          selection.staged,
          selection.file.untracked,
        );
        if (!cancelled) {
          if (contents.trim()) setPatch(contents);
          else onClose();
        }
      } catch (reason: any) {
        if (!cancelled) setError(reason?.message || String(reason));
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [onClose, repositoryPath, revision, selection]);

  useEffect(() => {
    let cancelled = false;
    let requestInProgress = false;

    const refreshPatchSilently = async () => {
      if (requestInProgress) return;
      requestInProgress = true;
      try {
        const contents = await window.electron.ipcRenderer.invoke(
          'get-working-tree-file-diff',
          repositoryPath,
          selection.file.path,
          selection.staged,
          selection.file.untracked,
        );
        if (!cancelled) {
          if (!contents.trim()) onClose();
          else
            setPatch((current) => (current === contents ? current : contents));
        }
      } catch {
        // Keep the currently rendered diff during a transient refresh failure.
      } finally {
        requestInProgress = false;
      }
    };

    const interval = window.setInterval(refreshPatchSilently, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [onClose, repositoryPath, selection]);

  const linePatches = useCallback((contents: string) => {
    const lines = contents.split(/\r?\n/);
    const fileHeader: string[] = [];
    const result: Array<{
      patch: string;
      kind: 'add' | 'delete';
      line: string;
      oldLine: number;
      newLine: number;
      header: string;
    }> = [];
    let oldLine = 0;
    let newLine = 0;
    let inHunk = false;
    lines.forEach((line) => {
      if (!inHunk && !line.startsWith('@@')) {
        fileHeader.push(line);
        return;
      }
      if (line.startsWith('@@')) {
        const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = Number(match[1]);
          newLine = Number(match[2]);
          inHunk = true;
        }
        return;
      }
      if (!inHunk) return;
      if (line.startsWith('-') && !line.startsWith('---')) {
        result.push({
          kind: 'delete',
          line,
          oldLine,
          newLine,
          header: fileHeader.join('\n'),
          patch: `${fileHeader.join('\n')}\n@@ -${oldLine},1 +${Math.max(0, newLine - 1)},0 @@\n${line}\n`,
        });
        oldLine += 1;
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        result.push({
          kind: 'add',
          line,
          oldLine,
          newLine,
          header: fileHeader.join('\n'),
          patch: `${fileHeader.join('\n')}\n@@ -${Math.max(0, oldLine - 1)},0 +${newLine},1 @@\n${line}\n`,
        });
        newLine += 1;
      } else if (line.startsWith(' ')) {
        oldLine += 1;
        newLine += 1;
      }
    });
    return result;
  }, []);

  const drawDiff = useCallback(() => {
    if (!diffElement.current) return () => undefined;
    diffElement.current.innerHTML = '';
    if (!patch) return () => undefined;
    const ui = new Diff2HtmlUI(diffElement.current, patch, {
      ...configuration,
      colorScheme: isDarkMode ? ColorSchemeType.DARK : ColorSchemeType.LIGHT,
    });
    ui.draw();
    ui.highlightCode();
    const diffRoot = diffElement.current;
    let synchronizingScroll = false;
    let scrollFrame: number | null = null;
    const synchronizeScroll = (event: Event) => {
      if (synchronizingScroll || !(event.target instanceof HTMLElement)) return;
      const source = event.target;
      const sourceSide = source.closest<HTMLElement>('.d2h-file-side-diff');
      if (!sourceSide) return;
      const sides = Array.from(
        diffRoot.querySelectorAll<HTMLElement>('.d2h-file-side-diff'),
      );
      const targetSide = sides.find((side) => side !== sourceSide);
      if (!targetSide) return;

      const sourceIsCodeWrapper = source.matches('.d2h-code-wrapper');
      const target = sourceIsCodeWrapper
        ? targetSide.querySelector<HTMLElement>('.d2h-code-wrapper')
        : targetSide;
      if (!target) return;

      synchronizingScroll = true;
      target.scrollLeft = source.scrollLeft;
      target.scrollTop = source.scrollTop;
      if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        synchronizingScroll = false;
        scrollFrame = null;
      });
    };
    diffRoot.addEventListener('scroll', synchronizeScroll, {
      capture: true,
      passive: true,
    });
    const fileStatus = selection.staged
      ? selection.file.indexStatus
      : selection.file.worktreeStatus;
    if (selection.file.untracked || fileStatus === 'A' || fileStatus === 'D') {
      return () => {
        diffRoot.removeEventListener('scroll', synchronizeScroll, true);
        if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
      };
    }
    const root = diffElement.current;
    const changes = linePatches(patch);
    const additions = changes.filter(({ kind }) => kind === 'add');
    const deletions = changes.filter(({ kind }) => kind === 'delete');
    const attachLineActions = () => {
      const addCells = Array.from(
        root.querySelectorAll<HTMLElement>(
          'td.d2h-ins:not(.d2h-code-side-linenumber)',
        ),
      ).filter((cell) => cell.querySelector('.d2h-code-line-ctn'));
      const deleteCells = Array.from(
        root.querySelectorAll<HTMLElement>(
          'td.d2h-del:not(.d2h-code-side-linenumber)',
        ),
      ).filter((cell) => cell.querySelector('.d2h-code-line-ctn'));
      const cellsAndChanges = [
        ...deleteCells.map((cell, index) => ({
          cell,
          change: deletions[index],
        })),
        ...addCells.map((cell, index) => ({
          cell,
          change: additions[index],
        })),
      ];
      const changeByCell = new Map(
        cellsAndChanges.map(({ cell, change }) => [cell, change]),
      );
      cellsAndChanges.forEach(({ cell, change }) => {
        if (!change || cell.querySelector('.working-tree-line-action')) return;
        const actionHost =
          cell.querySelector<HTMLElement>('.d2h-code-line-ctn') || cell;
        const patchForChange = () => {
          const row = cell.closest<HTMLTableRowElement>('tr');
          const table = row?.closest<HTMLTableElement>('table');
          const tables = Array.from(root.querySelectorAll('table'));
          const otherTable = tables.find((candidate) => candidate !== table);
          const otherRow =
            row && otherTable
              ? otherTable.querySelectorAll('tr')[row.rowIndex]
              : null;
          const otherCell = otherRow?.querySelector<HTMLElement>(
            'td.d2h-ins:not(.d2h-code-side-linenumber), td.d2h-del:not(.d2h-code-side-linenumber)',
          );
          const pairedChange = otherCell
            ? changeByCell.get(otherCell)
            : undefined;
          if (pairedChange && pairedChange.kind !== change.kind) {
            const deletion = change.kind === 'delete' ? change : pairedChange;
            const addition = change.kind === 'add' ? change : pairedChange;
            return `${deletion.header}\n@@ -${deletion.oldLine},1 +${addition.newLine},1 @@\n${deletion.line}\n${addition.line}\n`;
          }
          return change.patch;
        };
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `working-tree-line-action ${
          selection.staged ? 'unstage-line' : 'stage-line'
        }`;
        button.textContent = selection.staged ? '−' : '+';
        button.title = selection.staged
          ? 'Unstage this line'
          : 'Stage this line';
        button.setAttribute(
          'aria-label',
          selection.staged ? 'Unstage this line' : 'Stage this line',
        );
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          button.disabled = true;
          try {
            await window.electron.ipcRenderer.invoke(
              'apply-working-tree-line',
              repositoryPath,
              patchForChange(),
              selection.staged,
            );
            onChanged();
            silentRefresh.current = true;
            setRevision((value) => value + 1);
          } catch (reason: any) {
            setError(reason?.message || String(reason));
            button.disabled = false;
          }
        });
        actionHost.prepend(button);
        if (!selection.staged) {
          const discardButton = document.createElement('button');
          discardButton.type = 'button';
          discardButton.className = 'working-tree-line-action discard-line';
          discardButton.textContent = '↶';
          discardButton.title = 'Discard this line';
          discardButton.setAttribute('aria-label', 'Discard this line');
          discardButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!window.confirm('Discard this unstaged line permanently?')) {
              return;
            }
            discardButton.disabled = true;
            try {
              await window.electron.ipcRenderer.invoke(
                'discard-working-tree-line',
                repositoryPath,
                patchForChange(),
              );
              onChanged();
              silentRefresh.current = true;
              setRevision((value) => value + 1);
            } catch (reason: any) {
              setError(reason?.message || String(reason));
              discardButton.disabled = false;
            }
          });
          actionHost.prepend(discardButton);
        }
      });
    };
    const observer = new MutationObserver(attachLineActions);
    observer.observe(root, { childList: true, subtree: true });
    const animationFrame = window.requestAnimationFrame(attachLineActions);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      diffRoot.removeEventListener('scroll', synchronizeScroll, true);
      if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
    };
  }, [isDarkMode, linePatches, onChanged, patch, repositoryPath, selection]);

  useEffect(drawDiff, [drawDiff]);

  return (
    <section className="git-log-file-diff-pane">
      <div className="git-log-file-diff-header">
        <div className="working-tree-diff-title">
          <Typography.Text strong ellipsis title={selection.file.path}>
            {selection.file.path}
          </Typography.Text>
          <Typography.Text type="secondary">
            {selection.staged ? 'Staged changes' : 'Unstaged changes'}
          </Typography.Text>
        </div>
        <Button
          type="text"
          aria-label="Close file diff"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </div>
      <div className="git-log-file-diff-body">
        {loading && (
          <div className="git-log-file-diff-loading">
            <Spin size="large" />
          </div>
        )}
        {!loading && !error && !patch && (
          <Typography.Text type="secondary">
            No diff to display.
          </Typography.Text>
        )}
        {error && <Typography.Text type="danger">{error}</Typography.Text>}
        <div ref={diffElement} className="commit-file-diff-content" />
      </div>
    </section>
  );
}
