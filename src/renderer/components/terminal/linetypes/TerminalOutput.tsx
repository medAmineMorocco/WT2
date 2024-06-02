import React from 'react';

function TerminalOutput({ children }: { children?: React.ReactChild }) {
  return <div className="react-terminal-line">{children}</div>;
}

export default TerminalOutput;
