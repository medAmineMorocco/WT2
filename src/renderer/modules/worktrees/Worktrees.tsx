import React, { forwardRef, lazy, Suspense, useState } from 'react';
import { Button, Layout, Tooltip, Space, Tag, theme, Radio, Spin } from 'antd';
import { useHotkeys } from 'react-hotkeys-hook';
import ListWorktrees from './ListWorktrees';
import PackInfos from '../packInfos/PackInfos';
import { useItemsContext } from '../../TabsContext';

const GitDiff = lazy(() => import('../gitDiff/GitDiff'));
const AddWorktree = lazy(() => import('./AddWorktree'));

const { Sider } = Layout;
const { useToken } = theme;

const optionsWithDisabled = [
  { label: 'Git Log', value: 'GIT_LOG' },
  { label: 'Overview', value: 'OVERVIEW' },
  { label: 'Workflow', value: 'WORKFLOW' },
];

const Worktrees = forwardRef<
  HTMLDivElement,
  { isDarkMode: boolean; mode: string; onChangeMode: any }
>(({ isDarkMode, mode, onChangeMode }, ref) => {
  const { token } = useToken();
  const [collapsed, setCollapsed] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [openGitDiff, setOpenGitDiff] = useState(false);

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

  const ShowGitDiff = () => {
    setOpenGitDiff(true);
  };

  const onCloseGitDiff = () => {
    setOpenGitDiff(false);
  };

  useHotkeys('shift+d', () => setOpenGitDiff(true), {
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

          {openGitDiff && (
            <Suspense fallback={<Spin size="large" />}>
              <GitDiff isModalOpen={openGitDiff} handleCancel={onCloseGitDiff} />
            </Suspense>
          )}
          {isModalOpen && (
            <Suspense fallback={<Spin size="large" />}>
              <AddWorktree
                isModalOpen={isModalOpen}
                handleCancel={handleCancel}
                setMode={onChangeMode}
              />
            </Suspense>
          )}
          <ul style={{ marginTop: 0, paddingLeft: '0' }}>
            <li
              key="git-diff"
              style={{
                color: token.colorTextBase,
                cursor: 'pointer',
              }}
            >
              <Tooltip
                title={<small>Shift+D</small>}
                placement="right"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <Button
                  type="text"
                  block
                  onClick={ShowGitDiff}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    borderRadius: 0,
                    paddingLeft: '8px',
                    fontWeight: 'bold',
                  }}
                >
                  Git Diff
                </Button>
              </Tooltip>
            </li>
          </ul>
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
