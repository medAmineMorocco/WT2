import React, { useEffect, useRef, useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { ConfigProvider, theme, App as AntdApp, Tabs, Tooltip } from 'antd';
import { useHotkeys } from 'react-hotkeys-hook';
import { FolderOutlined } from '@ant-design/icons';
import ContentTab from './ContentTab';

const { defaultAlgorithm, darkAlgorithm } = theme;

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

function Hello() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setIsDarkMode(window.localStorage.getItem('isDarkMode') === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem('isDarkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const onThemeChange = () => {
    setIsDarkMode((previousValue) => !previousValue);
  };

  useHotkeys('shift+t', onThemeChange, {
    preventDefault: true,
  });

  const getTabs = () => {
    return Object.keys(window.localStorage)
      .filter((key) => key.startsWith('tab'))
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

  const getItem = (array: string[], currentItem: string, direction: string) => {
    const currentIndex = array.indexOf(currentItem);
    let resultItem = null;

    if (currentIndex !== -1) {
      if (direction === 'next' && currentIndex < array.length - 1) {
        resultItem = array[currentIndex + 1];
      } else if (direction === 'previous' && currentIndex > 0) {
        resultItem = array[currentIndex - 1];
      }
    }
    return resultItem;
  };

  useHotkeys(
    'shift+right',
    () => {
      const nextTab = getItem(getTabs(), activeKey, 'next');
      if (nextTab) {
        setActiveKey(nextTab);
        window.localStorage.setItem('activeTab', nextTab);
      }
    },
    {
      preventDefault: true,
    },
  );

  useHotkeys(
    'shift+left',
    () => {
      const previousTab = getItem(getTabs(), activeKey, 'previous');
      if (previousTab) {
        setActiveKey(previousTab);
        window.localStorage.setItem('activeTab', previousTab);
      }
    },
    {
      preventDefault: true,
    },
  );

  const getTabLabel = (tabKey: string) => {
    const tabValue = window.localStorage.getItem(tabKey);
    let tabLabel;
    if (tabValue) {
      const { repoName } = JSON.parse(tabValue);
      tabLabel = repoName || 'New Tab';
    } else {
      tabLabel = 'New Tab';
    }
    return tabLabel;
  };

  const getTabRepoPath = (tabKey: string) => {
    const tabValue = window.localStorage.getItem(tabKey);
    let result;
    if (tabValue) {
      const { selectedRepoPath } = JSON.parse(tabValue);
      result = selectedRepoPath || null;
    } else {
      result = null;
    }
    return result;
  };

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
              isDarkMode={isDarkMode}
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
      const tabLabel = getTabLabel(tabKey);
      const tabRepoPath = getTabRepoPath(tabKey);
      const label = tabRepoPath ? (
        <Tooltip arrow={false} title={tabRepoPath}>
          <span>{tabLabel}</span>
        </Tooltip>
      ) : (
        <span>{tabLabel}</span>
      );
      newItems.push({
        label,
        children: (
          <ContentTab
            keyTab={tabKey}
            isDarkMode={isDarkMode}
            onThemeChange={onThemeChange}
          />
        ),
        key: tabKey,
        icon: <FolderOutlined />,
      });
    }
    setItems(newItems);
    setActiveKey(window.localStorage.getItem('activeTab') || 'tab1');
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
