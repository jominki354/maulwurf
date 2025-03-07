import { useState, useCallback, useRef } from 'react';

export const useLayout = () => {
  // 패널 표시 상태
  const [showFolderPanel, setShowFolderPanel] = useState<boolean>(true);
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(true);
  const [showBottomPanel, setShowBottomPanel] = useState<boolean>(true);
  
  // 패널 크기
  const [folderPanelWidth, setFolderPanelWidth] = useState(250);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  
  // 드래그 상태
  const [isDraggingFolderPanel, setIsDraggingFolderPanel] = useState(false);
  const [isDraggingBottomPanel, setIsDraggingBottomPanel] = useState(false);
  
  // 디버그 콘솔 상태
  const [isDebugConsoleDetached, setIsDebugConsoleDetached] = useState(false);
  const [debugConsoleHeight, setDebugConsoleHeight] = useState(200);
  const [isDraggingConsole, setIsDraggingConsole] = useState(false);
  const [consolePosition, setConsolePosition] = useState({ x: 0, y: 0 });
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });
  
  // 패널 토글 함수
  const toggleFolderPanel = useCallback(() => {
    setShowFolderPanel(prev => !prev);
  }, []);
  
  const toggleHistoryPanel = useCallback(() => {
    setShowHistoryPanel(prev => !prev);
  }, []);

  const toggleBottomPanel = useCallback(() => {
    setShowBottomPanel(prev => !prev);
  }, []);
  
  // 폴더 패널 크기 조절 시작
  const startFolderPanelResize = useCallback((e: React.MouseEvent) => {
    setIsDraggingFolderPanel(true);
    e.preventDefault();
  }, []);
  
  // 하단 패널 크기 조절 시작
  const startBottomPanelResize = useCallback((e: React.MouseEvent) => {
    setIsDraggingBottomPanel(true);
    e.preventDefault();
  }, []);
  
  // 디버그 콘솔 분리
  const detachDebugConsole = useCallback(() => {
    setIsDebugConsoleDetached(true);
    setConsolePosition({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
  }, []);
  
  // 디버그 콘솔 다시 붙이기
  const attachDebugConsole = useCallback(() => {
    setIsDebugConsoleDetached(false);
  }, []);
  
  // 디버그 콘솔 드래그 시작
  const startDraggingConsole = useCallback((e: React.MouseEvent) => {
    setIsDraggingConsole(true);
    setDragStartPosition({
      x: e.clientX - consolePosition.x,
      y: e.clientY - consolePosition.y
    });
    e.preventDefault();
  }, [consolePosition]);
  
  // 디버그 콘솔 드래그 중
  const handleConsoleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingConsole) return;
    
    setConsolePosition({
      x: e.clientX - dragStartPosition.x,
      y: e.clientY - dragStartPosition.y
    });
    e.preventDefault();
  }, [isDraggingConsole, dragStartPosition]);
  
  // 디버그 콘솔 드래그 종료
  const stopDraggingConsole = useCallback(() => {
    setIsDraggingConsole(false);
  }, []);
  
  // 디버그 콘솔 크기 조절
  const resizeDebugConsole = useCallback((newHeight: number) => {
    setDebugConsoleHeight(Math.max(100, newHeight));
  }, []);
  
  return {
    showFolderPanel,
    showHistoryPanel,
    showBottomPanel,
    folderPanelWidth,
    bottomPanelHeight,
    isDraggingFolderPanel,
    isDraggingBottomPanel,
    isDebugConsoleDetached,
    debugConsoleHeight,
    isDraggingConsole,
    consolePosition,
    toggleFolderPanel,
    toggleHistoryPanel,
    toggleBottomPanel,
    startFolderPanelResize,
    startBottomPanelResize,
    detachDebugConsole,
    attachDebugConsole,
    startDraggingConsole,
    handleConsoleMouseMove,
    stopDraggingConsole,
    resizeDebugConsole,
    setFolderPanelWidth,
    setBottomPanelHeight,
    setIsDraggingFolderPanel,
    setIsDraggingBottomPanel
  };
}; 