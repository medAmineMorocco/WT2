import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useItemsContext } from '../../TabsContext';

interface TerminalUIProps {
  output?: string;
  style?: React.CSSProperties;
  className?: string;
}

function getTerminalTheme(isDarkMode: boolean) {
  return isDarkMode
    ? {
        background: '#0f0f0f',
        foreground: '#f0f0f0',
        cursor: 'transparent',
        selectionBackground: '#1668dc66',
        black: '#1e1e1e',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#d0d7de',
        brightBlack: '#6e7681',
        brightRed: '#ff7b72',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#ffffff',
      }
    : {
        background: '#ffffff',
        foreground: '#1f1f1f',
        cursor: 'transparent',
        selectionBackground: '#1677ff33',
        black: '#24292f',
        red: '#cf222e',
        green: '#1a7f37',
        yellow: '#9a6700',
        blue: '#0969da',
        magenta: '#8250df',
        cyan: '#1b7c83',
        white: '#ffffff',
        brightBlack: '#656d76',
        brightRed: '#a40e26',
        brightGreen: '#116329',
        brightYellow: '#4d2d00',
        brightBlue: '#0550ae',
        brightMagenta: '#5a32a3',
        brightCyan: '#116329',
        brightWhite: '#f6f8fa',
      };
}

export default function TerminalUI({
  output = '',
  style,
  className,
}: TerminalUIProps) {
  const { isDarkMode } = useItemsContext();
  const hostRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastWrittenOutputRef = useRef<string>('');

  // Update theme when isDarkMode changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getTerminalTheme(isDarkMode);
    }
  }, [isDarkMode]);

  // Initialize XTerm instance
  useEffect(() => {
    if (!hostRef.current) return undefined;

    const xterm = new XTerm({
      cursorBlink: false,
      cursorInactiveStyle: 'none',
      disableStdin: true,
      convertEol: true,
      fontFamily: 'Cascadia Mono, Consolas, Menlo, Monaco, monospace',
      fontSize: 12.5,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: getTerminalTheme(isDarkMode),
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(hostRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Initial write
    if (output) {
      xterm.write(output);
      lastWrittenOutputRef.current = output;
    }

    const fit = () => {
      if (
        hostRef.current &&
        hostRef.current.clientWidth > 0 &&
        hostRef.current.clientHeight > 0
      ) {
        try {
          fitAddon.fit();
        } catch {
          // ignore layout fitting errors when element is hidden or during transition
        }
      }
    };

    // Resize observer
    let animationFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(fit);
    });

    resizeObserver.observe(hostRef.current);
    fit();

    // Additional fit delay for animation / tab transition
    const timeoutId = window.setTimeout(fit, 100);

    return () => {
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      lastWrittenOutputRef.current = '';
    };
  }, []);

  // Update output when prop changes
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    const prev = lastWrittenOutputRef.current;
    const current = output || '';

    if (current === prev) return;

    if (current.startsWith(prev)) {
      // Append only the delta
      const delta = current.slice(prev.length);
      if (delta) {
        xterm.write(delta);
      }
    } else {
      // Reset and write the complete output
      xterm.reset();
      xterm.write(current);
    }

    lastWrittenOutputRef.current = current;

    // Fit on new output if needed
    if (
      hostRef.current &&
      hostRef.current.clientWidth > 0 &&
      hostRef.current.clientHeight > 0
    ) {
      try {
        fitAddonRef.current?.fit();
      } catch {
        // ignore
      }
    }
  }, [output]);

  return (
    <div
      className={`workflow-terminal-output ${isDarkMode ? 'is-dark' : 'is-light'} ${className || ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '240px',
        minHeight: '140px',
        borderRadius: '6px',
        overflow: 'hidden',
        border: isDarkMode
          ? '1px solid #303030'
          : '1px solid var(--ant-color-border-secondary, #e8e8e8)',
        background: isDarkMode ? '#0f0f0f' : '#ffffff',
        ...style,
      }}
    >
      <div
        ref={hostRef}
        style={{
          width: '100%',
          height: '100%',
          padding: '6px 8px',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
