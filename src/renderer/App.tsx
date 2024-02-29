import React, { useEffect, useRef, useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { ConfigProvider, theme, App as AntdApp, Tabs } from 'antd';
import { useHotkeys } from 'react-hotkeys-hook';
import { FolderOutlined } from '@ant-design/icons';
import ContentTab from './ContentTab';

const { defaultAlgorithm, darkAlgorithm } = theme;

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

function Hello() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const onThemeChange = () => {
    setIsDarkMode((previousValue) => !previousValue);
  };

  useHotkeys('shift+t', () => onThemeChange(), {
    preventDefault: true,
  });

  useHotkeys('shift+tab', () => console.log('nex'), {
    preventDefault: true,
  });

  useHotkeys('mod+shift+tab', () => console.log('prev'), {
    preventDefault: true,
  });

  const getTabs = () => {
    return Object.keys(window.localStorage)
      .filter((key) => key !== 'activeTab')
      .sort();
  };

  const getMaxTabKey = () => {
    if (getTabs().length === 0) {
      return 'tab1';
    }
    const max = Math.max(
      ...getTabs().map((key) => Number(key.replace('tab', ''))),
    );
    return `tab${max}`;
  };

  const getMinTabKey = () => {
    if (getTabs().length === 0) {
      return 'tab1';
    }
    const min = Math.min(
      ...getTabs().map((key) => Number(key.replace('tab', ''))),
    );
    return `tab${min}`;
  };

  const [activeKey, setActiveKey] = useState(getMinTabKey());
  const [items, setItems] = useState([]);
  const newTabIndex = useRef(Number(getMaxTabKey().replace('tab', '')) + 1);

  useEffect(() => {
    const tabs = getTabs();
    let newItems = [...items];

    if (tabs.length === 0) {
      newItems = [
        {
          label: 'Tab 1',
          children: (
            <ContentTab
              keyTab="tab1"
              isDarkMode={false}
              onThemeChange={onThemeChange}
            />
          ),
          key: 'tab1',
          icon: <FolderOutlined />,
        },
      ];
      setItems(newItems);
      return;
    }
    for (const tabKey of tabs) {
      newItems.push({
        label: tabKey,
        children: (
          <ContentTab
            keyTab={tabKey}
            isDarkMode={false}
            onThemeChange={onThemeChange}
          />
        ),
        key: tabKey,
        icon: <FolderOutlined />,
      });
    }
    setItems(newItems);
  }, []);

  const onChange = (newActiveKey: string) => {
    setActiveKey(newActiveKey);
    window.localStorage.setItem('activeTab', newActiveKey);
  };

  const add = () => {
    const newActiveKey = `tab${newTabIndex.current++}`;
    const newPanes = [...items];
    newPanes.push({
      label: 'New Tab',
      children: (
        <ContentTab
          keyTab={newActiveKey}
          isDarkMode={isDarkMode}
          onThemeChange={onThemeChange}
        />
      ),
      key: newActiveKey,
      icon: <FolderOutlined />,
    });
    setItems(newPanes);
    setActiveKey(newActiveKey);
    window.localStorage.setItem('activeTab', newActiveKey);
  };

  const remove = (targetKey: TargetKey) => {
    if (items.length >= 2) {
      window.localStorage.removeItem(String(targetKey));
      const newPanes = items.filter((item) => item.key !== targetKey);
      setItems(newPanes);
      const newActiveKey = getMaxTabKey();
      setActiveKey(newActiveKey);
      window.localStorage.setItem('activeTab', newActiveKey);
    }
  };

  const onEdit = (
    targetKey: React.MouseEvent | React.KeyboardEvent | string,
    action: 'add' | 'remove',
  ) => {
    if (action === 'add') {
      add();
    } else {
      remove(targetKey);
    }
  };

  return (
    <ConfigProvider
      theme={{ algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm }}
    >
      <AntdApp>
        <Tabs
          type="editable-card"
          onChange={onChange}
          activeKey={activeKey}
          onEdit={onEdit}
          items={items}
          size="small"
          className={
            isDarkMode ? 'repositories-tabs-dark' : 'repositories-tabs'
          }
          animated
        />
      </AntdApp>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
