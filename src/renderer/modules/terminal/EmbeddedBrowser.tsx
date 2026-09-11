import {
  ArrowRightOutlined,
  ExportOutlined,
  HomeOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { Button, Input, Tooltip } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_BROWSER_URL = 'http://localhost:3000';
const MIN_ZOOM_FACTOR = 0.5;
const MAX_ZOOM_FACTOR = 2;
const ZOOM_STEP = 0.1;
const EMBEDDED_SCROLLBAR_CSS = `
  * {
    scrollbar-color: #bfbfbf transparent;
    scrollbar-width: thin;
  }
  *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  *::-webkit-scrollbar-track {
    background: transparent;
  }
  *::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 4px;
    background: #bfbfbf;
    background-clip: padding-box;
  }
  *::-webkit-scrollbar-thumb:hover {
    background: #999999;
    background-clip: padding-box;
  }
`;

type EmbeddedWebviewElement = HTMLElement & {
  getZoomFactor: () => number;
  insertCSS: (css: string) => Promise<string>;
  reload: () => void;
  setZoomFactor: (factor: number) => void;
};

type WebviewNavigationEvent = Event & {
  url?: string;
};

type WebviewLoadErrorEvent = Event & {
  errorCode?: number;
  errorDescription?: string;
  validatedURL?: string;
};

function normalizeBrowserUrl(value: string) {
  const candidate = value.trim();
  if (!candidate) throw new Error('Enter a URL to preview.');
  const isLocalAddress =
    /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::|\/|$)/i.test(candidate);
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(candidate)
    ? candidate
    : `${isLocalAddress ? 'http' : 'https'}://${candidate}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs can be previewed.');
  }
  if (parsed.origin === window.location.origin) {
    throw new Error('The WorktreeWise application itself cannot be embedded.');
  }
  return parsed.toString();
}

function getBrowserPartition(worktreePath: string) {
  let hash = 2166136261;
  for (let index = 0; index < worktreePath.length; index += 1) {
    hash ^= worktreePath.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `persist:worktreewise-browser-${(hash >>> 0).toString(36)}`;
}

export default function EmbeddedBrowser({
  worktreePath,
}: {
  worktreePath: string;
}) {
  const storageKey = useMemo(
    () => `terminal-browser-url:${worktreePath}`,
    [worktreePath],
  );
  const browserPartition = useMemo(
    () => getBrowserPartition(worktreePath),
    [worktreePath],
  );
  const [url, setUrl] = useState(
    () => window.localStorage.getItem(storageKey) || DEFAULT_BROWSER_URL,
  );
  const [address, setAddress] = useState(url);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoomFactor, setZoomFactor] = useState(1);
  const webviewRef = useRef<EmbeddedWebviewElement | null>(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return undefined;

    const handleStartLoading = () => {
      setLoading(true);
      setError('');
    };
    const handleStopLoading = () => setLoading(false);
    const handleDomReady = () => {
      void webview.insertCSS(EMBEDDED_SCROLLBAR_CSS).catch(() => undefined);
      setZoomFactor(webview.getZoomFactor());
    };
    const handleNavigation = (event: Event) => {
      const nextUrl = (event as WebviewNavigationEvent).url;
      if (!nextUrl) return;
      setAddress(nextUrl);
      setUrl(nextUrl);
      window.localStorage.setItem(storageKey, nextUrl);
    };
    const handleLoadError = (event: Event) => {
      const loadError = event as WebviewLoadErrorEvent;
      // ERR_ABORTED is emitted for harmless redirects and cancelled navigations.
      if (loadError.errorCode === -3) return;
      setLoading(false);
      setError(
        loadError.errorDescription
          ? `The page could not load: ${loadError.errorDescription}`
          : 'The page could not load this URL.',
      );
    };

    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-navigate', handleNavigation);
    webview.addEventListener('did-navigate-in-page', handleNavigation);
    webview.addEventListener('did-fail-load', handleLoadError);

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-navigate', handleNavigation);
      webview.removeEventListener('did-navigate-in-page', handleNavigation);
      webview.removeEventListener('did-fail-load', handleLoadError);
    };
  }, [revision, storageKey]);

  const navigate = (target: string) => {
    try {
      const normalized = normalizeBrowserUrl(target);
      setAddress(normalized);
      setUrl(normalized);
      setLoading(true);
      setError('');
      window.localStorage.setItem(storageKey, normalized);
    } catch (reason: any) {
      setError(reason?.message || 'Enter a valid URL.');
    }
  };

  const reload = () => {
    setLoading(true);
    setError('');
    if (webviewRef.current) {
      webviewRef.current.reload();
    } else {
      setRevision((current) => current + 1);
    }
  };

  const changeZoom = (difference: number) => {
    const webview = webviewRef.current;
    if (!webview) return;
    const nextZoom = Math.min(
      MAX_ZOOM_FACTOR,
      Math.max(
        MIN_ZOOM_FACTOR,
        Number((webview.getZoomFactor() + difference).toFixed(1)),
      ),
    );
    webview.setZoomFactor(nextZoom);
    setZoomFactor(nextZoom);
  };

  return (
    <section className="terminal-browser" aria-label="Embedded browser">
      <header className="terminal-browser-toolbar">
        <Tooltip title="Open default localhost URL">
          <Button
            type="text"
            size="small"
            icon={<HomeOutlined />}
            aria-label="Open browser home"
            onClick={() => navigate(DEFAULT_BROWSER_URL)}
          />
        </Tooltip>
        <Tooltip title="Reload preview">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={loading} />}
            aria-label="Reload browser preview"
            onClick={reload}
          />
        </Tooltip>
        <Input
          size="small"
          value={address}
          status={error ? 'error' : undefined}
          aria-label="Browser address"
          placeholder="http://localhost:3000"
          onChange={(event) => setAddress(event.target.value)}
          onPressEnter={() => navigate(address)}
        />
        <Tooltip title="Navigate">
          <Button
            type="primary"
            size="small"
            icon={<ArrowRightOutlined />}
            aria-label="Navigate to browser address"
            onClick={() => navigate(address)}
          />
        </Tooltip>
        <Tooltip title={`Zoom out (${Math.round(zoomFactor * 100)}%)`}>
          <Button
            type="text"
            size="small"
            icon={<ZoomOutOutlined />}
            aria-label="Zoom browser page out"
            disabled={zoomFactor <= MIN_ZOOM_FACTOR}
            onClick={() => changeZoom(-ZOOM_STEP)}
          />
        </Tooltip>
        <Tooltip title={`Zoom in (${Math.round(zoomFactor * 100)}%)`}>
          <Button
            type="text"
            size="small"
            icon={<ZoomInOutlined />}
            aria-label="Zoom browser page in"
            disabled={zoomFactor >= MAX_ZOOM_FACTOR}
            onClick={() => changeZoom(ZOOM_STEP)}
          />
        </Tooltip>
        <Tooltip title="Open in system browser">
          <Button
            type="text"
            size="small"
            icon={<ExportOutlined />}
            aria-label="Open preview in system browser"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          />
        </Tooltip>
      </header>
      {error && <div className="terminal-browser-error">{error}</div>}
      <div className="terminal-browser-viewport">
        {React.createElement('webview', {
          key: `${browserPartition}-${revision}`,
          ref: (node: EmbeddedWebviewElement | null) => {
            webviewRef.current = node;
          },
          src: url,
          className: 'terminal-browser-webview',
          partition: browserPartition,
          webpreferences: 'contextIsolation=yes,nodeIntegration=no,sandbox=yes',
          'aria-label': `Browser preview for ${worktreePath}`,
        })}
      </div>
    </section>
  );
}
