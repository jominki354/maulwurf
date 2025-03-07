import React from 'react';
import { formatDrivePath } from '../../utils/fileUtils';
import FolderItem from './FolderItem';

interface FileExplorerProps {
  folderPath: string;
  folderStructure: any[];
  selectedFilePath: string | null;
  onFileSelect: (filePath: string) => void;
  onFolderSelect: (folderPath: string) => void;
  onParentFolderClick: () => void;
  hasParentFolder: boolean;
  folderPanelWidth: number;
  onCut?: (path: string) => void;
  onCopy?: (path: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  folderPath,
  folderStructure,
  selectedFilePath,
  onFileSelect,
  onFolderSelect,
  onParentFolderClick,
  hasParentFolder,
  folderPanelWidth,
  onCut,
  onCopy,
  onRename,
  onDelete
}) => {
  const handleFolderPathClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 현재 폴더 경로를 클립보드에 복사
    navigator.clipboard.writeText(folderPath);
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
            onCut={onCut}
            onCopy={onCopy}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
};

export default FileExplorer; 