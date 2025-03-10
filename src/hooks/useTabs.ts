import { useState, useCallback, useEffect } from 'react';
import { FileTab, TimelineSnapshot } from '../types';
import { createNewTab } from '../utils/fileUtils';

export const useTabs = () => {
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [activeTabContent, setActiveTabContent] = useState<string>('');
  const [lastSavedContent, setLastSavedContent] = useState<string>('');
  const [contentChangeTimeout, setContentChangeTimeout] = useState<NodeJS.Timeout | null>(null);

  // 활성 탭이 변경될 때마다 해당 탭의 내용을 activeTabContent에 설정
  useEffect(() => {
    if (!activeTabId) return;
    
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (activeTab) {
      setActiveTabContent(activeTab.content);
      setLastSavedContent(activeTab.content);
    }
  }, [activeTabId, tabs]);

  // 탭 활성화
  const activateTab = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    
    // 현재 활성화된 탭의 내용을 저장
    const currentActiveTab = tabs.find(tab => tab.id === activeTabId);
    if (currentActiveTab && activeTabContent !== currentActiveTab.content) {
      setTabs(prevTabs => 
        prevTabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, content: activeTabContent, isModified: tab.path ? true : false } 
            : tab
        )
      );
    }
    
    // 새 탭 활성화
    setActiveTabId(tabId);
    
    // 새로 활성화된 탭의 내용 설정
    const newActiveTab = tabs.find(tab => tab.id === tabId);
    if (newActiveTab) {
      setActiveTabContent(newActiveTab.content);
    }
  }, [activeTabId, tabs, activeTabContent]);

  // 탭 내용 업데이트
  const updateTabContent = useCallback((tabId: string, content: string) => {
    console.log('[useTabs] 탭 내용 업데이트 시작:', { tabId, contentLength: content.length });
    
    setTabs(prevTabs => {
      // 업데이트할 탭 찾기
      const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
      
      // 탭이 없으면 변경 없음
      if (tabIndex === -1) {
        console.log('[useTabs] 업데이트할 탭을 찾을 수 없음:', tabId);
        return prevTabs;
      }
      
      // 현재 탭 가져오기
      const currentTab = prevTabs[tabIndex];
      
      // 내용이 같으면 변경 없음
      if (currentTab.content === content) {
        console.log('[useTabs] 내용이 동일하여 업데이트 불필요');
        return prevTabs;
      }
      
      // 새 탭 배열 생성
      const newTabs = [...prevTabs];
      
      // 탭 내용 업데이트 및 수정 상태 설정
      newTabs[tabIndex] = {
        ...currentTab,
        content,
        isModified: true
      };
      
      console.log('[useTabs] 탭 내용 업데이트 완료:', { 
        tabId, 
        isActiveTab: tabId === activeTabId,
        oldContentLength: currentTab.content.length,
        newContentLength: content.length
      });
      
      return newTabs;
    });
    
    // 활성 탭 내용 업데이트 (활성 탭인 경우에만)
    if (tabId === activeTabId) {
      console.log('[useTabs] 활성 탭 내용 업데이트:', { tabId, contentLength: content.length });
      setActiveTabContent(content);
    }
  }, [activeTabId]);

  // 탭 닫기
  const closeTab = useCallback((tabId: string, event?: React.MouseEvent) => {
    // 이벤트가 있는 경우에만 전파 중지
    if (event) {
      event.stopPropagation();
    }
    
    console.log('[useTabs] 탭 닫기 시도:', tabId);
    
    // 현재 탭 목록 가져오기
    const currentTabs = [...tabs];
    
    // 닫으려는 탭이 없으면 아무 작업도 하지 않음
    const tabIndex = currentTabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) {
      console.log('[useTabs] 닫으려는 탭을 찾을 수 없음:', tabId);
      return;
    }
    
    // 닫으려는 탭이 활성 탭인 경우, 다른 탭으로 전환
    if (tabId === activeTabId) {
      // 닫으려는 탭이 마지막 탭이 아닌 경우, 다음 탭으로 전환
      if (tabIndex < currentTabs.length - 1) {
        console.log('[useTabs] 다음 탭으로 전환:', currentTabs[tabIndex + 1].id);
        setActiveTabId(currentTabs[tabIndex + 1].id);
        setActiveTabContent(currentTabs[tabIndex + 1].content);
      } 
      // 닫으려는 탭이 마지막 탭인 경우, 이전 탭으로 전환
      else if (tabIndex > 0) {
        console.log('[useTabs] 이전 탭으로 전환:', currentTabs[tabIndex - 1].id);
        setActiveTabId(currentTabs[tabIndex - 1].id);
        setActiveTabContent(currentTabs[tabIndex - 1].content);
      }
      // 닫으려는 탭이 유일한 탭인 경우, 빈 상태로 설정
      else {
        console.log('[useTabs] 마지막 탭 닫기');
        setTabs([]);
        setActiveTabId(null);
        setActiveTabContent('');
        return;
      }
    }
    
    // 탭 제거
    console.log('[useTabs] 탭 제거:', tabId);
    setTabs(currentTabs.filter(tab => tab.id !== tabId));
  }, [tabs, activeTabId]);

  // 새 탭 생성
  const createTab = useCallback(() => {
    const newTab = createNewTab();
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
    setActiveTabContent(newTab.content);
    return newTab;
  }, []);

  // 탭 추가
  const addTab = useCallback((tab: Partial<FileTab>) => {
    const newTab: FileTab = {
      id: tab.id || `tab-${Date.now()}`,
      title: tab.title || '새 파일',
      path: tab.path || null,
      content: tab.content || '',
      isModified: tab.isModified || false,
      timelineSnapshots: tab.timelineSnapshots || []
    };
    
    // 새 탭 추가
    setTabs(prevTabs => [...prevTabs, newTab]);
    
    // 새 탭 활성화 (약간의 지연을 두어 상태 업데이트가 완료되도록 함)
    setTimeout(() => {
      setActiveTabId(newTab.id);
      setActiveTabContent(newTab.content);
      setLastSavedContent(newTab.content);
    }, 10);
    
    return newTab;
  }, []);

  // 탭 드래그 시작
  const handleTabDragStart = useCallback((tabId: string, event: React.DragEvent<HTMLDivElement>) => {
    console.log('드래그 시작:', tabId);
    
    // 드래그 중인 탭 ID 설정
    setDraggedTabId(tabId);
    
    // 드래그 데이터 설정
    event.dataTransfer.setData('text/plain', tabId);
    event.dataTransfer.effectAllowed = 'move';
    
    // 드래그 이미지 설정 (투명하게)
    const dragImage = document.createElement('div');
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // 드래그 이미지 요소 제거 (지연 설정)
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }, []);

  // 탭 드래그 오버
  const handleTabDragOver = useCallback((tabId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    // 드래그 중인 탭과 드래그 오버된 탭이 다른 경우에만 처리
    if (draggedTabId && draggedTabId !== tabId) {
      setDragOverTabId(tabId);
      event.dataTransfer.dropEffect = 'move';
    }
  }, [draggedTabId]);

  // 탭 드롭
  const handleTabDrop = useCallback((tabId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    console.log('드롭 이벤트:', { draggedTabId, targetTabId: tabId });
    
    // 드래그 중인 탭과 드롭된 탭이 다른 경우에만 처리
    if (draggedTabId && draggedTabId !== tabId) {
      // 현재 탭 목록 복사
      const tabsCopy = [...tabs];
      
      // 드래그 중인 탭과 드롭된 탭의 인덱스 찾기
      const draggedTabIndex = tabsCopy.findIndex(tab => tab.id === draggedTabId);
      const dropTabIndex = tabsCopy.findIndex(tab => tab.id === tabId);
      
      console.log('탭 인덱스:', { draggedTabIndex, dropTabIndex });
      
      if (draggedTabIndex !== -1 && dropTabIndex !== -1) {
        // 드래그 중인 탭 저장
        const draggedTab = { ...tabsCopy[draggedTabIndex] };
        
        // 탭 목록에서 드래그 중인 탭 제거
        tabsCopy.splice(draggedTabIndex, 1);
        
        // 드롭된 위치에 탭 삽입
        tabsCopy.splice(dropTabIndex, 0, draggedTab);
        
        console.log('새 탭 목록:', tabsCopy.map(t => t.title || t.fileName));
        
        // 탭 목록 업데이트
        setTabs(tabsCopy);
      }
    }
    
    // 드래그 상태 초기화 (약간 지연시켜 시각적 효과 유지)
    setTimeout(() => {
      setDraggedTabId(null);
      setDragOverTabId(null);
    }, 50);
  }, [tabs, draggedTabId]);

  // 탭 드래그 종료
  const handleTabDragEnd = useCallback(() => {
    console.log('드래그 종료');
    // 드래그 상태 초기화
    setDraggedTabId(null);
    setDragOverTabId(null);
  }, []);

  // 탭 스냅샷 추가
  const addTabSnapshot = useCallback((tabId: string, snapshot: TimelineSnapshot) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === tabId 
          ? { 
              ...tab, 
              timelineSnapshots: [...(tab.timelineSnapshots || []), snapshot] 
            } 
          : tab
      )
    );
  }, []);

  // activeTabContent 설정 함수 (undefined 처리)
  const setActiveTabContentWrapper = useCallback((value: string | undefined) => {
    const newContent = value || '';
    setActiveTabContent(newContent);
    
    // 현재 활성 탭 찾기
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab) return;
    
    // 내용이 변경되었는지 확인
    if (newContent !== lastSavedContent) {
      // 탭 상태 업데이트 (수정됨 표시)
      setTabs(prevTabs => 
        prevTabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, content: newContent, isModified: true } 
            : tab
        )
      );
      
      // 타임라인 스냅샷 생성을 위한 디바운스 처리
      if (contentChangeTimeout) {
        clearTimeout(contentChangeTimeout);
      }
      
      const timeout = setTimeout(() => {
        // 현재 활성 탭 다시 가져오기 (상태가 변경되었을 수 있음)
        const currentActiveTab = tabs.find(tab => tab.id === activeTabId);
        if (!currentActiveTab) return;
        
        console.log('Creating content-changed event for tab:', currentActiveTab);
        
        // 파일 이름과 경로 확인
        const fileName = currentActiveTab.fileName || currentActiveTab.title || '새 파일';
        const filePath = currentActiveTab.filePath || currentActiveTab.path || '';
        
        // 타임라인 스냅샷 생성 이벤트 발생
        const changeEvent = new CustomEvent('content-changed', {
          detail: {
            tabId: activeTabId,
            content: newContent,
            fileName: fileName,
            filePath: filePath
          }
        });
        
        // 이벤트 발생
        window.dispatchEvent(changeEvent);
        
        setContentChangeTimeout(null);
      }, 1000); // 1초 디바운스로 변경
      
      setContentChangeTimeout(timeout);
    }
  }, [activeTabId, tabs, lastSavedContent, contentChangeTimeout]);

  // 파일 저장 시 호출되는 함수
  const markContentSaved = useCallback((tabId: string) => {
    // 해당 탭 찾기
    const tab = tabs.find(tab => tab.id === tabId);
    if (!tab) return;
    
    // 저장된 내용 업데이트
    setLastSavedContent(tab.content);
    
    // 탭의 수정 상태 업데이트
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === tabId 
          ? { ...tab, isModified: false } 
          : tab
      )
    );
  }, [tabs]);

  return {
    tabs,
    activeTabId,
    activeTabContent,
    addTab,
    activateTab,
    closeTab,
    updateTabContent,
    createTab,
    setActiveTabContent: setActiveTabContentWrapper,
    markContentSaved,
    draggedTabId,
    dragOverTabId,
    handleTabDragStart,
    handleTabDragOver,
    handleTabDrop,
    handleTabDragEnd,
    setTabs
  };
}; 