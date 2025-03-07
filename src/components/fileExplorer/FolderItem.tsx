import React, { useState } from 'react';
import { getFileIconClass } from '../../utils/fileUtils';
import ContextMenu from './ContextMenu';
import { join } from '@tauri-apps/api/path';

interface FolderItemProps {
  item: any;
  level: number;
  selectedFilePath: string | null;
  onFileSelect: (filePath: string) => void;
  onFileClick?: (filePath: string) => void;
  onFolderSelect: (path: string) => void;
  onFolderClick?: (path: string) => void;
  onCut?: (path: string) => void;
  onCopy?: (path: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  onPaste?: (targetFolderPath: string) => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
  item,
  level,
  selectedFilePath,
  onFileSelect,
  onFileClick,
  onFolderSelect,
  onFolderClick,
  onCut,
  onCopy,
  onRename,
  onDelete,
  onPaste
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
  
  // 폴더 클릭 핸들러
  const handleFolderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFolderClick && item.path) {
      onFolderClick(item.path);
    }
  };
  
  // 폴더 더블클릭 핸들러
  const handleFolderDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.path) {
      onFolderSelect(item.path);
    }
  };
  
  // 파일 더블클릭 핸들러
  const handleFileDoubleClick = () => {
    if (item.path) {
      // 더블 클릭 시에만 파일을 열도록 함
      onFileSelect(item.path);
    }
  };

  // 파일 선택 핸들러 (단일 클릭)
  const handleFileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 단일 클릭은 파일 선택만 함 (파일을 열지 않음)
    if (item.path && onFileClick) {
      onFileClick(item.path);
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

  // 붙여넣기 핸들러
  const handlePaste = () => {
    if (onPaste && item.path) {
      // 폴더인 경우 해당 폴더에 붙여넣기
      if (item.children) {
        onPaste(item.path);
      } 
      // 파일인 경우 파일이 위치한 폴더에 붙여넣기
      else {
        const pathParts = item.path.split(/[/\\]/);
        pathParts.pop(); // 파일명 제거
        const parentPath = pathParts.join('/');
        onPaste(parentPath);
      }
    }
  };
  
  const isFolder = !!item.children;
  
  const paddingLeft = level * 16 + 8;
  
  if (isFolder) {
    return (
      <div>
        <div 
          className={`folder-item ${selectedFilePath === item.path ? 'selected' : ''}`}
          style={{ paddingLeft }}
          onClick={handleFolderClick}
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
                onPaste={onPaste}
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
            onPaste={onPaste ? handlePaste : undefined}
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
          className={`file-item ${selectedFilePath === item.path ? 'selected' : ''}`}
          style={{ paddingLeft }}
          onClick={handleFileClick}
          onDoubleClick={(e) => {
            e.stopPropagation();
            // 더블 클릭 시 파일 열기
            handleFileDoubleClick();
          }}
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
            onPaste={onPaste ? handlePaste : undefined}
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