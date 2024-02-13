import React from 'react';
import { theme } from 'antd';

const { useToken } = theme;

export default function Workflows() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { token } = useToken();

  return (
    <div
      style={{
        padding: 12,
        height: '47vh',
        marginTop: '1vh',
        background: colorBgContainer,
        borderRadius: borderRadiusLG,
        color: token.colorTextBase,
      }}
    >
      Workflows
    </div>
  );
}
