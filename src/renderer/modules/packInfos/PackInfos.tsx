import { Button, Card, Modal, Result, Space, Statistic } from 'antd';
import { Award05Icon } from 'hugeicons-react';
import { HourglassOutlined, HourglassFilled } from '@ant-design/icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ipcRenderer } from 'electron';
import FreelancerIllustration from '../../components/illustrations/FreelancerIllustration';

const PAYMENT_URL = 'https://ant.design/components/overview';

export default function PackInfos() {
  const [isProVersion, setIsProVersion] = useState<boolean>();

  const [isExpired, setIsExpired] = useState<boolean>(false);

  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  const [startTrialDate, setStartTrialDate] = useState<string | null>(null);

  useEffect(() => {
    ipcRenderer.send('check-trial-expiration');
    const onReceiveExpirationInfos = (
      event: any,
      isProVersionReceived: boolean,
      isExpiredReceived: boolean,
      daysRemainingReceived: number,
      startTrialDateReceived: string,
    ) => {
      setIsProVersion(isProVersionReceived);
      setIsExpired(isExpiredReceived);
      if (!isExpiredReceived) {
        setDaysRemaining(daysRemainingReceived);
        setStartTrialDate(startTrialDateReceived);
      }
    };

    ipcRenderer.on('is-expired', onReceiveExpirationInfos);

    return () => {
      ipcRenderer.removeAllListeners('is-expired');
    };
  }, []);

  const content = useMemo(() => {
    if (isProVersion) {
      return (
        <div style={{ textAlign: 'center' }}>
          <Space>
            <Award05Icon size={24} color="#FAAD14" />
            <strong>Pro</strong>
          </Space>
        </div>
      );
    }
    if (isExpired) {
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
                onClick={() => window.open(PAYMENT_URL, '_blank')}
              >
                Upgrade
              </Button>
            }
          />
        </Modal>
      );
    }
    return (
      <Card
        actions={[
          <Space>
            <Award05Icon size={24} color="#FAAD14" />
            <Button
              onClick={() => window.open(PAYMENT_URL, '_blank')}
              type="link"
              style={{ padding: '0' }}
            >
              Go Pro
            </Button>
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
  }, [daysRemaining, isExpired, isProVersion, startTrialDate]);

  return <div>{content}</div>;
}
