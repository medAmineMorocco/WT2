import {
  App as AntdApp,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Alert,
  Segmented,
  Select,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import {
  BranchesOutlined,
  FolderOutlined,
  InfoCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import log from 'electron-log';
import { useNavigate } from 'react-router-dom';
import TabService from '../../services/tab/TabService';
import { useItemsContext } from '../../TabsContext';
import {
  EnvironmentIsolationConfig,
  EnvironmentSetting,
  EnvironmentSource,
  IsolationStrategy,
  SuggestedCommand,
} from '../../../shared/environmentIsolation';

export default function AddWorktree({
  isModalOpen,
  handleCancel,
  setMode,
}: {
  isModalOpen: boolean;
  handleCancel: any;
  setMode: any;
}) {
  const navigate = useNavigate();

  const { setIsWorkflowPlaying } = useItemsContext();

  const [createWorktreeMode, setCreateWorktreeMode] = useState('new-branch');

  const [branches, setBranches] = useState<any[]>([]);

  const [tags, setTags] = useState<any[]>([]);

  const [worktreesFolder, setWorktreesFolder] = useState<string>('');

  const [pathSeparator, setPathSeparator] = useState<string>('');

  const [loadingCreateWorktree, setLoadingCreateWorktree] = useState(false);

  const [isolateEnvironment, setIsolateEnvironment] = useState(false);

  const [environmentSources, setEnvironmentSources] = useState<
    EnvironmentSource[]
  >([]);

  const [selectedEnvironmentSourceIds, setSelectedEnvironmentSourceIds] =
    useState<string[]>([]);

  const [activeEnvironmentSourceId, setActiveEnvironmentSourceId] =
    useState('');

  const [environmentSettingsBySource, setEnvironmentSettingsBySource] =
    useState<Record<string, EnvironmentSetting[]>>({});

  const [environmentStrategies, setEnvironmentStrategies] = useState<
    Record<string, IsolationStrategy>
  >({});

  const [rememberEnvironmentChoices, setRememberEnvironmentChoices] =
    useState(true);

  const [creationProgress, setCreationProgress] = useState<string[]>([]);

  const [generatedEnvironmentValues, setGeneratedEnvironmentValues] = useState<
    Record<string, string>
  >({});

  const [previewPortAllocations, setPreviewPortAllocations] = useState<
    Record<string, number>
  >({});

  const [loadingEnvironmentPreview, setLoadingEnvironmentPreview] =
    useState(false);

  const [suggestedCommands, setSuggestedCommands] = useState<
    SuggestedCommand[]
  >([]);

  const environmentPreviewRequest = useRef(0);

  const selectTagRef = useRef(null);

  const selectBranchRef = useRef(null);

  const { notification } = AntdApp.useApp();

  const [form] = Form.useForm();

  const watchedWorktreeName = Form.useWatch('name', form);
  const watchedExistingBranch = Form.useWatch('existing-branch', form);
  const watchedExistingTag = Form.useWatch('existing-tag', form);

  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const { selectedRepoPath: tabRepoPath, repoName } = useMemo(() => {
    return TabService.getTab(activeTab);
  }, [activeTab]);

  const selectedEnvironmentSettings = useMemo(
    () =>
      selectedEnvironmentSourceIds.flatMap(
        (sourceId) => environmentSettingsBySource[sourceId] || [],
      ),
    [environmentSettingsBySource, selectedEnvironmentSourceIds],
  );

  const activeEnvironmentSettings = useMemo(
    () => environmentSettingsBySource[activeEnvironmentSourceId] || [],
    [activeEnvironmentSourceId, environmentSettingsBySource],
  );

  const selectedEnvironmentSources = useMemo(
    () =>
      selectedEnvironmentSourceIds.flatMap((sourceId) => {
        const source = environmentSources.find(
          (candidate) => candidate.id === sourceId,
        );
        return source ? [source] : [];
      }),
    [environmentSources, selectedEnvironmentSourceIds],
  );

  const storedWorktreePrefix =
    window.localStorage.getItem('worktreePrefix') != null &&
    window.localStorage.getItem('worktreePrefix')?.trim() !== ''
      ? window.localStorage.getItem('worktreePrefix')
      : '{repo}__wt__{branch}';

  useEffect(() => {
    const activeTabValue = TabService.getTab(activeTab);
    if (activeTabValue.worktreesPath) {
      window.electron.ipcRenderer.send('get-worktrees-separator', tabRepoPath);
      setWorktreesFolder(activeTabValue.worktreesPath);
    } else {
      window.electron.ipcRenderer.send('get-worktrees-folder', tabRepoPath);
    }

    const onWorktreeCreated = (code: number, result: any) => {
      log.debug(
        `onWorktreeCreated code: ${code} result: ${JSON.stringify(result)}`,
      );
      if (code === 0) {
        form.setFieldValue('name', null);
        notification.success({
          message: 'Worktree Created',
          placement: 'bottomLeft',
          duration: 1,
        });
        setLoadingCreateWorktree(false);
        window.electron.ipcRenderer.send('show-git-log', tabRepoPath);
        window.electron.ipcRenderer.send('get-worktrees', tabRepoPath);
        handleCancel();
      } else {
        setLoadingCreateWorktree(false);
        notification.error({
          message: 'Unable to Create Worktree',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onBranchesFound = (code: number, result: any) => {
      if (code === 0) {
        setBranches(
          JSON.parse(result).map((branch: string) => {
            return {
              label: branch,
              value: branch,
            };
          }),
        );
      }
    };

    const onTagsFound = (code: number, result: any) => {
      if (code === 0) {
        setTags(
          result.map((branch: string) => {
            return {
              label: branch,
              value: branch,
            };
          }),
        );
      }
    };

    const onWorktreesFolderFound = (code: number, result: any) => {
      if (code === 0) {
        const { folder, separator } = JSON.parse(result);
        setWorktreesFolder(folder);
        setPathSeparator(separator);
      }
    };

    const onWorktreesSeparatorFound = (code: number, result: any) => {
      if (code === 0) {
        setPathSeparator(result);
      }
    };

    const onSelectWorktreesDir = (code: number, dirPath: string) => {
      if (code === 0) {
        setWorktreesFolder(dirPath);
      }
    };

    const onEnvironmentSourcesDetected = (code: number, result: any) => {
      if (code === 0) {
        const sources = result as EnvironmentSource[];
        setEnvironmentSources(sources);
        if (result.length === 0) {
          setSelectedEnvironmentSourceIds([]);
          setActiveEnvironmentSourceId('');
          setEnvironmentSettingsBySource({});
          setEnvironmentStrategies({});
          return;
        }
        const saved = TabService.getTab(activeTab)?.environmentIsolation;
        const rememberedIds = (saved?.sources || [])
          .map((sourceConfig: any) => sourceConfig.source?.id)
          .filter((id: string) => sources.some((source) => source.id === id));
        if (saved?.sourceFile) {
          const legacySource = sources.find(
            (source) => source.relativePath === saved.sourceFile,
          );
          if (legacySource && !rememberedIds.includes(legacySource.id)) {
            rememberedIds.push(legacySource.id);
          }
        }
        const selectedIds = rememberedIds.length
          ? rememberedIds
          : [sources[0].id];
        setSelectedEnvironmentSourceIds(selectedIds);
        setActiveEnvironmentSourceId(selectedIds[0]);
        selectedIds.forEach((sourceId: string) => {
          const source = sources.find((candidate) => candidate.id === sourceId);
          if (!source) return;
          window.electron.ipcRenderer.send(
            'read-environment-source',
            tabRepoPath,
            source,
          );
        });
      } else {
        notification.error({
          message: 'Unable to detect environment sources',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onEnvironmentSourceRead = (
      code: number,
      result: any,
      source: EnvironmentSource,
    ) => {
      if (code !== 0) {
        notification.error({
          message: 'Unable to read environment source',
          description: result,
          placement: 'bottomLeft',
        });
        return;
      }
      const settings = result as EnvironmentSetting[];
      setEnvironmentSettingsBySource((current) => ({
        ...current,
        [source.id]: settings,
      }));
      const saved = TabService.getTab(activeTab)?.environmentIsolation;
      const savedSource = (saved?.sources || []).find(
        (sourceConfig: any) => sourceConfig.source?.id === source.id,
      );
      const legacyStrategies =
        saved?.sourceFile === source?.relativePath ? saved.variables || {} : {};
      setEnvironmentStrategies((current) => ({
        ...current,
        ...Object.fromEntries(
          settings.map((setting) => [
            setting.id,
            savedSource?.strategies?.[setting.id] ||
              legacyStrategies[setting.key] ||
              setting.suggestedStrategy,
          ]),
        ),
      }));
    };

    const onCreationProgress = (_key: string, label: string) => {
      setCreationProgress((current) => [...current, label]);
    };

    const onEnvironmentIsolationPreviewed = (
      code: number,
      result: any,
      requestId: number,
    ) => {
      if (requestId !== environmentPreviewRequest.current) return;
      setLoadingEnvironmentPreview(false);
      if (code === 0) {
        setGeneratedEnvironmentValues(result.values);
        setPreviewPortAllocations(result.portAllocations);
      } else {
        setGeneratedEnvironmentValues({});
        setPreviewPortAllocations({});
        notification.error({
          message: 'Unable to preview environment isolation',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onEnvironmentSuggestionsPreviewed = (
      code: number,
      result: any,
      requestId: number,
    ) => {
      if (requestId !== environmentPreviewRequest.current) return;
      setSuggestedCommands(code === 0 ? result : []);
    };

    window.electron.ipcRenderer.on('worktree-created', onWorktreeCreated);
    window.electron.ipcRenderer.on('receive-branches', onBranchesFound);
    window.electron.ipcRenderer.on('receive-tags', onTagsFound);
    window.electron.ipcRenderer.on(
      'worktrees-folder-found',
      onWorktreesFolderFound,
    );
    window.electron.ipcRenderer.on(
      'worktrees-separator-found',
      onWorktreesSeparatorFound,
    );
    window.electron.ipcRenderer.on(
      'selected-worktrees-dir',
      onSelectWorktreesDir,
    );
    window.electron.ipcRenderer.on(
      'environment-sources-detected',
      onEnvironmentSourcesDetected,
    );
    window.electron.ipcRenderer.on(
      'environment-source-read',
      onEnvironmentSourceRead,
    );
    window.electron.ipcRenderer.on(
      'worktree-creation-progress',
      onCreationProgress,
    );
    window.electron.ipcRenderer.on(
      'environment-isolation-previewed',
      onEnvironmentIsolationPreviewed,
    );
    window.electron.ipcRenderer.on(
      'environment-suggestions-previewed',
      onEnvironmentSuggestionsPreviewed,
    );

    return () => {
      window.electron.ipcRenderer.removeAllListeners('worktree-created');
      window.electron.ipcRenderer.removeAllListeners('receive-branches');
      window.electron.ipcRenderer.removeAllListeners('receive-tags');
      window.electron.ipcRenderer.removeAllListeners('worktrees-folder-found');
      window.electron.ipcRenderer.removeAllListeners(
        'worktrees-separator-found',
      );
      window.electron.ipcRenderer.removeAllListeners('selected-worktrees-dir');
      window.electron.ipcRenderer.removeAllListeners(
        'environment-sources-detected',
      );
      window.electron.ipcRenderer.removeAllListeners('environment-source-read');
      window.electron.ipcRenderer.removeAllListeners(
        'worktree-creation-progress',
      );
      window.electron.ipcRenderer.removeAllListeners(
        'environment-isolation-previewed',
      );
      window.electron.ipcRenderer.removeAllListeners(
        'environment-suggestions-previewed',
      );
    };
    // do not touch
  }, [form, notification, tabRepoPath]);

  function sanitizeWorktreeName(worktreeName: string) {
    if (!worktreeName) {
      return null;
    }
    return worktreeName.replace(/\//g, '-').replace(/[:*?"<>|\\]/g, '-');
  }

  useEffect(() => {
    const activeTabValue = TabService.getTab(activeTab);
    if (activeTabValue.preHook) {
      form.setFieldValue('preHook', activeTabValue.preHook);
    }
    if (activeTabValue.postHook) {
      form.setFieldValue('postHook', activeTabValue.postHook);
    }
  }, [activeTab, form, isModalOpen, tabRepoPath]);

  useEffect(() => {
    if (!isModalOpen) return;
    const saved = TabService.getTab(activeTab)?.environmentIsolation;
    if (saved) {
      setIsolateEnvironment(true);
      setRememberEnvironmentChoices(true);
    }
  }, [activeTab, isModalOpen]);

  useEffect(() => {
    if (isolateEnvironment && isModalOpen) {
      window.electron.ipcRenderer.send(
        'detect-environment-sources',
        tabRepoPath,
      );
    }
  }, [isModalOpen, isolateEnvironment, tabRepoPath]);

  useEffect(() => {
    if (!isolateEnvironment || selectedEnvironmentSources.length === 0) {
      setGeneratedEnvironmentValues({});
      setPreviewPortAllocations({});
      setSuggestedCommands([]);
      setLoadingEnvironmentPreview(false);
      return undefined;
    }
    const worktreeName =
      createWorktreeMode === 'new-branch'
        ? watchedWorktreeName
        : createWorktreeMode === 'existing-branch'
          ? watchedExistingBranch
          : watchedExistingTag;
    const requestId = environmentPreviewRequest.current + 1;
    environmentPreviewRequest.current = requestId;
    setLoadingEnvironmentPreview(selectedEnvironmentSettings.length > 0);
    const timeout = window.setTimeout(() => {
      const previewWorktreeName = worktreeName || 'worktree-name';
      if (selectedEnvironmentSettings.length > 0) {
        window.electron.ipcRenderer.send(
          'preview-environment-isolation',
          requestId,
          selectedEnvironmentSettings,
          environmentStrategies,
          previewWorktreeName,
        );
      } else {
        setGeneratedEnvironmentValues({});
        setPreviewPortAllocations({});
      }
      window.electron.ipcRenderer.send(
        'preview-environment-suggestions',
        requestId,
        tabRepoPath,
        worktreeName || '{worktree-name}',
        selectedEnvironmentSources,
      );
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [
    createWorktreeMode,
    environmentStrategies,
    selectedEnvironmentSettings,
    selectedEnvironmentSources,
    isolateEnvironment,
    watchedExistingBranch,
    watchedExistingTag,
    watchedWorktreeName,
    tabRepoPath,
  ]);

  useEffect(() => {
    if (createWorktreeMode === 'existing-branch' && isModalOpen) {
      window.electron.ipcRenderer.send('list-branches', tabRepoPath);
    }
    if (createWorktreeMode === 'existing-tag' && isModalOpen) {
      window.electron.ipcRenderer.send('list-tags', tabRepoPath);
    }
  }, [activeTab, createWorktreeMode, form, isModalOpen, tabRepoPath]);

  const onChangeCreateWorktreeMode = (newVal: string) => {
    setCreateWorktreeMode(newVal);
  };

  function isNotBlank(val: string | null | undefined) {
    return typeof val === 'string' && val.trim() !== '';
  }

  function resolveWorktreeNamePattern(
    pattern: string | null,
    repo: string,
    branch: string,
  ): string {
    if (!pattern || (pattern && pattern.trim() === '')) {
      return branch;
    }
    return pattern.replaceAll(/{repo}/g, repo).replaceAll(/{branch}/g, branch);
  }

  const getWorktreeName = () => {
    let branch;
    if (createWorktreeMode === 'new-branch') {
      branch = sanitizeWorktreeName(form.getFieldValue('name')) || ' ';
    } else if (createWorktreeMode === 'existing-branch') {
      branch =
        sanitizeWorktreeName(form.getFieldValue('existing-branch')) || ' ';
    } else {
      const tag = form.getFieldValue('existing-tag');
      if (tag) {
        branch = form.getFieldValue('existing-tag').replaceAll('.', '-');
      } else {
        branch = '';
      }
    }
    return resolveWorktreeNamePattern(storedWorktreePrefix, repoName, branch);
  };

  const onFinish = (values: any) => {
    log.debug(`values: ${JSON.stringify(values)}`);
    let worktreeName: any;
    if (createWorktreeMode === 'new-branch') {
      worktreeName = values.name;
    } else if (createWorktreeMode === 'existing-branch') {
      worktreeName = values['existing-branch'];
    } else {
      worktreeName = values['existing-tag'];
    }
    const environmentIsolation: EnvironmentIsolationConfig | undefined =
      isolateEnvironment && selectedEnvironmentSourceIds.length > 0
        ? {
            sources: selectedEnvironmentSourceIds.flatMap((sourceId) => {
              const source = environmentSources.find(
                (candidate) => candidate.id === sourceId,
              );
              if (!source) return [];
              const sourceSettings =
                environmentSettingsBySource[sourceId] || [];
              return [
                {
                  source,
                  strategies: Object.fromEntries(
                    sourceSettings.map((setting) => [
                      setting.id,
                      environmentStrategies[setting.id] ||
                        setting.suggestedStrategy,
                    ]),
                  ),
                  portAllocations: Object.fromEntries(
                    sourceSettings.flatMap((setting) =>
                      previewPortAllocations[setting.id]
                        ? [[setting.id, previewPortAllocations[setting.id]]]
                        : [],
                    ),
                  ),
                },
              ];
            }),
          }
        : undefined;
    setCreationProgress([]);
    if (
      !environmentIsolation &&
      !isNotBlank(values.preHook) &&
      !isNotBlank(values.postHook)
    ) {
      log.debug('== create-worktree ==');

      setLoadingCreateWorktree(true);
      window.electron.ipcRenderer.send(
        'create-worktree',
        worktreeName,
        worktreesFolder + pathSeparator + getWorktreeName(),
        createWorktreeMode,
        tabRepoPath,
        environmentIsolation,
      );
    } else {
      log.debug('== create-worktree-workflow ==');
      window.electron.ipcRenderer.send(
        'create-worktree-workflow',
        values,
        createWorktreeMode,
        worktreeName.replaceAll('.', '-'),
        worktreesFolder + pathSeparator + getWorktreeName(),
        tabRepoPath,
        environmentIsolation,
      );
      setIsWorkflowPlaying(true);
      handleCancel();
      setMode({ target: { value: 'WORKFLOW' } });
    }

    const activeTabValue = TabService.getTab(activeTab);
    const activeTabNewValue = {
      ...activeTabValue,
      preHook: values.preHook,
      postHook: values.postHook,
      worktreesPath: worktreesFolder,
      environmentIsolation: rememberEnvironmentChoices
        ? environmentIsolation && {
            sources: environmentIsolation.sources.map((sourceConfig) => ({
              source: sourceConfig.source,
              strategies: sourceConfig.strategies,
            })),
          }
        : activeTabValue.environmentIsolation,
    };
    if (!rememberEnvironmentChoices) {
      delete activeTabNewValue.environmentIsolation;
    }
    window.localStorage.setItem(activeTab, JSON.stringify(activeTabNewValue));
  };

  const chooseWorktreesDir = () => {
    window.electron.ipcRenderer.send('choose-worktrees-dir');
  };

  const onSelectTagChange = () => {
    if (selectTagRef.current) {
      // @ts-ignore
      selectTagRef.current.blur();
    }
  };

  const onSelectBranchChange = () => {
    if (selectBranchRef.current) {
      // @ts-ignore
      selectBranchRef.current.blur();
    }
  };

  const openSettingsPage = () => {
    navigate('/settings');
  };

  const toggleEnvironmentSource = (
    source: EnvironmentSource,
    selected: boolean,
  ) => {
    setSelectedEnvironmentSourceIds((current) => {
      const next = selected
        ? [...new Set([...current, source.id])]
        : current.filter((sourceId) => sourceId !== source.id);
      if (!next.includes(activeEnvironmentSourceId)) {
        setActiveEnvironmentSourceId(next[0] || '');
      }
      return next;
    });
    if (selected && !environmentSettingsBySource[source.id]) {
      window.electron.ipcRenderer.send(
        'read-environment-source',
        tabRepoPath,
        source,
      );
    }
  };

  return (
    <Modal
      open={isModalOpen}
      footer={null}
      onCancel={handleCancel}
      destroyOnClose
      width={950}
      closeIcon={false}
      centered={true}
      styles={{
        body: {
          display: 'flex',
          flexDirection: 'column',
          height: '90vh',
          overflow: 'hidden',
        },
      }}
    >
      <Segmented
        defaultValue={createWorktreeMode}
        onChange={onChangeCreateWorktreeMode}
        block
        options={[
          {
            label: <div style={{ padding: 2 }}>From Head</div>,
            value: 'new-branch',
          },
          {
            label: <div style={{ padding: 2 }}>From Branch</div>,
            value: 'existing-branch',
          },
          {
            label: <div style={{ padding: 2 }}>From Tag</div>,
            value: 'existing-tag',
          },
        ]}
      />
      <Form
        layout="vertical"
        requiredMark="optional"
        form={form}
        onFinish={onFinish}
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          marginTop: 8,
          minHeight: 0,
        }}
      >
        <div
          className="create-worktree-scrollable-content"
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {createWorktreeMode === 'new-branch' && (
            <Form.Item
              label="Name"
              name="name"
              extra="Always created from HEAD of the main worktree"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Please enter the name of your worktree.',
                },
              ]}
              style={{ marginBottom: 12 }}
            >
              <Input
                prefix={<BranchesOutlined />}
                placeholder="feature-add-sidebar"
                allowClear
              />
            </Form.Item>
          )}
          {createWorktreeMode === 'existing-branch' && (
            <Form.Item
              label="Existing branch"
              name="existing-branch"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Please choose a branch.',
                },
              ]}
              style={{ marginBottom: 12 }}
            >
              <Select
                ref={selectBranchRef}
                allowClear
                showSearch
                placeholder="Select branch"
                options={branches}
                onChange={onSelectBranchChange}
              />
            </Form.Item>
          )}
          {createWorktreeMode === 'existing-tag' && (
            <Form.Item
              label="Existing tag"
              name="existing-tag"
              extra="A new branch is created from the selected tag, and a worktree is linked to it"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Please choose a tag.',
                },
              ]}
              style={{ marginBottom: 12 }}
            >
              <Select
                ref={selectTagRef}
                allowClear
                showSearch
                placeholder="Select tag"
                options={tags}
                onChange={onSelectTagChange}
              />
            </Form.Item>
          )}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <Form.Item
              label="Pre-hook"
              name="preHook"
              style={{ flex: 1, marginBottom: 10 }}
              tooltip={{
                title: `command will be executed in main worktree : ${tabRepoPath}`,
                icon: <InfoCircleOutlined />,
                placement: 'right',
              }}
            >
              <Input
                prefix={<StepBackwardOutlined />}
                placeholder="git fetch origin main:main"
                allowClear
              />
            </Form.Item>
            <Form.Item
              label="Post-hook"
              name="postHook"
              style={{ flex: 1, marginBottom: 10 }}
              tooltip={{
                title: `command will be executed in created worktree repository`,
                icon: <InfoCircleOutlined />,
                placement: 'right',
              }}
            >
              <Input
                prefix={<StepForwardOutlined />}
                placeholder="npm install"
                allowClear
              />
            </Form.Item>
          </div>
          <small>The worktree will be created at the specified directory</small>
          <Form.Item
            style={{ marginBottom: 10 }}
            extra={
              <small>
                {`The folder name will be based on your current naming pattern: ${storedWorktreePrefix}.`}
                <Button
                  type="link"
                  onClick={openSettingsPage}
                  style={{ paddingLeft: 0 }}
                >
                  <small>Want to change it ?</small>
                </Button>
              </small>
            }
          >
            <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
              <Tooltip
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
                title="Change Location"
                placement="bottom"
              >
                <Button
                  size="small"
                  icon={<FolderOutlined />}
                  onClick={chooseWorktreesDir}
                />
              </Tooltip>
              <Tooltip
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
                title={worktreesFolder + pathSeparator + getWorktreeName()}
                placement="bottom"
              >
                <Typography.Text
                  code
                  ellipsis={{ rows: 1 }}
                  style={{ direction: 'rtl' }}
                >
                  {worktreesFolder + pathSeparator + getWorktreeName()}
                </Typography.Text>
              </Tooltip>
            </div>
          </Form.Item>
          <Form.Item style={{ marginBottom: isolateEnvironment ? 12 : 24 }}>
            <Checkbox
              checked={isolateEnvironment}
              onChange={(event) => setIsolateEnvironment(event.target.checked)}
            >
              Isolate environment
            </Checkbox>
          </Form.Item>
          {isolateEnvironment && (
            <div style={{ marginBottom: 10 }}>
              <Typography.Text strong>Environment sources</Typography.Text>
              <div
                style={{
                  maxHeight: 104,
                  margin: '6px 0 8px',
                  overflowY: 'auto',
                }}
              >
                {environmentSources.length === 0 ? (
                  <Typography.Text type="secondary">
                    No supported environment sources were detected.
                  </Typography.Text>
                ) : (
                  environmentSources.map((source) => (
                    <div
                      key={source.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: 28,
                        paddingRight: 8,
                      }}
                    >
                      <Checkbox
                        checked={selectedEnvironmentSourceIds.includes(
                          source.id,
                        )}
                        onChange={(event) =>
                          toggleEnvironmentSource(source, event.target.checked)
                        }
                      >
                        {source.relativePath}
                      </Checkbox>
                      <Typography.Text type="secondary">
                        {source.detectedType}
                      </Typography.Text>
                    </div>
                  ))
                )}
              </div>
              {selectedEnvironmentSourceIds.length > 0 && (
                <Select
                  size="small"
                  style={{ width: '100%', marginBottom: 6 }}
                  value={activeEnvironmentSourceId || undefined}
                  placeholder="Select source settings"
                  options={selectedEnvironmentSourceIds.flatMap((sourceId) => {
                    const source = environmentSources.find(
                      (candidate) => candidate.id === sourceId,
                    );
                    return source
                      ? [{ label: source.relativePath, value: source.id }]
                      : [];
                  })}
                  onChange={setActiveEnvironmentSourceId}
                />
              )}
              {activeEnvironmentSettings.length > 0 && (
                <Table
                  className="environment-isolation-table"
                  size="small"
                  pagination={false}
                  rowKey="id"
                  dataSource={activeEnvironmentSettings}
                  loading={loadingEnvironmentPreview}
                  virtual
                  scroll={{ x: 900, y: 160 }}
                  tableLayout="fixed"
                  columns={[
                    { title: 'Variable', dataIndex: 'key', width: '28%' },
                    {
                      title: 'Current value',
                      width: '24%',
                      render: (_, setting: EnvironmentSetting) => (
                        <Typography.Text ellipsis>
                          {setting.sensitive ? '********' : setting.value}
                        </Typography.Text>
                      ),
                    },
                    {
                      title: 'Isolation strategy',
                      width: '25%',
                      render: (_, setting: EnvironmentSetting) => (
                        <Select
                          style={{ width: '100%' }}
                          value={environmentStrategies[setting.id] || 'shared'}
                          options={[
                            { label: 'Shared', value: 'shared' },
                            {
                              label: 'Suffix',
                              value: 'suffix',
                              disabled: /^\d+$/.test(setting.value),
                            },
                            {
                              label: 'Auto Port',
                              value: 'auto-port',
                              disabled: !/^\d+$/.test(setting.value),
                            },
                          ]}
                          onChange={(strategy: IsolationStrategy) =>
                            setEnvironmentStrategies((current) => ({
                              ...current,
                              [setting.id]: strategy,
                            }))
                          }
                        />
                      ),
                    },
                    {
                      title: 'Generated value',
                      width: '23%',
                      render: (_, setting: EnvironmentSetting) => {
                        const generatedValue =
                          generatedEnvironmentValues[setting.id] ??
                          setting.value;
                        return (
                          <Typography.Text ellipsis>
                            {setting.sensitive
                              ? '********'
                              : `\u2192 ${generatedValue}`}
                          </Typography.Text>
                        );
                      },
                    },
                  ]}
                />
              )}
              <Checkbox
                style={{ marginTop: 8 }}
                checked={rememberEnvironmentChoices}
                onChange={(event) =>
                  setRememberEnvironmentChoices(event.target.checked)
                }
              >
                Remember these choices for future worktrees
              </Checkbox>
              {suggestedCommands.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <Typography.Text strong>Suggested commands</Typography.Text>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginBottom: 4 }}
                  >
                    Review before running. WorktreeWise will not execute these
                    commands automatically.
                  </Typography.Paragraph>
                  <div style={{ maxHeight: 110, overflowY: 'auto' }}>
                    {suggestedCommands.map((suggestion) => (
                      <div key={suggestion.id} style={{ marginBottom: 6 }}>
                        <Typography.Text>{suggestion.label}</Typography.Text>
                        <Typography.Paragraph
                          code
                          copyable={{ text: suggestion.command }}
                          ellipsis={{ rows: 1, tooltip: suggestion.command }}
                          style={{ marginBottom: 0 }}
                        >
                          {suggestion.command}
                        </Typography.Paragraph>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {loadingCreateWorktree && creationProgress.length > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Creating worktree"
              description={creationProgress.map((step) => (
                <div key={step}>{`\u2713 ${step}`}</div>
              ))}
            />
          )}
        </div>
        <Form.Item style={{ flex: 'none', marginBottom: 0, paddingTop: 10 }}>
          <Button
            type="primary"
            htmlType="submit"
            style={{ width: '100%' }}
            loading={loadingCreateWorktree}
            disabled={
              isolateEnvironment &&
              (selectedEnvironmentSourceIds.length === 0 ||
                loadingEnvironmentPreview)
            }
          >
            Create Worktree
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
