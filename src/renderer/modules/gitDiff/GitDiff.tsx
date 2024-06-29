import {
  Badge,
  Button,
  Checkbox,
  Divider,
  FloatButton,
  Grid,
  Input,
  Modal,
  notification,
  Radio,
  RadioChangeEvent,
  Result,
  Select,
  Space,
  Typography,
} from 'antd';
import {
  BranchesOutlined,
  ForkOutlined,
  LoadingOutlined,
  NodeIndexOutlined,
  TagOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useState } from 'react';
import { GitCompareIcon } from 'hugeicons-react';
import {
  Diff2HtmlUI,
  Diff2HtmlUIConfig,
} from 'diff2html/lib/ui/js/diff2html-ui';
import { ColorSchemeType } from 'diff2html/lib/types';
import { useHotkeys } from 'react-hotkeys-hook';
import TabService from '../../services/tab/TabService';
import 'highlight.js/styles/github.min.css';
import 'highlight.js/styles/github-dark.min.css';
import 'diff2html/bundles/css/diff2html.min.css';
import { useItemsContext } from '../../TabsContext';

const { useBreakpoint } = Grid;

const configuration: Diff2HtmlUIConfig = {
  drawFileList: true,
  fileListToggle: false,
  outputFormat: 'side-by-side',
  highlight: true,
};

