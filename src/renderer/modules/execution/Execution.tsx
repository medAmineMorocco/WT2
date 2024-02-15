import React, { useState } from 'react';
import { theme, Space, Tooltip } from 'antd';
import {
  FileOutlined,
  BlockOutlined,
  CopyOutlined,
  ExpandOutlined,
  CheckOutlined,
} from '@ant-design/icons';

const { useToken } = theme;

export default function Execution() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { token } = useToken();

  const [isCopied, setCopied] = useState(false);

  const onCopyClick = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

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
          position: 'relative',
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

        <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
          <Space>
            <Tooltip title={!isCopied ? 'Copy' : 'Copied!'} placement="left">
              {!isCopied ? (
                <CopyOutlined
                  style={{ cursor: 'pointer' }}
                  onClick={onCopyClick}
                />
              ) : (
                <CheckOutlined />
              )}
            </Tooltip>
            <Tooltip title="Enter fullscreen mode" placement="left">
              <ExpandOutlined style={{ cursor: 'pointer' }} />
            </Tooltip>
          </Space>
        </div>
      </div>
    </div>
  );
}
