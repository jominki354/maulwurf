import React from 'react';
import { FileTab } from '../../types';
import TabItem from './TabItem';

interface TabBarProps {
  tabs: FileTab[];
  activeTabId: string | null;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string, event: React.MouseEvent) => void;
  handleTabDragStart: (tabId: string, event: React.DragEvent<HTMLDivElement>) => void;
  handleTabDragOver: (tabId: string, event: React.DragEvent<HTMLDivElement>) => void;
  handleTabDrop: (tabId: string, event: React.DragEvent<HTMLDivElement>) => void;
  handleTabDragEnd: () => void;
  draggedTabId: string | null;
  dragOverTabId: string | null;
  onNewTabClick?: () => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  activateTab,
  closeTab,
  handleTabDragStart,
  handleTabDragOver,
  handleTabDrop,
  handleTabDragEnd,
  draggedTabId,
  dragOverTabId,
  onNewTabClick
}) => {
  return (
    <div className="tab-bar-container">
      <div className="tab-bar">
        {tabs.map(tab => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => activateTab(tab.id)}
            onClose={(e) => closeTab(tab.id, e)}
            onDragStart={(e) => handleTabDragStart(tab.id, e)}
            onDragOver={(e) => handleTabDragOver(tab.id, e)}
            onDrop={(e) => handleTabDrop(tab.id, e)}
            onDragEnd={handleTabDragEnd}
            isDragged={tab.id === draggedTabId}
            isDragOver={tab.id === dragOverTabId}
          />
        ))}
        <div className="new-tab-button" onClick={onNewTabClick}>
          +
        </div>
      </div>
    </div>
  );
};

export default TabBar; 