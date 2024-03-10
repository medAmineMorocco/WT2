import React from 'react';
import { List, Modal, Space, Typography, Tabs } from 'antd';

const { Text } = Typography;
const data = {
  general: [
    {
      title: 'Menu',
      shortcut1: 'Shift',
      shortcut2: 'M',
    },
    {
      title: 'Toggle theme',
      shortcut1: 'Shift',
      shortcut2: 'T',
    },
    {
      title: 'Collapse Sidebar',
      shortcut1: 'Shift',
      shortcut2: 'C',
    },
  ],
  tabs: [
    {
      title: 'New tab',
      shortcut1: 'Shift',
      shortcut2: 'N',
    },
    {
      title: 'Close current tab',
      shortcut1: 'Shift',
      shortcut2: 'F4',
    },
    {
      title: 'Move to next tab',
      shortcut1: 'Shift',
      shortcut2: '→',
    },
    {
      title: 'Move to previous tab',
      shortcut1: 'shift',
      shortcut2: '←',
    },
    {
      title: 'Open repository',
      shortcut1: 'Shift',
      shortcut2: 'O',
    },
  ],
  worktree: [
    {
      title: 'Add Worktree',
      shortcut1: 'Shift',
      shortcut2: 'W',
    },
  ],
  workflow: [
    {
      title: 'Add Workflow',
      shortcut1: 'Shift',
      shortcut2: 'A',
    },
    {
      title: 'Import Workflow',
      shortcut1: 'Shift',
      shortcut2: 'I',
    },
    {
      title: 'Toggle Fullscreen',
      shortcut1: 'Shift',
      shortcut2: 'S',
    },
    {
      title: 'Copy Log',
      shortcut1: 'Shift',
      shortcut2: 'L',
    },
  ],
};
export default function KeyboardShortcuts({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      title={
        <Space>
          <strong>
            Keyboard Shortcuts <Text keyboard>Shift</Text>
            <Text keyboard>K</Text>
          </strong>
        </Space>
      }
      className="keyboard-modal"
      centered
      open={open}
      maskClosable
      onCancel={onClose}
      destroyOnClose
      footer={null}
    >
      <Tabs
        tabPosition="left"
        items={[
          {
            label: 'General',
            key: '10',
            children: (
              <List
                grid={{ column: 1 }}
                dataSource={data.general}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ display: 'flex' }}>
                      <span style={{ flex: 1 }}>{item.title}</span>{' '}
                      <Text keyboard>{item.shortcut1}</Text>
                      <Text keyboard>{item.shortcut2}</Text>
                    </div>
                  </List.Item>
                )}
              />
            ),
          },
          {
            label: 'Tabs',
            key: '20',
            children: (
              <List
                grid={{ column: 1 }}
                dataSource={data.tabs}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ display: 'flex' }}>
                      <span style={{ flex: 1 }}>{item.title}</span>{' '}
                      <Text keyboard>{item.shortcut1}</Text>
                      <Text keyboard>{item.shortcut2}</Text>
                    </div>
                  </List.Item>
                )}
              />
            ),
          },
          {
            label: 'Worktree',
            key: '30',
            children: (
              <List
                grid={{ column: 1 }}
                dataSource={data.worktree}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ display: 'flex' }}>
                      <span style={{ flex: 1 }}>{item.title}</span>{' '}
                      <Text keyboard>{item.shortcut1}</Text>
                      <Text keyboard>{item.shortcut2}</Text>
                    </div>
                  </List.Item>
                )}
              />
            ),
          },
          {
            label: 'Workflow',
            key: '40',
            children: (
              <List
                grid={{ column: 1 }}
                dataSource={data.workflow}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ display: 'flex' }}>
                      <span style={{ flex: 1 }}>{item.title}</span>{' '}
                      <Text keyboard>{item.shortcut1}</Text>
                      <Text keyboard>{item.shortcut2}</Text>
                    </div>
                  </List.Item>
                )}
              />
            ),
          },
        ]}
      />
    </Modal>
  );
}
