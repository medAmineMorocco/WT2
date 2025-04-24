import React, { useEffect, useState } from 'react';
import { StepProps, Steps, Tag } from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import log from 'electron-log';

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
  warning: {
    icon: <ExclamationCircleOutlined />,
    status: 'wait',
  },
};

export default function Visualization({
  commands,
  initialWorktreesStates,
}: {
  commands: StepProps[];
  initialWorktreesStates: any[];
}) {
  const [worktreesStates, setWorktreesStates] = useState<any[]>(
    initialWorktreesStates,
  );

  useEffect(() => {
    const onReceiveStatesUpdated = (
      event: any,
      worktreesStatesUpdated: any[],
    ) => {
      log.debug(
        'worktreesStatesUpdated: ',
        JSON.stringify(worktreesStatesUpdated),
      );
      setWorktreesStates(worktreesStatesUpdated);
    };

    ipcRenderer.on('workflow-started-states-updated', onReceiveStatesUpdated);

    return () => {
      ipcRenderer.removeAllListeners('workflow-started-states-updated');
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
              className="steps-visualization"
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
