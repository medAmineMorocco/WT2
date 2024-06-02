import React from 'react';
import { useItemsContext } from '../../TabsContext';
import Terminal, { ColorMode, TerminalOutput } from '.';

export default function TerminalUI({ output }: { output: string }) {
  const { isDarkMode } = useItemsContext();
  return (
    <div
      className="output-command"
      style={{ position: 'relative', width: '100%' }}
    >
      <Terminal
        name=""
        colorMode={isDarkMode ? ColorMode.Dark : ColorMode.Light}
      >
        <TerminalOutput key={0}>{output}</TerminalOutput>
      </Terminal>
    </div>
  );
}
