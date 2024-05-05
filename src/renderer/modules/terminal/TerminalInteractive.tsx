import { Modal } from 'antd';
import React, { useEffect, useState } from 'react';
import Terminal, {
  ColorMode,
  TerminalInput,
  TerminalOutput,
} from 'react-terminal-ui';
import { ipcRenderer } from 'electron';

const banner =
  ' #     #                                                 #     #                 \n' +
  ' #  #  #  ####  #####  #    # ##### #####  ###### ###### #  #  # #  ####  ###### \n' +
  ' #  #  # #    # #    # #   #    #   #    # #      #      #  #  # # #      #      \n' +
  ' #  #  # #    # #    # ####     #   #    # #####  #####  #  #  # #  ####  #####  \n' +
  ' #  #  # #    # #####  #  #     #   #####  #      #      #  #  # #      # #      \n' +
  ' #  #  # #    # #   #  #   #    #   #   #  #      #      #  #  # # #    # #      \n' +
  '  ## ##   ####  #    # #    #   #   #    # ###### ######  ## ##  #  ####  ###### \n' +
  '                                                                                 ';

export default function TerminalInteractive({
  isModalOpen,
  repository,
  handleCancel,
  isDarkMode,
}: {
  isModalOpen: boolean;
  repository: string | null;
  handleCancel: any;
  isDarkMode: boolean;
}) {
  const [lineData, setLineData] = useState([
    <TerminalOutput key={0}>{banner}</TerminalOutput>,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (event.ctrlKey && event.key === 'u') {
        console.log('u');
      }
      if (event.ctrlKey && event.key === 'l') {
        console.log('clear');
        setLineData([]);
      } else if (event.key === 'ArrowUp') {
        console.log('up');
      } else if (event.key === 'ArrowDown') {
        console.log('down');
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const onReceiveCommandOutput = (event: any, code: number, result: any) => {
      if (code === 0) {
        const ld = [...lineData];
        const decoder = new TextDecoder();
        const decodedString = decoder.decode(result);
        ld.push(<TerminalOutput>{decodedString}</TerminalOutput>);
        setLineData(ld);
      } else {
        const ld = [...lineData];
        ld.push(<TerminalOutput>{result}</TerminalOutput>);
        setLineData(ld);
      }
    };

    ipcRenderer.on('command-executed', onReceiveCommandOutput);

    return () => {
      ipcRenderer.removeAllListeners('command-executed');
    };
  }, [lineData, repository]);

  function onInput(input: string) {
    let ld = [...lineData];
    ld.push(<TerminalInput>{input}</TerminalInput>);
    if (input.toLocaleLowerCase().trim() === 'clear') {
      ld = [];
    } else if (input) {
      ipcRenderer.send('execute-command', input, repository);
    }
    setLineData(ld);
  }

  return (
    <Modal
      open={isModalOpen}
      onCancel={handleCancel}
      footer={null}
      destroyOnClose
      className="git-log-modal"
      width="calc(100% - 216px)"
      style={{
        position: 'absolute',
        right: '8px',
        top: '48px',
        height: 'calc(100% - 56px)',
        paddingBottom: 0,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Terminal
          name={repository}
          colorMode={isDarkMode ? ColorMode.Dark : ColorMode.Light}
          onInput={onInput}
        >
          {lineData}
        </Terminal>
      </div>
    </Modal>
  );
}
