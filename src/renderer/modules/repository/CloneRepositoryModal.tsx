import {
  CloudDownloadOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  LockOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Segmented,
  Select,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  INTEGRATION_PROVIDERS,
  loadStoredIntegrations,
} from '../../../shared/integrations';
import type {
  IntegrationProviderId,
  IntegrationState,
  ListIntegrationRepositoriesResult,
  RemoteRepository,
} from '../../../shared/integrations';
import { getProviderIcon } from '../settings/IntegrationsSettings';

type CloneFormValues = {
  repositoryUrl: string;
  destination: string;
  folderName?: string;
};

type CloneRepositoryModalProps = {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onChooseDirectory: () => Promise<string | null>;
  onClone: (values: CloneFormValues) => Promise<void>;
};

export default function CloneRepositoryModal({
  open,
  loading,
  onCancel,
  onChooseDirectory,
  onClone,
}: CloneRepositoryModalProps) {
  const [form] = Form.useForm<CloneFormValues>();
  const [sourceMode, setSourceMode] = useState<'provider' | 'url'>('provider');
  const [providerId, setProviderId] = useState<IntegrationProviderId>();
  const [repositories, setRepositories] = useState<RemoteRepository[]>([]);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [repositoryError, setRepositoryError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRepositoryId, setSelectedRepositoryId] = useState('');
  const [integrations, setIntegrations] = useState(loadStoredIntegrations);
  const connectedProviders = useMemo(
    () =>
      INTEGRATION_PROVIDERS.filter(
        (provider) => integrations[provider.id]?.connected,
      ),
    [integrations],
  );

  useEffect(() => {
    if (!open) return;
    setIntegrations((current) => {
      const next = loadStoredIntegrations();
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const firstProvider = connectedProviders[0]?.id;
    setProviderId((current) =>
      current && integrations[current]?.connected ? current : firstProvider,
    );
    setSourceMode(firstProvider ? 'provider' : 'url');
  }, [connectedProviders, integrations, open]);

  useEffect(() => {
    if (!open || sourceMode !== 'provider' || !providerId) return undefined;
    let cancelled = false;
    const integration: IntegrationState = integrations[providerId];
    setRepositoryLoading(true);
    setRepositoryError('');
    setRepositories([]);
    setSelectedRepositoryId('');
    form.setFieldsValue({ repositoryUrl: '', folderName: '' });

    window.electron.ipcRenderer
      .invoke('list-integration-repositories', {
        providerId,
        token: integration.token || '',
        hostDomain: integration.hostDomain,
        username: integration.username,
      })
      .then((result: ListIntegrationRepositoriesResult) => {
        if (cancelled) return;
        if (result.ok) setRepositories(result.repositories);
        else setRepositoryError(result.error);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setRepositoryError(error?.message || 'Could not load repositories.');
        }
      })
      .finally(() => {
        if (!cancelled) setRepositoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form, integrations, open, providerId, sourceMode]);

  const filteredRepositories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return repositories;
    return repositories.filter(
      (repository) =>
        repository.name.toLowerCase().includes(query) ||
        repository.fullName.toLowerCase().includes(query) ||
        repository.description?.toLowerCase().includes(query),
    );
  }, [repositories, search]);

  const selectRepository = (repository: RemoteRepository) => {
    setSelectedRepositoryId(repository.id);
    form.setFieldsValue({
      repositoryUrl: repository.cloneUrl,
      folderName: repository.name,
    });
  };

  const chooseDirectory = async () => {
    const directory = await onChooseDirectory();
    if (directory) form.setFieldValue('destination', directory);
  };

  return (
    <Modal
      title={
        <div className="clone-modal-title">
          <span className="clone-modal-title-icon">
            <CloudDownloadOutlined />
          </span>
          <span>
            <Typography.Title level={4}>Clone a repository</Typography.Title>
            <Typography.Text type="secondary">
              Choose a connected provider or paste a Git URL.
            </Typography.Text>
          </span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      centered
      destroyOnClose
      width={720}
      className="clone-repository-modal"
      maskClosable={!loading}
      closable={!loading}
    >
      <Form form={form} layout="vertical" onFinish={onClone}>
        <Segmented
          block
          value={sourceMode}
          onChange={(value) => {
            setSourceMode(value as 'provider' | 'url');
            setSelectedRepositoryId('');
            form.setFieldsValue({ repositoryUrl: '', folderName: '' });
          }}
          options={[
            {
              label: 'Connected provider',
              value: 'provider',
              icon: <CloudDownloadOutlined />,
              disabled: connectedProviders.length === 0,
            },
            { label: 'Repository URL', value: 'url', icon: <LinkOutlined /> },
          ]}
          aria-label="Repository source"
        />

        {sourceMode === 'provider' ? (
          <div className="clone-provider-browser">
            <div className="clone-provider-toolbar">
              <Select
                value={providerId}
                onChange={setProviderId}
                options={connectedProviders.map((provider) => ({
                  value: provider.id,
                  label: (
                    <span className="clone-provider-option">
                      {getProviderIcon(provider.id)}
                      {provider.name}
                    </span>
                  ),
                }))}
                aria-label="Connected Git provider"
                className="clone-provider-select"
                popupMatchSelectWidth={260}
              />
              <Input
                prefix={<SearchOutlined />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search repositories"
                allowClear
                aria-label="Search remote repositories"
              />
            </div>

            <div
              className="clone-repository-list"
              data-testid="remote-repository-list"
            >
              {repositoryLoading ? (
                <div className="clone-repository-state">
                  <Spin />
                  <Typography.Text type="secondary">
                    Loading repositories…
                  </Typography.Text>
                </div>
              ) : repositoryError ? (
                <Alert
                  type="error"
                  showIcon
                  message="Repositories could not be loaded"
                  description={repositoryError}
                />
              ) : filteredRepositories.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    repositories.length === 0
                      ? 'No repositories were returned by this provider.'
                      : 'No repositories match your search.'
                  }
                />
              ) : (
                <List
                  dataSource={filteredRepositories}
                  renderItem={(repository) => {
                    const selected = selectedRepositoryId === repository.id;
                    return (
                      <List.Item
                        className={`clone-repository-option ${selected ? 'selected' : ''}`}
                        onClick={() => selectRepository(repository)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            selectRepository(repository);
                          }
                        }}
                        role="option"
                        aria-selected={selected}
                        tabIndex={0}
                        data-testid={`remote-repository-${repository.id}`}
                      >
                        <div className="clone-repository-option-main">
                          <Typography.Text strong ellipsis>
                            {repository.fullName}
                          </Typography.Text>
                          {repository.isPrivate ? (
                            <Tag icon={<LockOutlined />}>Private</Tag>
                          ) : null}
                        </div>
                        {repository.description ? (
                          <Typography.Text type="secondary" ellipsis>
                            {repository.description}
                          </Typography.Text>
                        ) : null}
                      </List.Item>
                    );
                  }}
                />
              )}
            </div>
            <Form.Item
              name="repositoryUrl"
              hidden
              rules={[
                { required: true, message: 'Select a remote repository.' },
              ]}
            >
              <Input />
            </Form.Item>
          </div>
        ) : (
          <Form.Item
            label="Repository URL"
            name="repositoryUrl"
            rules={[{ required: true, message: 'Enter a repository URL.' }]}
          >
            <Input
              prefix={<LinkOutlined />}
              placeholder="https://github.com/owner/repository.git"
              allowClear
            />
          </Form.Item>
        )}

        <div className="clone-destination-grid">
          <Form.Item
            label="Destination folder"
            name="destination"
            rules={[
              { required: true, message: 'Choose a destination folder.' },
            ]}
          >
            <Input
              prefix={<FolderOpenOutlined />}
              readOnly
              placeholder="Choose a parent folder"
              addonAfter={
                <Button type="text" size="small" onClick={chooseDirectory}>
                  Browse
                </Button>
              }
            />
          </Form.Item>
          <Form.Item
            label="Folder name"
            name="folderName"
            extra="Defaults to the repository name."
          >
            <Input placeholder="repository" allowClear />
          </Form.Item>
        </div>

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          icon={<CloudDownloadOutlined />}
          loading={loading}
        >
          Clone Repository
        </Button>
      </Form>
    </Modal>
  );
}
