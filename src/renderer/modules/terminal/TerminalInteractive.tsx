import { Modal } from 'antd';
import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

const colors = require('ansi-colors');

const banner =
  ' #     #                                                 #     #                 \n' +
  ' #  #  #  ####  #####  #    # ##### #####  ###### ###### #  #  # #  ####  ###### \n' +
  ' #  #  # #    # #    # #   #    #   #    # #      #      #  #  # # #      #      \n' +
  ' #  #  # #    # #    # ####     #   #    # #####  #####  #  #  # #  ####  #####  \n' +
  ' #  #  # #    # #####  #  #     #   #####  #      #      #  #  # #      # #      \n' +
  ' #  #  # #    # #   #  #   #    #   #   #  #      #      #  #  # # #    # #      \n' +
  '  ## ##   ####  #    # #    #   #   #    # ###### ######  ## ##  #  ####  ###### \n' +
  '                                                                                 ';

let terminal: any = null;
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
  const terminalRef = useRef(null);

  useEffect(() => {
    terminal = new Terminal({
      convertEol: true,
      fontWeight: '200',
      customGlyphs: true,
      theme: {
        background: isDarkMode ? '#1f1f1f' : 'white',
        foreground: isDarkMode ? 'white' : 'black',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminal.writeln(colors.bold.blue(banner));
    terminal.write(`${repository}> `);

    terminal.onData((data: string) => {
      terminal.write(data);
    });

    return () => {
      terminal.dispose();
    };
  }, [isDarkMode, repository]);

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
      <div
        ref={terminalRef}
        style={{ width: '96%', height: 'calc(100% - 46px)', padding: '22px' }}
      />
    </Modal>
  );
}
