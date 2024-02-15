import React, { useState } from 'react';
import { theme, Space, Tooltip, Modal } from 'antd';
import {
  FileOutlined,
  BlockOutlined,
  CopyOutlined,
  ExpandOutlined,
  CheckOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';

const { useToken } = theme;

export default function Execution() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { token } = useToken();

  const [isCopied, setCopied] = useState(false);

  const [isFullScreenMode, setFullScreenMode] = useState(false);

  const onCopyClick = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const toggleFullScreenMode = () => {
    setFullScreenMode(!isFullScreenMode);
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
              <ExpandOutlined
                style={{ cursor: 'pointer' }}
                onClick={toggleFullScreenMode}
              />
            </Tooltip>
          </Space>
          <Modal
            title={
              <Space>
                <FileOutlined />
                <strong>Log</strong>
              </Space>
            }
            centered
            open={isFullScreenMode}
            className="fullSsceen-modal"
            width="100vw"
            style={{ height: '98vh' }}
            closeIcon={<FullscreenExitOutlined />}
            maskClosable
            onCancel={toggleFullScreenMode}
            destroyOnClose
            footer={null}
          >
            <Tooltip title={!isCopied ? 'Copy' : 'Copied!'} placement="left">
              {!isCopied ? (
                <CopyOutlined
                  style={{
                    cursor: 'pointer',
                    position: 'absolute',
                    top: '21px',
                    right: '44px',
                  }}
                  onClick={onCopyClick}
                />
              ) : (
                <CheckOutlined
                  style={{
                    position: 'absolute',
                    top: '21px',
                    right: '44px',
                  }}
                />
              )}
            </Tooltip>
          </Modal>
        </div>
      </div>
    </div>
  );
}
