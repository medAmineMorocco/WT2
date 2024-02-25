import React from 'react';
import { theme, Space } from 'antd';
import { FileOutlined, BlockOutlined } from '@ant-design/icons';
import Visualization from './Visualization';
import Log from './Log';

const { useToken } = theme;

export default function Execution() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { token } = useToken();

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <div
        style={{
          flex: 1,
          padding: 12,
          height: '48.5vh',
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          color: token.colorTextBase,
        }}
      >
        <Space>
          <BlockOutlined />
          <strong>Execution</strong>
        </Space>
        <div
          style={{
            height: '42vh',
            overflowX: 'auto',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          <div>
            <Visualization />
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          flex: 1,
          padding: 12,
          height: '48.5vh',
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          color: token.colorTextBase,
        }}
      >
        <Space>
          <FileOutlined />
          <strong>Log</strong>
        </Space>
        <div>
          <Log />
        </div>
      </div>
    </div>
  );
}
