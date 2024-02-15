import React from 'react';
import { theme, Space } from 'antd';
import { FileOutlined, BlockOutlined } from '@ant-design/icons';

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
          flexGrow: 1,
          padding: 12,
          height: '47vh',
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          color: token.colorTextBase,
        }}
      >
        <Space>
          <BlockOutlined />
          <strong>Execution</strong>
        </Space>
      </div>
      <div
        style={{
          flexGrow: 1,
          padding: 12,
          height: '47vh',
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          color: token.colorTextBase,
        }}
      >
        <Space>
          <FileOutlined />
          <strong>Log</strong>
        </Space>
      </div>
    </div>
  );
}
