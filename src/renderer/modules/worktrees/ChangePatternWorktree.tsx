import { AutoComplete, Button, Form, Modal, Typography } from 'antd';
import { useEffect, useState } from 'react';
import options from '../settings/patternNamingOptions';

export default function ChangePatternWorktree({
  isModalOpen,
  form,
  onFinish,
  handleCancel,
  loading,
}: {
  isModalOpen: boolean;
  form: any;
  onFinish: any;
  handleCancel: any;
  loading: boolean;
}) {
  const [pathPreview, setPathPreview] = useState(
    form.getFieldValue('worktreeToChange').path,
  );
  const [patterns, setPatterns] = useState<any[]>(options);

  useEffect(() => {
    window.electron.ipcRenderer.send('get-os-separator');

    const storedWorktreePatterns =
      window.localStorage.getItem('worktreePatterns');
    if (storedWorktreePatterns) {
      setPatterns(JSON.parse(storedWorktreePatterns));
    }

    const onReceivePathPreview = (
      code: number,
      receivedPath: string,
    ) => {
      if (code === 0) {
        setPathPreview(receivedPath);
        form.setFieldValue('worktreeToChangePatternNewPath', receivedPath);
      }
    };

    const removePreview = window.electron.ipcRenderer.on(
      'received-preview-path-change-pattern',
      onReceivePathPreview,
    );

    return () => {
      if (typeof removePreview === 'function') removePreview();
      else window.electron.ipcRenderer.removeAllListeners('received-preview-path-change-pattern');
    };
  }, []);

  const onChange = (pattern: any) => {
    const worktreeToChange = form.getFieldValue('worktreeToChange');
    const repo = form.getFieldValue('repo');
    window.electron.ipcRenderer.send(
      'get-preview-path-change-pattern',
      worktreeToChange.name,
      worktreeToChange.path,
      pattern,
      repo,
    );
  };

  return (
    <Modal
      open={isModalOpen}
      footer={null}
      onCancel={handleCancel}
      destroyOnClose
      centered
      closeIcon={null}
      style={{ minWidth: '620px' }}
    >
      <Form
        onFinish={onFinish}
        layout="inline"
        requiredMark="optional"
        form={form}
      >
        <Form.Item label="Pattern" name="worktreePattern">
          <AutoComplete
            style={{ width: 360 }}
            options={patterns}
            onChange={onChange}
            placeholder="{repo}__wt__{branch}"
            allowClear
            filterOption={(inputValue, option) =>
              option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !==
              -1
            }
          />
        </Form.Item>
        <Form.Item style={{ marginRight: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading}>
            Apply
          </Button>
        </Form.Item>
      </Form>
      <div style={{ marginTop: '8px' }}>
        <Typography.Text code>{pathPreview}</Typography.Text>
      </div>
    </Modal>
  );
}
