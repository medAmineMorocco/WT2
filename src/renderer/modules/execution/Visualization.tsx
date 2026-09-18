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
    const onReceiveStatesUpdated = (worktreesStatesUpdated: any[]) => {
      log.debug(
        'worktreesStatesUpdated: ',
        JSON.stringify(worktreesStatesUpdated),
      );
      setWorktreesStates(worktreesStatesUpdated);
    };

    window.electron.ipcRenderer.on(
      'workflow-started-states-updated',
      onReceiveStatesUpdated,
    );

    return () => {
      window.electron.ipcRenderer.removeAllListeners(
        'workflow-started-states-updated',
      );
    };
  }, []);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'max-content 1fr',
        rowGap: '16px',
        columnGap: '16px',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 8,
        margin: 0,
        paddingTop: 6,
      }}
    >
      {(worktreesStates || []).map((item) => (
        <React.Fragment key={item.title}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              minWidth: 0,
            }}
          >
            <Tag
              bordered={false}
              icon={config[item.status]?.icon}
              color={item.status === 'wait' ? 'default' : item.status}
              style={{
                margin: 0,
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={item.title}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.title}
              </span>
            </Tag>
          </div>
          <div style={{ minWidth: 0, width: '100%' }}>
            <Steps
              className="steps-visualization"
              status={config[item.status]?.status}
              size="small"
              labelPlacement="vertical"
              current={item.current}
              items={commands}
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
