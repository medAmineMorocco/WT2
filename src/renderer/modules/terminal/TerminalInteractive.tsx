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

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const onReceiveCommandOutput = (event: any, code: number, result: any) => {
      const ld = [...lineData];
      ld.push(
        <TerminalOutput key={new Date().getTime().toString()}>
          {result}
        </TerminalOutput>,
      );
      if (!commandFinished) {
        setLineData(ld);
      }
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
