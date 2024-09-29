import {
  Button,
  Card,
  ColorPicker,
  ColorPickerProps,
  Form,
  GetProp,
  Input,
  Segmented,
  Select,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { BoldOutlined } from '@ant-design/icons';
import React, { useEffect, useRef, useState } from 'react';

type Color = Extract<
  GetProp<ColorPickerProps, 'value'>,
  string | { cleared: any }
>;

const defaultFormatExpression =
  '%C(auto)%h %C(auto)%d %C(auto)%ai %C(bold)%s %C(auto)<%an>';

export default function GitSettings() {
  const [form] = Form.useForm();
  const [formGitLog] = Form.useForm();
  const [formatOption, setFormatOption] = useState<string>();

  const [commitMsgOption, setCommitMsgOption] = useState<string>();
  const [commitHashOption, setCommitHashOption] = useState<string>();
  const [authorInfoOption, setAuthorInfoOption] = useState<string>();
  const [commmitterOption, setCommitterOption] = useState<string>();
  const [referencesOption, setReferencesOption] = useState<string>();

  const [color, setColor] = useState<Color>();
  const [colorOption, setColorOption] = useState<Color>('auto');
  const [textStyle, setTextStyle] = useState<Color>('normal');

  const formatOptionRef = useRef(null);
  const commitHashRef = useRef(null);
  const commitMsgRef = useRef(null);
  const authorInfoRef = useRef(null);
  const committerRef = useRef(null);
  const referencesRef = useRef(null);

  useEffect(() => {
    const storedGitExecutable =
      window.localStorage.getItem('gitExecutablePath');
    if (storedGitExecutable) {
      form.setFieldValue('gitExecutablePath', storedGitExecutable);
    }

    const storedGitLogFormat = window.localStorage.getItem('gitLogFormat');
    formGitLog.setFieldValue(
      'formatExpression',
      storedGitLogFormat || defaultFormatExpression,
    );

    return () => {
      const gitExecutablePath = form.getFieldValue('gitExecutablePath');
      window.localStorage.setItem('gitExecutablePath', gitExecutablePath || '');
      window.localStorage.setItem(
        'gitLogFormat',
        formGitLog.getFieldValue('formatExpression') || defaultFormatExpression,
      );
    };
  }, [form, formGitLog]);

  const updateFormatOption = () => {
    let result;
    if (formatOption === 'commit-msg') {
      result = commitMsgOption;
    }
    if (formatOption === 'commit-hash') {
      result = commitHashOption;
    }
    if (formatOption === 'author-info') {
      result = authorInfoOption;
    }
    if (formatOption === 'committer') {
      result = commmitterOption;
    }
    if (formatOption === 'references') {
      result = referencesOption;
    }
    // @ts-ignore
    const expression = `%C(${colorOption === 'auto' ? 'auto' : color?.toHexString()}${textStyle === 'normal' ? '' : ` ${textStyle}`})${result}`;
    formGitLog.setFieldValue(
      'formatExpression',
      `${formGitLog.getFieldValue('formatExpression')} ${expression}`,
    );
  };

  const clearOptions = () => {
    setCommitMsgOption(undefined);
    setCommitHashOption(undefined);
    setAuthorInfoOption(undefined);
    setCommitterOption(undefined);
    setReferencesOption(undefined);
  };

  const isAddToFormatBtnDisabled = () => {
    return (
      commitMsgOption === undefined &&
      commitHashOption === undefined &&
      authorInfoOption === undefined &&
      commmitterOption === undefined &&
      referencesOption === undefined
    );
  };

  const onChangeFormatOption = (val: string) => {
    setFormatOption(val);
    clearOptions();
  };

  const blurSelect = (ref: any) => {
    ref.current.blur();
  };

  const resetFormatExpression = () => {
    formGitLog.setFieldValue('formatExpression', defaultFormatExpression);
  };

  return (
    <div>
      <Form
        form={form}
        layout="horizontal"
        colon={false}
        labelCol={{ span: 10 }}
        wrapperCol={{ span: 7 }}
      >
        <Form.Item
          label="Git executable"
          name="gitExecutablePath"
          extra={
            <div>
              <div>
                Please enter the full path to the Git executable, Example:{' '}
              </div>
              <ul>
                <li>
                  <span>Windows: </span>
                  <Typography.Text copyable>
                    C:\Program Files\Git\bin\git.exe
                  </Typography.Text>
                </li>
                <li>
                  <span>MacOS/Linux: </span>
                  <Typography.Text copyable>/usr/bin/git</Typography.Text>
                </li>
              </ul>
            </div>
          }
        >
          <Input allowClear />
        </Form.Item>
      </Form>

      <div
        style={{
          float: 'left',
          width: '40%',
          marginLeft: '5%',
          marginTop: '20px',
        }}
      >
        <Card title="Git Log Format Customization">
          <Form layout="vertical">
            <div>
              <Select
                ref={formatOptionRef}
                value={formatOption}
                onChange={(val: string) => {
                  onChangeFormatOption(val);
                  blurSelect(formatOptionRef);
                }}
                placeholder="Select"
                allowClear
                style={{ width: '100%' }}
              >
                <Select.Option value="commit-msg">Commit Message</Select.Option>
                <Select.Option value="commit-hash">Commit Hash</Select.Option>
                <Select.Option value="author-info">Author Info</Select.Option>
                <Select.Option value="committer">Committer</Select.Option>
                <Select.Option value="references">References</Select.Option>
              </Select>
            </div>
            <br />

            {/* Commit Info Section */}
            {formatOption === 'commit-hash' && (
              <Form.Item label="Commit Hash">
                <Select
                  ref={commitHashRef}
                  value={commitHashOption}
                  onChange={(val: string) => {
                    setCommitHashOption(val);
                    blurSelect(commitHashRef);
                  }}
                  placeholder="Select Commit Hash"
                >
                  <Select.Option value="%H">Full Hash (%H)</Select.Option>
                  <Select.Option value="%h">Short Hash (%h)</Select.Option>
                </Select>
              </Form.Item>
            )}

            {formatOption === 'references' && (
              <Form.Item label="References">
                <Select
                  ref={referencesRef}
                  value={referencesOption}
                  onChange={(val: string) => {
                    setReferencesOption(val);
                    blurSelect(referencesRef);
                  }}
                  placeholder="Select References"
                >
                  <Select.Option value="%D">Full Refs (%D)</Select.Option>
                  <Select.Option value="%d">Short Refs (%d)</Select.Option>
                </Select>
              </Form.Item>
            )}

            {/* Author Info Section */}
            {formatOption === 'author-info' && (
              <Form.Item label="Author Info">
                <Select
                  ref={authorInfoRef}
                  value={authorInfoOption}
                  onChange={(val: string) => {
                    setAuthorInfoOption(val);
                    blurSelect(authorInfoRef);
                  }}
                  placeholder="Select Author Info"
                >
                  <Select.Option value="%an">Author Name (%an)</Select.Option>
                  <Select.Option value="%ae">Author Email (%ae)</Select.Option>
                  <Select.Option value="%ai">
                    Author Date ISO8601 (%ai)
                  </Select.Option>
                  <Select.Option value="%aD">
                    Author Date RFC2882 (%aD)
                  </Select.Option>
                  <Select.Option value="%ar">
                    Author Date relative (%ar)
                  </Select.Option>
                  <Select.Option value="%at">
                    Author Date unix timestamp (%at)
                  </Select.Option>
                </Select>
              </Form.Item>
            )}

            {/* Committer Section */}
            {formatOption === 'committer' && (
              <Form.Item label="Committer">
                <Select
                  ref={committerRef}
                  value={commmitterOption}
                  onChange={(val: string) => {
                    setCommitterOption(val);
                    blurSelect(committerRef);
                  }}
                  placeholder="Select Committer"
                >
                  <Select.Option value="%cn">
                    Committer Name (%cn)
                  </Select.Option>
                  <Select.Option value="%ce">
                    Committer Email (%ce)
                  </Select.Option>
                  <Select.Option value="%ci">
                    Committer Date ISO8601 (%ci)
                  </Select.Option>
                  <Select.Option value="%cD">
                    Committer Date RFC2882 (%cD)
                  </Select.Option>
                  <Select.Option value="%cr">
                    Committer Date relative (%cr)
                  </Select.Option>
                  <Select.Option value="%ct">
                    Committer Date unix timestamp (%ct)
                  </Select.Option>
                </Select>
              </Form.Item>
            )}

            {/* Commit Message Section */}
            {formatOption === 'commit-msg' && (
              <Form.Item label="Commit Message">
                <Select
                  ref={commitMsgRef}
                  value={commitMsgOption}
                  onChange={(val: string) => {
                    setCommitMsgOption(val);
                    blurSelect(commitMsgRef);
                  }}
                  placeholder="Select Commit Message"
                >
                  <Select.Option value="%s">Commit Subject (%s)</Select.Option>
                  <Select.Option value="%b">Commit Body (%b)</Select.Option>
                </Select>
              </Form.Item>
            )}

            {formatOption !== undefined && (
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <Segmented
                  className="segmented-color"
                  options={[
                    {
                      value: 'auto',
                      label: (
                        <Tooltip
                          mouseEnterDelay={0}
                          mouseLeaveDelay={0}
                          title="Display Color from Git Config"
                          placement="top"
                        >
                          <span>auto</span>
                        </Tooltip>
                      ),
                    },
                    {
                      value: 'customColor',
                      label: (
                        <Tooltip
                          mouseEnterDelay={0}
                          mouseLeaveDelay={0}
                          title="Display a Custom Color"
                          placement="top"
                        >
                          <ColorPicker
                            defaultValue="white"
                            value={color}
                            onChange={setColor}
                            format="hex"
                            size="small"
                          />
                        </Tooltip>
                      ),
                    },
                  ]}
                  value={colorOption}
                  onChange={setColorOption}
                />
                <Segmented
                  options={[
                    { value: 'normal', label: 'normal' },
                    { value: 'bold', icon: <BoldOutlined /> },
                  ]}
                  value={textStyle}
                  onChange={setTextStyle}
                />
              </div>
            )}
            {formatOption !== undefined && <br />}

            <Space>
              <Button
                type="primary"
                onClick={updateFormatOption}
                disabled={isAddToFormatBtnDisabled()}
              >
                Add to Format
              </Button>
            </Space>
          </Form>
        </Card>
      </div>

      <div
        style={{
          float: 'left',
          width: '40%',
          marginTop: '20px',
          marginLeft: '5%',
        }}
      >
        <Card title="Format Expression">
          <Form form={formGitLog}>
            <Form.Item name="formatExpression" label="Choose Color">
              <Input allowClear />
            </Form.Item>
          </Form>
          <Button onClick={resetFormatExpression}>Reset</Button>
        </Card>
      </div>
    </div>
  );
}
