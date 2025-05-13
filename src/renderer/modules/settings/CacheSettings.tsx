import { App as AntdApp, Button, Form } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';

export default function CacheSettings() {
  const { modal } = AntdApp.useApp();

  function clearLocalStorageExcept(exceptions: string[]): void {
    const keysToKeep = new Set<string>(exceptions);

    const keysToRemove: string[] = [];

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);

      if (key && !keysToKeep.has(key)) {
        keysToRemove.push(key);
      }
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  }

  const clear = () => {
    modal.confirm({
      title: 'Confirm Cache Clearing ?',
      icon: <ExclamationCircleFilled />,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      centered: true,
      onOk() {
        clearLocalStorageExcept([
          'shellPath',
          'gitExecutablePath',
          'VERSION',
          'PAYMENT_PAGE_URL',
          'server-port',
        ]);
      },
    });
  };

  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ span: 8 }}
      wrapperCol={{ span: 8 }}
    >
      <Form.Item
        label=" "
        extra="Please be aware that clicking the 'Clear Cache' button will reset all settings to their default state and close all tabs."
      >
        <Button danger onClick={clear}>
          Clear Cache
        </Button>
      </Form.Item>
    </Form>
  );
}
