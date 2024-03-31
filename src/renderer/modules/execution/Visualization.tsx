import React, { useEffect, useState } from 'react';
import { StepProps, Steps, Tag } from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';

const config: any = {
  processing: {
    icon: <SyncOutlined spin />,
    status: 'process',
  },
  success: {
    icon: <CheckCircleOutlined />,
    status: 'finish',
  },
  error: {
    icon: <CloseCircleOutlined />,
    status: 'error',
  },
  wait: {
    icon: <ClockCircleOutlined />,
    status: 'wait',
  },
  stop: {
    icon: <MinusCircleOutlined />,
    status: 'finish',
  },
};

export default function Visualization() {
  const [commands, setCommands] = useState<StepProps[]>([]);
  const [worktreesStates, setWorktreesStates] = useState<any[]>([]);

  useEffect(() => {
    const onReceiveCommands = (event: any, executedCommands: string[]) => {
      setCommands(
        executedCommands.map((command) => {
          return {
            title: command,
          };
        }),
      );
    };
    const onReceiveStatesUpdated = (
      event: any,
      worktreesStatesUpdated: any[],
    ) => {
      setWorktreesStates(worktreesStatesUpdated);
    };

    ipcRenderer.on('workflow-started-with-commands', onReceiveCommands);
    ipcRenderer.on('workflow-started-states-updated', onReceiveStatesUpdated);

    return () => {
      ipcRenderer.removeAllListeners('workflow-started-states-updated');
      ipcRenderer.removeAllListeners('workflow-started-with-commands');
    };
  }, []);

  return (
    <ul style={{ paddingLeft: 0 }}>
      {worktreesStates.map((item) => (
        <li
          key={item.title}
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <Tag
            bordered={false}
            icon={config[item.status].icon}
            color={item.status === 'wait' ? 'default' : item.status}
          >
            {item.title}
          </Tag>
          <div style={{ flex: 1 }}>
            <Steps
              status={config[item.status].status}
              size="small"
              labelPlacement="vertical"
              current={item.current}
              items={commands}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
