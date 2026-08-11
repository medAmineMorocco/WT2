import { CloseOutlined } from '@ant-design/icons';
import { Button, Spin, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import pako from 'pako';
import {
  Diff2HtmlUI,
  Diff2HtmlUIConfig,
} from 'diff2html/lib/ui/js/diff2html-ui';
import { ColorSchemeType } from 'diff2html/lib/types';
import { style } from 'dynamic-import';
import 'highlight.js/styles/github.min.css';
import 'diff2html/bundles/css/diff2html.min.css';
import { CommitChangedFile } from '../../../shared/gitCommit';
import { useItemsContext } from '../../TabsContext';

const configuration: Diff2HtmlUIConfig = {
  drawFileList: false,
  fileListToggle: false,
  outputFormat: 'side-by-side',
  highlight: true,
  diffMaxChanges: 5000,
};

export default function CommitFileDiffPane({
  commit,
  file,
  repositoryPath,
  onClose,
}: {
  commit: string;
  file: CommitChangedFile;
  repositoryPath: string;
  onClose: () => void;
}) {
  const [patch, setPatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const diffElement = useRef<HTMLDivElement>(null);
  const { isDarkMode } = useItemsContext();

  useEffect(() => {
    let serverPort = Number(window.localStorage.getItem('server-port'));
    if (!serverPort) serverPort = 3201;
    const darkHighlightStyle = `http://localhost:${serverPort}/styles/github-dark.min.css`;
    if (isDarkMode) style.import([darkHighlightStyle]);
    else style.unload([darkHighlightStyle]);
  }, [isDarkMode]);

  const drawDiff = useCallback(
    (contents: string) => {
      if (!diffElement.current) return;
      diffElement.current.innerHTML = '';
      if (!contents) return;
      const ui = new Diff2HtmlUI(diffElement.current, contents, {
        ...configuration,
        colorScheme: isDarkMode ? ColorSchemeType.DARK : ColorSchemeType.LIGHT,
      });
      ui.draw();
      ui.highlightCode();
    },
    [isDarkMode],
  );

  useEffect(() => {
    const onDiff = (code: number, payload: any, requestId: number) => {
      if (requestId !== request.current) return;
      setLoading(false);
      if (code === 0) {
        setPatch(pako.ungzip(payload, { to: 'string' }));
        setError('');
      } else {
        setPatch('');
        setError(payload);
      }
    };
    window.electron.ipcRenderer.on('receive-commit-file-diff', onDiff);
    return () => {
      window.electron.ipcRenderer.removeAllListeners(
        'receive-commit-file-diff',
      );
    };
  }, []);

  useEffect(() => {
    const requestId = request.current + 1;
    request.current = requestId;
    setPatch('');
    setError('');
    setLoading(true);
    window.electron.ipcRenderer.send(
      'get-commit-file-diff',
      requestId,
      commit,
      file.path,
      repositoryPath,
    );
  }, [commit, file.path, repositoryPath]);

  useEffect(() => drawDiff(patch), [drawDiff, patch]);

  return (
    <section className="git-log-file-diff-pane">
      <div className="git-log-file-diff-header">
        <Typography.Text strong ellipsis title={file.path}>
          {file.path}
        </Typography.Text>
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
        {error && <Typography.Text type="danger">{error}</Typography.Text>}
        <div ref={diffElement} className="commit-file-diff-content" />
      </div>
    </section>
  );
}
