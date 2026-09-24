import {
  App as AntdApp,
  Button,
  Checkbox,
  Dropdown,
  Form,
  Input,
  Modal,
  Progress,
  Segmented,
  Select,
  Switch,
  Table,
  Tooltip,
  Tree,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  BranchesOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  InfoCircleOutlined,
  CodeOutlined,
  DownOutlined,
  RobotOutlined,
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
import { aiAgentsDefault, AiAgentId } from '../../../shared/aiAgents';
import {
  CreatedWorktreeTarget,
  WorktreeOpenAction,
} from '../../../shared/worktreeOpenAction';
import { editorIconsMap, editorsCst } from '../config/EditorsConfig';
import { getAiAgentIcon } from '../../components/aiAgents/AiAgentIcons';

type SparseCheckoutFolder = {
  title: string;
  key: string;
  path: string;
  size: number;
  children?: SparseCheckoutFolder[];
};

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getCoveredSize(
  folders: SparseCheckoutFolder[],
  checked: Set<string>,
): number {
  return folders.reduce(
    (total, folder) =>
      total +
      (checked.has(folder.path)
        ? folder.size
        : getCoveredSize(folder.children || [], checked)),
    0,
  );
}

function getMinimalSparseFolders(paths: string[]) {
  const selected = new Set(paths);
  return paths.filter((folderPath) => {
    const segments = folderPath.split('/');
    return !segments
      .slice(0, -1)
      .some((_, index) => selected.has(segments.slice(0, index + 1).join('/')));
  });
}

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
  const [showRemoteBranches, setShowRemoteBranches] = useState(false);

  const [tags, setTags] = useState<any[]>([]);

  const [worktreesFolder, setWorktreesFolder] = useState<string>('');

  const [pathSeparator, setPathSeparator] = useState<string>('');

  const [loadingCreateWorktree, setLoadingCreateWorktree] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [creationProgressLabel, setCreationProgressLabel] = useState('');
  const createAndOpenAction = useRef<WorktreeOpenAction | null>(null);
  const createdWorktree = useRef<CreatedWorktreeTarget | null>(null);

  const [nodeModulesWorktrees, setNodeModulesWorktrees] = useState<
    Array<{ path: string; name: string; isPrimary: boolean }>
  >([]);
  const [selectedNodeModulesSourcePath, setSelectedNodeModulesSourcePath] =
    useState<string>('');
  const [shareNodeModules, setShareNodeModules] = useState(false);

  const [checkoutScope, setCheckoutScope] = useState<'full' | 'selected'>(
    'full',
  );
  const [sparseFolders, setSparseFolders] = useState<SparseCheckoutFolder[]>(
    [],
  );
  const [selectedSparseFolders, setSelectedSparseFolders] = useState<string[]>(
    [],
  );
  const [sparseTotalSize, setSparseTotalSize] = useState(0);
  const [sparseRootSize, setSparseRootSize] = useState(0);
  const [loadingSparseFolders, setLoadingSparseFolders] = useState(false);

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

  const createAndOpenItems = useMemo<MenuProps['items']>(() => {
    const storedEditors = window.localStorage.getItem('editors');
    const editors = storedEditors ? JSON.parse(storedEditors) : editorsCst;
    const storedAgents = window.localStorage.getItem('aiAgents');
    const configuredAgents = storedAgents
      ? JSON.parse(storedAgents)
      : aiAgentsDefault;

    return [
      {
        key: 'terminal',
        label: 'Terminal',
        icon: <CodeOutlined />,
      },
      {
        key: 'editors',
        label: 'Editor / IDE',
        icon: <CodeOutlined />,
        children: editors
          .filter((editor: any) => editor.enabled)
          .map((editor: any) => ({
            key: `editor:${editor.name || editor.key}`,
            label: editor.name || editor.label,
            icon: editorIconsMap[editor.icon] || <CodeOutlined />,
          })),
      },
      {
        key: 'agents',
        label: 'AI Agent',
        icon: <RobotOutlined />,
        children: configuredAgents
          .filter((agent: any) => agent.enabled)
          .map((agent: any) => ({
            key: `agent:${agent.id}`,
            label: agent.label,
            icon: getAiAgentIcon(agent.id),
          })),
      },
    ];
  }, [isModalOpen]);

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
        setCreationProgress(100);
        setCreationProgressLabel('Worktree ready');
        const action = createAndOpenAction.current;
        const worktree = createdWorktree.current;
        if (action && worktree) {
          window.dispatchEvent(
            new CustomEvent('worktreewise:open-created-worktree', {
              detail: { action, worktree },
            }),
          );
        }
        createAndOpenAction.current = null;
        createdWorktree.current = null;
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
        setCreationProgress(0);
        setCreationProgressLabel('');
        createAndOpenAction.current = null;
        createdWorktree.current = null;
        setLoadingCreateWorktree(false);
        notification.error({
          message: 'Unable to Create Worktree',
          description: result,
          placement: 'bottomLeft',
        });
      }
    };

    const onWorktreeCreationProgress = (_key: string, label: string) => {
      setCreationProgress((current) =>
        Math.min(90, Math.max(15, current + 20)),
      );
      setCreationProgressLabel(label);
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

    const onMainNodeModulesChecked = (
      code: number,
      result: Array<{ path: string; name: string; isPrimary: boolean }>,
    ) => {
      if (code === 0 && Array.isArray(result) && result.length > 0) {
        setNodeModulesWorktrees(result);
        setSelectedNodeModulesSourcePath((current) => {
          if (current && result.some((item) => item.path === current)) {
            return current;
          }
          const primary = result.find((item) => item.isPrimary);
          return primary ? primary.path : result[0].path;
        });
      } else {
        setNodeModulesWorktrees([]);
        setSelectedNodeModulesSourcePath('');
      }
    };

    window.electron.ipcRenderer.on('worktree-created', onWorktreeCreated);
    window.electron.ipcRenderer.on(
      'worktree-creation-progress',
      onWorktreeCreationProgress,
    );
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
      'environment-isolation-previewed',
      onEnvironmentIsolationPreviewed,
    );
    window.electron.ipcRenderer.on(
      'environment-suggestions-previewed',
      onEnvironmentSuggestionsPreviewed,
    );
    window.electron.ipcRenderer.on(
      'main-node-modules-checked',
      onMainNodeModulesChecked,
    );

    return () => {
      window.electron.ipcRenderer.removeAllListeners('worktree-created');
      window.electron.ipcRenderer.removeAllListeners(
        'worktree-creation-progress',
      );
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
        'environment-isolation-previewed',
      );
      window.electron.ipcRenderer.removeAllListeners(
        'environment-suggestions-previewed',
      );
      window.electron.ipcRenderer.removeAllListeners(
        'main-node-modules-checked',
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
    if (isModalOpen && tabRepoPath) {
      window.electron.ipcRenderer.send('check-main-node-modules', tabRepoPath);
    } else if (!isModalOpen) {
      setShareNodeModules(false);
    }
  }, [isModalOpen, tabRepoPath]);

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

  const sparseCheckoutRef = useMemo(() => {
    if (createWorktreeMode === 'existing-branch') {
      return watchedExistingBranch || '';
    }
    if (createWorktreeMode === 'existing-tag') {
      return watchedExistingTag || '';
    }
    return 'HEAD';
  }, [createWorktreeMode, watchedExistingBranch, watchedExistingTag]);

  useEffect(() => {
    if (!isModalOpen || checkoutScope !== 'selected' || !sparseCheckoutRef) {
      return undefined;
    }
    let cancelled = false;
    setLoadingSparseFolders(true);
    setSelectedSparseFolders([]);
    window.electron.ipcRenderer
      .invoke('get-sparse-checkout-tree', tabRepoPath, sparseCheckoutRef)
      .then((result: any) => {
        if (cancelled) return;
        setSparseFolders(result.folders || []);
        setSparseTotalSize(result.totalSize || 0);
        setSparseRootSize(result.rootSize || 0);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setSparseFolders([]);
        setSparseTotalSize(0);
        setSparseRootSize(0);
        notification.error({
          message: 'Unable to inspect repository folders',
          description: error?.message || String(error),
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingSparseFolders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    checkoutScope,
    isModalOpen,
    notification,
    sparseCheckoutRef,
    tabRepoPath,
  ]);

  useEffect(() => {
    if (createWorktreeMode === 'existing-branch' && isModalOpen) {
      window.electron.ipcRenderer.send(
        'list-branches',
        tabRepoPath,
        showRemoteBranches,
      );
    }
    if (createWorktreeMode === 'existing-tag' && isModalOpen) {
      window.electron.ipcRenderer.send('list-tags', tabRepoPath);
    }
  }, [
    activeTab,
    createWorktreeMode,
    form,
    isModalOpen,
    showRemoteBranches,
    tabRepoPath,
  ]);

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
    const shouldShareNodeModules =
      shareNodeModules && nodeModulesWorktrees.length > 0;
    const effectiveCreateWorktreeMode =
      createWorktreeMode === 'existing-branch' && showRemoteBranches
        ? 'existing-remote-branch'
        : createWorktreeMode;
    const selectedCheckoutFolders =
      checkoutScope === 'selected'
        ? getMinimalSparseFolders(selectedSparseFolders)
        : [];
    if (checkoutScope === 'selected' && selectedCheckoutFolders.length === 0) {
      notification.warning({
        message: 'Select at least one folder',
        description: 'Choose the folders to include in this worktree.',
      });
      return;
    }

    createdWorktree.current = {
      name: worktreeName.replaceAll('.', '-'),
      path: worktreesFolder + pathSeparator + getWorktreeName(),
    };
    setCreationProgress(8);
    setCreationProgressLabel('Preparing worktree');

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
        effectiveCreateWorktreeMode,
        tabRepoPath,
        environmentIsolation,
        shouldShareNodeModules,
        shouldShareNodeModules ? selectedNodeModulesSourcePath : undefined,
        selectedCheckoutFolders,
      );
    } else {
      log.debug('== create-worktree-workflow ==');
      window.electron.ipcRenderer.send(
        'create-worktree-workflow',
        values,
        effectiveCreateWorktreeMode,
        worktreeName.replaceAll('.', '-'),
        worktreesFolder + pathSeparator + getWorktreeName(),
        tabRepoPath,
        environmentIsolation,
        shouldShareNodeModules,
        shouldShareNodeModules ? selectedNodeModulesSourcePath : undefined,
        selectedCheckoutFolders,
        createAndOpenAction.current,
      );
      createAndOpenAction.current = null;
      createdWorktree.current = null;
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

  const sparseCheckedSet = new Set(selectedSparseFolders);
  const sparseEstimatedSize = Math.min(
    sparseTotalSize,
    sparseRootSize + getCoveredSize(sparseFolders, sparseCheckedSet),
  );
  const sparseEstimatedPercent =
    sparseTotalSize > 0
      ? Math.max(1, Math.round((sparseEstimatedSize / sparseTotalSize) * 100))
      : 0;
  const sparseSelectionCount = getMinimalSparseFolders(
    selectedSparseFolders,
  ).length;

  return (
    <Modal
      open={isModalOpen}
      title={
        <div className="create-worktree-modal-title">
          <span className="create-worktree-modal-title-icon">
            <BranchesOutlined />
          </span>
          <span>
            <Typography.Title level={4}>Create a worktree</Typography.Title>
            <Typography.Text type="secondary">
              Start isolated work without leaving your current branch.
            </Typography.Text>
          </span>
        </div>
      }
      footer={null}
      onCancel={handleCancel}
      destroyOnClose
      width={920}
      centered
      className="create-worktree-modal"
      styles={{
        body: {
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 150px)',
          overflow: 'hidden',
        },
      }}
    >
      <Segmented
        className="create-worktree-source-tabs"
        defaultValue={createWorktreeMode}
        onChange={onChangeCreateWorktreeMode}
        block
        options={[
          {
            label: <div style={{ padding: 3 }}>New branch</div>,
            value: 'new-branch',
          },
          {
            label: <div style={{ padding: 3 }}>Existing branch</div>,
            value: 'existing-branch',
          },
          {
            label: <div style={{ padding: 3 }}>From tag</div>,
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
          marginTop: 16,
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
          <div className="create-worktree-section-heading">
            <span>Source</span>
            <small>Choose the Git reference and worktree name.</small>
          </div>
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
            <>
              <Form.Item
                label={
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span>
                      {showRemoteBranches ? 'Remote branch' : 'Local branch'}
                    </span>
                    <Switch
                      size="small"
                      checked={showRemoteBranches}
                      checkedChildren="Remote"
                      unCheckedChildren="Local"
                      onChange={(checked) => {
                        setShowRemoteBranches(checked);
                        setBranches([]);
                        form.setFieldValue('existing-branch', undefined);
                      }}
                    />
                  </span>
                }
                name="existing-branch"
                extra={
                  showRemoteBranches
                    ? 'Creates a local tracking branch for the selected remote branch'
                    : undefined
                }
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
                  placeholder={
                    showRemoteBranches
                      ? 'Select remote branch'
                      : 'Select local branch'
                  }
                  options={branches}
                  onChange={onSelectBranchChange}
                />
              </Form.Item>
            </>
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
          <div className="create-worktree-section-heading">
            <span>Automation hooks</span>
            <small>Optional commands run before and after creation.</small>
          </div>
          <div className="create-worktree-hook-grid">
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
          <div className="create-worktree-section-heading">
            <span>Location</span>
            <small>Review where the new worktree will be stored.</small>
          </div>
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
            <div className="create-worktree-location-control">
              <Tooltip
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
                title="Change Location"
                placement="bottom"
              >
                <Button
                  icon={<FolderOutlined />}
                  onClick={chooseWorktreesDir}
                  aria-label="Change worktree location"
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
                  className="create-worktree-path"
                >
                  {worktreesFolder + pathSeparator + getWorktreeName()}
                </Typography.Text>
              </Tooltip>
            </div>
          </Form.Item>
          <section className="sparse-checkout-section">
            <div className="sparse-checkout-heading">
              <div className="sparse-checkout-title-group">
                <span className="sparse-checkout-heading-icon">
                  <BranchesOutlined />
                </span>
                <span>
                  <Typography.Text strong>Repository checkout</Typography.Text>
                  <Typography.Text type="secondary">
                    Control which project folders are available in this
                    worktree.
                  </Typography.Text>
                </span>
              </div>
              <span className="sparse-checkout-optional">Optional</span>
            </div>
            <Segmented
              block
              value={checkoutScope}
              onChange={(value) =>
                setCheckoutScope(value as 'full' | 'selected')
              }
              className="sparse-checkout-options"
              options={[
                {
                  value: 'full',
                  label: (
                    <span className="sparse-checkout-option">
                      <DatabaseOutlined />
                      <span>
                        <strong>Full repository</strong>
                        <small>Checkout every file and folder</small>
                      </span>
                    </span>
                  ),
                },
                {
                  value: 'selected',
                  label: (
                    <span className="sparse-checkout-option">
                      <FolderOpenOutlined />
                      <span>
                        <strong>Selected folders</strong>
                        <small>Keep the worktree lightweight</small>
                      </span>
                    </span>
                  ),
                },
              ]}
            />
            {checkoutScope === 'selected' && (
              <div className="sparse-checkout-picker">
                <div className="sparse-checkout-picker-header">
                  <span>
                    <FolderOpenOutlined />
                    Choose folders
                  </span>
                  {sparseSelectionCount > 0 && (
                    <span className="sparse-checkout-selection-count">
                      {sparseSelectionCount} selected
                    </span>
                  )}
                </div>
                <div className="sparse-checkout-tree-wrap">
                  {!sparseCheckoutRef ? (
                    <Typography.Text type="secondary">
                      Select a branch or tag to browse its folders.
                    </Typography.Text>
                  ) : loadingSparseFolders ? (
                    <Typography.Text type="secondary">
                      Inspecting repository folders…
                    </Typography.Text>
                  ) : sparseFolders.length === 0 ? (
                    <Typography.Text type="secondary">
                      This revision has no folders to select.
                    </Typography.Text>
                  ) : (
                    <Tree
                      checkable
                      selectable={false}
                      checkedKeys={selectedSparseFolders}
                      treeData={sparseFolders}
                      onCheck={(keys) =>
                        setSelectedSparseFolders(
                          (Array.isArray(keys) ? keys : keys.checked).map(
                            String,
                          ),
                        )
                      }
                      titleRender={(node: any) => (
                        <span className="sparse-checkout-folder-label">
                          <span>{node.title}</span>
                          <Typography.Text type="secondary">
                            {formatBytes(node.size)}
                          </Typography.Text>
                        </span>
                      )}
                    />
                  )}
                </div>
                {sparseTotalSize > 0 && (
                  <div className="sparse-checkout-estimate">
                    <div className="sparse-checkout-estimate-copy">
                      <span>
                        <Typography.Text type="secondary">
                          Estimated checkout
                        </Typography.Text>
                        <Typography.Text strong>
                          {formatBytes(sparseEstimatedSize)}
                        </Typography.Text>
                      </span>
                      <span className="sparse-checkout-percent">
                        ~{sparseEstimatedPercent}%
                      </span>
                    </div>
                    <Progress
                      percent={sparseEstimatedPercent}
                      size="small"
                      showInfo={false}
                      strokeColor={{ from: '#1677ff', to: '#36cfc9' }}
                    />
                    <Typography.Text type="secondary">
                      Full repository size: {formatBytes(sparseTotalSize)}
                    </Typography.Text>
                  </div>
                )}
              </div>
            )}
          </section>
          <div className="create-worktree-section-heading">
            <span>Workspace setup</span>
            <small>Optional optimizations and environment isolation.</small>
          </div>
          <div className="create-worktree-setup-options">
            {nodeModulesWorktrees.length > 0 && (
              <div className="create-worktree-setup-option">
                <Checkbox
                  checked={shareNodeModules}
                  onChange={(event) =>
                    setShareNodeModules(event.target.checked)
                  }
                >
                  Share node_modules
                </Checkbox>
                {shareNodeModules && (
                  <div style={{ marginTop: 6, paddingLeft: 24 }}>
                    <Typography.Text
                      type="secondary"
                      style={{
                        display: 'block',
                        marginBottom: 4,
                        fontSize: 12,
                      }}
                    >
                      Share from worktree:
                    </Typography.Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={selectedNodeModulesSourcePath}
                      onChange={(val) => setSelectedNodeModulesSourcePath(val)}
                      options={nodeModulesWorktrees.map((wt) => ({
                        value: wt.path,
                        label: wt.isPrimary
                          ? `${wt.name} (Main worktree)`
                          : wt.name,
                      }))}
                    />
                  </div>
                )}
              </div>
            )}
            <Form.Item
              className="create-worktree-setup-option"
              style={{ marginBottom: isolateEnvironment ? 12 : 0 }}
            >
              <Checkbox
                checked={isolateEnvironment}
                onChange={(event) =>
                  setIsolateEnvironment(event.target.checked)
                }
              >
                Isolate environment
              </Checkbox>
            </Form.Item>
          </div>
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
        </div>
        <Form.Item className="create-worktree-actions">
          {loadingCreateWorktree && (
            <div style={{ marginBottom: 10 }} aria-live="polite">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography.Text>{creationProgressLabel}</Typography.Text>
                <Typography.Text type="secondary">
                  {creationProgress}%
                </Typography.Text>
              </div>
              <Progress
                percent={creationProgress}
                showInfo={false}
                status={creationProgress === 100 ? 'success' : 'active'}
              />
            </div>
          )}
          <div style={{ display: 'flex', width: '100%', gap: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<BranchesOutlined />}
              size="large"
              style={{ flex: 1, height: 44, fontWeight: 500 }}
              loading={loadingCreateWorktree}
              onClick={() => {
                createAndOpenAction.current = null;
              }}
              disabled={
                isolateEnvironment &&
                (selectedEnvironmentSourceIds.length === 0 ||
                  loadingEnvironmentPreview)
              }
            >
              Create Worktree
            </Button>
            <div style={{ flex: 1 }}>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: createAndOpenItems,
                  onClick: ({ key }) => {
                    if (key === 'terminal') {
                      createAndOpenAction.current = { type: 'terminal' };
                    } else if (key.startsWith('editor:')) {
                      createAndOpenAction.current = {
                        type: 'editor',
                        editor: key.slice('editor:'.length),
                      };
                    } else if (key.startsWith('agent:')) {
                      createAndOpenAction.current = {
                        type: 'agent',
                        agentId: key.slice('agent:'.length) as AiAgentId,
                      };
                    } else {
                      return;
                    }
                    form.submit();
                  },
                }}
                placement="topRight"
              >
                <Button
                  size="large"
                  aria-label="Create worktree and open with"
                  loading={loadingCreateWorktree}
                  disabled={
                    isolateEnvironment &&
                    (selectedEnvironmentSourceIds.length === 0 ||
                      loadingEnvironmentPreview)
                  }
                  style={{ width: '100%', height: 44, fontWeight: 500 }}
                >
                  <span>Create &amp; Open</span>
                  <DownOutlined style={{ fontSize: 12 }} />
                </Button>
              </Dropdown>
            </div>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
