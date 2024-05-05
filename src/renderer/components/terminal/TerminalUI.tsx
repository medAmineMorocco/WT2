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

  function calculateColsRows() {
    const terminalElement = terminalRef.current;

    // Get the dimensions of the terminal container
    const containerWidth = terminalElement.parentElement?.clientWidth;
    const containerHeight = terminalElement.parentElement?.clientHeight;

    // Get the dimensions of a single character in the terminal
    const charWidth = terminalElement.offsetWidth / terminal.cols;
    const charHeight = terminalElement.offsetHeight / terminal.rows;

    // Calculate the number of columns and rows
    const cols = Math.floor(containerWidth / charWidth);
    const rows = Math.floor(containerHeight / charHeight);
    return { cols, rows };
  }

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

    function handleResize() {
      if (terminal && terminalRef.current) {
        const { cols, rows } = calculateColsRows();
        terminal.resize(cols, rows);
        fitAddon.fit();
      }
    }

    window.addEventListener('resize', handleResize);

    return () => {
      terminal.dispose();
      if (terminalRef.current) {
        terminalRef.current.innerHTML = '';
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [backgroundDarkMode, isDarkMode, output]);

  useEffect(() => {
    const { cols, rows } = calculateColsRows();
    terminal.resize(cols, rows);
  }, [terminal]);

  return (
    <div
      ref={terminalRef}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}
