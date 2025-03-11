import React, { useState, useEffect, useRef } from 'react';
import { formatDrivePath } from '../../utils/fileUtils';
import FolderItem from './FolderItem';
import ContextMenu from './ContextMenu';

interface FileExplorerProps {
  folderPath: string;
  folderStructure: any[];
  selectedFilePath: string | null;
  onFileSelect: (filePath: string) => void;
  onFileClick?: (filePath: string) => void;
  onFolderSelect: (folderPath: string) => void;
  onFolderClick?: (folderPath: string) => void;
  onParentFolderClick: () => void;
  onBrowseFolder: () => void;
  hasParentFolder: boolean;
  folderPanelWidth: number;
  onCut?: (path: string) => void;
  onCopy?: (path: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  onPaste?: (targetFolderPath: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  folderPath,
  folderStructure,
  selectedFilePath,
  onFileSelect,
  onFileClick,
  onFolderSelect,
  onFolderClick,
  onParentFolderClick,
  onBrowseFolder,
  hasParentFolder,
  folderPanelWidth,
  onCut,
  onCopy,
  onRename,
  onDelete,
  onPaste
}) => {
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const fileExplorerRef = useRef<HTMLDivElement>(null);
  const folderContentRef = useRef<HTMLDivElement>(null);
  
  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0
  });

  // 폴더 구조가 변경될 때마다 로그 출력
  useEffect(() => {
    console.log('FileExplorer: 폴더 구조 업데이트됨', folderStructure);
  }, [folderStructure]);

  // 폴더 경로 클릭 핸들러
  const handleFolderPathClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (folderPath) {
      // 현재 폴더 경로를 클립보드에 복사
      navigator.clipboard.writeText(folderPath);
    } else {
      // 폴더 경로가 없으면 폴더 지정 대화상자 열기
      onBrowseFolder();
    }
  };

  // 키보드 단축키 핸들러
  const handleKeyDown = (e: KeyboardEvent) => {
    // 파일 탐색기가 포커스 상태인지 확인
    if (!fileExplorerRef.current?.contains(document.activeElement)) return;

    // Ctrl+C: 복사
    if (e.ctrlKey && e.key === 'c' && onCopy && selectedFilePath) {
      e.preventDefault();
      onCopy(selectedFilePath);
    }
    
    // Ctrl+X: 잘라내기
    if (e.ctrlKey && e.key === 'x' && onCut && selectedFilePath) {
      e.preventDefault();
      onCut(selectedFilePath);
    }
    
    // Ctrl+V: 붙여넣기
    if (e.ctrlKey && e.key === 'v' && onPaste) {
      e.preventDefault();
      // 현재 열려있는 폴더에 붙여넣기
      onPaste(folderPath);
    }
    
    // Delete: 삭제
    if (e.key === 'Delete' && onDelete && selectedFilePath) {
      e.preventDefault();
      onDelete(selectedFilePath);
    }
    
    // F2: 이름 변경
    if (e.key === 'F2' && onRename && selectedFilePath) {
      e.preventDefault();
      onRename(selectedFilePath);
    }
  };

  // 키보드 이벤트 리스너 등록
  useEffect(() => {
    const currentRef = fileExplorerRef.current;
    
    if (currentRef) {
      currentRef.addEventListener('keydown', handleKeyDown);
      // 포커스 가능하도록 설정
      currentRef.setAttribute('tabindex', '0');
      
      // 컴포넌트 마운트 시 자동으로 포커스 설정
      currentRef.focus();
    }
    
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [selectedFilePath, onCopy, onCut, onDelete, onRename, onPaste]);

  // 컨테이너 클릭 시 포커스 설정
  const handleContainerClick = () => {
    if (fileExplorerRef.current) {
      fileExplorerRef.current.focus();
    }
  };
  
  // 빈 영역 우클릭 핸들러
  const handleContentContextMenu = (e: React.MouseEvent) => {
    // 이벤트가 폴더 콘텐츠 영역에서 직접 발생한 경우에만 처리
    // 자식 요소에서 발생한 이벤트는 무시 (이벤트 버블링 방지)
    if (e.currentTarget === e.target) {
      e.preventDefault();
      e.stopPropagation();
      
      // 컨텍스트 메뉴 표시
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY
      });
    }
  };
  
  // 컨텍스트 메뉴 닫기
  const closeContextMenu = () => {
    setContextMenu({
      ...contextMenu,
      visible: false
    });
  };
  
  // 붙여넣기 핸들러
  const handlePaste = () => {
    if (onPaste && folderPath) {
      onPaste(folderPath);
    }
  };

  return (
    <div 
      className="folder-panel" 
      style={{ width: `${folderPanelWidth}px` }}
      ref={fileExplorerRef}
      onClick={handleContainerClick}
    >
      <div className="folder-header">
        <div className="folder-title">작업 영역</div>
      </div>
      <div className="folder-path-container" onClick={onBrowseFolder} title="폴더 지정하기">
        <div className="folder-icon-small"></div>
        <div className="folder-path-text">{folderPath || '폴더 지정하기'}</div>
      </div>
      <div 
        className="folder-content" 
        ref={folderContentRef}
        onContextMenu={handleContentContextMenu}
      >
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
            onFileClick={onFileClick}
            onFolderSelect={onFolderSelect}
            onFolderClick={onFolderClick}
            onCut={onCut}
            onCopy={onCopy}
            onRename={onRename}
            onDelete={onDelete}
            onPaste={onPaste}
          />
        ))}
      </div>
      
      {/* 빈 영역 컨텍스트 메뉴 */}
      {contextMenu.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isVisible={contextMenu.visible}
          onClose={closeContextMenu}
          onCut={() => {}}
          onCopy={() => {}}
          onPaste={handlePaste}
          onRename={() => {}}
          onDelete={() => {}}
          isFolder={true}
          emptyAreaMenu={true}
        />
      )}
    </div>
  );
};

export default FileExplorer; 