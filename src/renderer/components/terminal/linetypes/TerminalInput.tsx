import React, { PropsWithChildren } from 'react';

type TerminalInputProps = PropsWithChildren<{
  prompt?: string;
}>;

function TerminalInput({ children, prompt }: TerminalInputProps) {
  return (
    <div
      className="react-terminal-line react-terminal-input"
      data-terminal-prompt={prompt || '$'}
    >
      {children}
    </div>
  );
}

export default TerminalInput;
