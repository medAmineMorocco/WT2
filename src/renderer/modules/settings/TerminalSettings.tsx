import { Form, Select } from 'antd';
import React, { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';

export default function TerminalSettings() {
  const [terminal, setTerminal] = useState<string | null>(null);
  const [installedTerminals, setInstalledTerminals] = useState([]);

  useEffect(() => {
    ipcRenderer.send('get-terminals');
    const storedSelectedTerminal = window.localStorage.getItem('terminal');
    if (storedSelectedTerminal) {
      setTerminal(JSON.parse(storedSelectedTerminal).label);
    }
    const onTerminalsFound = (event: any, code: number, result: any) => {
      if (code === 0) {
        setInstalledTerminals(JSON.parse(result));
      }
    };

    ipcRenderer.on('terminals-found', onTerminalsFound);

    return () => {
      ipcRenderer.removeAllListeners('terminals-found');
    };
  }, []);
  const onChange = (value: any) => {
    const selectedTerminal = installedTerminals.find(
      (item: any) => item.label === value,
    );
    if (selectedTerminal) {
      window.localStorage.setItem('terminal', JSON.stringify(selectedTerminal));
      setTerminal(value);
    }
  };

  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ span: 10 }}
      wrapperCol={{ span: 6 }}
    >
      <Form.Item label="Default Terminal">
        <Select
          placeholder="Select terminal"
          onChange={onChange}
          value={terminal}
        >
          {installedTerminals.map((item: any) => (
            <Select.Option key={item.label} value={item.label}>
              {item.label}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
    </Form>
  );
}
