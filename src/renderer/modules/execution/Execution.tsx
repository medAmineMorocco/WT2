import React from 'react';
import { theme } from 'antd';

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
        <strong>Execution</strong>
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
        <strong>Log</strong>
      </div>
    </div>
  );
}
