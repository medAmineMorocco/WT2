import React from 'react';
import { List, Modal, Space, Typography } from 'antd';

const { Text } = Typography;
const data = [
  {
    title: 'Menu',
    shortcut1: 'Shift',
    shortcut2: 'M',
  },
  {
    title: 'Open Repository',
    shortcut1: 'Shift',
    shortcut2: 'O',
  },
  {
    title: 'Add Worktree',
    shortcut1: 'Shift',
    shortcut2: 'W',
  },
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
  {
    title: 'New tab',
    shortcut1: 'Shift',
    shortcut2: 'N',
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
];
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
      <List
        grid={{ gutter: 16, column: 2 }}
        dataSource={data}
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
    </Modal>
  );
}
