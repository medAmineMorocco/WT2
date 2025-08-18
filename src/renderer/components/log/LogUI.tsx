import {
  Avatar,
  Dropdown,
  FloatButton,
  MenuProps,
  notification,
  Tag,
  Tooltip,
} from 'antd';
import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo } from 'react';
import log from 'electron-log';
import { LoadingOutlined } from '@ant-design/icons';
import TabService from '../../services/tab/TabService';

const formatDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const items: MenuProps['items'] = [
  {
    label: 'Copy commit sha',
    key: '1',
  },
  {
    label: 'Create worktree here',
    key: '2',
  },
];
export default function LogUI({
  commits,
  isAuthorEnabled,
  isCommitDateEnabled,
  isHashEnabled,
  isRefsEnabled,
  shouldHide,
}: {
  commits: string[];
  isAuthorEnabled: boolean;
  isCommitDateEnabled: boolean;
  isHashEnabled: boolean;
  isRefsEnabled: boolean;
  shouldHide: boolean;
}) {
  const [api, contextHolder] = notification.useNotification();

  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

  const storedWorktreePrefix =
    window.localStorage.getItem('worktreePrefix') != null &&
    window.localStorage.getItem('worktreePrefix')?.trim() !== ''
      ? window.localStorage.getItem('worktreePrefix')
      : '{repo}__wt__{branch}';

  useEffect(() => {
    const onWorktreeCreated = (event: any, code: number, result: any) => {
      log.debug(
        `onWorktreeCreated code: ${code} result: ${JSON.stringify(result)}`,
      );
      if (code === 0) {
        ipcRenderer.send('show-git-log', tabRepoPath);
        ipcRenderer.send('get-worktrees', tabRepoPath);
        setTimeout(() => {
          api.success({
            key: 'updatable',
            message: 'Worktree Created',
            placement: 'bottomLeft',
            duration: 0.5,
          });
          setTimeout(() => {
            api.destroy('updatable');
          }, 1500);
        }, 500);
      } else {
        notification.error({
          message: 'Unable to Create Worktree From Commit',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    ipcRenderer.on('worktree-from-commit-created', onWorktreeCreated);

    return () => {
      ipcRenderer.removeAllListeners('worktree-from-commit-created');
    };
  }, [api, tabRepoPath]);

  const onClick = (hash: string) => {
    return (event: any) => {
      if (event.key === '1') {
        navigator.clipboard.writeText(hash);
      }
      if (event.key === '2') {
        const activeTabValue = TabService.getTab(activeTab);
        let worktreesPath;
        if (activeTabValue.worktreesPath) {
          worktreesPath = activeTabValue.worktreesPath;
        }
        api.open({
          key: 'updatable',
          icon: <LoadingOutlined />,
          message:
            'Your worktree is being created. Please wait a moment while we complete the process.',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        ipcRenderer.send(
          'create-worktree-from-commit',
          hash,
          worktreesPath,
          tabRepoPath,
          storedWorktreePrefix,
        );
      }
    };
  };

  function formatToIsoWithoutSeconds(dateString: string): string {
    const date = new Date(dateString);

    const parts = formatDate.formatToParts(date);
    const { year, month, day, hour, minute } = Object.fromEntries(
      parts.map((p) => [p.type, p.value]),
    );

    const offsetMatch = dateString.match(/([+-])(\d{2})(\d{2})$/);
    let tz = 'UTC';

    if (offsetMatch) {
      const [, sign, hours] = offsetMatch;
      const totalOffset = `UTC${sign}${parseInt(hours, 10)}`;
      tz = totalOffset;
    }

    return `${year}-${month}-${day} ${hour}:${minute} ${tz}`;
  }

  return (
    <div
      style={{
        fontFamily: 'monospace',
        height: '100%',
        overflowY: 'auto',
      }}
      className="log-container"
    >
      {contextHolder}
      {commits.map((line, idx) => {
        const parts = line.match(/(.*?)(\*)(.*)/); // Split around the *
        if (!parts) {
          // eslint-disable-next-line react/no-array-index-key
          return <div key={idx}>{line}</div>;
        }

        const regex =
          /^(.*?)(?: \(([^)]+)\))? <([^>]+)> \[([^\]]+)\]\s+([a-f0-9]{7,40})$/;
        const match = parts[3].match(regex);

        const [_, subject = '', refs = '', author = '', date = '', hash = ''] =
          match;

        return (
          <Dropdown
            key={idx}
            menu={{ items, onClick: onClick(hash) }}
            trigger={['contextMenu']}
            overlayClassName="commit-dropdown"
            placement="bottom"
          >
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
            <a onClick={(e) => e.preventDefault()}>
              <div className="commit-row" style={{ position: 'relative' }}>
                <span>{parts[1]}</span>
                <Tooltip
                  title={author}
                  placement="top"
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <Avatar
                    size={18}
                    shape="square"
                    className="commit-author"
                    gap={5}
                  >
                    {author[0]}
                  </Avatar>
                </Tooltip>
                <span className="commit-msg">{subject}</span>
                {isRefsEnabled && refs && (
                  <Tag color="#6a737d" bordered={false}>
                    {refs}
                  </Tag>
                )}
                {!shouldHide && isAuthorEnabled && (
                  <span
                    style={{
                      position: 'absolute',
                      fontSize: '13px',
                      right:
                        // eslint-disable-next-line no-nested-ternary
                        isHashEnabled && isCommitDateEnabled
                          ? '274px'
                          : // eslint-disable-next-line no-nested-ternary
                            isHashEnabled && !isCommitDateEnabled
                            ? '74px'
                            : !isHashEnabled && isCommitDateEnabled
                              ? '216px'
                              : '8px',
                    }}
                  >
                    {' '}
                    {`<${author}>`}
                  </span>
                )}
                {!shouldHide && isCommitDateEnabled && (
                  <span
                    style={{
                      position: 'absolute',
                      fontSize: '13px',
                      right: isHashEnabled ? '74px' : '8px',
                    }}
                  >
                    {' '}
                    {`[${formatToIsoWithoutSeconds(date)}]`}
                  </span>
                )}
                {!shouldHide && isHashEnabled && (
                  <span
                    style={{
                      position: 'absolute',
                      fontSize: '13px',
                      right: '8px',
                    }}
                  >
                    {' '}
                    {hash}
                  </span>
                )}
              </div>
            </a>
          </Dropdown>
        );
      })}
      <FloatButton.BackTop
        style={{ insetInlineEnd: '36px' }}
        target={() => document.querySelector('.log-container')}
      />
    </div>
  );
}
