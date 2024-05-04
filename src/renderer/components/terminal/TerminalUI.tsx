import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import { useItemsContext } from '../../TabsContext';

let terminal: any = null;
export default function TerminalUI({
  output,
  backgroundDarkMode,
}: {
  output: string;
  backgroundDarkMode: string;
}) {
  const terminalRef = useRef(null);
  const { isDarkMode } = useItemsContext();

  useEffect(() => {
    terminal = new Terminal({
      convertEol: true,
      disableStdin: true,
      fontWeight: '200',
      theme: {
        background: isDarkMode ? backgroundDarkMode : 'white',
        foreground: isDarkMode ? 'white' : 'black',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();
    if (output) {
      terminal.writeln(output);
      setTimeout(() => {
        terminal.scrollToTop();
      });
    }
    return () => {
      terminal.dispose();
      if (terminalRef.current) {
        terminalRef.current.innerHTML = '';
      }
    };
  }, [backgroundDarkMode, isDarkMode, output]);

  return <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
}
