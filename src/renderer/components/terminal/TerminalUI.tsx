import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';

let terminal: any = null;
export default function TerminalUI({
  isDarkMode,
  output,
}: {
  isDarkMode: boolean;
  output: string;
}) {
  const terminalRef = useRef(null);

  useEffect(() => {
    terminal = new Terminal({
      convertEol: true,
      disableStdin: true,
      fontWeight: '200',
      customGlyphs: true,
      theme: {
        background: isDarkMode ? '#1f1f1f' : 'white',
        foreground: isDarkMode ? 'white' : 'black',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();
    if (output) {
      terminal.writeln(output);
    }
    return () => {
      terminal.dispose();
    };
  }, [isDarkMode, output]);

  return (
    <div
      ref={terminalRef}
      style={{ width: '96%', height: 'calc(100% - 46px)', padding: '22px' }}
    />
  );
}
