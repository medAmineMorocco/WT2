import React from 'react';

function TerminalOutput({ children }: { children?: React.ReactNode }) {
  return <div className="react-terminal-line">{children}</div>;
}

export default TerminalOutput;
