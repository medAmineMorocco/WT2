import {
  Modal,
  Typography,
  notification,
  Space,
  Radio,
  Input,
  Select,
  RadioChangeEvent,
  Button,
  FloatButton,
  Result,
  Grid,
} from 'antd';
import {
  BranchesOutlined,
  TagOutlined,
  NodeIndexOutlined,
  ForkOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useState } from 'react';
import { GitCompareIcon } from 'hugeicons-react';
import TabService from '../../services/tab/TabService';
import 'diff2html/bundles/css/diff2html.min.css';
import { useItemsContext } from '../../TabsContext';

const { useBreakpoint } = Grid;

export default function GitDiff({
  isModalOpen,
  handleCancel,
}: {
  isModalOpen: boolean;
  handleCancel: any;
}) {
  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

  const { isDarkMode } = useItemsContext();

  const [diffMode, setDiffMode] = useState(false);

  const [gitDiff, setGitDiff] = useState('');

  const [leftOptions, setLeftOptions] = useState<any[]>([]);

  const [leftPlaceholder, setLeftPlaceholder] = useState('Select a worktree');

  const [isLeftInputFocus, setIsLeftInputFocus] = useState<boolean | null>(
    false,
  );

  const [rightOptions, setRightOptions] = useState<any[]>([]);

  const [rightPlaceholder, setRightPlaceholder] = useState('Select a worktree');

  const [isRightInputFocus, setIsRightInputFocus] = useState<boolean | null>(
    false,
  );

  const [branches, setBranches] = useState([]);

  const [tags, setTags] = useState([]);

  const [worktrees, setWorktrees] = useState([]);

  const [val1, setVal1] = useState<string | null>();

  const [val2, setVal2] = useState<string | null>();

  const [loading, setLoading] = useState(false);

  const [responsiveStyle, setResponsiveStyle] = useState<any>();

  const [responsiveWidth, setResponsiveWidth] = useState<string>();

  const screens = useBreakpoint();

  const mapToSelectOptions = (strings: string[]) => {
    return strings.map((branch: string) => {
      return {
        label: branch,
        value: branch,
      };
    });
  };

  useEffect(() => {
    if (screens.xl === false) {
      setResponsiveStyle({
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      });
      setResponsiveWidth('60%');
    } else {
      setResponsiveStyle({});
      setResponsiveWidth('');
    }
  }, [screens]);

  useEffect(() => {
    ipcRenderer.send('list-branches', tabRepoPath);
    ipcRenderer.send('list-tags', tabRepoPath);
    ipcRenderer.send('list-worktrees', tabRepoPath);
    const onReceiveGitDiff = (event: any, code: number, result: any) => {
      if (code === 0) {
        setGitDiff(result);
        setLoading(false);
        setDiffMode(true);
      } else {
        notification.error({
          message: 'Unable to get log',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
        setLoading(false);
        setDiffMode(false);
      }
    };

    const onReceiveBranches = (event: any, code: number, result: any) => {
      if (code === 0) {
        setBranches(result);
      } else {
        notification.error({
          message: 'Unable to get branches',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    const onReceiveTags = (event: any, code: number, result: any) => {
      if (code === 0) {
        setTags(result);
      } else {
        notification.error({
          message: 'Unable to get tags',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    const onReceiveWorktrees = (event: any, code: number, result: any) => {
      if (code === 0) {
        setWorktrees(result);
        setLeftOptions(mapToSelectOptions(result));
        setRightOptions(mapToSelectOptions(result));
      } else {
        notification.error({
          message: 'Unable to get worktrees',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    ipcRenderer.on('receive-git-diff', onReceiveGitDiff);
    ipcRenderer.on('receive-branches', onReceiveBranches);
    ipcRenderer.on('receive-tags', onReceiveTags);
    ipcRenderer.on('receive-worktrees', onReceiveWorktrees);

    return () => {
      ipcRenderer.removeAllListeners('receive-git-diff');
      ipcRenderer.removeAllListeners('receive-branches');
      ipcRenderer.removeAllListeners('receive-tags');
      ipcRenderer.removeAllListeners('receive-worktrees');
    };
  }, [tabRepoPath]);

  const onLeftModeChange = (e: RadioChangeEvent) => {
    const val = e.target.value;
    setVal1(null);
    if (val === 'commit') {
      setIsLeftInputFocus(true);
    } else if (val === 'branch') {
      setLeftPlaceholder('Select a branch');
      setIsLeftInputFocus(false);
      setLeftOptions(mapToSelectOptions(branches));
    } else if (val === 'tag') {
      setLeftPlaceholder('Select a tag');
      setIsLeftInputFocus(false);
      setLeftOptions(mapToSelectOptions(tags));
    } else if (val === 'worktree') {
      setLeftPlaceholder('Select a worktree');
      setIsLeftInputFocus(false);
      setLeftOptions(mapToSelectOptions(worktrees));
    }
  };

  const onRightModeChange = (e: RadioChangeEvent) => {
    const val = e.target.value;
    setVal2(null);
    if (val === 'commit') {
      setIsRightInputFocus(true);
    } else if (val === 'branch') {
      setRightPlaceholder('Select a branch');
      setIsRightInputFocus(false);
      setRightOptions(mapToSelectOptions(branches));
    } else if (val === 'tag') {
      setRightPlaceholder('Select a tag');
      setIsRightInputFocus(false);
      setRightOptions(mapToSelectOptions(tags));
    } else if (val === 'worktree') {
      setRightPlaceholder('Select a worktree');
      setIsRightInputFocus(false);
      setRightOptions(mapToSelectOptions(worktrees));
    }
  };

  const onLeftValueChange = (val: any) => {
    setVal1(val);
  };

  const onRightValueChange = (val: any) => {
    setVal2(val);
  };

  const findDifference = () => {
    setLoading(true);
    ipcRenderer.send('show-git-diff', val1, val2, tabRepoPath, isDarkMode);
  };

  return (
    <Modal
      open={isModalOpen}
      footer={null}
      onCancel={handleCancel}
      destroyOnClose
      className="git-log-modal"
      width="calc(100% - 216px)"
      style={{
        position: 'absolute',
        right: '8px',
        top: '48px',
        height: 'calc(100% - 56px)',
        paddingBottom: 0,
      }}
    >
      <Space>
        <GitCompareIcon size={16} />
        <strong>Git Diff</strong>
      </Space>
      <div
        style={{
          width: '96%',
          height: 'calc(100% - 46px)',
          padding: '22px',
        }}
      >
        {loading && (
          <div
            style={{
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Result
              icon={<LoadingOutlined spin />}
              title="Loading diff content... Sit back and relax 😉"
            />
          </div>
        )}
        {!loading && diffMode && (
          <div
            dangerouslySetInnerHTML={{ __html: gitDiff }}
            style={{
              position: 'absolute',
              left: '26px',
              right: '26px',
              top: '54px',
              height: '90%',
              overflowY: 'auto',
            }}
            className="diff-container"
          />
        )}
        {!loading && diffMode && (
          <FloatButton.BackTop
            target={() => document.querySelector('.diff-container')}
          />
        )}
        {!loading && !diffMode && (
          <div style={{ display: 'flex', gap: '8px', height: '80%' }}>
            <div
              style={{
                width: 0,
                flexGrow: 1,
                border: '1px dashed',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Space direction="vertical" style={{ width: responsiveWidth }}>
                <div>
                  <Radio.Group
                    style={responsiveStyle}
                    defaultValue="worktree"
                    buttonStyle="solid"
                    onChange={onLeftModeChange}
                  >
                    <Radio.Button value="worktree">
                      <Space>
                        <BranchesOutlined />
                        <span>Worktree</span>
                      </Space>
                    </Radio.Button>
                    <Radio.Button value="commit">
                      <Space>
                        <NodeIndexOutlined />
                        <span>Commit</span>
                      </Space>
                    </Radio.Button>
                    <Radio.Button value="branch">
                      <Space>
                        <ForkOutlined />
                        <span>Branch</span>
                      </Space>
                    </Radio.Button>
                    <Radio.Button value="tag">
                      <Space>
                        <TagOutlined />
                        <span>Tag</span>
                      </Space>
                    </Radio.Button>
                  </Radio.Group>
                </div>
                <div>
                  {isLeftInputFocus === true && (
                    <Input
                      value={val1}
                      placeholder="commit hash"
                      onChange={(e) => onLeftValueChange(e.target.value)}
                    />
                  )}
                  {isLeftInputFocus === false && (
                    <Select
                      placeholder={leftPlaceholder}
                      onChange={onLeftValueChange}
                      value={val1}
                      options={leftOptions}
                      showSearch
                      style={{ width: '100%' }}
                    />
                  )}
                </div>
              </Space>
            </div>

            <div
              style={{
                width: 0,
                flexGrow: 1,
                border: '1px dashed',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Space direction="vertical" style={{ width: responsiveWidth }}>
                <div>
                  <Radio.Group
                    defaultValue="worktree"
                    buttonStyle="solid"
                    style={responsiveStyle}
                    onChange={onRightModeChange}
                  >
                    <Radio.Button value="worktree">
                      <Space>
                        <BranchesOutlined />
                        <span>Worktree</span>
                      </Space>
                    </Radio.Button>
                    <Radio.Button value="commit">
                      <Space>
                        <NodeIndexOutlined />
                        <span>Commit</span>
                      </Space>
                    </Radio.Button>
                    <Radio.Button value="branch">
                      <Space>
                        <ForkOutlined />
                        <span>Branch</span>
                      </Space>
                    </Radio.Button>
                    <Radio.Button value="tag">
                      <Space>
                        <TagOutlined />
                        <span>Tag</span>
                      </Space>
                    </Radio.Button>
                  </Radio.Group>
                </div>
                <div>
                  {isRightInputFocus === true && (
                    <Input
                      value={val2}
                      placeholder="commit hash"
                      onChange={(e) => onRightValueChange(e.target.value)}
                    />
                  )}
                  {isRightInputFocus === false && (
                    <Select
                      placeholder={rightPlaceholder}
                      onChange={onRightValueChange}
                      value={val2}
                      options={rightOptions}
                      showSearch
                      style={{ width: '100%' }}
                    />
                  )}
                </div>
              </Space>
            </div>
          </div>
        )}
        {!loading && !diffMode && (
          <div
            style={{
              marginTop: '5%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Button
              type="primary"
              onClick={findDifference}
              disabled={
                !val1 || /^\s*$/.test(val1) || !val2 || /^\s*$/.test(val2)
              }
            >
              Compare
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
