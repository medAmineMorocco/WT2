import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Input,
  Radio,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type {
  BisectMark,
  GitBisectResult,
  GitBisectState,
} from '../../../shared/gitBisect';

const EMPTY_STATE: GitBisectState = {
  active: false,
  currentCommit: null,
  originalBranch: null,
  completed: false,
  culpritCommit: null,
};

export default function GitBisectPanel({
  repositoryPath,
  worktreeName,
  goodCommit,
  badCommit,
  onClearGood,
  onClearBad,
  onStateChange,
  onClose,
  onReload,
  notify,
  hasWorkingChanges,
}: {
  repositoryPath: string;
  worktreeName: string;
  goodCommit: string | null;
  badCommit: string | null;
  onClearGood: () => void;
  onClearBad: () => void;
  onStateChange: (state: GitBisectState) => void;
  onClose: () => void;
  onReload: () => void;
  notify: {
    success: (options: any) => void;
    error: (options: any) => void;
  };
  hasWorkingChanges: boolean;
}) {
  const [state, setState] = useState<GitBisectState>(EMPTY_STATE);
  const [verification, setVerification] = useState<'manual' | 'command'>(
    'manual',
  );
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState('');

  const updateState = (next: GitBisectState) => {
    setState(next);
    onStateChange(next);
  };

  useEffect(() => {
    let active = true;
    window.electron.ipcRenderer
      .invoke('git-bisect-status', repositoryPath)
      .then((next: GitBisectState) => {
        if (active) updateState(next || EMPTY_STATE);
      })
      .catch((error: any) => {
        if (!active) return;
        notify.error({
          message: 'Unable to read Git bisect status',
          description: error?.message || String(error),
          placement: 'bottomLeft',
        });
      });
    return () => {
      active = false;
    };
    // onStateChange is intentionally excluded; it is recreated by GitLog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryPath]);

  const run = async (channel: string, ...args: any[]) => {
    setLoading(channel);
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        channel,
        repositoryPath,
        ...args,
      )) as GitBisectResult;
      if (!result.ok) {
        updateState(result.state || EMPTY_STATE);
        notify.error({
          message: 'Git bisect could not continue',
          description: result.error,
          placement: 'bottomLeft',
        });
        return null;
      }
      updateState(result.state);
      setLastOutput(result.verificationOutput || result.output || '');
      onReload();
      return result;
    } catch (error: any) {
      notify.error({
        message: 'Git bisect could not continue',
        description: error?.message || String(error),
        placement: 'bottomLeft',
      });
      return null;
    } finally {
      setLoading(null);
    }
  };

  const start = async () => {
    if (!badCommit || !goodCommit) return;
    const result = await run('git-bisect-start', badCommit, goodCommit);
    if (result) {
      notify.success({
        message: 'Git bisect started',
        description: `Testing revisions in ${worktreeName}.`,
        placement: 'bottomLeft',
      });
      if (
        verification === 'command' &&
        command.trim() &&
        !result.state.completed
      ) {
        await run('git-bisect-run', command.trim());
      }
    }
  };

  const mark = async (value: BisectMark) => {
    await run('git-bisect-mark', value);
  };

  const abort = async () => {
    const result = await run('git-bisect-reset');
    if (result) {
      notify.success({
        message: 'Git bisect ended',
        description: 'The worktree was restored to its original revision.',
        placement: 'bottomLeft',
      });
      onClearGood();
      onClearBad();
      onClose();
    }
  };

  const boundariesReady = Boolean(goodCommit && badCommit);
  const commandReady = verification === 'manual' || Boolean(command.trim());
  const canStart = boundariesReady && commandReady && !hasWorkingChanges;

  const copyCulpritCommit = async () => {
    if (!state.culpritCommit) return;
    try {
      await navigator.clipboard.writeText(state.culpritCommit);
      notify.success({
        message: 'Commit copied',
        description: state.culpritCommit,
        placement: 'bottomLeft',
      });
    } catch (error: any) {
      notify.error({
        message: 'Unable to copy commit',
        description: error?.message || String(error),
        placement: 'bottomLeft',
      });
    }
  };

  return (
    <section className="git-bisect-panel" aria-label="Git bisect controls">
      <div className="git-bisect-heading">
        <span className="git-bisect-title">
          <ExperimentOutlined /> Bisect mode
        </span>
        <Typography.Text type="secondary">
          {state.active
            ? `Testing ${state.currentCommit?.slice(0, 8) || 'current revision'} in ${worktreeName}`
            : 'Choose a known good commit and a known bad commit from the log.'}
        </Typography.Text>
        <Tag className="git-bisect-worktree-tag" icon={<CodeOutlined />}>
          {worktreeName}
        </Tag>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          aria-label="Close bisect mode"
          onClick={() => {
            if (!state.active) onClose();
          }}
          disabled={state.active}
        />
      </div>

      {!state.active ? (
        <div className="git-bisect-setup">
          <div className="git-bisect-setup-grid">
            <div className="git-bisect-step">
              <span className="git-bisect-step-number">1</span>
              <div className="git-bisect-step-content">
                <Typography.Text strong>Choose boundaries</Typography.Text>
                <Typography.Text type="secondary">
                  Right-click commits in the graph to mark them.
                </Typography.Text>
                <Space wrap size={8} className="git-bisect-boundaries">
                  <Tag
                    className="git-bisect-boundary-tag"
                    color="success"
                    closable={Boolean(goodCommit)}
                    onClose={onClearGood}
                  >
                    <span>Known good</span>
                    <strong>
                      {goodCommit?.slice(0, 8) || 'Select commit'}
                    </strong>
                  </Tag>
                  <Tag
                    className="git-bisect-boundary-tag"
                    color="error"
                    closable={Boolean(badCommit)}
                    onClose={onClearBad}
                  >
                    <span>Known bad</span>
                    <strong>{badCommit?.slice(0, 8) || 'Select commit'}</strong>
                  </Tag>
                </Space>
              </div>
            </div>
            <div className="git-bisect-step">
              <span className="git-bisect-step-number">2</span>
              <div className="git-bisect-step-content">
                <Typography.Text strong>Choose verification</Typography.Text>
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  value={verification}
                  onChange={(event) => setVerification(event.target.value)}
                  options={[
                    { label: 'Manual', value: 'manual' },
                    { label: 'Run command', value: 'command' },
                  ]}
                />
                {verification === 'command' && (
                  <Input
                    className="git-bisect-command"
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    placeholder="npm test -- --runInBand"
                    prefix={<PlayCircleOutlined />}
                    onPressEnter={() => canStart && start()}
                  />
                )}
              </div>
            </div>
            <div className="git-bisect-step git-bisect-start-area">
              <span className="git-bisect-step-number">3</span>
              <div className="git-bisect-step-content">
                <Typography.Text strong>Start investigation</Typography.Text>
                <Typography.Text type="secondary">
                  {canStart
                    ? 'Everything is ready.'
                    : 'Complete the required setup.'}
                </Typography.Text>
                <Tooltip
                  title={
                    hasWorkingChanges
                      ? 'Commit or stash changes first'
                      : !boundariesReady
                        ? 'Select both boundary commits first'
                        : !commandReady
                          ? 'Enter a verification command'
                          : undefined
                  }
                >
                  <span className="git-bisect-start-button-wrap">
                    <Button
                      block
                      type="primary"
                      icon={<ExperimentOutlined />}
                      loading={loading !== null}
                      disabled={!canStart}
                      onClick={start}
                    >
                      {verification === 'command'
                        ? 'Start & run'
                        : 'Start bisect'}
                    </Button>
                  </span>
                </Tooltip>
              </div>
            </div>
          </div>
          {hasWorkingChanges && (
            <Alert
              className="git-bisect-notice"
              type="warning"
              showIcon
              message="Clean the selected worktree first"
              description="Commit or stash its working-tree changes before starting bisect."
            />
          )}
        </div>
      ) : state.completed ? (
        <div className="git-bisect-result">
          <Alert
            className="git-bisect-culprit-alert"
            type="error"
            showIcon
            message="First bad commit found"
            description={
              <div className="git-bisect-culprit">
                <Typography.Text code>{state.culpritCommit}</Typography.Text>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  aria-label="Copy first bad commit hash"
                  onClick={copyCulpritCommit}
                >
                  Copy commit
                </Button>
              </div>
            }
          />
          <Button
            icon={<StopOutlined />}
            loading={loading !== null}
            onClick={abort}
          >
            Finish & restore worktree
          </Button>
        </div>
      ) : (
        <div className="git-bisect-active-actions">
          {verification === 'command' ? (
            <>
              <Input
                className="git-bisect-command"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Verification command"
                prefix={<PlayCircleOutlined />}
                onPressEnter={() => run('git-bisect-run', command.trim())}
              />
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={loading === 'git-bisect-run'}
                disabled={!command.trim() || loading !== null}
                onClick={() => run('git-bisect-run', command.trim())}
              >
                Run automatically
              </Button>
            </>
          ) : (
            <Space wrap>
              <Button
                className="git-bisect-good-button"
                icon={<CheckOutlined />}
                disabled={loading !== null}
                onClick={() => mark('good')}
              >
                This commit is good
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                disabled={loading !== null}
                onClick={() => mark('bad')}
              >
                This commit is bad
              </Button>
              <Button disabled={loading !== null} onClick={() => mark('skip')}>
                Skip revision
              </Button>
            </Space>
          )}
          <Button
            danger
            type="text"
            icon={<StopOutlined />}
            loading={loading === 'git-bisect-reset'}
            onClick={abort}
          >
            Abort
          </Button>
        </div>
      )}
      {lastOutput && (
        <Typography.Text className="git-bisect-output" title={lastOutput}>
          {lastOutput.split('\n').slice(-1)[0]}
        </Typography.Text>
      )}
    </section>
  );
}
