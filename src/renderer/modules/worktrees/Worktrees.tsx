import React, { forwardRef, lazy, Suspense, useState } from 'react';
import { Button, Layout, Spin } from 'antd';
import {
  ApartmentOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import ListWorktrees from './ListWorktrees';
import { useItemsContext } from '../../TabsContext';

const AddWorktree = lazy(() => import('./AddWorktree'));

const { Sider } = Layout;

const modeOptions = [
  { label: 'Git Log', value: 'GIT_LOG', icon: <ClockCircleOutlined /> },
  { label: 'Overview', value: 'OVERVIEW', icon: <BarChartOutlined /> },
  { label: 'Workflow', value: 'WORKFLOW', icon: <ApartmentOutlined /> },
];

const Worktrees = forwardRef<
  HTMLDivElement,
  { isDarkMode: boolean; mode: string; onChangeMode: any }
>(({ isDarkMode, mode, onChangeMode }, ref) => {
  const [collapsed, setCollapsed] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { isWorkflowPlaying } = useItemsContext();

  const showModal = (event: any) => {
    if (event) {
      event.stopPropagation();
    }
    setIsModalOpen(true);
  };

  useHotkeys(
    'shift+w',
    () => {
      if (isWorkflowPlaying) {
        return;
      }
      if (collapsed) {
        setCollapsed(false);
        showModal(null);
      } else {
        showModal(null);
      }
    },
    { preventDefault: true },
  );
  useHotkeys('shift+c', () => setCollapsed(!collapsed), {
    preventDefault: true,
  });
  useHotkeys('shift+o', () => onChangeMode({ target: { value: 'OVERVIEW' } }), {
    preventDefault: true,
  });

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  return (
    <Sider
      theme="light"
      collapsible
      collapsedWidth={36}
      collapsed={collapsed}
      onCollapse={(value) => setCollapsed(value)}
      trigger={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
    >
      {!collapsed && (
        <>
          <ListWorktrees
            isDarkMode={isDarkMode}
            ref={ref}
            showModal={showModal}
          />

          {isModalOpen && (
            <Suspense fallback={<Spin size="large" />}>
              <AddWorktree
                isModalOpen={isModalOpen}
                handleCancel={handleCancel}
                setMode={onChangeMode}
              />
            </Suspense>
          )}
          <div
            className="worktree-mode-navigation"
            aria-label="Repository views"
          >
            {modeOptions.map((option) => (
              <Button
                key={option.value}
                type={mode === option.value ? 'primary' : 'text'}
                icon={option.icon}
                className="worktree-mode-button"
                aria-pressed={mode === option.value}
                onClick={() =>
                  onChangeMode({ target: { value: option.value } })
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </>
      )}
    </Sider>
  );
});

export default Worktrees;
