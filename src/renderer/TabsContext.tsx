import React, { createContext, useState, useContext } from 'react';
import TabService from './services/tab/TabService';

const ItemsContext = createContext<any | null>(null);

function ItemsProvider({ children }) {
  const [items, setItems] = useState<any[]>([]);
  const [activeKey, setActiveKey] = useState(TabService.getMinTabKey());
  const [isWorkflowPlaying, setIsWorkflowPlaying] = useState(false);

  const updateItems = (newItems: any[]) => {
    setItems(newItems);
  };

  return (
    <ItemsContext.Provider
      value={{
        items,
        updateItems,
        activeKey,
        setActiveKey,
        isWorkflowPlaying,
        setIsWorkflowPlaying,
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
}

const useItemsContext = () => {
  const context = useContext(ItemsContext);
  if (context === null) {
    throw new Error('useItemsContext must be used within an ItemsProvider');
  }
  return context;
};

export { ItemsContext, ItemsProvider, useItemsContext };
