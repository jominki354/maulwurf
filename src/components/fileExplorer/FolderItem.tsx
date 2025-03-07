import React, { useState } from 'react';
import { getFileIconClass } from '../../utils/fileUtils';
import ContextMenu from './ContextMenu';
import { join } from '@tauri-apps/api/path';

interface FolderItemProps {
  item: any;
  level: number;
  selectedFilePath: string | null;
  onFileSelect: (filePath: string) => void;
  onFolderSelect: (path: string) => void;
  onCut?: (path: string) => void;
  onCopy?: (path: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
  item,
  level,
  selectedFilePath,
  onFileSelect,
  onFolderSelect,
  onCut,
  onCopy,
  onRename,
  onDelete
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0
  });
  
  // 폴더 토글
  const toggleFolder = () => {
    setIsExpanded(!isExpanded);
  };
  
  // 폴더 더블클릭 핸들러
  const handleFolderDoubleClick = () => {
    if (item.path) {
      onFolderSelect(item.path);
    }
  };
  
  // 파일 더블클릭 핸들러
  const handleFileDoubleClick = () => {
    if (item.path) {
      onFileSelect(item.path);
    }
  };

  // 컨텍스트 메뉴 표시
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = () => {
    setContextMenu({
      ...contextMenu,
      visible: false
    });
  };

  // 잘라내기 핸들러
  const handleCut = () => {
    if (onCut && item.path) {
      onCut(item.path);
    }
  };

  // 복사 핸들러
  const handleCopy = () => {
    if (onCopy && item.path) {
      onCopy(item.path);
    }
  };

  // 이름 변경 핸들러
  const handleRename = () => {
    if (onRename && item.path) {
      onRename(item.path);
    }
  };

  // 삭제 핸들러
  const handleDelete = () => {
    if (onDelete && item.path) {
      onDelete(item.path);
    }
  };
  
  const isFolder = !!item.children;
  const isSelected = selectedFilePath === item.path;
  
  const paddingLeft = level * 16 + 8;
  
  if (isFolder) {
    return (
      <div>
        <div 
          className="folder-item" 
          style={{ paddingLeft }}
          onClick={toggleFolder}
          onDoubleClick={handleFolderDoubleClick}
          onContextMenu={handleContextMenu}
        >
          <div className={`folder-icon ${isExpanded ? 'expanded' : ''}`}></div>
          <div className="folder-name">{item.name}</div>
        </div>
        {isExpanded && item.children && (
          <div className="folder-children">
            {item.children.map((child: any, index: number) => (
              <FolderItem
                key={index}
                item={child}
                level={level + 1}
                selectedFilePath={selectedFilePath}
                onFileSelect={onFileSelect}
                onFolderSelect={onFolderSelect}
                onCut={onCut}
                onCopy={onCopy}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
        {contextMenu.visible && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isVisible={contextMenu.visible}
            onClose={closeContextMenu}
            onCut={handleCut}
            onCopy={handleCopy}
            onRename={handleRename}
            onDelete={handleDelete}
            isFolder={true}
          />
        )}
      </div>
    );
  } else {
    return (
      <>
        <div 
          className={`file-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft }}
          onClick={() => onFileSelect(item.path)}
          onDoubleClick={handleFileDoubleClick}
          onContextMenu={handleContextMenu}
        >
          <div className={`file-icon ${getFileIconClass(item.name)}`}></div>
          <div className="file-name">{item.name}</div>
        </div>
        {contextMenu.visible && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isVisible={contextMenu.visible}
            onClose={closeContextMenu}
            onCut={handleCut}
            onCopy={handleCopy}
            onRename={handleRename}
            onDelete={handleDelete}
            isFolder={false}
          />
        )}
      </>
    );
  }
};

export default FolderItem; 