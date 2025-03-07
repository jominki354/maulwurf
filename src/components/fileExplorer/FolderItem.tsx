import React from 'react';
import { getFileIconClass } from '../../utils/fileUtils';

interface FolderItemProps {
  item: any;
  level: number;
  selectedFilePath: string | null;
  onFileSelect: (filePath: string) => void;
  onFolderSelect: (path: string) => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
  item,
  level,
  selectedFilePath,
  onFileSelect,
  onFolderSelect
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
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
        >
          <div className="folder-icon"></div>
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
              />
            ))}
          </div>
        )}
      </div>
    );
  } else {
    return (
      <div 
        className={`file-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft }}
        onDoubleClick={handleFileDoubleClick}
      >
        <div className="file-icon"></div>
        <div className="file-name">{item.name}</div>
      </div>
    );
  }
};

export default FolderItem; 