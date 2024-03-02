import { useEffect, useState } from 'react';
import TabService from '../../services/tab/TabService';

export default function useStickyState(field: string, defaultValue: any) {
  const activeTab = TabService.getActiveTab();

  const [newValue, setNewValue] = useState();

  const [value, setValue] = useState(() => {
    const initialValue = TabService.getTabField(activeTab, field, defaultValue);
    setNewValue(initialValue);
    return initialValue;
  });

  useEffect(() => {
    const stickyValue = window.localStorage.getItem(activeTab);
    if (stickyValue) {
      const parse = JSON.parse(stickyValue);
      parse[field] = value;
      window.localStorage.setItem(activeTab, JSON.stringify(parse));
      setNewValue(parse);
    } else {
      const newVal: any = { [field]: value };
      window.localStorage.setItem(activeTab, JSON.stringify(newVal));
      setNewValue(newVal);
    }
  }, [activeTab, field, value, setValue]);

  return [newValue ? newValue[field] : null, setValue];
}
