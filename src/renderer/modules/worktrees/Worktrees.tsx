import React, { forwardRef, lazy, Suspense, useState } from 'react';
import { Layout, Space, Tag, Radio, Spin } from 'antd';
import { useHotkeys } from 'react-hotkeys-hook';
import ListWorktrees from './ListWorktrees';
import PackInfos from '../packInfos/PackInfos';
import { useItemsContext } from '../../TabsContext';

const AddWorktree = lazy(() => import('./AddWorktree'));

const { Sider } = Layout;

const optionsWithDisabled = [
  { label: 'Git Log', value: 'GIT_LOG' },
  { label: 'Overview', value: 'OVERVIEW' },
  { label: 'Workflow', value: 'WORKFLOW' },
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
      collapsed={collapsed}
      onCollapse={(value) => setCollapsed(value)}
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
            style={{
              position: 'absolute',
              bottom: '46px',
              width: '100%',
              padding: '16px',
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Radio.Group
                  className="worktree-mode-selector"
                  options={optionsWithDisabled}
                  onChange={onChangeMode}
                  value={mode}
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                />
              </div>
              <PackInfos />
            </Space>
          </div>
          <Tag
            style={{
              position: 'absolute',
              bottom: '12px',
              left: 'calc(50% - 25px)',
              zIndex: 8,
            }}
          >
            {window.localStorage.getItem('VERSION') || ''}
          </Tag>
        </>
      )}
    </Sider>
  );
});

export default Worktrees;
