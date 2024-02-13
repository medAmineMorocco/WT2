import React from 'react';
import { theme } from 'antd';

const { useToken } = theme;

export default function Execution() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { token } = useToken();

  return (
    <div
      style={{
        padding: 12,
        height: '47vh',
        background: colorBgContainer,
        borderRadius: borderRadiusLG,
        color: token.colorTextBase,
      }}
    >
      Execution
    </div>
  );
}
