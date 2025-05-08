import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  Modal,
  Result,
  Segmented,
  Space,
  Statistic,
  theme,
  Tooltip,
  Typography,
} from 'antd';
import { Award05Icon } from 'hugeicons-react';
import {
  HourglassOutlined,
  HourglassFilled,
  UserOutlined,
  KeyOutlined,
  WarningOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ipcRenderer } from 'electron';
import iconImage from './icon.png';
import FreelancerIllustration from '../../components/illustrations/FreelancerIllustration';

const { useToken } = theme;

export default function PackInfos() {
  const { token } = useToken();

  const [pack, setPack] = useState<string | null>();

  const [isExpired, setIsExpired] = useState<boolean>(false);

  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  const [startTrialDate, setStartTrialDate] = useState<string | null>(null);

  const [packInfos, setPackInfos] = useState<any | null>();

  const [isLoading, setLoading] = useState<boolean>(false);

  const [isSubscriptionModalClosable, setIsSubscriptionModalClosable] =
    useState<boolean>(false);

  const [errorReason, setErrorReason] = useState<string | null>();

  const handleSwitchUser = () => {
    setIsSubscriptionModalClosable(true);
  };

  useEffect(() => {
    ipcRenderer.send('check-trial-expiration');
    const onReceiveExpirationInfos = (
      event: any,
      packReceived: string,
      infos: any,
    ) => {
      setPack(packReceived);
      setPackInfos(infos);
      if (packReceived === 'Free Trial') {
        const {
          isExpiredReceived,
          daysRemainingReceived,
          startTrialDateReceived,
        } = infos;
        setIsExpired(isExpiredReceived);
        setStartTrialDate(startTrialDateReceived);
        setIsSubscriptionModalClosable(false);
        if (!isExpiredReceived) {
          setDaysRemaining(daysRemainingReceived);
        }
      }
    };

    const onReceiveSubscriptionInfos = (
      event: any,
      isSubscribedOrHasTrial: boolean,
      _infos: any,
      errorReasonReceived: string,
    ) => {
      setLoading(false);
      setErrorReason(errorReasonReceived);
      if (isSubscribedOrHasTrial) {
        ipcRenderer.send('check-trial-expiration');
      }
    };

    const onSwitchUser = () => {
      handleSwitchUser();
    };

    ipcRenderer.on('is-expired', onReceiveExpirationInfos);
    ipcRenderer.on('is-subscribed', onReceiveSubscriptionInfos);
    ipcRenderer.on('switch-user', onSwitchUser);

    return () => {
      ipcRenderer.removeAllListeners('is-expired');
      ipcRenderer.removeAllListeners('is-subscribed');
      ipcRenderer.removeAllListeners('switch-user');
    };
  }, []);

  const onGoPro = () => {
    setIsSubscriptionModalClosable(true);
  };

  const onCloseSubscriptionModal = () => {
    setIsSubscriptionModalClosable(false);
  };

  const onFinish = (values: any) => {
    setLoading(true);
    setErrorReason(null);
    ipcRenderer.send(
      'verify-subscription',
      values.trialOrSubscription,
      values.email,
      values.licence,
    );
  };

  const content = useMemo(() => {
    if (
      pack !== 'Free Trial' &&
      packInfos &&
      packInfos.pack &&
      !isSubscriptionModalClosable
    ) {
      return (
        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical">
            <Space>
              <Tooltip
                title="Switch User"
                placement="top"
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <UserSwitchOutlined onClick={handleSwitchUser} />
              </Tooltip>
              <Tooltip
                title={packInfos.email}
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <small>
                  {packInfos.email && packInfos.email.split('@')[0]}
                </small>
              </Tooltip>
            </Space>
            <Space>
              <Award05Icon size={24} color="#FAAD14" />
              <strong>{packInfos.pack}</strong>
            </Space>
          </Space>
        </div>
      );
    }
    if (!packInfos || packInfos.pack === null || isSubscriptionModalClosable) {
      return (
        <Modal
          className="trial-expired-modal"
          open
          onCancel={onCloseSubscriptionModal}
          closeIcon={isSubscriptionModalClosable}
          footer={null}
          centered
          width="50%"
        >
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                marginBottom: '24px',
              }}
            >
              <img
                alt="worktreewise-icon"
                src={iconImage}
                width={86}
                height={86}
              />
              <div
                style={{ fontFamily: 'ExpletusSans-Regular', fontSize: '2rem' }}
              >
                WorktreeWise
              </div>
            </div>

            <Form
              onFinish={onFinish}
              name="login"
              initialValues={{ remember: true }}
              disabled={isLoading}
              style={{ width: '100%' }}
            >
              <Form.Item name="trialOrSubscription" initialValue="subscription">
                <Segmented
                  disabled={isLoading}
                  block
                  options={[
                    {
                      label: <div style={{ padding: 2 }}>Subscription</div>,
                      value: 'subscription',
                    },
                    {
                      label: <div style={{ padding: 2 }}>Free Trial</div>,
                      value: 'trial',
                      disabled:
                        (pack === 'Free Trial' && isExpired) ||
                        (pack === 'Free Trial' &&
                          !isExpired &&
                          daysRemaining &&
                          daysRemaining >= 0) ||
                        false,
                    },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Please input your Email !' },
                  { type: 'email' },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="Email" />
              </Form.Item>
              <Form.Item
                name="licence"
                rules={[
                  {
                    required: true,
                    message: 'Please input your Licence Key !',
                  },
                ]}
              >
                <Input prefix={<KeyOutlined />} placeholder="Licence Key" />
              </Form.Item>

              <Form.Item>
                <Button
                  block
                  type="primary"
                  htmlType="submit"
                  loading={isLoading}
                >
                  Verify
                </Button>
              </Form.Item>
            </Form>
            <div style={{ position: 'absolute' }}>
              {errorReason ? (
                <Space align="start">
                  <WarningOutlined style={{ color: token.colorErrorText }} />
                  <Typography.Text type="danger">{errorReason}</Typography.Text>
                </Space>
              ) : (
                <span />
              )}
            </div>

            <Divider />

            <Typography.Text>
              Don’t have a subscription ?{' '}
              <Typography.Link
                href={window.localStorage.getItem('PAYMENT_PAGE_URL') || ''}
                target="_blank"
              >
                Buy a license
              </Typography.Link>
            </Typography.Text>
          </div>
        </Modal>
      );
    }
    if (pack === 'Free Trial' && isExpired) {
      return (
        <Modal
          className="trial-expired-modal"
          open
          closeIcon={null}
          footer={null}
          centered
          width="60%"
        >
          <Result
            icon={<FreelancerIllustration width="50%" />}
            title="Your trial has expired. We hope you enjoyed your trial."
            subTitle="We invite you to upgrade to a paid plan for continued access to our premium features and services."
            extra={
              <Button
                size="large"
                type="primary"
                onClick={() => setIsSubscriptionModalClosable(true)}
              >
                Go Pro
              </Button>
            }
          />
        </Modal>
      );
    }
    return (
      <Card
        actions={[
          <Space direction="vertical">
            <Space>
              <UserOutlined />
              <Tooltip
                title={packInfos.email}
                mouseEnterDelay={0}
                mouseLeaveDelay={0}
              >
                <small>
                  {packInfos.email && packInfos.email.split('@')[0]}
                </small>
              </Tooltip>
            </Space>
            <Space>
              <Award05Icon size={24} color="#FAAD14" />
              <Button onClick={onGoPro} type="link" style={{ padding: '0' }}>
                Go Pro
              </Button>
            </Space>
          </Space>,
        ]}
        title="Free Trial"
        bordered
        type="inner"
      >
        <Statistic
          title={null}
          prefix={
            daysRemaining === 1 ? <HourglassOutlined /> : <HourglassFilled />
          }
          value={daysRemaining || ''}
          suffix="Days"
        />
        <small>Started on {startTrialDate}</small>
      </Card>
    );
  }, [
    pack,
    packInfos,
    isSubscriptionModalClosable,
    isExpired,
    daysRemaining,
    startTrialDate,
    isLoading,
    errorReason,
    token.colorErrorText,
  ]);

  return <div>{content}</div>;
}
