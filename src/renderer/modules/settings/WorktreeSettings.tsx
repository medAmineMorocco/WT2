import { AutoComplete, Flex, Form } from 'antd';
import { useEffect } from 'react';

function Title(props: any) {
  const { title, example } = props;
  return (
    <Flex align="center" justify="space-between">
      {title}
      <span>{example}</span>
    </Flex>
  );
}

const options = [
  {
    label: (
      <Title title="{repo}__wt__{branch}" example="my-app__wt__feature-login" />
    ),
    value: '{repo}__wt__{branch}',
  },
  {
    label: <Title title="{repo}__{branch}" example="my-app__feature-login" />,
    value: '{repo}__{branch}',
  },
  {
    label: (
      <Title title="{repo}-wt-{branch}" example="my-app-wt-feature-login" />
    ),
    value: '{repo}-wt-{branch}',
  },
  {
    label: (
      <Title title="wt__{repo}__{branch}" example="wt__my-app__feature-login" />
    ),
    value: 'wt__{repo}__{branch}',
  },
];

export default function WorktreeSettings() {
  const [form] = Form.useForm();

  useEffect(() => {
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
        <AutoComplete
          style={{ width: 400 }}
          options={options}
          placeholder="{repo}__wt__{branch}"
          allowClear
          filterOption={(inputValue, option) =>
            option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
          }
        />
      </Form.Item>
    </Form>
  );
}
