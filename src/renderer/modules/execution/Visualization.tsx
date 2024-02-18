import React from 'react';
import { Steps, Tag } from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';

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
  const worktreesStates = [
    {
      title: 'Worktree1',
      current: 3,
      status: 'success',
    },
    {
      title: 'Worktree2',
      current: 1,
      status: 'processing',
    },
    {
      title: 'Worktree3',
      current: 1,
      status: 'error',
    },
    {
      title: 'Worktree4',
      current: -1,
      status: 'wait',
    },
  ];

  const commands = [
    {
      title: 'git stash',
    },
    {
      title: 'git rebase master',
    },
    {
      title: 'git pop',
    },
  ];

  return (
    <ul style={{ paddingLeft: 0 }}>
      {worktreesStates.map((item) => (
        <li
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
