import { Modal } from 'antd';
import React, { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';
import Terminal, {
  ColorMode,
  TerminalInput,
  TerminalOutput,
} from '../../components/terminal';

const banner =
  ' _       __              __    __                   _       __ _           \n' +
  '| |     / /____   _____ / /__ / /_ _____ ___   ___ | |     / /(_)_____ ___ \n' +
  '| | /| / // __ \\ / ___// //_// __// ___// _ \\ / _ \\| | /| / // // ___// _ \\\n' +
  '| |/ |/ // /_/ // /   / ,<  / /_ / /   /  __//  __/| |/ |/ // /(__  )/  __/\n' +
  '|__/|__/ \\____//_/   /_/|_| \\__//_/    \\___/ \\___/ |__/|__//_//____/ \\___/ \n' +
  '                                                                           ';

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
    <TerminalOutput key={0}>
      <span style={{ whiteSpace: 'pre' }}>{banner}</span>
    </TerminalOutput>,
  ]);
  const [commandFinished, setCommandFinished] = useState(true);

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (event.ctrlKey && event.key === 'l') {
        setLineData([]);
      } else if (event.ctrlKey && event.key === 'c') {
        ipcRenderer.send('stop-command');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const terminalInput = document.getElementsByClassName(
      'terminal-hidden-input',
    );
    if (terminalInput.length > 0) {
      const terminalInputElement = terminalInput[0] as any;
      terminalInputElement.focus();
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function removeANSI(str: string) {
    return str.replace(
      // eslint-disable-next-line no-control-regex
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      '',
    );
  }

  useEffect(() => {
    const onReceiveCommandOutput = (event: any, code: number, result: any) => {
      const removedAnsi = removeANSI(result);
      setLineData((prevLineData) => {
        const updatedLineData = [...prevLineData];
        updatedLineData.push(
          <TerminalOutput key={Math.random()}>{removedAnsi}</TerminalOutput>,
        );
        return updatedLineData;
      });
    };

    const onCommandFinished = (event: any) => {
      setCommandFinished(true);
    };

    ipcRenderer.on('command-receive-data', onReceiveCommandOutput);
    ipcRenderer.on('command-finished', onCommandFinished);

    return () => {
      ipcRenderer.removeAllListeners('command-receive-data');
      ipcRenderer.removeAllListeners('command-finished');
    };
  }, [lineData, repository]);

  function onInput(input: string) {
    let ld = [...lineData];
    ld.push(<TerminalInput>{input}</TerminalInput>);
    if (input.toLocaleLowerCase().trim() === 'clear') {
      ld = [];
    } else if (input) {
      setCommandFinished(false);
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
          onInput={commandFinished ? onInput : null}
        >
          {lineData}
        </Terminal>
      </div>
    </Modal>
  );
}
