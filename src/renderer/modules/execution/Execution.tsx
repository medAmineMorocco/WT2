import React from 'react';
import { theme, Space } from 'antd';
import { FileOutlined, BlockOutlined } from '@ant-design/icons';
import Visualization from './Visualization';
import Log from './Log';
import LogIllustration from '../../components/LogIllustration';
import VisualizationIllustration from '../../components/VisualizationIllustration';
import { motion } from 'framer-motion';

const { useToken } = theme;

export default function Execution({ workflowToPlay }: { workflowToPlay: any }) {
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
          height: 'calc(48.5vh - 20px)',
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
          {workflowToPlay ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 1,
                ease: 'easeInOut',
              }}
            >
              <Visualization />
            </motion.div>
          ) : (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }}
            >
              <VisualizationIllustration />
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          flex: 1,
          padding: 12,
          height: 'calc(48.5vh - 20px)',
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          color: token.colorTextBase,
        }}
      >
        <Space>
          <FileOutlined />
          <strong>Log</strong>
        </Space>

        {workflowToPlay ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 1,
              ease: 'easeInOut',
            }}
          >
            <Log />
          </motion.div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            <LogIllustration />
          </div>
        )}
      </div>
    </div>
  );
}