const options = ['added', 'deleted', 'modified'];

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

  const [diff, setDiff] = useState();

  const [diffMode, setDiffMode] = useState(false);

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

  const [refs, setRefs] = useState<any>([]);

  const [diffFilters, setDiffFilters] = useState<any[]>(options);

  const [diffStats, setDiffStats] = useState<any>();

  const [leftMode, setLeftMode] = useState('worktree');

  const [val1, setVal1] = useState<string | null>();

  const [rightMode, setRightMode] = useState('worktree');

  const [val2, setVal2] = useState<string | null>();

  const [loading, setLoading] = useState(false);

  const [responsiveStyle, setResponsiveStyle] = useState<any>();

  const [responsiveWidth, setResponsiveWidth] = useState<string>();

  const screens = useBreakpoint();

  const checkAll = options.length === diffFilters.length;
  const indeterminate =
    diffFilters.length > 0 && diffFilters.length < options.length;

  const mapToSelectOptions = (strings: string[]) => {
    return strings.map((branch: string) => {
      return {
        label: branch,
        value: branch,
      };
    });
  };

  const drawDiff = (dif: string) => {
    const targetElement = document.getElementById('git-diff');
    if (targetElement) {
      configuration.colorScheme = isDarkMode
        ? ColorSchemeType.DARK
        : ColorSchemeType.LIGHT;
      const diff2htmlUi = new Diff2HtmlUI(targetElement, dif, configuration);
      diff2htmlUi.draw();
      diff2htmlUi.highlightCode();
    }
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
    ipcRenderer.send('list-refs', tabRepoPath);
    const onReceiveGitDiff = (event: any, code: number, result: any) => {
      if (code === 0) {
        setDiff(result);
        drawDiff(result);
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

    const onReceiveRefs = (event: any, code: number, result: any) => {
      if (code === 0) {
        setRefs(result);
        setLeftOptions(mapToSelectOptions(result.worktrees));
        setRightOptions(mapToSelectOptions(result.worktrees));
      } else {
        notification.error({
          message: 'Unable to get worktrees',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    const onReceiveDiffStats = (event: any, code: number, result: any) => {
      if (code === 0) {
        setDiffStats(result);
      }
    };

    ipcRenderer.on('receive-git-diff', onReceiveGitDiff);
    ipcRenderer.on('receive-refs', onReceiveRefs);
    ipcRenderer.on('receive-diff-stats', onReceiveDiffStats);

    return () => {
      ipcRenderer.removeAllListeners('receive-git-diff');
      ipcRenderer.removeAllListeners('receive-refs');
      ipcRenderer.removeAllListeners('receive-diff-stats');
    };
  }, [isDarkMode, tabRepoPath]);

  const onLeftModeChange = (e: RadioChangeEvent) => {
    const val = e.target.value;
    setLeftMode(val);
    setVal1(null);
    if (val === 'commit') {
      setIsLeftInputFocus(true);
    } else if (val === 'branch') {
      setLeftPlaceholder('Select a branch');
      setIsLeftInputFocus(false);
      setLeftOptions(mapToSelectOptions(refs.branches));
    } else if (val === 'tag') {
      setLeftPlaceholder('Select a tag');
      setIsLeftInputFocus(false);
      setLeftOptions(mapToSelectOptions(refs.tags));
    } else if (val === 'worktree') {
      setLeftPlaceholder('Select a worktree');
      setIsLeftInputFocus(false);
      setLeftOptions(mapToSelectOptions(refs.worktrees));
    }
  };

  const onRightModeChange = (e: RadioChangeEvent) => {
    const val = e.target.value;
    setRightMode(val);
    setVal2(null);
    if (val === 'commit') {
      setIsRightInputFocus(true);
    } else if (val === 'branch') {
      setRightPlaceholder('Select a branch');
      setIsRightInputFocus(false);
      setRightOptions(mapToSelectOptions(refs.branches));
    } else if (val === 'tag') {
      setRightPlaceholder('Select a tag');
      setIsRightInputFocus(false);
      setRightOptions(mapToSelectOptions(refs.tags));
    } else if (val === 'worktree') {
      setRightPlaceholder('Select a worktree');
      setIsRightInputFocus(false);
      setRightOptions(mapToSelectOptions(refs.worktrees));
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
    ipcRenderer.send(
      'show-git-diff',
      val1,
      val2,
      diffFilters,
      checkAll,
      tabRepoPath,
    );
    ipcRenderer.send(
      'git-diff-stats',
      val1,
      val2,
      diffFilters,
      checkAll,
      tabRepoPath,
    );
  };

  const onThemeChange = () => {
    if (diff) {
      drawDiff(diff);
    }
  };

  const clear = () => {
    const targetElement = document.getElementById('git-diff');
    if (targetElement) {
      targetElement.innerHTML = '';
    }
    setDiffMode(false);
  };
  const filter = () => {
    const targetElement = document.getElementById('git-diff');
    if (targetElement) {
      targetElement.innerHTML = '';
    }
    setLoading(true);
    ipcRenderer.send(
      'show-git-diff',
      val1,
      val2,
      diffFilters,
      checkAll,
      tabRepoPath,
    );
    ipcRenderer.send(
      'git-diff-stats',
      val1,
      val2,
      diffFilters,
      checkAll,
      tabRepoPath,
    );
  };

  const onChangeFilter = (checkedValues: any[]) => {
    setDiffFilters(checkedValues);
  };

  const onCheckAllChange = (e: any) => {
    setDiffFilters(e.target.checked ? options : []);
  };

  useHotkeys('shift+t', onThemeChange, {
    preventDefault: true,
  });

  return (
    <Modal
      open={isModalOpen}
      footer={null}
      onCancel={handleCancel}
      destroyOnClose
      className="git-log-modal"
      width="100%"
      style={{
        position: 'absolute',
        right: '8px',
        left: '8px',
        top: '48px',
        height: 'calc(100% - 56px)',
        paddingBottom: 0,
      }}
    >
      <Space>
        <GitCompareIcon size={16} />
        <strong>Git Diff</strong>
      </Space>

      <div style={{ display: 'flex', height: '98%' }}>
        <div style={{ width: '246px', padding: '22px', paddingLeft: 0 }}>
          <div>
            <Space>
              <strong>
                {leftMode === 'commit' ? val1?.substring(0, 6) : val1}
              </strong>
              {val1 && leftMode && <i>({leftMode})</i>}
              {(val1 || val2) && <SwapOutlined />}
              <strong>
                {rightMode === 'commit' ? val2?.substring(0, 6) : val2}
              </strong>
              {val2 && rightMode && <i>({rightMode})</i>}
            </Space>
          </div>
          <br />
          <div style={{ display: 'flex' }}>
            <div>
              <div>
                <Checkbox
                  value="all"
                  indeterminate={indeterminate}
                  onChange={onCheckAllChange}
                  checked={checkAll}
                  style={{ marginBottom: '8px' }}
                >
                  All
                </Checkbox>
              </div>
              <div>
                <Checkbox.Group value={diffFilters} onChange={onChangeFilter}>
                  <Space direction="vertical">
                    <Checkbox value="added">Added</Checkbox>
                    <Checkbox value="deleted">Deleted</Checkbox>
                    <Checkbox value="modified">Modified</Checkbox>
                  </Space>
                </Checkbox.Group>
              </div>
            </div>
            <div
              style={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                rowGap: '8px',
                justifyContent: 'space-evenly',
                alignItems: 'flex-end',
                color: 'white',
              }}
            >
              {!loading && diffStats && (
                <Badge
                  count={diffStats.all ? diffStats.all : 0}
                  showZero
                  color="#FAAD14"
                  overflowCount={1000}
                />
              )}
              {!loading && diffStats && (
                <Badge
                  count={diffStats.added ? diffStats.added : 0}
                  showZero
                  color="#FAAD14"
                  overflowCount={1000}
                />
              )}
              {!loading && diffStats && (
                <Badge
                  count={diffStats.deleted ? diffStats.deleted : 0}
                  showZero
                  color="#FAAD14"
                  overflowCount={1000}
                />
              )}
              {!loading && diffStats && (
                <Badge
                  count={diffStats.modified ? diffStats.modified : 0}
                  showZero
                  color="#FAAD14"
                  overflowCount={1000}
                />
              )}
            </div>
          </div>
          <br />
          {diffMode && (
            <Space>
              <Button onClick={clear} disabled={loading} type="link">
                Clear
              </Button>

              <Button onClick={filter} disabled={loading} type="primary">
                Filter
              </Button>
            </Space>
          )}
        </div>
        <Divider type="vertical" style={{ height: '100%' }} />

        <div style={{ flexGrow: 1 }}>
          <div
            style={{
              position: 'relative',
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
            <div
              id="git-diff"
              style={{
                position: 'absolute',
                left: '26px',
                right: '26px',
                top: '22px',
                height: '90%',
                overflowY: 'auto',
              }}
              className="diff-container"
            />
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
                  <Space
                    direction="vertical"
                    style={{ width: responsiveWidth }}
                  >
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
                  <Space
                    direction="vertical"
                    style={{ width: responsiveWidth }}
                  >
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
        </div>
      </div>
    </Modal>
  );
}
