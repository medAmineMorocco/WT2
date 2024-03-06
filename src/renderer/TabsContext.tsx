import React, { createContext, useState, useContext } from 'react';

const ItemsContext = createContext<any | null>(null);

function ItemsProvider({ children }) {
  const [items, setItems] = useState<any[]>([]);

  const updateItems = (newItems: any[]) => {
    setItems(newItems);
  };

  return (
    <ItemsContext.Provider value={{ items, updateItems }}>
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
