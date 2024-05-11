import Terminal, { ColorMode, TerminalOutput } from 'react-terminal-ui';
import { useItemsContext } from '../../TabsContext';

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
