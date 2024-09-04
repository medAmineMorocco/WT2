import {
  App as AntdApp,
  Button,
  Cascader,
  Checkbox,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClearOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import TabService from '../../services/tab/TabService';

const items: any[] = [
  {
    label: 'copy',
    value: 'copy',
    template: '<%= ? %>',
  },
  {
    label: 'case helpers (_-)',
    value: 'case_',
    children: [
      {
        label: 'constant (TWO_WORDS)',
        value: 'constant',
        template: '<%= h.changeCase.constantCase(?) %>',
      },
      {
        label: 'kebab (two-words)',
        value: 'kebab',
        template: '<%= h.changeCase.kebabCase(?) %>',
      },
      {
        label: 'pascalSnake (Two_Words)',
        value: 'pascalSnake',
        template: '<%= h.changeCase.pascalSnakeCase(?) %>',
      },
      {
        label: 'snake (two_words)',
        value: 'snake',
        template: '<%= h.changeCase.snakeCase(?) %>',
      },
      {
        label: 'train (Two-Words)',
        value: 'train',
        template: '<%= h.changeCase.trainCase(?) %>',
      },
    ],
  },
  {
    label: 'case helpers (/.)',
    value: 'case/',
    children: [
      {
        label: 'dot (two.words)',
        value: 'dot',
        template: '<%= h.changeCase.dotCase(?) %>',
      },
      {
        label: 'path (two/words)',
        value: 'path',
        template: '<%= h.changeCase.pathCase(?) %>',
      },
    ],
  },
  {
    label: 'case helpers',
    value: 'case',
    children: [
      {
        label: 'camel (twoWords)',
        value: 'camel',
        template: '<%= h.changeCase.camelCase(?) %>',
      },
      {
        label: 'capital (Two Words)',
        value: 'capital',
        template: '<%= h.changeCase.capitalCase(?) %>',
      },
      {
        label: 'no (two words)',
        value: 'no',
        template: '<%= h.changeCase.noCase(?) %>',
      },
      {
        label: 'pascal (TwoWords)',
        value: 'pascal_Two',
        template: '<%= h.changeCase.pascalCase(?) %>',
      },
      {
        label: 'sentence (Two words)',
        value: 'sentence',
        template: '<%= h.changeCase.sentenceCase(?) %>',
      },
    ],
  },
  {
    label: 'helpers',
    value: 'helpers',
    children: [
      {
        label: 'pluralize (Hat ==> Hats)',
        value: 'pluralize',
        template: '<%= h.inflection.pluralize(?) %>',
      },
      {
        label: 'singularize (Hat ==> Hats)',
        value: 'singularize',
        template: '<%= h.inflection.singularize(?) %>',
      },
      {
        label: 'dasherize (Hat ==> Hats)',
        value: 'dasherize',
        template: '<%= h.inflection.dasherize(?) %>',
      },
      {
        label: 'titleize (Hat ==> Hats)',
        value: 'titleize',
        template: '<%= h.inflection.titleize(?) %>',
      },
    ],
  },
];
export default function AddGenerator({
  isModalOpen,
  handleCancel,
  generatorToEdit,
}: {
  isModalOpen: boolean;
  handleCancel: any;
  generatorToEdit: any;
}) {
  const [parameters, setParameters] = useState<any[]>([]);

  const [files, setFiles] = useState<any[]>([]);

  const [injectChecked, setInjectChecked] = useState<boolean>();

  const [choicesQuestion, setChoicesQuestion] = useState<boolean>();

  const [parametersForm] = Form.useForm();

  const [fileForm] = Form.useForm();

  const [generatorForm] = Form.useForm();

  const [fileContent, setFileContent] = useState<string>();

  const [editFileMode, setEditFileMode] = useState(false);

  const [fileKeyToEdit, setFileKeyToEdit] = useState<string | null>();

  const [loading, setLoading] = useState(false);

  const activeTab = useMemo(() => TabService.getActiveTab(), []);

  const tabRepoPath = useMemo(() => {
    return TabService.getTabRepoPath(activeTab);
  }, [activeTab]);

  const { notification } = AntdApp.useApp();

  const resetFileForm = useCallback(() => {
    fileForm.resetFields();
    setFileContent('');
  }, [fileForm]);

  const resetParametersForm = useCallback(() => {
    parametersForm.resetFields();
    setChoicesQuestion(false);
  }, [parametersForm]);

  useEffect(() => {
    if (generatorToEdit) {
      generatorForm.setFieldValue(
        'generatorName',
        generatorToEdit.generatorName,
      );
      setFiles(generatorToEdit.files);
      setParameters(generatorToEdit.parameters);
    }
    const onGeneratorCreated = (event: any, code: number, result: any) => {
      if (code === 0) {
        setLoading(false);
        generatorForm.resetFields();
        resetParametersForm();
        setParameters([]);
        resetFileForm();
        setFiles([]);

        notification.success({
          message: 'Your new generator is ready to use',
          placement: 'bottomLeft',
          duration: 0.5,
        });
      } else {
        setLoading(false);
        notification.error({
          message: 'Unable to Create Generator',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    const onGeneratorUpdated = (event: any, code: number, result: any) => {
      if (code === 0) {
        setLoading(false);
        notification.success({
          message: 'Your generator changes have been applied',
          placement: 'bottomLeft',
          duration: 0.5,
        });
        handleCancel();
      } else {
        setLoading(false);
        notification.error({
          message: 'Unable to Update Generator',
          description: <Typography.Text copyable>{result}</Typography.Text>,
          placement: 'bottomLeft',
        });
      }
    };

    ipcRenderer.on('generator-created', onGeneratorCreated);
    ipcRenderer.on('generator-updated', onGeneratorUpdated);

    return () => {
      ipcRenderer.removeAllListeners('generator-created');
      ipcRenderer.removeAllListeners('generator-updated');
    };
  }, []);

  const onInjectChecked = (e: any) => {
    setInjectChecked(e.target.checked);
  };

  const onQuestionTypeSelect = (value: string) => {
    setChoicesQuestion(value === 'select' || value === 'multiselect');
  };

  const onFinishAddParameter = (values: any) => {
    setParameters([...parameters, { key: new Date().getTime(), ...values }]);
    resetParametersForm();
  };

  const deleteParameter = (key: string) => {
    setParameters(parameters.filter((parameter: any) => parameter.key !== key));
  };

  const onFinishAddFile = (values: any) => {
    setFiles([...files, { key: new Date().getTime(), ...values, fileContent }]);
    resetFileForm();
  };

  const deleteFile = (key: string) => {
    setFiles(files.filter((parameter: any) => parameter.key !== key));
  };

  const cancelEditFile = () => {
    setEditFileMode(false);
    setFileKeyToEdit(null);
    setInjectChecked(false);
    resetFileForm();
  };

  const saveFile = () => {
    const newFiles = files.map((file: any) => {
      if (file.key === fileKeyToEdit) {
        return Object.assign(file, fileForm.getFieldsValue(), { fileContent });
      }
      return file;
    });
    setFiles(newFiles);
    resetFileForm();
    setEditFileMode(false);
    setInjectChecked(false);
  };

  const editFile = (key: string) => {
    const fileToEdit = files.find((parameter: any) => parameter.key === key);
    if (fileToEdit) {
      Object.entries(fileToEdit).forEach(([field, value]) => {
        if (field !== 'key') {
          fileForm.setFieldValue(field, value);
        }
      });
      setInjectChecked(fileForm.getFieldValue('inject'));
      setFileContent(fileToEdit.fileContent);
      setEditFileMode(true);
      setFileKeyToEdit(key);
    }
  };

  const onChangeFileContent = (e: any) => {
    setFileContent(e.target.value);
  };

  const onFinishAddGenerator = (values: any) => {
    setLoading(true);
    const generator = {
      generatorName: values.generatorName,
      files,
      parameters,
    };
    if (generatorToEdit) {
      ipcRenderer.send(
        'update-generator',
        generatorToEdit.generatorName,
        generator,
        tabRepoPath,
      );
    } else {
      ipcRenderer.send('add-generator', generator, tabRepoPath);
    }
  };

  const onChange = (parameterName: string, selectedOptions: any[]) => {
    const { template } = selectedOptions[selectedOptions.length - 1];
    navigator.clipboard.writeText(template.replace('?', parameterName));
  };

  const clearFileContent = () => {
    setFileContent('');
  };

  return (
    <Modal
      open={isModalOpen}
      footer={null}
      onCancel={handleCancel}
      destroyOnClose
      className="generator-modal"
      width="100%"
      style={{
        position: 'absolute',
        right: '8px',
        top: '48px',
        height: 'calc(100% - 56px)',
        paddingBottom: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          width: '100%',
          height: '100%',
        }}
      >
        <div style={{ width: '60%' }}>
          <Form
            form={generatorForm}
            onFinish={onFinishAddGenerator}
            layout="inline"
          >
            <Form.Item
              name="generatorName"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Please enter the name of your generator.',
                },
                () => ({
                  validator(_, value) {
                    if (value && value.includes('/')) {
                      return Promise.reject(
                        new Error(
                          'The name of generator should not contains / character !',
                        ),
                      );
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
              className="form-item-without-margin-bottom"
            >
              <Input placeholder="Generator name" style={{ width: '300px' }} />
            </Form.Item>
            <Form.Item className="form-item-without-margin-bottom">
              <Button type="primary" loading={loading} htmlType="submit">
                {generatorToEdit ? 'Edit Generator' : 'Create Generator'}
              </Button>
            </Form.Item>
          </Form>
        </div>
        <div
          style={{
            display: 'flex',
            flexGrow: 1,
            height: '0',
          }}
        >
          {/* files to generate */}
          <div style={{ flexGrow: 0.7, flexBasis: 0, width: 0 }}>
            <strong>Files To Generate</strong>

            <div>
              {files.length === 0 && (
                <Empty
                  description="No File"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
              {files.map((file: any) => (
                <div key={file.key} style={{ display: 'flex', gap: '8px' }}>
                  <Tooltip
                    title={file.fileName}
                    placement="top"
                    mouseEnterDelay={0}
                    mouseLeaveDelay={0}
                  >
                    <span
                      style={{
                        width: '126px',
                        flexGrow: 1,
                        textAlign: 'left',
                        overflowX: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        direction: 'rtl',
                      }}
                    >
                      {file.fileName}.ejs.t
                    </span>
                  </Tooltip>
                  <Space style={{ marginLeft: 'auto' }}>
                    <Tooltip
                      title="Edit file"
                      placement="top"
                      mouseEnterDelay={0}
                      mouseLeaveDelay={0}
                    >
                      <EditOutlined
                        onClick={() => editFile(file.key)}
                        style={{ cursor: 'pointer' }}
                      />
                    </Tooltip>
                    <Tooltip
                      title="Delete file"
                      placement="top"
                      mouseEnterDelay={0}
                      mouseLeaveDelay={0}
                    >
                      <DeleteOutlined
                        onClick={() =>
                          editFileMode ? null : deleteFile(file.key)
                        }
                        style={{
                          cursor: editFileMode ? 'not-allowed' : 'pointer',
                        }}
                      />
                    </Tooltip>
                  </Space>
                </div>
              ))}
            </div>
          </div>
          <Divider type="vertical" style={{ height: '100%' }} />

          {/* file settings */}
          <div style={{ flexGrow: 1, flexBasis: 0, width: 0 }}>
            <strong>File Settings</strong>
            <Form form={fileForm} onFinish={onFinishAddFile}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item
                  name="fileName"
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: 'Please enter the name of your file.',
                    },
                  ]}
                  className="form-item-without-margin-bottom"
                >
                  <Input placeholder="File name" addonAfter=".ejs.t" />
                </Form.Item>
                <Form.Item
                  name="to"
                  className="form-item-without-margin-bottom"
                >
                  <Input
                    addonBefore={
                      <Tooltip
                        title="specifies the target location for the template."
                        placement="top"
                        mouseEnterDelay={0}
                        mouseLeaveDelay={0}
                      >
                        to
                      </Tooltip>
                    }
                  />
                </Form.Item>
                <div>
                  <Form.Item
                    name="force"
                    valuePropName="checked"
                    className="form-item-without-margin-bottom"
                  >
                    <Checkbox>
                      <Tooltip
                        title="overwrite an existing file."
                        placement="top"
                        mouseEnterDelay={0}
                        mouseLeaveDelay={0}
                      >
                        force
                      </Tooltip>
                    </Checkbox>
                  </Form.Item>
                  <Form.Item
                    name="unless_exists"
                    valuePropName="checked"
                    className="form-item-without-margin-bottom"
                  >
                    <Checkbox>
                      <Tooltip
                        title="If a target file already exists, and you don't want to overwrite it, you can use unless_exists."
                        placement="top"
                        mouseEnterDelay={0}
                        mouseLeaveDelay={0}
                      >
                        unless exists
                      </Tooltip>
                    </Checkbox>
                  </Form.Item>
                </div>
                <Form.Item
                  name="inject"
                  valuePropName="checked"
                  className="form-item-without-margin-bottom"
                >
                  <Checkbox onChange={onInjectChecked}>
                    <Tooltip
                      title="injects a template into an existing target file."
                      placement="top"
                      mouseEnterDelay={0}
                      mouseLeaveDelay={0}
                    >
                      inject
                    </Tooltip>
                  </Checkbox>
                </Form.Item>
                {injectChecked && (
                  <Form.Item
                    name="before"
                    className="form-item-without-margin-bottom"
                  >
                    <Input
                      addonBefore={
                        <Tooltip
                          title="contains a regular expression of text to locate. The inject line will appear before the located line."
                          placement="top"
                          mouseEnterDelay={0}
                          mouseLeaveDelay={0}
                        >
                          before
                        </Tooltip>
                      }
                    />
                  </Form.Item>
                )}
                {injectChecked && (
                  <Form.Item
                    name="after"
                    className="form-item-without-margin-bottom"
                  >
                    <Input
                      addonBefore={
                        <Tooltip
                          title="contains a regular expression of text to locate. The inject line will appear after the located line."
                          placement="top"
                          mouseEnterDelay={0}
                          mouseLeaveDelay={0}
                        >
                          after
                        </Tooltip>
                      }
                    />
                  </Form.Item>
                )}
                {injectChecked && (
                  <div>
                    <Form.Item
                      name="prepend"
                      valuePropName="checked"
                      className="form-item-without-margin-bottom"
                    >
                      <Checkbox>
                        <Tooltip
                          title="when true, add a line to start of file."
                          placement="top"
                          mouseEnterDelay={0}
                          mouseLeaveDelay={0}
                        >
                          prepend
                        </Tooltip>
                      </Checkbox>
                    </Form.Item>
                    <Form.Item
                      name="append"
                      valuePropName="checked"
                      className="form-item-without-margin-bottom"
                    >
                      <Checkbox>
                        <Tooltip
                          title="when true, add a line to end of file."
                          placement="top"
                          mouseEnterDelay={0}
                          mouseLeaveDelay={0}
                        >
                          append
                        </Tooltip>
                      </Checkbox>
                    </Form.Item>
                  </div>
                )}
                {injectChecked && (
                  <Form.Item
                    name="at_line"
                    className="form-item-without-margin-bottom"
                  >
                    <InputNumber
                      addonBefore={
                        <Tooltip
                          title="contains a line number will add a line at this exact line number."
                          placement="top"
                          mouseEnterDelay={0}
                          mouseLeaveDelay={0}
                        >
                          at line
                        </Tooltip>
                      }
                      min={1}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                )}
                <Form.Item
                  name="skip_if"
                  className="form-item-without-margin-bottom"
                >
                  <Input
                    addonBefore={
                      <Tooltip
                        title="contains a regular expression / text. If exists, injection is skipped."
                        placement="top"
                        mouseEnterDelay={0}
                        mouseLeaveDelay={0}
                      >
                        skip if
                      </Tooltip>
                    }
                  />
                </Form.Item>
                {!editFileMode && (
                  <Form.Item className="form-item-without-margin-bottom">
                    <Button type="primary" htmlType="submit" block ghost>
                      Add File
                    </Button>
                  </Form.Item>
                )}
                {editFileMode && (
                  <Form.Item className="form-item-without-margin-bottom">
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button
                        type="primary"
                        ghost
                        onClick={cancelEditFile}
                        style={{ flexGrow: 1 }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="primary"
                        ghost
                        onClick={saveFile}
                        style={{ flexGrow: 1 }}
                      >
                        Save File
                      </Button>
                    </div>
                  </Form.Item>
                )}
              </Space>
            </Form>
          </div>
          <Divider type="vertical" style={{ height: '100%' }} />

          {/* file content */}
          <div style={{ flexGrow: 2, flexBasis: 0, width: 0 }}>
            <strong>File Content</strong>
            <div
              style={{ position: 'relative', height: '98%', resize: 'none' }}
            >
              <Input.TextArea
                value={fileContent}
                onChange={onChangeFileContent}
                style={{ height: '100%', resize: 'none' }}
              />
              <Tooltip
                title="Clear"
                placement="top"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <Button
                  size="small"
                  style={{ position: 'absolute', right: '8px', top: '8px' }}
                  shape="circle"
                  icon={<ClearOutlined />}
                  onClick={clearFileContent}
                />
              </Tooltip>
            </div>
          </div>
          <Divider type="vertical" style={{ height: '100%' }} />

          {/* parameters */}
          <div
            style={{
              flexGrow: 1,
              flexBasis: 0,
              width: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <strong>Parameters</strong>
            <Form form={parametersForm} onFinish={onFinishAddParameter}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Form.Item
                  name="parameterName"
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: 'Please enter the name of your parameter.',
                    },
                  ]}
                  className="form-item-without-margin-bottom"
                >
                  <Input
                    addonBefore={
                      <Tooltip
                        title="name of the parameter"
                        placement="top"
                        mouseEnterDelay={0}
                        mouseLeaveDelay={0}
                      >
                        name
                      </Tooltip>
                    }
                    style={{ flexGrow: 1 }}
                  />
                </Form.Item>
                <Form.Item
                  name="parameterType"
                  initialValue="input"
                  className="form-item-without-margin-bottom"
                >
                  <Select
                    defaultValue="input"
                    style={{ flexGrow: 1, minWidth: '110px' }}
                    onChange={onQuestionTypeSelect}
                  >
                    <Select.Option value="input">Input</Select.Option>
                    <Select.Option value="confirm">Confirm</Select.Option>
                    <Select.Option value="select">Select</Select.Option>
                    <Select.Option value="multiselect">
                      Multiselect
                    </Select.Option>
                  </Select>
                </Form.Item>
              </div>
              {choicesQuestion && (
                <Form.Item
                  name="parameterValues"
                  rules={[
                    () => ({
                      validator(_, value) {
                        const paramType =
                          parametersForm.getFieldValue('parameterType');
                        if (
                          (paramType === 'select' ||
                            paramType === 'multiselect') &&
                          !value
                        ) {
                          return Promise.reject(
                            new Error('values should not be empty'),
                          );
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                  className="form-item-without-margin-bottom"
                >
                  <Input
                    addonBefore={
                      <Tooltip
                        title="values should be separated by ( , )"
                        placement="top"
                        mouseEnterDelay={0}
                        mouseLeaveDelay={0}
                      >
                        values
                      </Tooltip>
                    }
                    placeholder="option1,option2,option3"
                    style={{ marginTop: '8px' }}
                  />
                </Form.Item>
              )}
              <Form.Item className="form-item-without-margin-bottom">
                <Button
                  htmlType="submit"
                  type="primary"
                  ghost
                  block
                  style={{ marginTop: '8px' }}
                >
                  Add Parameter
                </Button>
              </Form.Item>
            </Form>

            <div
              style={{
                flexGrow: 1,
                height: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '8px',
              }}
            >
              <Divider>Defined Parameters</Divider>
              {parameters.length === 0 && (
                <Empty
                  description="No Parameter"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
              <div
                style={{
                  flexGrow: 1,
                  height: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {parameters.map((parameter) => (
                  <div
                    key={parameter.key}
                    style={{ display: 'flex', gap: '4px' }}
                  >
                    <Cascader
                      options={items}
                      onChange={(_value: any, selectedOptions: any[]) =>
                        onChange(parameter.parameterName, selectedOptions)
                      }
                      expandTrigger="hover"
                    >
                      <Tag color="processing" style={{ cursor: 'pointer' }}>
                        {parameter.parameterName}
                      </Tag>
                    </Cascader>
                    <Tag>{parameter.parameterType}</Tag>
                    {parameter.parameterValues && (
                      <Typography.Text
                        code
                        style={{ flexGrow: 1, whiteSpace: 'nowrap' }}
                      >
                        {parameter.parameterValues}
                      </Typography.Text>
                    )}
                    <Tooltip
                      title="Delete parameter"
                      placement="left"
                      mouseEnterDelay={0}
                      mouseLeaveDelay={0}
                    >
                      <DeleteOutlined
                        onClick={() => deleteParameter(parameter.key)}
                        style={{ cursor: 'pointer', marginLeft: 'auto' }}
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
