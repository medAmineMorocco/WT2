import { Button, Divider, Flex, Form, Input, InputRef, Select, Space, Tooltip } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import options from './patternNamingOptions';

export default function WorktreeSettings() {
  const [form] = Form.useForm();
  const [items, setItems] = useState<any[]>(options);
  const inputRef = useRef<InputRef>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string|null>();

  useEffect(() => {
    const storedWorktreePatterns = window.localStorage.getItem('worktreePatterns');
    if (storedWorktreePatterns) {
      setItems(JSON.parse(storedWorktreePatterns));
    }

    const storedPrefix = window.localStorage.getItem('worktreePrefix');
    if (storedPrefix !== null) {
      form.setFieldValue('worktreePrefix', storedPrefix);
    } else {
      form.setFieldValue('worktreePrefix', options[0].value);
    }

    return () => {
      const worktreePrefix = form.getFieldValue('worktreePrefix');
      window.localStorage.setItem('worktreePrefix', worktreePrefix);
    };
  }, [form]);

  useEffect(() => {
    window.localStorage.setItem('worktreePatterns', JSON.stringify(items));
  }, [items]);

  const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const addPattern = (
    e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>,
  ) => {
    e.preventDefault();
    const found = items.find(item => item.value === name);
    if (found) {
      setError('This Pattern already exists in the list');
    } else {
      // eslint-disable-next-line no-plusplus
      setItems([
        ...items,
        {
          label: name,
          value: name,
        } as any,
      ]);
      setError(null);
      setName('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const deletePattern = (e: any, pattern: any) => {
    e.stopPropagation();
    setItems(items.filter(item => item.value !== pattern.value));
  };

  return (
    <Form
      form={form}
      layout="horizontal"
      colon={false}
      labelCol={{ span: 8 }}
      wrapperCol={{ span: 8 }}
    >
      <Form.Item
        label=" "
        name="worktreePrefix"
        extra="Customize how your worktree folders are named. Use {repo} for the main worktree name and {branch} for the branch name.
        Example: {repo}__wt__{branch} → my-app__wt__feature-login"
      >
        <Select
          style={{ width: 400 }}
          options={items}
          placeholder="{repo}__wt__{branch}"
          allowClear
          popupRender={(menu) => (
            <>
              {menu}
              <Divider style={{ margin: '8px 0' }} />
              <Space className="naming-pattern-space">
                <Input
                  placeholder="Please enter pattern"
                  style = {{ flexGrow: 1 }}
                  ref={inputRef}
                  value={name}
                  onChange={onNameChange}
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <Button type="text" icon={<PlusOutlined />} onClick={addPattern}>
                  Add Pattern
                </Button>
              </Space>
              {error && <small style={{ marginLeft: '8px', color: 'red'}}>{error}</small>}
            </>
          )}
          optionRender={(option) => (
            <Flex align="center" justify="space-between">
              <strong>{option.data.label}</strong>
              <span>{option.data.example}</span>
              <Tooltip
                placement="top"
                title="Remove Pattern"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <DeleteOutlined onClick={(e) => deletePattern(e, option)} />
              </Tooltip>
            </Flex>
          )}
        />
      </Form.Item>
    </Form>
  );
}
