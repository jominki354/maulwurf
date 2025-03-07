import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useApp } from '../../hooks/useApp';
import CodeEditor from '../editor/CodeEditor';
import TabBar from '../tabs/TabBar';
import FileExplorer from '../fileExplorer/FileExplorer';
import Timeline from '../timeline/Timeline';

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

  // 상태 추가
  const [activeBottomTab, setActiveBottomTab] = useState<string>('timeline');
  const [isFirstFileOpen, setIsFirstFileOpen] = useState<boolean>(true);
  const [debugConsoleSearch, setDebugConsoleSearch] = useState<string>('');
  const [debugConsoleFilter, setDebugConsoleFilter] = useState<string>('all');
  const [debugConsoleAutoScroll, setDebugConsoleAutoScroll] = useState<boolean>(true);

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
      // 이미 열린 파일인지 확인
      const existingTab = tabs.tabs.find(tab => tab.path === filePath);
      
      if (existingTab) {
        // 이미 열린 파일이면 해당 탭을 활성화만 함
        tabs.activateTab(existingTab.id);
        return;
      }
      
      // 파일 내용 읽기
      const content = await fileSystem.openFile(filePath);
      
      // 파일 이름 추출
      const fileName = filePath.split(/[/\\]/).pop() || '새 파일';
      
      // 상태 업데이트
      editor.setFileName(fileName);
      editor.setFilePath(filePath);
      
      // 선택된 파일 경로 업데이트
      fileSystem.setSelectedFilePath(filePath);
      
      // 히스토리에 추가
      logging.addToHistory(`파일 열기: ${filePath}`);
      
      // 탭 추가 (addTab 함수 내에서 탭 활성화 및 내용 설정이 이루어짐)
      const newTab = tabs.addTab({
        id: filePath,
        title: fileName,
        path: filePath,
        content: content
      });
      
      // 파일 열기 스냅샷 생성
      // 해당 파일에 대한 스냅샷이 없는 경우에만 첫 스냅샷 생성
      const existingSnapshots = timeline.snapshots.filter(snapshot => snapshot.tabId === filePath);
      if (existingSnapshots.length === 0) {
        timeline.createSnapshot(
          "파일 열기",
          content,
          fileName,
          filePath,
          filePath, // 탭 ID는 filePath
          editor.cursorPosition || undefined,
          timeline.SnapshotType.MANUAL, // 수동 스냅샷으로 표시
          ["파일 열기", "초기 상태"],
          editor.scrollPosition || undefined
        );
      }
      
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
  };

  // 정보 툴팁 토글
  const toggleInfoTooltip = () => {
    setInfoTooltipVisible(prev => !prev);
  };

  // 메뉴 외부 클릭 처리
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // 메뉴 아이템, 메뉴 드롭다운, 서브메뉴를 클릭한 경우에는 메뉴를 닫지 않음
      if (!target.closest('.menu-item') && 
          !target.closest('.menu-dropdown') && 
          !target.closest('.submenu') &&
          !target.closest('.dropdown-section')) {
        setActiveMenu(null);
      }
      
      if (infoButtonRef.current && !infoButtonRef.current.contains(target) && !target.closest('.info-tooltip')) {
        setInfoTooltipVisible(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
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
      
      // 파일 경로가 없거나 새 파일인 경우에만 다른 이름으로 저장 다이얼로그 표시
      if (!editor.filePath || editor.filePath === '') {
        // 파일 경로가 없으면 다른 이름으로 저장
        await handleSaveAsFile();
        return;
      }
      
      // 파일 저장
      await fileSystem.saveFile(editor.filePath, tabs.activeTabContent);
      
      // 탭 상태 업데이트 (수정되지 않음으로 표시)
      if (tabs.activeTabId) {
        tabs.markContentSaved(tabs.activeTabId);
      }
      
      // 저장 스냅샷 생성
      timeline.createSnapshot(
        `파일 저장: ${activeTab.fileName || '새 파일'}`,
        tabs.activeTabContent,
        activeTab.fileName || '새 파일',
        editor.filePath,
        tabs.activeTabId || '',
        editor.cursorPosition || undefined,
        timeline.SnapshotType.SAVE,
        [],
        editor.scrollPosition || undefined,
        editor.getSelectionsFromEditor()
      );
      
      // 히스토리에 추가
      logging.addToHistory(`파일 저장: ${editor.filePath}`);
      
      // 토스트 메시지 표시
      toast.showToast('파일이 저장되었습니다.', 'success');
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
    setFindReplaceVisible(prev => !prev);
  };

  // 디버그 콘솔 토글
  const toggleDebugConsole = () => {
    setDebugConsoleVisible(prev => !prev);
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
    layout.setIsDraggingBottomPanel(true);
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
      
      // 삭제 전 확인 (자동 스냅샷이 아닌 경우)
      if (snapshot.type !== timeline.SnapshotType.AUTO) {
        const confirmDelete = window.confirm(`"${snapshot.description}" 스냅샷을 삭제하시겠습니까?`);
        if (!confirmDelete) {
          return;
        }
      }
      
      timeline.deleteSnapshot(originalIndex);
      logging.addToHistory(`스냅샷 삭제: ${snapshot.description}`);
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
        // 파일 저장 다이얼로그 열기
        const filePath = await fileSystem.showSaveDialog();
        
        if (!filePath) {
          // 사용자가 취소함
          return;
        }
        
        // 파일 저장
        await fileSystem.saveFile(filePath, snapshot.content);
        
        // 히스토리에 추가
        logging.addToHistory(`스냅샷 내보내기: ${snapshot.description} -> ${filePath}`);
        
        // 토스트 메시지 표시
        toast.showToast(`스냅샷이 ${filePath}에 저장되었습니다.`, 'success');
      } catch (error) {
        console.error('스냅샷 내보내기 오류:', error);
        toast.showToast(`스냅샷을 내보낼 수 없습니다: ${error}`, 'error');
      }
    }
  };
  
  // 스냅샷 가져오기
  const handleImportSnapshot = async () => {
    try {
      const snapshot = await timeline.importSnapshot();
      
      if (snapshot) {
        // 히스토리에 추가
        logging.addToHistory(`스냅샷 가져오기: ${snapshot.fileName}`);
        
        // 토스트 메시지 표시
        toast.showToast(`${snapshot.fileName} 스냅샷을 가져왔습니다.`, 'success');
        
        // 가져온 스냅샷 복원
        const index = timeline.snapshots.findIndex(s => s.id === snapshot.id);
        if (index !== -1) {
          handleRestoreSnapshot(index);
        }
      }
    } catch (error) {
      console.error('스냅샷 가져오기 오류:', error);
      toast.showToast(`스냅샷을 가져올 수 없습니다: ${error}`, 'error');
    }
  };
  
  // 스냅샷 비교
  const handleCompareSnapshots = (index1: number, index2: number) => {
    const diff = timeline.compareSnapshots(index1, index2);
    
    if (diff) {
      // 비교 결과 표시 (실제 구현에서는 모달 또는 별도 패널에 표시)
      console.log('스냅샷 비교 결과:', diff);
      
      // 히스토리에 추가
      logging.addToHistory('스냅샷 비교 완료');
    }
  };
  
  // 수동 스냅샷 생성
  const handleCreateManualSnapshot = () => {
    // 현재 활성 탭 찾기
    const activeTab = tabs.tabs.find(tab => tab.id === tabs.activeTabId);
    if (!activeTab) return;
    
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
      editor.getSelectionsFromEditor()
    );
    
    if (snapshot) {
      // 히스토리에 추가
      logging.addToHistory(`수동 스냅샷 생성: ${activeTab.title || '새 파일'}`);
      
      // 토스트 메시지 표시
      toast.showToast('수동 스냅샷이 생성되었습니다.', 'success');
    }
  };
  
  // 모든 스냅샷 지우기
  const handleClearAllSnapshots = () => {
    // 확인 대화상자 표시
    if (window.confirm('현재 탭의 모든 스냅샷을 지우시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      // 현재 활성 탭의 스냅샷만 지우기
      if (tabs.activeTabId) {
        timeline.clearTabSnapshots(tabs.activeTabId);
      }
      
      // 히스토리에 추가
      logging.addToHistory('현재 탭의 모든 스냅샷 지우기');
      
      // 토스트 메시지 표시
      toast.showToast('현재 탭의 모든 스냅샷이 지워졌습니다.', 'info');
    }
  };
  
  // 자동 스냅샷 정리
  const handleCleanupSnapshots = () => {
    const removedCount = timeline.cleanupSnapshots();
    
    if (removedCount > 0) {
      // 히스토리에 추가
      logging.addToHistory(`자동 스냅샷 정리: ${removedCount}개 제거됨`);
      
      // 토스트 메시지 표시
      toast.showToast(`${removedCount}개의 오래된 자동 스냅샷이 제거되었습니다.`, 'info');
    }
  };

  // 하단 패널 탭 전환
  const handleBottomTabChange = (tabName: string) => {
    setActiveBottomTab(tabName);
  };

  // 새 탭 버튼 클릭 핸들러
  const handleNewTabClick = () => {
    handleNewFile();
  };

  // 에디터 내용 변경 이벤트 처리
  useEffect(() => {
    const handleContentChanged = (event: CustomEvent) => {
      const { tabId, content, fileName, filePath } = event.detail;
      
      console.log('Content changed event received:', { tabId, fileName, filePath });
      
      // 타임라인 스냅샷 생성
      const snapshot = timeline.createSnapshot(
        `${fileName} 편집`,
        content,
        fileName,
        filePath,
        tabId,
        editor.cursorPosition || undefined
      );
      
      console.log('Timeline snapshot created:', snapshot);
      
      // 히스토리에 추가
      logging.addToHistory(`${fileName} 편집 스냅샷 생성`);
    };
    
    // 이벤트 리스너 등록
    window.addEventListener('content-changed', handleContentChanged as EventListener);
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      window.removeEventListener('content-changed', handleContentChanged as EventListener);
    };
  }, [timeline, editor.cursorPosition, logging]);

  // 에디터 커맨드 이벤트 처리
  useEffect(() => {
    const handleEditorCommand = (event: CustomEvent) => {
      const { command } = event.detail;
      
      console.log('Editor command received:', command);
      
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
      }
    };
    
    // 이벤트 리스너 등록
    window.addEventListener('editor-command', handleEditorCommand as EventListener);
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      window.removeEventListener('editor-command', handleEditorCommand as EventListener);
    };
  }, [handleSaveFile, handleOpenFile, handleNewFile, toggleFindReplace]);

  // 키보드 단축키 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl 키가 눌려있는지 확인
      const isCtrl = e.ctrlKey || e.metaKey;
      
      // 입력 필드에서 단축키가 작동하지 않도록 예외 처리
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement || 
        (e.target as HTMLElement).isContentEditable
      ) {
        // 저장(Ctrl+S)은 입력 필드에서도 작동하도록 허용
        if (isCtrl && e.key === 's') {
          e.preventDefault();
          handleSaveFile();
        }
        return;
      }
      
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
        case '`': // 디버그 콘솔 토글 (Ctrl+`)
          if (isCtrl) {
            e.preventDefault();
            toggleDebugConsole();
          }
          break;
        case 'F5': // 수동 스냅샷 생성 (F5)
          e.preventDefault();
          handleCreateManualSnapshot();
          break;
      }
    };
    
    // 키보드 이벤트 리스너 등록
    document.addEventListener('keydown', handleKeyDown);
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
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
    handleCreateManualSnapshot
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
      {/* 메뉴바 */}
      <div className="menu-bar">
        <div className="menu-left">
          <div 
            className="menu-item" 
            onClick={() => toggleMenu('file')}
            onMouseOver={() => handleMenuMouseOver('file')}
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
                <div className="menu-option" onClick={() => handleFolderSelect('')}>
                  <span>폴더 열기</span>
                  <span className="shortcut-hint">Ctrl+K</span>
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
              </div>
            )}
          </div>
          
          <div 
            className="menu-item" 
            onClick={() => toggleMenu('edit')}
            onMouseOver={() => handleMenuMouseOver('edit')}
          >
            편집
            {activeMenu === 'edit' && (
              <div className="menu-dropdown">
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
          >
            보기
            {activeMenu === 'view' && (
              <div className="menu-dropdown">
                <div className="menu-option" onClick={() => layout.toggleFolderPanel()}>
                  <span>파일 탐색기</span>
                  <span className="shortcut-hint">Ctrl+B</span>
                </div>
                <div className="menu-option" onClick={() => layout.toggleBottomPanel()}>
                  <span>타임라인/히스토리</span>
                  <span className="shortcut-hint">Ctrl+J</span>
                </div>
                <div className="menu-separator"></div>
                <div className="menu-option" onClick={toggleDebugConsole}>
                  <span>디버그 콘솔</span>
                  <span className="shortcut-hint">Ctrl+`</span>
                </div>
              </div>
            )}
          </div>
          
          <div 
            className="menu-item" 
            onClick={() => toggleMenu('settings')}
            onMouseOver={() => handleMenuMouseOver('settings')}
          >
            설정
            {activeMenu === 'settings' && (
              <div className="menu-dropdown">
                <div className="menu-option">
                  <span>에디터</span>
                  <span className="shortcut-hint">▶</span>
                  <div className="submenu editor-settings-submenu" onClick={(e) => e.stopPropagation()}>
                    <div className="checkbox-option" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        id="wordWrap" 
                        checked={editor.wordWrap === 'on'} 
                        onChange={(e) => {
                          e.stopPropagation();
                          editor.setWordWrap(editor.wordWrap === 'on' ? 'off' : 'on');
                        }} 
                      />
                      <label htmlFor="wordWrap" onClick={(e) => e.stopPropagation()}>자동 줄바꿈</label>
                    </div>
                    <div className="checkbox-option" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        id="lineNumbers" 
                        checked={editor.showLineNumbers} 
                        onChange={(e) => {
                          e.stopPropagation();
                          editor.setShowLineNumbers(!editor.showLineNumbers);
                        }} 
                      />
                      <label htmlFor="lineNumbers" onClick={(e) => e.stopPropagation()}>줄 번호 표시</label>
                    </div>
                    <div className="checkbox-option" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        id="minimap" 
                        checked={editor.showMinimap} 
                        onChange={(e) => {
                          e.stopPropagation();
                          editor.setShowMinimap(!editor.showMinimap);
                        }} 
                      />
                      <label htmlFor="minimap" onClick={(e) => e.stopPropagation()}>미니맵 표시</label>
                    </div>
                  </div>
                </div>
                <div className="menu-option">
                  <span>글꼴</span>
                  <span className="shortcut-hint">▶</span>
                  <div className="submenu font-settings-submenu" onClick={(e) => e.stopPropagation()}>
                    <div className="dropdown-section" onClick={(e) => e.stopPropagation()}>
                      <div className="dropdown-label">글꼴 크기</div>
                      <select 
                        value={editor.fontSize} 
                        onChange={(e) => {
                          e.stopPropagation();
                          editor.setFontSize(Number(e.target.value));
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {[10, 12, 14, 16, 18, 20, 22, 24].map(size => (
                          <option key={size} value={size}>{size}px</option>
                        ))}
                      </select>
                    </div>
                    <div className="dropdown-section" onClick={(e) => e.stopPropagation()}>
                      <div className="dropdown-label">글꼴 패밀리</div>
                      <select 
                        value={editor.fontFamily} 
                        onChange={(e) => {
                          e.stopPropagation();
                          editor.setFontFamily(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="Consolas">Consolas</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Menlo">Menlo</option>
                        <option value="Monaco">Monaco</option>
                        <option value="Source Code Pro">Source Code Pro</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {activeMenu === 'editor-settings' && (
            <div className="menu-dropdown" style={{ left: '120px', top: '36px' }}>
              <div className="checkbox-option">
                <input 
                  type="checkbox" 
                  id="wordWrap" 
                  checked={editor.wordWrap === 'on'} 
                  onChange={(e) => editor.setWordWrap(editor.wordWrap === 'on' ? 'off' : 'on')} 
                />
                <label htmlFor="wordWrap">자동 줄바꿈</label>
              </div>
              <div className="checkbox-option">
                <input 
                  type="checkbox" 
                  id="lineNumbers" 
                  checked={editor.showLineNumbers} 
                  onChange={(e) => editor.setShowLineNumbers(!editor.showLineNumbers)} 
                />
                <label htmlFor="lineNumbers">줄 번호 표시</label>
              </div>
              <div className="checkbox-option">
                <input 
                  type="checkbox" 
                  id="minimap" 
                  checked={editor.showMinimap} 
                  onChange={(e) => editor.setShowMinimap(!editor.showMinimap)} 
                />
                <label htmlFor="minimap">미니맵 표시</label>
              </div>
            </div>
          )}
          
          {activeMenu === 'font-settings' && (
            <div className="menu-dropdown" style={{ left: '120px', top: '36px' }}>
              <div className="dropdown-section">
                <div className="dropdown-label">글꼴 크기</div>
                <select 
                  value={editor.fontSize} 
                  onChange={(e) => editor.setFontSize(Number(e.target.value))}
                >
                  {[10, 12, 14, 16, 18, 20, 22, 24].map(size => (
                    <option key={size} value={size}>{size}px</option>
                  ))}
                </select>
              </div>
              <div className="dropdown-section">
                <div className="dropdown-label">글꼴 패밀리</div>
                <select 
                  value={editor.fontFamily} 
                  onChange={(e) => editor.setFontFamily(e.target.value)}
                >
                  <option value="Consolas">Consolas</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Menlo">Menlo</option>
                  <option value="Monaco">Monaco</option>
                  <option value="Source Code Pro">Source Code Pro</option>
                </select>
              </div>
            </div>
          )}
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
                  <div className="info-tooltip-logo">M</div>
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
      {layout.showBottomPanel && (
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
                <div className="timeline-panel">
                  <div className="timeline-header">
                    <h3>
                      {tabs.activeTabId ? (
                        `타임라인 - ${tabs.tabs.find(tab => tab.id === tabs.activeTabId)?.title || '새 파일'}`
                      ) : (
                        '타임라인'
                      )}
                    </h3>
                    <div className="timeline-actions">
                      <button 
                        className="timeline-action-button" 
                        onClick={handleCreateManualSnapshot}
                        title="수동 스냅샷 생성"
                      >
                        생성
                      </button>
                      <button 
                        className="timeline-action-button" 
                        onClick={handleClearAllSnapshots}
                        title="모든 스냅샷 지우기"
                      >
                        지우기
                      </button>
                    </div>
                  </div>
                  {timeline.isLoading ? (
                    <div className="timeline-loading">스냅샷 로딩 중...</div>
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