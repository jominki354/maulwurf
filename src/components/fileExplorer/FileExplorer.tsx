import React from 'react';
import { formatDrivePath } from '../../utils/fileUtils';
import FolderItem from './FolderItem';

interface FileExplorerProps {
  folderPath: string;
  folderStructure: any[];
  selectedFilePath: string | null;
  onFileSelect: (filePath: string) => void;
  onFolderSelect: (path: string) => void;
  hasParentFolder: boolean;
  onParentFolderClick: () => void;
  folderPanelWidth: number;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  folderPath,
  folderStructure,
  selectedFilePath,
  onFileSelect,
  onFolderSelect,
  hasParentFolder,
  onParentFolderClick,
  folderPanelWidth
}) => {
  // 폴더 경로 클릭 핸들러
  const handleFolderPathClick = () => {
    // 빈 문자열을 전달하여 폴더 선택 다이얼로그 열기
    onFolderSelect('');
  };

  return (
    <div className="folder-panel" style={{ width: `${folderPanelWidth}px` }}>
      <div className="folder-header">
        <div className="folder-title">작업 영역</div>
      </div>
      <div className="folder-path-container" onClick={handleFolderPathClick}>
        <div className="folder-path-text">{folderPath || '폴더지정하기'}</div>
      </div>
      <div className="folder-content">
        {hasParentFolder && (
          <div className="folder-item parent-folder" onDoubleClick={onParentFolderClick}>
            <div className="folder-icon parent-icon"></div>
            <div className="folder-name">..</div>
          </div>
        )}
        {folderStructure.map((item, index) => (
          <FolderItem
            key={index}
            item={item}
            level={0}
            selectedFilePath={selectedFilePath}
            onFileSelect={onFileSelect}
            onFolderSelect={onFolderSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default FileExplorer; 