import React, { useState, useEffect, useRef, useContext } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { useApp } from '../../hooks/useApp';
import CodeEditor from '../editor/CodeEditor';
import TabBar from '../tabs/TabBar';
import FileExplorer from '../fileExplorer/FileExplorer';
import Timeline from '../timeline/Timeline';
import './MainLayout.css';
import './FontSizeSelect.css';

const MainLayout: React.FC = () => {
  const { 
    editor, 
    tabs, 
    fileSystem, 
    timeline, 
    layout,
    logging,
    toast
  } = useApp();

  // 메뉴 상태
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [infoTooltipVisible, setInfoTooltipVisible] = useState<boolean>(false);
  const [findReplaceVisible, setFindReplaceVisible] = useState<boolean>(false);
  const [debugConsoleVisible, setDebugConsoleVisible] = useState<boolean>(false);
  const infoButtonRef = useRef<HTMLDivElement>(null);
  // 메뉴 닫기 타이머 참조 추가
  const menuCloseTimerRef = useRef<number | null>(null);

  // 상태 추가
  const [activeBottomTab, setActiveBottomTab] = useState<string>('timeline');
  const [isFirstFileOpen, setIsFirstFileOpen] = useState<boolean>(true);
  const [debugConsoleSearch, setDebugConsoleSearch] = useState<string>('');
  const [debugConsoleFilter, setDebugConsoleFilter] = useState<string>('all');
  const [debugConsoleAutoScroll, setDebugConsoleAutoScroll] = useState<boolean>(true);
  const [bottomPanelVisible, setBottomPanelVisible] = useState<boolean>(true);
  const [folderPanelWidth, setFolderPanelWidth] = useState<number>(200);
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(300);

  // 클립보드 상태 관리
  const [clipboard, setClipboard] = useState<{
    action: 'cut' | 'copy' | null;
    path: string | null;
  }>({
    action: null,
    path: null
  });

  // 폴더 선택 핸들러 (폴더를 열지 않고 선택만 함)
  const handleFolderClick = (folderPath: string) => {
    // 폴더 선택만 하고 열지는 않음
    fileSystem.setSelectedFilePath(folderPath);
    console.log('폴더 선택됨 (열지 않음):', folderPath);
  };

  // 파일 선택 핸들러 (파일을 열지 않고 선택만 함)
  const handleFileClick = (filePath: string) => {
    // 파일 선택만 하고 열지는 않음
    fileSystem.setSelectedFilePath(filePath);
    console.log('파일 선택됨 (열지 않음):', filePath);
  };

  // 파일 선택 핸들러 (파일을 열음)
  const handleFileSelect = async (filePath: string) => {
    try {
      // 파일 내용 읽기
      const content = await fileSystem.openFile(filePath);
      const fileName = filePath.split(/[/\\]/).pop() || '새 파일';

      // 이미 열려있는 탭인지 확인
      const existingTab = tabs.tabs.find(tab => tab.path === filePath);
      if (existingTab) {
        // 이미 열려있는 탭이면 해당 탭을 활성화만 하고 스냅샷은 생성하지 않음
        tabs.activateTab(existingTab.id);
        return;
      }

      // 새 탭 추가
      const newTab = tabs.addTab({
        id: filePath,
        title: fileName,
        path: filePath,
        content: content
      });
      
      // 처음 열 때만 스냅샷 생성
      timeline.createSnapshot(
        "파일 열기",
        content,
        fileName,
        filePath,
        filePath, // 탭 ID는 filePath
        editor.cursorPosition || undefined,
        timeline.SnapshotType.OPEN, // 파일 열기 스냅샷으로 표시
        ["파일 열기", "초기 상태"],
        editor.scrollPosition || undefined
      );

      // 최초 파일 열기 시에만 새 파일 탭 닫기
      if (isFirstFileOpen) {
        // 새 탭이 추가된 후에 탭 목록을 다시 확인
        setTimeout(() => {
          const updatedTabs = tabs.tabs;
          const initialNewFileTab = updatedTabs.find(tab => 
            tab.id === 'new-file' && 
            tab.path === null && 
            !tab.isModified && 
            tab.content === ''
          );
          
          if (initialNewFileTab && updatedTabs.length > 1) {
            // 가짜 이벤트 객체 생성
            const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
            tabs.closeTab(initialNewFileTab.id, fakeEvent);
          }
          
          // 최초 파일 열기 완료 표시
          setIsFirstFileOpen(false);
        }, 100);
      }
    } catch (error) {
      console.error('파일 열기 오류:', error);
      toast.showToast(`파일을 열 수 없습니다: ${error}`, 'error');
    }
  };

  // 메뉴 토글
  const toggleMenu = (menuName: string) => {
    setActiveMenu(prev => prev === menuName ? null : menuName);
  };

  // 메뉴 마우스 오버 핸들러
  const handleMenuMouseOver = (menuName: string) => {
    // 이미 활성화된 메뉴가 있을 때만 마우스 오버로 메뉴 변경
    if (activeMenu !== null) {
      setActiveMenu(menuName);
    }
    
    // 마우스가 메뉴 영역으로 들어오면 타이머 취소
    if (menuCloseTimerRef.current !== null) {
      window.clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  };

  // 메뉴 마우스 아웃 핸들러 추가
  const handleMenuMouseOut = () => {
    // 마우스가 메뉴 영역을 벗어나면 지연 시간 후 메뉴 닫기
    if (activeMenu !== null && menuCloseTimerRef.current === null) {
      menuCloseTimerRef.current = window.setTimeout(() => {
        setActiveMenu(null);
        menuCloseTimerRef.current = null;
      }, 1500); // 1500ms 지연 시간 설정
    }
  };

  // 정보 툴팁 토글
  const toggleInfoTooltip = () => {
    setInfoTooltipVisible(prev => !prev);
  };

  // 메뉴 외부 클릭 처리
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // 메뉴 아이템, 메뉴 드롭다운, 서브메뉴, 드롭다운 섹션, 셀렉트 요소를 클릭한 경우에는 메뉴를 닫지 않음
      if (!target.closest('.menu-item') && 
          !target.closest('.menu-dropdown') && 
          !target.closest('.submenu') &&
          !target.closest('.dropdown-section') &&
          !target.closest('select') &&
          target.tagName !== 'OPTION') {
        setActiveMenu(null);
        
        // 클릭 시 타이머 취소
        if (menuCloseTimerRef.current !== null) {
          window.clearTimeout(menuCloseTimerRef.current);
          menuCloseTimerRef.current = null;
        }
      }
      
      if (infoButtonRef.current && !infoButtonRef.current.contains(target) && !target.closest('.info-tooltip')) {
        setInfoTooltipVisible(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      
      // 컴포넌트 언마운트 시 타이머 정리
      if (menuCloseTimerRef.current !== null) {
        window.clearTimeout(menuCloseTimerRef.current);
      }
    };
  }, []);

  // 드래그 앤 드롭 이벤트 처리
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (layout.isDraggingFolderPanel) {
        const minWidth = 200; // 최소 너비
        const maxWidth = window.innerWidth * 0.5; // 최대 너비 (화면의 50%)
        
        // 새 너비 계산
        let newWidth = e.clientX;
        
        // 최소/최대 너비 제한
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        
        layout.setFolderPanelWidth(newWidth);
      }
      
      if (layout.isDraggingBottomPanel) {
        const minHeight = 100;
        const maxHeight = window.innerHeight * 0.7;
        
        const newHeight = window.innerHeight - e.clientY;
        
        if (newHeight >= minHeight && newHeight <= maxHeight) {
        layout.setBottomPanelHeight(newHeight);
        }
      }
    };
    
    const handleGlobalMouseUp = () => {
      if (layout.isDraggingFolderPanel) {
        layout.setIsDraggingFolderPanel(false);
        
        // 커서 스타일 원래대로
        document.body.style.cursor = '';
        
        // 선택 방지 해제
        document.body.style.userSelect = '';
      }
      
      if (layout.isDraggingBottomPanel) {
        layout.setIsDraggingBottomPanel(false);
        
        // 커서 스타일 원래대로
        document.body.style.cursor = '';
        
        // 선택 방지 해제
        document.body.style.userSelect = '';
      }
    };
    
    if (layout.isDraggingFolderPanel || layout.isDraggingBottomPanel) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [layout]);

  // 새 파일 생성
  const handleNewFile = () => {
    editor.setFileName('새 파일');
    editor.setFilePath(null);
    fileSystem.setSelectedFilePath(null);
    
    // 새 탭 추가 (addTab 함수 내에서 탭 활성화 및 내용 설정이 이루어짐)
    const newTabId = `new-file-${Date.now()}`;
    tabs.addTab({
      id: newTabId,
      title: '새 파일',
      path: null,
      content: ''
    });
    
    // 최초 파일 열기 상태 업데이트 (새 파일을 생성했으므로 더 이상 최초 파일 열기가 아님)
    setIsFirstFileOpen(false);
    
    // 히스토리에 추가
    logging.addToHistory('새 파일 생성');
  };

  // 파일 저장
  const handleSaveFile = async () => {
    try {
      // 현재 활성 탭 찾기
      const activeTab = tabs.tabs.find(tab => tab.id === tabs.activeTabId);
      if (!activeTab) return;
      
      // 파일 경로가 없는 경우에만 다른 이름으로 저장 다이얼로그 표시
      if (!activeTab.path) {
        // 파일 경로가 없으면 다른 이름으로 저장
        await handleSaveAsFile();
        return;
      }
      
      // 파일 저장
      await fileSystem.saveFile(activeTab.path, tabs.activeTabContent);
      
      // 탭 상태 업데이트 (수정되지 않음으로 표시)
      if (tabs.activeTabId) {
        tabs.markContentSaved(tabs.activeTabId);
      }
      
      // 저장 스냅샷 생성
      timeline.createSnapshot(
        `파일 저장: ${activeTab.title || '새 파일'}`,
        tabs.activeTabContent,
        activeTab.title || '새 파일',
        activeTab.path,
        tabs.activeTabId || '',
        editor.cursorPosition || undefined,
        timeline.SnapshotType.SAVE,
        [],
        editor.scrollPosition || undefined,
        editor.getSelectionsFromEditor()
      );
      
      // 히스토리에 추가
      logging.addToHistory(`파일 저장: ${activeTab.path}`);
      
      // 토스트 메시지 표시
      toast.showToast('파일이 저장되었습니다.', 'success');
      
      // 저장 완료 이벤트 발생
      const saveCompleteEvent = new CustomEvent('save-complete', {
        detail: { tabId: tabs.activeTabId }
      });
      window.dispatchEvent(saveCompleteEvent);
    } catch (error) {
      console.error('파일 저장 오류:', error);
      toast.showToast(`파일을 저장할 수 없습니다: ${error}`, 'error');
    }
  };

  // 다른 이름으로 저장
  const handleSaveAsFile = async () => {
    try {
      // 현재 활성 탭 찾기
      const activeTab = tabs.tabs.find(tab => tab.id === tabs.activeTabId);
      if (!activeTab) return;
      
      // 파일 저장 다이얼로그 열기
      const filePath = await fileSystem.showSaveDialog();
      
      if (!filePath) {
        // 사용자가 취소함
        return;
      }
      
      // 파일 저장
      await fileSystem.saveFile(filePath, tabs.activeTabContent);
      
      // 파일 이름 추출
      const fileName = filePath.split(/[/\\]/).pop() || '새 파일';
      
      // 상태 업데이트
      editor.setFileName(fileName);
      editor.setFilePath(filePath);
      
      // 선택된 파일 경로 업데이트
      fileSystem.setSelectedFilePath(filePath);
      
      // 탭 ID 업데이트 (새 경로로)
      const oldTabId = tabs.activeTabId || '';
      
      // 새 탭 추가 (기존 탭의 내용으로)
      tabs.addTab({
        id: filePath,
        title: fileName,
        path: filePath,
        content: tabs.activeTabContent
      });
      
      // 이전 탭 닫기
      const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
      tabs.closeTab(oldTabId, fakeEvent);
      
      // 탭 상태 업데이트 (수정되지 않음으로 표시)
      tabs.markContentSaved(filePath);
      
      // 저장 스냅샷 생성
      timeline.createSnapshot(
        `다른 이름으로 저장: ${fileName}`,
        tabs.activeTabContent,
        fileName,
        filePath,
        filePath, // 새 탭 ID는 filePath
        editor.cursorPosition || undefined,
        timeline.SnapshotType.SAVE,
        [],
        editor.scrollPosition || undefined,
        editor.getSelectionsFromEditor()
      );
      
      // 히스토리에 추가
      logging.addToHistory(`다른 이름으로 저장: ${filePath}`);
      
      // 토스트 메시지 표시
      toast.showToast('파일이 저장되었습니다.', 'success');
      
      // 저장 완료 이벤트 발생
      const saveCompleteEvent = new CustomEvent('save-complete', {
        detail: { tabId: filePath } // 새 탭 ID는 filePath
      });
      window.dispatchEvent(saveCompleteEvent);
    } catch (error) {
      console.error('파일 저장 오류:', error);
      toast.showToast(`파일을 저장할 수 없습니다: ${error}`, 'error');
    }
  };

  // 폴더 선택
  const handleFolderSelect = async (folderPath: string) => {
    try {
      if (!folderPath) {
        // 빈 경로가 전달되면 폴더 선택 다이얼로그 열기
        const selectedPath = await fileSystem.showOpenFolderDialog();
        if (selectedPath) {
          // 선택된 폴더 구조 로드
          await fileSystem.loadFolderStructure(selectedPath);
          // 히스토리에 추가
          logging.addToHistory(`폴더 열기: ${selectedPath}`);
        }
        return;
      }
      
      // 특정 경로가 전달되면 해당 폴더 구조 로드
      await fileSystem.loadFolderStructure(folderPath);
    } catch (error) {
      console.error('폴더 선택 오류:', error);
      toast.showToast(`폴더를 선택할 수 없습니다: ${error}`, 'error');
    }
  };

  // 파일 열기
  const handleOpenFile = async () => {
    try {
      // 파일 선택 다이얼로그 열기
      const filePath = await fileSystem.showOpenDialog();
      
      if (!filePath) {
        // 사용자가 취소함
        return;
      }
      
      // 파일 열기
      await handleFileSelect(filePath);
    } catch (error) {
      console.error('파일 열기 오류:', error);
      toast.showToast(`파일을 열 수 없습니다: ${error}`, 'error');
    }
  };

  // 찾기/바꾸기 토글
  const toggleFindReplace = () => {
    const activeEditor = document.querySelector('.monaco-editor')?.querySelector('.monaco-editor-background')?.parentElement;
    if (activeEditor) {
      const event = new CustomEvent('editor-command', { 
        detail: { 
          command: 'find',
          editor: activeEditor
        } 
      });
      window.dispatchEvent(event);
    }
  };

  // 디버그 콘솔 토글
  const toggleDebugConsole = () => {
    console.log('[디버그 콘솔] 토글 요청됨, 현재 상태:', !debugConsoleVisible);
    
    // 디버그 콘솔 상태 토글
    setDebugConsoleVisible(prev => {
      const newState = !prev;
      console.log('[디버그 콘솔] 상태 변경:', prev, '->', newState);
      
      // 디버그 콘솔 토글 이벤트 발생
      const customEvent = new CustomEvent('debug-console-toggled', {
        detail: {
          visible: newState
        }
      });
      window.dispatchEvent(customEvent);
      console.log('[디버그 콘솔] 토글 이벤트 발생');
      
      return newState;
    });
    
    // 디버그 콘솔 로그 추가
    logging.addLog('디버그 콘솔 토글', 'command');
  };

  // 폴더 패널 리사이저 드래그 시작
  const handleFolderPanelResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    layout.setIsDraggingFolderPanel(true);
    
    // 드래그 중에는 커서 스타일 변경
    document.body.style.cursor = 'col-resize';
    
    // 선택 방지
    document.body.style.userSelect = 'none';
  };

  // 하단 패널 리사이저 드래그 시작
  const handleBottomPanelResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    layout.setIsDraggingBottomPanel(true);
    
    // 드래그 중에는 커서 스타일 변경
    document.body.style.cursor = 'row-resize';
    
    // 선택 방지
    document.body.style.userSelect = 'none';
  };

  // 부모 폴더로 이동
  const handleParentFolderClick = () => {
    if (fileSystem.folderPath) {
      const parentPath = fileSystem.folderPath.split(/[/\\]/).slice(0, -1).join('/');
      if (parentPath) {
        fileSystem.loadFolderStructure(parentPath);
      }
    }
  };

  // 폴더 지정 버튼 클릭 핸들러
  const handleBrowseFolder = async () => {
    try {
      const selectedFolder = await fileSystem.showOpenFolderDialog();
      if (selectedFolder) {
        await fileSystem.loadFolderStructure(selectedFolder);
      }
    } catch (error) {
      console.error('폴더 지정 오류:', error);
      toast.showToast(`폴더를 지정할 수 없습니다: ${error}`, 'error');
    }
  };

  // 스냅샷 복원
  const handleRestoreSnapshot = (index: number) => {
    // 현재 활성 탭의 스냅샷만 필터링
    const filteredSnapshots = timeline.snapshots.filter(snapshot => snapshot.tabId === tabs.activeTabId);
    const snapshot = filteredSnapshots[index];
    
    if (snapshot) {
      // 전체 스냅샷 배열에서의 인덱스 찾기
      const originalIndex = timeline.snapshots.findIndex(s => s.id === snapshot.id);
      
      // 현재 내용 저장 (하이라이트 비교용)
      const currentContent = tabs.activeTabContent;
      
      // 먼저 하이라이트 제거
      editor.clearHighlights();
      
      // 현재 탭에 스냅샷 내용 적용
      tabs.setActiveTabContent(snapshot.content);
      
      // 타임라인 활성 스냅샷 인덱스 업데이트
      timeline.setActiveSnapshotIndex(originalIndex);
      
      // 커서 위치 복원
      if (snapshot.cursorPosition) {
        setTimeout(() => {
          editor.setCursorPositionInEditor(snapshot.cursorPosition);
        }, 50);
      }
      
      // 스크롤 위치 복원
      if (snapshot.scrollPosition) {
        setTimeout(() => {
          editor.setScrollPositionInEditor(snapshot.scrollPosition);
        }, 50);
      }
      
      // 선택 영역 복원
      if (snapshot.selections && snapshot.selections.length > 0) {
        setTimeout(() => {
          editor.setSelectionsInEditor(snapshot.selections);
        }, 50);
      }
      
      // 변경 내용 하이라이트 (약간 지연시켜 에디터가 완전히 업데이트된 후 적용)
      setTimeout(() => {
        try {
          // 현재 내용과 스냅샷 내용이 다른 경우에만 하이라이트 적용
          if (currentContent !== snapshot.content) {
            editor.highlightChanges(currentContent, snapshot.content);
          }
        } catch (error) {
          console.error('하이라이트 적용 오류:', error);
        }
      }, 200);
      
      // 히스토리에 추가
      logging.addToHistory(`스냅샷 복원: ${snapshot.description}`);
      
      // 복원 후 새 스냅샷 생성하지 않음
    }
  };

  // 스냅샷 삭제
  const handleDeleteSnapshot = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // 현재 활성 탭의 스냅샷만 필터링
    const filteredSnapshots = timeline.snapshots.filter(snapshot => snapshot.tabId === tabs.activeTabId);
    const snapshot = filteredSnapshots[index];
    
    if (snapshot) {
      // 전체 스냅샷 배열에서의 인덱스 찾기
      const originalIndex = timeline.snapshots.findIndex(s => s.id === snapshot.id);
      
      // 확인 없이 바로 삭제
      console.log('[스냅샷] 삭제:', snapshot.description);
      timeline.deleteSnapshot(originalIndex);
      logging.addToHistory(`스냅샷 삭제: ${snapshot.description}`);
      
      // 삭제 성공 토스트 메시지
      toast.showToast(`"${snapshot.description}" 스냅샷이 삭제되었습니다.`, 'success');
    }
  };

  // 모든 스냅샷 삭제
  const handleClearAllSnapshots = () => {
    // 확인 없이 바로 삭제
    console.log('[스냅샷] 모든 스냅샷 삭제');
    timeline.clearAllSnapshots();
    
    // 삭제 성공 토스트 메시지
    toast.showToast('모든 스냅샷이 삭제되었습니다.', 'success');
  };
  
  // 오래된 스냅샷 정리
  const handleCleanupSnapshots = () => {
    // 확인 없이 바로 정리
    console.log('[스냅샷] 오래된 스냅샷 정리');
    timeline.cleanupSnapshots();
    
    // 정리 성공 토스트 메시지
    toast.showToast('오래된 스냅샷이 정리되었습니다.', 'success');
  };

  // 하단 패널 탭 전환
  const handleBottomTabChange = (tabName: string) => {
    setActiveBottomTab(tabName);
  };

  // 새 탭 버튼 클릭 핸들러
  const handleNewTabClick = () => {
    handleNewFile();
  };

  // 주기적인 자동 저장 스냅샷 생성 (5분마다)
  useEffect(() => {
    const autoSaveInterval = 5 * 60 * 1000; // 5분
    
    const createAutoSaveSnapshot = () => {
      // 현재 활성 탭 찾기
      const activeTab = tabs.tabs.find(tab => tab.id === tabs.activeTabId);
      if (!activeTab) return;
      
      // 수정된 내용이 있는 경우에만 스냅샷 생성
      if (activeTab.isModified) {
        timeline.createSnapshot(
          `${activeTab.title || '새 파일'} 자동 저장`,
          tabs.activeTabContent,
          activeTab.title || '새 파일',
          activeTab.path || '',
          tabs.activeTabId || '',
          editor.cursorPosition || undefined,
          timeline.SnapshotType.AUTO,
          ['자동 저장', '주기적'],
          editor.scrollPosition || undefined,
          editor.getSelectionsFromEditor()
        );
        
        console.log('자동 저장 스냅샷이 생성되었습니다.');
      }
    };
    
    const intervalId = setInterval(createAutoSaveSnapshot, autoSaveInterval);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [tabs, timeline, editor]);

  // 앱 종료 이벤트 처리
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupAppExit = async () => {
      // 이전 이벤트 리스너 제거
      if (unlistenFn) {
        unlistenFn();
      }

      unlistenFn = await appWindow.onCloseRequested(async (event) => {
        // 수정된 파일이 있는지 확인
        const modifiedTabs = tabs.tabs.filter(tab => tab.isModified);
        
        if (modifiedTabs.length > 0) {
          event.preventDefault(); // 앱 종료 방지
          
          // 각 수정된 파일에 대해 저장 여부 확인
          for (const tab of modifiedTabs) {
            const fileName = tab.title || '새 파일';
            // Promise로 확인 대화상자 처리
            const shouldSave = await new Promise<boolean>((resolve) => {
              const result = window.confirm(`"${fileName}" 파일에 저장되지 않은 변경사항이 있습니다.\n저장하시겠습니까?`);
              resolve(result);
            });
            
            if (shouldSave) {
              try {
                if (tab.path) {
                  // 기존 파일 저장
                  await fileSystem.saveFile(tab.path, tab.content);
                  logging.addToHistory(`파일 저장: ${tab.path}`);
                  tabs.markContentSaved(tab.id);
                  
                  // 저장 완료 이벤트 발생
                  const saveCompleteEvent = new CustomEvent('save-complete', {
                    detail: { tabId: tab.id }
                  });
                  window.dispatchEvent(saveCompleteEvent);
                } else {
                  // 새 파일인 경우 다른 이름으로 저장
                  const filePath = await fileSystem.showSaveDialog();
                  if (filePath) {
                    await fileSystem.saveFile(filePath, tab.content);
                    logging.addToHistory(`파일 저장: ${filePath}`);
                    tabs.markContentSaved(tab.id);
                    
                    // 저장 완료 이벤트 발생
                    const saveCompleteEvent = new CustomEvent('save-complete', {
                      detail: { tabId: tab.id }
                    });
                    window.dispatchEvent(saveCompleteEvent);
                  } else {
                    // 저장 대화상자에서 취소를 누른 경우 앱 종료 취소
                    console.log('사용자가 저장 대화상자에서 취소를 선택하여 앱 종료 취소');
                    return;
                  }
                }
              } catch (error) {
                console.error('파일 저장 오류:', error);
                window.alert(`"${fileName}" 파일 저장 중 오류가 발생했습니다: ${error}`);
                return; // 저장 실패 시 앱 종료 취소
              }
            } else {
              // 저장하지 않기로 선택한 경우 - 앱 종료 취소
              console.log(`"${fileName}" 파일의 변경사항을 저장하지 않기로 선택하여 앱 종료 취소`);
              return; // 앱 종료 취소
            }
          }

          // 모든 처리가 완료되면 앱 종료
          appWindow.close();
        }
      });
    };

    setupAppExit();

    // 컴포넌트 언마운트 시 이벤트 리스너 정리
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [tabs, fileSystem, logging]);

  // 에디터 내용 변경 이벤트 처리
  useEffect(() => {
    const handleContentChanged = (event: CustomEvent) => {
      const { tabId, content, fileName, filePath, cursorPosition } = event.detail;
      
      console.log('[이벤트 수신] content-changed 이벤트 수신:', { 
        tabId, 
        fileName,
        filePath,
        contentLength: content?.length || 0,
        cursorPosition,
        activeTabId: tabs.activeTabId,
        editorState: {
          cursorPosition: editor.cursorPosition,
          hasFocus: document.activeElement?.className?.includes('monaco') || false
        }
      });
      
      // 타이핑할 때마다 스냅샷을 생성하지 않음
      // 스냅샷은 저장, 열기, 의도치 않은 종료 시에만 생성됨
      
      // 탭 내용 업데이트
      if (tabId && content) {
        console.log('[탭 업데이트] 탭 내용 업데이트 시작:', tabId);
        
        // 업데이트 전 상태 기록
        const beforeUpdate = {
          activeTabId: tabs.activeTabId,
          activeTabContent: tabs.activeTabContent?.length || 0,
          cursorPosition: editor.cursorPosition
        };
        
        // 탭 내용 업데이트
        tabs.updateTabContent(tabId, content);
        
        // 커서 위치 유지 (이벤트에서 전달된 커서 위치가 있는 경우)
        if (cursorPosition && editor.setCursorPositionInEditor) {
          console.log('[커서 위치] 커서 위치 복원 시도:', cursorPosition);
          setTimeout(() => {
            editor.setCursorPositionInEditor(cursorPosition);
          }, 0);
        }
        
        // 업데이트 후 상태 기록
        setTimeout(() => {
          console.log('[탭 업데이트] 탭 내용 업데이트 완료:', {
            beforeUpdate,
            afterUpdate: {
              activeTabId: tabs.activeTabId,
              activeTabContent: tabs.activeTabContent?.length || 0,
              cursorPosition: editor.cursorPosition
            }
          });
        }, 0);
      }
    };
    
    // 이벤트 리스너 등록
    console.log('[이벤트 등록] content-changed 이벤트 리스너 등록');
    window.addEventListener('content-changed', handleContentChanged as EventListener);
    
    return () => {
      console.log('[이벤트 제거] content-changed 이벤트 리스너 제거');
      window.removeEventListener('content-changed', handleContentChanged as EventListener);
    };
  }, [tabs, timeline, editor]);

  // 에디터 커맨드 이벤트 처리
  useEffect(() => {
    const handleEditorCommand = (event: CustomEvent) => {
      const { command } = event.detail;
      
      console.log('Editor command received:', command);
      
      // 디버그 콘솔에 커맨드 로그 추가
      logging.addLog(`커맨드 실행: ${command}`, 'command');
      
      // 명령어에 따라 적절한 핸들러 호출
      switch (command) {
        case 'save':
          handleSaveFile();
          break;
        case 'open':
          handleOpenFile();
          break;
        case 'new':
          handleNewFile();
          break;
        case 'find':
          toggleFindReplace();
          break;
        case 'debug':
          toggleDebugConsole();
          break;
      }
    };
    
    // 이벤트 리스너 등록
    window.addEventListener('editor-command', handleEditorCommand as EventListener);
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      window.removeEventListener('editor-command', handleEditorCommand as EventListener);
    };
  }, [handleSaveFile, handleOpenFile, handleNewFile, toggleFindReplace, toggleDebugConsole, logging]);

  // 수동 스냅샷 생성
  const handleCreateManualSnapshot = () => {
    // 현재 활성 탭 찾기
    const activeTab = tabs.tabs.find(tab => tab.id === tabs.activeTabId);
    if (!activeTab) {
      console.log('[스냅샷] 활성 탭이 없어 수동 스냅샷을 생성할 수 없음');
      return;
    }
    
    console.log('[스냅샷] 수동 스냅샷 생성 시도:', activeTab.title || '새 파일');
    
    const snapshot = timeline.createSnapshot(
      `${activeTab.title || '새 파일'} 수동 스냅샷`,
      tabs.activeTabContent,
      activeTab.title || '새 파일',
      activeTab.path || '',
      tabs.activeTabId || '',
      editor.cursorPosition || undefined,
      timeline.SnapshotType.MANUAL,
      [],
      editor.scrollPosition || undefined,
      editor.getSelectionsFromEditor?.() || []
    );
    
    if (snapshot) {
      // 히스토리에 추가
      logging.addToHistory(`수동 스냅샷 생성: ${activeTab.title || '새 파일'}`);
      
      // 토스트 메시지 표시
      toast.showToast('수동 스냅샷이 생성되었습니다.', 'success');
      
      console.log('[스냅샷] 수동 스냅샷 생성 완료:', snapshot.id);
    } else {
      console.log('[스냅샷] 수동 스냅샷 생성 실패');
    }
  };
  
  // 스냅샷 내보내기
  const handleExportSnapshot = async (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // 현재 활성 탭의 스냅샷만 필터링
    const filteredSnapshots = timeline.snapshots.filter(snapshot => snapshot.tabId === tabs.activeTabId);
    const snapshot = filteredSnapshots[index];
    
    if (snapshot) {
      try {
        console.log('[스냅샷] 내보내기 시도:', snapshot.description);
        
        // 파일 저장 다이얼로그 열기
        const filePath = await fileSystem.showSaveDialog();
        
        if (!filePath) {
          // 사용자가 취소함
          console.log('[스냅샷] 내보내기 취소됨');
          return;
        }
        
        // 파일 저장
        await fileSystem.saveFile(filePath, snapshot.content);
        
        // 히스토리에 추가
        logging.addToHistory(`스냅샷 내보내기: ${snapshot.description} -> ${filePath}`);
        
        // 토스트 메시지 표시
        toast.showToast(`스냅샷이 ${filePath}에 저장되었습니다.`, 'success');
        
        console.log('[스냅샷] 내보내기 완료:', filePath);
      } catch (error) {
        console.error('[스냅샷] 내보내기 오류:', error);
        toast.showToast(`스냅샷을 내보낼 수 없습니다: ${error}`, 'error');
      }
    }
  };

  // 키보드 단축키 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 요소에 포커스가 있는 경우 단축키 무시
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement && (document.activeElement as HTMLElement).isContentEditable)
      ) {
        return;
      }
      
      // Ctrl+` 또는 F12: 디버그 콘솔 토글
      if ((e.ctrlKey && e.key === '`') || e.key === 'F12') {
        console.log('[키보드 단축키] 디버그 콘솔 토글 단축키 감지:', e.key);
        e.preventDefault();
        toggleDebugConsole();
        return;
      }
      
      // Ctrl+W: 현재 탭 닫기
      if (e.ctrlKey && e.key === 'w') {
        console.log('[키보드 단축키] 탭 닫기 단축키 감지: Ctrl+W');
        e.preventDefault();
        
        // 현재 활성 탭이 있으면 닫기
        if (tabs.activeTabId) {
          console.log('[탭 닫기] 활성 탭 닫기 시도:', tabs.activeTabId);
          // 이벤트 객체 없이 직접 closeTab 호출
          tabs.closeTab(tabs.activeTabId);
        } else {
          console.log('[탭 닫기] 활성 탭 없음');
        }
        return;
      }
      
      // Ctrl 키가 눌려있는지 확인
      const isCtrl = e.ctrlKey || e.metaKey;
      
      // 단축키 처리
      if (isCtrl) {
        switch (e.key.toLowerCase()) {
          case 'n': // 새 파일 (Ctrl+N)
            e.preventDefault();
            handleNewFile();
            break;
          case 'o': // 파일 열기 (Ctrl+O)
            e.preventDefault();
            handleOpenFile();
            break;
          case 's': // 저장 (Ctrl+S)
            e.preventDefault();
            handleSaveFile();
            break;
          case 'f': // 찾기/바꾸기 (Ctrl+F)
            e.preventDefault();
            toggleFindReplace();
            break;
          case 'b': // 파일 탐색기 토글 (Ctrl+B)
            e.preventDefault();
            layout.toggleFolderPanel();
            break;
          case 'j': // 타임라인/히스토리 토글 (Ctrl+J)
            e.preventDefault();
            layout.toggleBottomPanel();
            break;
          case 'z': // 실행 취소 (Ctrl+Z)
            e.preventDefault();
            editor.undo();
            break;
          case 'y': // 다시 실행 (Ctrl+Y)
            e.preventDefault();
            editor.redo();
            break;
          case 'k': // 폴더 열기 (Ctrl+K)
            e.preventDefault();
            handleFolderSelect('');
            break;
        }
      }
      
      // Ctrl+Shift 조합 단축키
      if (isCtrl && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 's': // 다른 이름으로 저장 (Ctrl+Shift+S)
            e.preventDefault();
            handleSaveAsFile();
            break;
        }
      }
      
      // 기타 단축키
      switch (e.key) {
        case 'F5': // 수동 스냅샷 생성 (F5)
          e.preventDefault();
          handleCreateManualSnapshot();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    editor, 
    layout, 
    handleNewFile, 
    handleOpenFile, 
    handleSaveFile, 
    handleSaveAsFile, 
    toggleFindReplace, 
    toggleDebugConsole, 
    handleFolderSelect,
    handleCreateManualSnapshot,
    handleExportSnapshot,
    tabs
  ]);

  // 토스트 메시지 이벤트 리스너
  useEffect(() => {
    // 토스트 메시지 이벤트 핸들러
    const handleShowToast = (event: CustomEvent) => {
      const { type, message, unique } = event.detail;
      
      // 토스트 표시
      toast.showToast(
        message, 
        (type as 'success' | 'error' | 'warning' | 'info') || 'info',
        'active-toast'
      );
    };
    
    // 이벤트 리스너 등록
    window.addEventListener('showToast', handleShowToast as EventListener);
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      window.removeEventListener('showToast', handleShowToast as EventListener);
    };
  }, [toast]);

  // 파일 잘라내기
  const handleCutFile = (path: string) => {
    setClipboard({
      action: 'cut',
      path
    });
    toast.showToast('파일이 잘라내기 되었습니다. 원하는 위치에서 붙여넣기 하세요.', 'info');
    logging.addToHistory(`파일 잘라내기: ${path}`);
  };

  // 파일 복사
  const handleCopyFile = (path: string) => {
    setClipboard({
      action: 'copy',
      path
    });
    toast.showToast('파일이 복사되었습니다. 원하는 위치에서 붙여넣기 하세요.', 'info');
    logging.addToHistory(`파일 복사: ${path}`);
  };

  // 파일 이름 변경
  const handleRenameFile = async (path: string) => {
    const fileName = path.split(/[/\\]/).pop() || '';
    const newName = window.prompt('새 이름을 입력하세요:', fileName);
    
    if (newName && newName !== fileName) {
      try {
        const dirPath = path.substring(0, path.length - fileName.length);
        const newPath = dirPath + newName;
        
        const success = await fileSystem.renameFileOrFolder(path, newPath);
        
        if (success) {
          toast.showToast('파일 이름이 변경되었습니다.', 'success');
          logging.addToHistory(`파일 이름 변경: ${path} → ${newPath}`);
          
          // 현재 열려있는 파일이면 탭 업데이트
          if (path === fileSystem.selectedFilePath) {
            // 현재 열려있는 탭 업데이트
            const updatedTabs = tabs.tabs.map(tab => {
              if (tab.path === path) {
                return { ...tab, path: newPath, name: newName };
              }
              return tab;
            });
            
            // 탭 업데이트 및 활성화
            const tabToActivate = updatedTabs.find(tab => tab.path === newPath);
            if (tabToActivate) {
              tabs.activateTab(tabToActivate.id);
            }
            tabs.setTabs(updatedTabs);
            fileSystem.setSelectedFilePath(newPath);
          }
          
          // 폴더 구조 새로고침 (현재 폴더 경로 사용)
          await fileSystem.loadFolderStructure();
          console.log('파일 이름 변경 후 폴더 구조 새로고침 완료');
        }
      } catch (error) {
        console.error('파일 이름 변경 오류:', error);
        toast.showToast('파일 이름 변경 중 오류가 발생했습니다.', 'error');
      }
    }
  };

  // 파일 삭제
  const handleDeleteFile = async (path: string) => {
    const fileName = path.split(/[/\\]/).pop() || '';
    
    // 삭제 확인 대화상자
    const confirmDelete = window.confirm(`정말로 "${fileName}"을(를) 삭제하시겠습니까?`);
    
    // 사용자가 취소를 선택한 경우 함수 종료
    if (!confirmDelete) {
      return;
    }
    
    try {
      const success = await fileSystem.deleteFile(path);
      
      if (success) {
        toast.showToast('파일이 삭제되었습니다.', 'success');
        logging.addToHistory(`파일 삭제: ${path}`);
        
        // 현재 열려있는 파일이면 탭 닫기
        if (path === fileSystem.selectedFilePath) {
          // 해당 경로의 탭 찾기
          const tabToClose = tabs.tabs.find(tab => tab.path === path);
          if (tabToClose) {
            // 탭 닫기 처리
            const newTabs = tabs.tabs.filter(tab => tab.path !== path);
            tabs.setTabs(newTabs);
            
            // 다른 탭이 있으면 활성화
            if (newTabs.length > 0) {
              tabs.activateTab(newTabs[0].id);
              fileSystem.setSelectedFilePath(newTabs[0].path);
            } else {
              tabs.activateTab(''); // 빈 문자열 또는 유효하지 않은 ID를 전달하여 활성 탭 없음 상태로 만듦
              fileSystem.setSelectedFilePath(null);
            }
          }
        }
        
        // 폴더 구조 새로고침 (현재 폴더 경로 사용)
        await fileSystem.loadFolderStructure();
        console.log('파일 삭제 후 폴더 구조 새로고침 완료');
      }
    } catch (error) {
      console.error('파일 삭제 오류:', error);
      toast.showToast('파일 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // 파일 붙여넣기
  const handlePasteFile = async (targetFolderPath: string) => {
    // 클립보드에 파일 경로가 없으면 무시
    if (!clipboard.path || !clipboard.action) {
      toast.showToast('붙여넣을 파일이 없습니다.', 'warning');
      return;
    }

    try {
      const fileName = clipboard.path.split(/[/\\]/).pop() || '';
      const newPath = `${targetFolderPath}/${fileName}`;
      
      // 같은 경로에 붙여넣기 시도하면 무시
      if (clipboard.path === newPath) {
        toast.showToast('같은 위치에 붙여넣을 수 없습니다.', 'warning');
        return;
      }
      
      let success = false;
      
      if (clipboard.action === 'copy') {
        // 파일 복사
        success = await fileSystem.copyFileToDestination(clipboard.path, newPath);
        if (success) {
          toast.showToast('파일이 복사되었습니다.', 'success');
          logging.addToHistory(`파일 복사: ${clipboard.path} → ${newPath}`);
        }
      } else if (clipboard.action === 'cut') {
        // 파일 이동 (이름 변경으로 구현)
        success = await fileSystem.renameFileOrFolder(clipboard.path, newPath);
        if (success) {
          toast.showToast('파일이 이동되었습니다.', 'success');
          logging.addToHistory(`파일 이동: ${clipboard.path} → ${newPath}`);
          
          // 현재 열려있는 파일이면 탭 업데이트
          if (clipboard.path === fileSystem.selectedFilePath) {
            // 현재 열려있는 탭 업데이트
            const updatedTabs = tabs.tabs.map(tab => {
              if (tab.path === clipboard.path) {
                return { ...tab, path: newPath, title: fileName };
              }
              return tab;
            });
            
            // 탭 업데이트 및 활성화
            const tabToActivate = updatedTabs.find(tab => tab.path === newPath);
            if (tabToActivate) {
              tabs.activateTab(tabToActivate.id);
            }
            tabs.setTabs(updatedTabs);
            fileSystem.setSelectedFilePath(newPath);
          }
          
          // 잘라내기 후 붙여넣기가 완료되면 클립보드 초기화
          setClipboard({ action: null, path: null });
        }
      }
      
      // 폴더 구조 새로고침
      if (success) {
        await fileSystem.loadFolderStructure();
        console.log('파일 붙여넣기 후 폴더 구조 새로고침 완료');
      }
    } catch (error) {
      console.error('파일 붙여넣기 오류:', error);
      toast.showToast('파일 붙여넣기 중 오류가 발생했습니다.', 'error');
    }
  };

  return (
    <div className="app-container dark">
      {/* 상단 메뉴바 */}
      <div className="menu-bar" style={{ zIndex: 1000 }}>
        <div className="menu-left">
          <div 
            className="menu-item" 
            onClick={() => toggleMenu('file')}
            onMouseOver={() => handleMenuMouseOver('file')}
            onMouseOut={handleMenuMouseOut}
          >
            파일
            {activeMenu === 'file' && (
              <div className="menu-dropdown">
                <div className="menu-option" onClick={handleNewFile}>
                  <span>새 파일</span>
                  <span className="shortcut-hint">Ctrl+N</span>
                </div>
                <div className="menu-option" onClick={handleOpenFile}>
                  <span>파일 열기</span>
                  <span className="shortcut-hint">Ctrl+O</span>
                </div>
                <div className="menu-separator"></div>
                <div className="menu-option" onClick={handleSaveFile}>
                  <span>저장</span>
                  <span className="shortcut-hint">Ctrl+S</span>
                </div>
                <div className="menu-option" onClick={handleSaveAsFile}>
                  <span>다른 이름으로 저장</span>
                  <span className="shortcut-hint">Ctrl+Shift+S</span>
                </div>
                <div className="menu-separator"></div>
                <div className="menu-option" onClick={async () => {
                  const selectedPath = await fileSystem.showOpenFolderDialog();
                  if (selectedPath) {
                    await fileSystem.setDefaultFolder(selectedPath);
                    toast.showToast('기본 폴더가 설정되었습니다.', 'success');
                  }
                }}>
                  <span>기본 폴더 지정</span>
                </div>
              </div>
            )}
          </div>
          
          <div 
            className="menu-item" 
            onClick={() => toggleMenu('edit')}
            onMouseOver={() => handleMenuMouseOver('edit')}
            onMouseLeave={handleMenuMouseOut}
          >
            편집
            {activeMenu === 'edit' && (
              <div 
                className="menu-dropdown"
                onMouseEnter={() => handleMenuMouseOver('edit')}
                onMouseLeave={handleMenuMouseOut}
              >
                <div className="menu-option" onClick={() => editor.undo()}>
                  <span>실행 취소</span>
                  <span className="shortcut-hint">Ctrl+Z</span>
                </div>
                <div className="menu-option" onClick={() => editor.redo()}>
                  <span>다시 실행</span>
                  <span className="shortcut-hint">Ctrl+Y</span>
                </div>
                <div className="menu-separator"></div>
                <div className="menu-option" onClick={toggleFindReplace}>
                  <span>찾기/바꾸기</span>
                  <span className="shortcut-hint">Ctrl+F</span>
                </div>
              </div>
            )}
          </div>
          
          <div 
            className="menu-item" 
            onClick={() => toggleMenu('view')}
            onMouseOver={() => handleMenuMouseOver('view')}
            onMouseOut={handleMenuMouseOut}
          >
            보기
            {activeMenu === 'view' && (
              <div className="menu-dropdown">
                <div className="checkbox-option">
                  <input 
                    type="checkbox" 
                    checked={layout.showFolderPanel} 
                    onChange={() => layout.toggleFolderPanel()} 
                  />
                  <span>폴더 패널</span>
                </div>
                <div className="checkbox-option">
                  <input 
                    type="checkbox" 
                    checked={bottomPanelVisible} 
                    onChange={() => setBottomPanelVisible(!bottomPanelVisible)} 
                  />
                  <span>하단 패널</span>
                </div>
                <div className="menu-separator"></div>
                <div className="menu-option" onClick={toggleDebugConsole}>
                  <span>디버그 콘솔</span>
                </div>
              </div>
            )}
          </div>
          
          {/* 에디터 메뉴 */}
          <div 
            className="menu-item" 
            onClick={() => toggleMenu('editor')}
            onMouseOver={() => handleMenuMouseOver('editor')}
            onMouseOut={handleMenuMouseOut}
          >
            에디터
            {activeMenu === 'editor' && (
              <div className="menu-dropdown">
                <div className="checkbox-option">
                  <input 
                    type="checkbox" 
                    id="wordWrap" 
                    checked={editor.wordWrap === 'on'} 
                    onChange={() => editor.setWordWrap(editor.wordWrap === 'on' ? 'off' : 'on')} 
                  />
                  <label htmlFor="wordWrap">자동 줄바꿈</label>
                </div>
                <div className="checkbox-option">
                  <input 
                    type="checkbox" 
                    id="lineNumbers" 
                    checked={editor.showLineNumbers} 
                    onChange={() => editor.setShowLineNumbers(!editor.showLineNumbers)} 
                  />
                  <label htmlFor="lineNumbers">줄 번호 표시</label>
                </div>
                <div className="checkbox-option">
                  <input 
                    type="checkbox" 
                    id="minimap" 
                    checked={editor.showMinimap} 
                    onChange={() => editor.setShowMinimap(!editor.showMinimap)} 
                  />
                  <label htmlFor="minimap">미니맵 표시</label>
                </div>
              </div>
            )}
          </div>
          
          {/* 글꼴 메뉴 */}
          <div 
            className="menu-item" 
            onClick={() => toggleMenu('font')}
            onMouseOver={() => handleMenuMouseOver('font')}
            onMouseOut={handleMenuMouseOut}
          >
            글꼴
            {activeMenu === 'font' && (
              <div className="menu-dropdown">
                <div className="menu-option">
                  <span>글꼴 패밀리</span>
                  <span className="shortcut-hint">{editor.fontFamily || 'monospace'}</span>
                  <div className="submenu">
                    <div className="menu-option" onClick={() => editor.setFontFamily('Consolas')}>
                      <span>Consolas</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontFamily("'맑은 고딕', 'Malgun Gothic'")}>
                      <span>맑은 고딕</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontFamily("'나눔고딕코딩', 'NanumGothicCoding'")}>
                      <span>나눔고딕코딩</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontFamily("'D2Coding'")}>
                      <span>D2Coding</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontFamily("'Source Code Pro'")}>
                      <span>Source Code Pro</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontFamily("'Fira Code'")}>
                      <span>Fira Code</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontFamily("'JetBrains Mono'")}>
                      <span>JetBrains Mono</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontFamily('monospace')}>
                      <span>monospace</span>
                    </div>
                  </div>
                </div>
                <div className="menu-option">
                  <span>글꼴 크기</span>
                  <span className="shortcut-hint">{editor.fontSize || 14}px</span>
                  <div className="submenu">
                    <div className="menu-option custom-font-size" onClick={(e) => e.stopPropagation()}>
                      <span>글꼴 크기</span>
                      <select 
                        className="font-size-select"
                        value={editor.fontSize || 14}
                        onChange={(e) => {
                          const size = parseInt(e.target.value);
                          editor.setFontSize(size);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="10">10px</option>
                        <option value="11">11px</option>
                        <option value="12">12px</option>
                        <option value="13">13px</option>
                        <option value="14">14px</option>
                        <option value="15">15px</option>
                        <option value="16">16px</option>
                        <option value="18">18px</option>
                        <option value="20">20px</option>
                        <option value="22">22px</option>
                        <option value="24">24px</option>
                        <option value="26">26px</option>
                        <option value="28">28px</option>
                        <option value="30">30px</option>
                      </select>
                    </div>
                    <div className="menu-separator"></div>
                    <div className="menu-option" onClick={() => editor.setFontSize(12)}>
                      <span>12px</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontSize(13)}>
                      <span>13px</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontSize(14)}>
                      <span>14px</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontSize(15)}>
                      <span>15px</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontSize(16)}>
                      <span>16px</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontSize(18)}>
                      <span>18px</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontSize(20)}>
                      <span>20px</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontSize(22)}>
                      <span>22px</span>
                    </div>
                    <div className="menu-option" onClick={() => editor.setFontSize(24)}>
                      <span>24px</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="menu-right">
          <div 
            className="info-button" 
            onClick={toggleInfoTooltip}
            ref={infoButtonRef}
          >
            정보
            {infoTooltipVisible && (
              <div className="info-tooltip">
                <div className="info-tooltip-content">
                  <div className="info-tooltip-title">Maulwurf</div>
                  <div className="info-tooltip-version">베타 버전 0.1.0</div>
                  <div className="info-tooltip-author">제작자: 조민기</div>
                  <div className="info-tooltip-email email-gray">
                    <a href="mailto:jominki354@gmail.com">jominki354@gmail.com</a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 메인 콘텐츠 */}
      <div className="main-content">
        {/* 파일 탐색기 */}
        {layout.showFolderPanel && (
          <div className="file-explorer-panel" style={{ width: `${layout.folderPanelWidth}px`, maxWidth: `${layout.folderPanelWidth}px` }}>
            <FileExplorer
              folderPath={fileSystem.folderPath}
              folderStructure={fileSystem.folderStructure}
              selectedFilePath={fileSystem.selectedFilePath}
              onFileSelect={handleFileSelect}
              onFileClick={handleFileClick}
              onFolderSelect={handleFolderSelect}
              onFolderClick={handleFolderClick}
              onParentFolderClick={handleParentFolderClick}
              onBrowseFolder={handleBrowseFolder}
              hasParentFolder={fileSystem.hasParentFolder}
              folderPanelWidth={layout.folderPanelWidth}
              onCut={handleCutFile}
              onCopy={handleCopyFile}
              onRename={handleRenameFile}
              onDelete={handleDeleteFile}
              onPaste={handlePasteFile}
            />
            <div 
              className="resize-handle right-resize-handle"
              onMouseDown={handleFolderPanelResizerMouseDown}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            ></div>
          </div>
        )}
        
        {/* 에디터 영역 */}
        <div className="editor-workspace" style={{ marginLeft: 0, paddingLeft: 0, position: 'relative' }}>
          {/* 탭 바 */}
          <TabBar
            tabs={tabs.tabs}
            activeTabId={tabs.activeTabId}
            activateTab={tabs.activateTab}
            closeTab={tabs.closeTab}
            handleTabDragStart={tabs.handleTabDragStart}
            handleTabDragOver={tabs.handleTabDragOver}
            handleTabDrop={tabs.handleTabDrop}
            handleTabDragEnd={tabs.handleTabDragEnd}
            draggedTabId={tabs.draggedTabId}
            dragOverTabId={tabs.dragOverTabId}
            onNewTabClick={handleNewTabClick}
          />
          
          {/* 배경 로고 (탭이 없을 때만 표시) */}
          {tabs.tabs.length === 0 && (
            <div className="editor-background-logo">Maulwurf</div>
          )}
          
          {/* 코드 에디터 (탭이 있을 때만 표시) */}
          {tabs.tabs.length > 0 && (
            <CodeEditor
              value={tabs.activeTabContent}
              onChange={tabs.setActiveTabContent}
              onMount={editor.handleEditorDidMount}
              fontFamily={editor.fontFamily}
              fontSize={editor.fontSize}
              wordWrap={editor.wordWrap}
              showLineNumbers={editor.showLineNumbers}
              showMinimap={editor.showMinimap}
            />
          )}
        </div>
      </div>
      
      {/* 하단 패널 */}
      {bottomPanelVisible && (
        <>
          <div 
            className="resizer resizer-horizontal"
            onMouseDown={handleBottomPanelResizerMouseDown}
          ></div>
          <div className="bottom-panels" style={{ height: `${layout.bottomPanelHeight}px` }}>
            <div className="split-panels">
              <div className="split-panel-left">
                <div className="history-panel">
                  <div className="history-header">
                    <h3>작업 히스토리</h3>
                    <button className="clear-history" onClick={() => logging.setHistory([])}>지우기</button>
                  </div>
                  <div className="history-content">
                    {logging.history.length === 0 ? (
                      <div className="history-empty">작업 히스토리가 없습니다.</div>
                    ) : (
                      <ul className="history-list">
                        {logging.history.map((item, index) => (
                          <li key={index} className="history-item">{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
              <div className="split-panel-right">
                <div className="history-panel">
                  <div className="history-header">
                    <h3>
                      {tabs.activeTabId ? (
                        `타임라인 - ${tabs.tabs.find(tab => tab.id === tabs.activeTabId)?.title || '새 파일'}`
                      ) : (
                        '타임라인'
                      )}
                    </h3>
                    <div className="timeline-actions">
                      <button 
                        className="clear-history" 
                        onClick={handleCreateManualSnapshot}
                        title="수동 스냅샷 생성"
                      >
                        생성
                      </button>
                      <button 
                        className="clear-history" 
                        onClick={handleClearAllSnapshots}
                        title="모든 스냅샷 지우기"
                      >
                        지우기
                      </button>
                    </div>
                  </div>
                  {timeline.isLoading ? (
                    <div className="history-empty">스냅샷 로딩 중...</div>
                  ) : (
                    <Timeline
                      snapshots={timeline.snapshots.filter(snapshot => snapshot.tabId === tabs.activeTabId)}
                      activeSnapshotIndex={timeline.activeSnapshotIndex}
                      onRestoreSnapshot={handleRestoreSnapshot}
                      onDeleteSnapshot={handleDeleteSnapshot}
                      onExportSnapshot={handleExportSnapshot}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* 디버그 콘솔 */}
      {debugConsoleVisible && (
        <div className="debug-console">
          <div className="debug-console-header">
            <h3>디버그 콘솔</h3>
            <div className="debug-console-controls">
              <input 
                type="text" 
                placeholder="로그 검색..." 
                className="debug-console-search"
                value={debugConsoleSearch || ''}
                onChange={(e) => setDebugConsoleSearch(e.target.value)}
              />
              <select 
                className="debug-console-filter"
                value={debugConsoleFilter || 'all'}
                onChange={(e) => setDebugConsoleFilter(e.target.value)}
              >
                <option value="all">모든 로그</option>
                <option value="info">정보</option>
                <option value="warning">경고</option>
                <option value="error">오류</option>
                <option value="debug">디버그</option>
                <option value="success">성공</option>
                <option value="terminal">터미널</option>
                <option value="log">콘솔</option>
                <option value="history">히스토리</option>
              </select>
              <button onClick={() => logging.clearLogs()}>지우기</button>
              <button onClick={toggleDebugConsole}>닫기</button>
            </div>
          </div>
          <div className="debug-console-content">
            {logging.logs
              .filter(log => {
                // 필터링
                if (debugConsoleFilter && debugConsoleFilter !== 'all') {
                  if (log.level.toLowerCase() !== debugConsoleFilter.toLowerCase()) {
                    return false;
                  }
                }
                
                // 검색
                if (debugConsoleSearch) {
                  const searchLower = debugConsoleSearch.toLowerCase();
                  return (
                    log.message.toLowerCase().includes(searchLower) ||
                    log.level.toLowerCase().includes(searchLower) ||
                    log.timestamp.toLowerCase().includes(searchLower)
                  );
                }
                
                return true;
              })
              .map((log, index) => (
                <div 
                  key={index} 
                  className={`log-entry log-level-${log.level.toLowerCase()}`}
                  style={{
                    ...logging.getLogLevelStyle(log.level),
                    userSelect: 'text',
                    cursor: 'text',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  <span 
                    className="log-timestamp"
                    style={{ userSelect: 'text' }}
                  >
                    {log.timestamp}
                  </span>
                  <span 
                    className="log-level"
                    style={{ userSelect: 'text' }}
                  >
                    [{log.level}]
                  </span>
                  <span 
                    className="log-message"
                    style={{ userSelect: 'text' }}
                  >
                    {log.message}
                  </span>
              </div>
              ))
            }
          </div>
          <div className="debug-console-footer">
            <span className="debug-console-status">
              {logging.logs.length}개의 로그 메시지 
              {debugConsoleFilter !== 'all' && ` (필터: ${debugConsoleFilter})`}
              {debugConsoleSearch && ` (검색: "${debugConsoleSearch}")`}
            </span>
            <div className="debug-console-actions">
              <button 
                className="debug-console-action"
                onClick={() => {
                  // 로그 내용을 텍스트 파일로 내보내기
                  const logText = logging.logs
                    .map(log => `${log.timestamp} [${log.level}] ${log.message}`)
                    .join('\n');
                  
                  const blob = new Blob([logText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `maulwurf-logs-${new Date().toISOString().replace(/:/g, '-')}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                로그 내보내기
              </button>
              <button 
                className="debug-console-action"
                onClick={() => {
                  // 로그 자동 스크롤 토글
                  setDebugConsoleAutoScroll(!debugConsoleAutoScroll);
                }}
              >
                {debugConsoleAutoScroll ? '자동 스크롤 끄기' : '자동 스크롤 켜기'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 토스트 메시지 */}
      <div className="toast-container">
        {toast.toasts.map(toastItem => (
          <div 
            key={toastItem.id} 
            id={toastItem.toastId || `toast-${toastItem.id}`}
            className={`toast-message ${toastItem.type} ${toastItem.removing ? 'removing' : ''}`}
          >
            <div className="toast-content">{toastItem.message}</div>
            <button 
              className="toast-close" 
              onClick={() => toast.removeToast(toastItem.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      
      {/* 상태 바 */}
      <div className="status-bar">
        <div className="status-items">
          <div className="status-item">
            {editor.filePath ? editor.filePath : '새 파일'}
          </div>
          <div className="status-item">
            {editor.cursorPosition ? `줄 ${editor.cursorPosition.lineNumber}, 열 ${editor.cursorPosition.column}` : ''}
          </div>
          <div className="status-item">
            {editor.wordWrap === 'on' ? '자동 줄바꿈: 켜짐' : '자동 줄바꿈: 꺼짐'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainLayout; 