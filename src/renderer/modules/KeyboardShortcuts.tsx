import React from 'react';
import { List, Modal, Space, Typography, Tabs } from 'antd';

const { Text } = Typography;
const data = {
  general: [
    {
      title: 'Git Log',
      shortcut1: 'Shift',
      shortcut2: 'G',
    },
    {
      title: 'Git Diff',
      shortcut1: 'Shift',
      shortcut2: 'D',
    },
    {
      title: 'Settings',
      shortcut1: 'Shift',
      shortcut2: 'S',
    },
    {
      title: 'Toggle Theme',
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
      title: 'New Tab',
      shortcut1: 'Shift',
      shortcut2: 'N',
    },
    {
      title: 'Close Current Tab',
      shortcut1: 'Shift',
      shortcut2: 'F4',
    },
    {
      title: 'Move to Next Tab',
      shortcut1: 'Shift',
      shortcut2: '→',
    },
    {
      title: 'Move to Previous Tab',
      shortcut1: 'shift',
      shortcut2: '←',
    },
    {
      title: 'Open Repository',
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
    {
      title: 'Prune Worktrees',
      shortcut1: 'Shift',
      shortcut2: 'P',
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
      title: 'Enter Fullscreen',
      shortcut1: 'Shift',
      shortcut2: 'F',
    },
    {
      title: 'Exit Fullscreen',
      shortcut1: 'ESC',
    },
  ],
  terminal: [
    {
      title: 'Clear Console',
      shortcut1: 'Ctrl/Cmd',
      shortcut2: 'L',
    },
    {
      title: 'Clear Input',
      shortcut1: 'Ctrl/Cmd',
      shortcut2: 'U',
    },
    {
      title: 'Clear Word',
      shortcut1: 'Ctrl/Cmd',
      shortcut2: 'Backspace',
    },
    {
      title: 'Go to Start of Input',
      shortcut1: 'Home',
    },
    {
      title: 'Go to End of Input',
      shortcut1: 'End',
    },
    {
      title: 'Navigate Command History',
      shortcut1: '↑/↓',
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
                      {item.shortcut2 && <Text keyboard>{item.shortcut2}</Text>}
                    </div>
                  </List.Item>
                )}
              />
            ),
          },
          {
            label: 'Tab',
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
                      {item.shortcut2 && <Text keyboard>{item.shortcut2}</Text>}
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
                      {item.shortcut2 && <Text keyboard>{item.shortcut2}</Text>}
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
                      {item.shortcut2 && <Text keyboard>{item.shortcut2}</Text>}
                    </div>
                  </List.Item>
                )}
              />
            ),
          },
          {
            label: 'Terminal',
            key: '50',
            children: (
              <List
                grid={{ column: 1 }}
                dataSource={data.terminal}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ display: 'flex' }}>
                      <span style={{ flex: 1 }}>{item.title}</span>{' '}
                      <Text keyboard>{item.shortcut1}</Text>
                      {item.shortcut2 && <Text keyboard>{item.shortcut2}</Text>}
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
