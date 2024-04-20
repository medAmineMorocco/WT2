export default class TabService {
  static getTabs = (): string[] => {
    return Object.keys(window.localStorage)
      .filter((key) => key.startsWith('tab'))
      .sort();
  };

  static getTabsWithDetails = (): any[] => {
    return Object.keys(window.localStorage)
      .filter((key) => key.startsWith('tab'))
      .map((tab) => {
        return {
          tab,
          ...TabService.getTab(tab),
        };
      });
  };

  static getTab = (tabKey: string) => {
    const tabValue = window.localStorage.getItem(tabKey);
    if (!tabValue) {
      return null;
    }
    return JSON.parse(tabValue);
  };

  static getTabField = (tabKey: string, field: string, defaultValue: any) => {
    const tabValue = window.localStorage.getItem(tabKey);
    if (!tabValue) {
      return null;
    }
    const tabValueParsed = JSON.parse(tabValue);
    return tabValueParsed[field] || defaultValue;
  };

  static getTabRepoPath = (tabKey: string) => {
    return this.getTabField(tabKey, 'selectedRepoPath', null);
  };

  static getTabLabel = (tabKey: string) => {
    return this.getTabField(tabKey, 'repoName', 'New Tab');
  };

  static getMaxTabKey = () => {
    if (this.getTabs().length === 0) {
      return 'tab1';
    }
    const max = Math.max(
      ...this.getTabs().map((key) => Number(key.replace('tab', ''))),
    );
    return `tab${max}`;
  };

  static getMinTabKey = () => {
    if (this.getTabs().length === 0) {
      return 'tab1';
    }
    const min = Math.min(
      ...this.getTabs().map((key) => Number(key.replace('tab', ''))),
    );
    return `tab${min}`;
  };

  static getActiveTab = () => {
    return window.localStorage.getItem('activeTab') || 'tab1';
  };

  static setActiveTab = (tabKey: string) => {
    return window.localStorage.setItem('activeTab', tabKey);
  };
}
