import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  isVisible: boolean;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste?: () => void;
  onRename: () => void;
  onDelete: () => void;
  isFolder: boolean;
  emptyAreaMenu?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isVisible,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onRename,
  onDelete,
  isFolder,
  emptyAreaMenu
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // ESC 키 누를 때 메뉴 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  // 화면 경계를 벗어나지 않도록 위치 조정
  const adjustedPosition = {
    x: Math.min(x, window.innerWidth - 150),
    y: Math.min(y, window.innerHeight - 200)
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`
      }}
    >
      <ul>
        {!emptyAreaMenu && (
          <>
            <li onClick={() => { onCut(); onClose(); }}>
              <span className="context-menu-icon">✂️</span> 잘라내기
            </li>
            <li onClick={() => { onCopy(); onClose(); }}>
              <span className="context-menu-icon">📋</span> 복사
            </li>
          </>
        )}
        {onPaste && (
          <li onClick={() => { onPaste(); onClose(); }}>
            <span className="context-menu-icon">📌</span> 붙여넣기
          </li>
        )}
        {!emptyAreaMenu && (
          <>
            <li onClick={() => { onRename(); onClose(); }}>
              <span className="context-menu-icon">✏️</span> 이름 변경
            </li>
            <li onClick={() => { onDelete(); onClose(); }} className="danger">
              <span className="context-menu-icon">🗑️</span> 삭제
            </li>
          </>
        )}
      </ul>
    </div>
  );
};

export default ContextMenu; 