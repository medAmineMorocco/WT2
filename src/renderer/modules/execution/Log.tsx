import React, { useRef, useState } from 'react';
import { Space, Tabs, Tooltip } from 'antd';
import { CheckOutlined, CopyOutlined, ExpandOutlined } from '@ant-design/icons';
import { useHotkeys } from 'react-hotkeys-hook';
import { TypeAnimation } from 'react-type-animation';
import LogFullscreen from './LogFullscreen';

const firstText = `Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ab
consequuntur cupiditate dolores, explicabo iste itaque natus nisi qui
quibusdam repudiandae. Aliquid consequatur doloremque doloribus
laborum modi nemo nihil non quos? Lorem ipsum dolor sit amet,
  consectetur adipisicing elit. Aliquid blanditiis, consequuntur culpa
doloribus eius est expedita itaque labore, magnam modi, nemo optio
perspiciatis quae sint ullam. Et nihil possimus repellendus. Lorem
ipsum dolor sit amet, consectetur adipisicing elit. Ab at cumque
distinctio, eaque facere fugit laudantium minima nobis numquam quasi
saepe suscipit vitae, voluptatum. Ad fugit iusto quis similique
voluptatum! Lorem ipsum dolor sit amet, consectetur adipisicing elit.
  Atque enim, error iure molestias mollitia perferendis placeat quas
tempore ut vel! Atque beatae consequuntur ea enim perferendis placeat,
  quae quas unde! Lorem ipsum dolor sit amet, consectetur adipisicing
elit. A ab dicta eius facere incidunt, ipsum molestias nemo, omnis
praesentium, quibusdam quisquam quo ratione tempora tenetur voluptate
voluptatem voluptatum. Aut, doloremque. Lorem ipsum dolor sit amet,
  consectetur adipisicing elit. Doloribus impedit odit recusandae
voluptas voluptate voluptatem. Aperiam, consectetur debitis dolorum
facilis in ipsam iste molestiae nam numquam quasi repellendus sint?
  Vitae. Lorem ipsum dolor sit amet, consectetur adipisicing elit.
  Dolorem ipsum magni numquam veniam? A atque consequuntur dolore
explicabo, in iure magni maxime minus mollitia, nisi nulla qui rem
ullam voluptatem.
  Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ab
consequuntur cupiditate dolores, explicabo iste itaque natus nisi qui
quibusdam repudiandae. Aliquid consequatur doloremque doloribus
laborum modi nemo nihil non quos? Lorem ipsum dolor sit amet,
  consectetur adipisicing elit. Aliquid blanditiis, consequuntur culpa
doloribus eius est expedita itaque labore, magnam modi, nemo optio
perspiciatis quae sint ullam. Et nihil possimus repellendus. Lorem
ipsum dolor sit amet, consectetur adipisicing elit. Ab at cumque
distinctio, eaque facere fugit laudantium minima nobis numquam quasi
saepe suscipit vitae, voluptatum. Ad fugit iusto quis similique
voluptatum! Lorem ipsum dolor sit amet, consectetur adipisicing elit.
  Atque enim, error iure molestias mollitia perferendis placeat quas
tempore ut vel! Atque beatae consequuntur ea enim perferendis placeat,
  quae quas unde! Lorem ipsum dolor sit amet, consectetur adipisicing
elit. A ab dicta eius facere incidunt, ipsum molestias nemo, omnis
praesentium, quibusdam quisquam quo ratione tempora tenetur voluptate
voluptatem voluptatum. Aut, doloremque. Lorem ipsum dolor sit amet,
  consectetur adipisicing elit. Doloribus impedit odit recusandae
voluptas voluptate voluptatem. Aperiam, consectetur debitis dolorum
facilis in ipsam iste molestiae nam numquam quasi repellendus sint?
  Vitae. Lorem ipsum dolor sit amet, consectetur adipisicing elit.
  Dolorem ipsum magni numquam veniam? A atque consequuntur dolore
explicabo, in iure magni maxime minus mollitia, nisi nulla qui rem
ullam voluptatem.`;

export default function Log() {
  const [isCopied, setCopied] = useState(false);

  const [isFullScreenMode, setFullScreenMode] = useState(false);

  const logRef = useRef();

  const [activeTabKey, setActiveTabKey] = useState('1');

  const onCopyClick = () => {
    navigator.clipboard.writeText(logRef.current.innerHTML);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const toggleFullScreenMode = () => {
    setFullScreenMode(!isFullScreenMode);
  };

  const onChangeTab = (activeKey: string) => {
    setActiveTabKey(activeKey);
  };

  useHotkeys('shift+s', () => toggleFullScreenMode(), {
    preventDefault: true,
  });

  useHotkeys('shift+l', () => onCopyClick(), {
    preventDefault: true,
  });

  return (
    <>
      <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
        <Space>
          <Tooltip
            title={
              !isCopied ? (
                <Space>
                  <span>Copy</span>
                  <small style={{ color: 'grey' }}>Shift+L</small>
                </Space>
              ) : (
                'Copied!'
              )
            }
            placement="left"
          >
            {!isCopied ? (
              <CopyOutlined
                style={{ cursor: 'pointer' }}
                onClick={onCopyClick}
              />
            ) : (
              <CheckOutlined />
            )}
          </Tooltip>
          <Tooltip
            title={
              <Space>
                <span>Enter fullscreen mode</span>
                <small style={{ color: 'grey' }}>Shift+S</small>
              </Space>
            }
            placement="left"
          >
            <ExpandOutlined
              style={{ cursor: 'pointer' }}
              onClick={toggleFullScreenMode}
              className="icon-action"
            />
          </Tooltip>
        </Space>
      </div>
      <div
        style={{
          marginTop: '8px',
          height: 'calc(41.5vh - 20px)',
        }}
      >
        <Tabs
          tabPosition="left"
          style={{
            height: 'calc(41.5vh - 20px)',
          }}
          className="log-tabs"
          onChange={onChangeTab}
          items={new Array(3).fill(null).map((_, i) => {
            const id = String(i + 1);
            return {
              label: `Worktree ${id}`,
              key: id,
              children: (
                <TypeAnimation
                  ref={logRef}
                  style={{
                    display: 'block',
                  }}
                  sequence={[firstText]}
                  cursor={false}
                />
              ),
            };
          })}
        />
      </div>
      <LogFullscreen
        isFullScreenMode={isFullScreenMode}
        toggleFullScreenMode={toggleFullScreenMode}
        activeKey={activeTabKey}
      />
    </>
  );
}
