import {
  Avatar,
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Popover,
  Progress,
  Result,
  Segmented,
  Space,
  Tag,
  theme,
  Typography,
} from 'antd';
import { Award05Icon } from 'hugeicons-react';
import {
  CalendarOutlined,
  CreditCardOutlined,
  DownOutlined,
  KeyOutlined,
  LogoutOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import iconImage from './icon.png';

const FreelancerIllustration = lazy(
  () => import('../../components/illustrations/FreelancerIllustration'),
);

const { useToken } = theme;

export default function PackInfos() {
  const { token } = useToken();
  const [isExpired, setIsExpired] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [startTrialDate, setStartTrialDate] = useState<string | null>(null);
  const [packInfos, setPackInfos] = useState<any | null>();
  const [isLoading, setLoading] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isValid, setValid] = useState(false);
  const [errorReason, setErrorReason] = useState<string | null>();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    window.electron.ipcRenderer.send('check-trial-expiration');

    const removeExpirationListener = window.electron.ipcRenderer.on(
      'is-expired',
      (infos: any) => {
        setPackInfos(infos);
        if (infos?.pack === 'Free Trial') {
          setIsExpired(infos.isExpiredReceived);
          setValid(!infos.isExpiredReceived);
          setStartTrialDate(infos.startTrialDateReceived);
          setShowSubscriptionModal(false);
          setDaysRemaining(
            infos.isExpiredReceived ? null : infos.daysRemainingReceived,
          );
        } else if (infos) {
          setValid(true);
        }
      },
    );

    const removeSubscriptionListener = window.electron.ipcRenderer.on(
      'is-subscribed',
      (valid: boolean, hasTrial: boolean, infos: any, reason: string) => {
        setLoading(false);
        setValid(valid);
        setErrorReason(reason);
        setPackInfos(infos);
        if (!reason) setShowSubscriptionModal(false);
        if (hasTrial) {
          window.electron.ipcRenderer.send('check-trial-expiration');
        }
      },
    );

    const removeSwitchUserListener = window.electron.ipcRenderer.on(
      'switch-user',
      () => setShowSubscriptionModal(true),
    );

    return () => {
      removeExpirationListener();
      removeSubscriptionListener();
      removeSwitchUserListener();
    };
  }, []);

  const onFinish = (values: any) => {
    setLoading(true);
    setErrorReason(null);
    window.electron.ipcRenderer.send(
      'verify-subscription',
      values.trialOrSubscription,
      values.email,
      values.licence,
    );
  };

  const email = packInfos?.email || 'Not signed in';
  const userName = packInfos?.email?.split('@')[0] || 'Profile';
  const packName = packInfos?.pack || 'WorktreeWise';
  const version = window.localStorage.getItem('VERSION') || '';
  const trialProgress = Math.max(
    0,
    Math.min(100, ((daysRemaining || 0) / 14) * 100),
  );

  const profileContent = (
    <div className="profile-popover-content">
      <div className="profile-popover-header">
        <Avatar size={42} icon={<UserOutlined />} />
        <div>
          <Typography.Text strong>{userName}</Typography.Text>
          <Typography.Text type="secondary" ellipsis>
            {email}
          </Typography.Text>
        </div>
      </div>
      <Divider />
      <div className="profile-info-row">
        <span>
          <Award05Icon size={18} color={token.colorWarning} /> Plan
        </span>
        <Tag color={packInfos?.pack === 'Free Trial' ? 'blue' : 'gold'}>
          {packName}
        </Tag>
      </div>
      {packInfos?.pack === 'Free Trial' && !isExpired && (
        <div className="profile-trial-block">
          <div>
            <span>
              <CalendarOutlined /> Trial remaining
            </span>
            <strong>{daysRemaining || 0} days</strong>
          </div>
          <Progress percent={trialProgress} showInfo={false} size="small" />
          {startTrialDate && (
            <Typography.Text type="secondary">
              Started on {startTrialDate}
            </Typography.Text>
          )}
        </div>
      )}
      <div className="profile-info-row">
        <span>
          <SafetyCertificateOutlined /> Version
        </span>
        <Typography.Text code>{version || '—'}</Typography.Text>
      </div>
      <Divider />
      {packInfos?.pack === 'Free Trial' && (
        <Button
          type="primary"
          block
          icon={<RocketOutlined />}
          onClick={() => {
            setProfileOpen(false);
            setShowSubscriptionModal(true);
          }}
        >
          Upgrade WorktreeWise
        </Button>
      )}
      <Button
        type="text"
        block
        icon={<LogoutOutlined />}
        onClick={() => {
          setProfileOpen(false);
          setShowSubscriptionModal(true);
        }}
      >
        Switch account
      </Button>
    </div>
  );

  return (
    <>
      <Popover
        content={profileContent}
        placement="bottomRight"
        trigger="click"
        open={profileOpen}
        onOpenChange={setProfileOpen}
        arrow={false}
        overlayClassName="profile-popover"
      >
        <Button type="text" className="profile-tab-button">
          <Avatar size={25} icon={<UserOutlined />} />
          <span className="profile-tab-name">{userName}</span>
          <DownOutlined />
        </Button>
      </Popover>

      {(!isValid || showSubscriptionModal) && (
        <Modal
          className="trial-expired-modal"
          open
          onCancel={() => setShowSubscriptionModal(false)}
          closeIcon={showSubscriptionModal}
          footer={null}
          centered
          width="50%"
        >
          <div className="subscription-modal-content">
            <div className="subscription-modal-brand">
              <img alt="WorktreeWise" src={iconImage} width={72} height={72} />
              <Typography.Title level={2}>WorktreeWise</Typography.Title>
            </div>
            <Form onFinish={onFinish} name="login" disabled={isLoading}>
              <Form.Item name="trialOrSubscription" initialValue="subscription">
                <Segmented
                  block
                  options={[
                    {
                      label: (
                        <Space size={6}>
                          <CreditCardOutlined />
                          <span>Subscription</span>
                        </Space>
                      ),
                      value: 'subscription',
                    },
                    {
                      label: (
                        <Space size={6}>
                          <RocketOutlined />
                          <span>Free Trial</span>
                        </Space>
                      ),
                      value: 'trial',
                      disabled: packInfos?.pack === 'Free Trial',
                    },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Please input your email.' },
                  { type: 'email' },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="Email" />
              </Form.Item>
              <Form.Item
                name="licence"
                rules={[
                  { required: true, message: 'Please input your licence key.' },
                ]}
              >
                <Input prefix={<KeyOutlined />} placeholder="Licence Key" />
              </Form.Item>
              <Button block type="primary" htmlType="submit" loading={isLoading}>
                Verify
              </Button>
            </Form>
            <Divider />
            <Typography.Text>
              Don’t have a subscription?{' '}
              <Typography.Link
                href={window.localStorage.getItem('PAYMENT_PAGE_URL') || ''}
                target="_blank"
              >
                Buy a license
              </Typography.Link>
            </Typography.Text>
            {errorReason && (
              <Space align="start" className="subscription-error">
                <WarningOutlined style={{ color: token.colorErrorText }} />
                <Typography.Text type="danger">{errorReason}</Typography.Text>
              </Space>
            )}
          </div>
        </Modal>
      )}

      {isValid && packInfos?.pack === 'Free Trial' && isExpired && (
        <Modal open closeIcon={null} footer={null} centered width="60%">
          <Result
            icon={
              <Suspense fallback={null}>
                <FreelancerIllustration width="50%" />
              </Suspense>
            }
            title="Your trial has expired. We hope you enjoyed your trial."
            subTitle="Upgrade to a paid plan for continued access to premium features and services."
            extra={
              <Button type="primary" onClick={() => setShowSubscriptionModal(true)}>
                Go Pro
              </Button>
            }
          />
        </Modal>
      )}
    </>
  );
}
