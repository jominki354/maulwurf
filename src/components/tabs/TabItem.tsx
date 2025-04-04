import React, { useRef } from 'react';
import { FileTab } from '../../types';

interface TabItemProps {
  tab: FileTab;
  isActive: boolean;
  onActivate: () => void;
  onClose: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  isDragged: boolean;
  isDragOver: boolean;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  isActive,
  onActivate,
  onClose,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragged,
  isDragOver
}) => {
  // 탭 타이틀 영역 참조
  const titleRef = useRef<HTMLDivElement>(null);

  // 이벤트 전파 방지
  const handleCloseClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onClose(e);
  };
  
  // 드래그 시작 핸들러
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // 닫기 버튼에서 시작된 드래그인지 확인
    const target = e.target as HTMLElement;
    if (target.classList.contains('tab-close')) {
      e.preventDefault();
      return;
    }
    
    console.log('탭 드래그 시작:', tab.id);
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
    // 드래그 데이터 설정
    e.dataTransfer.setData('text/plain', tab.id);
    
    // 드래그 시작 이벤트 전달
    onDragStart(e);
  };

  // 드래그 오버 핸들러
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 드래그 효과 설정
    e.dataTransfer.dropEffect = 'move';
    
    // 드래그 오버 이벤트 전달
    onDragOver(e);
  };

  // 드롭 핸들러
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('탭 드롭:', tab.id);
    
    // 드롭 이벤트 전달
    onDrop(e);
  };

  return (
    <div
      className={`tab ${isActive ? 'active' : ''} ${isDragged ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={onActivate}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
    >
      <div className="tab-title" ref={titleRef}>
        {tab.fileName || tab.title}
        {tab.isModified && <span className="modified-indicator">*</span>}
      </div>
      <div className="tab-close" onClick={handleCloseClick}>×</div>
    </div>
  );
};

export default TabItem; 