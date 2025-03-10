import { useState, useCallback, useEffect } from 'react';
import { TimelineSnapshot } from '../types';
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';
import { save, open } from '@tauri-apps/api/dialog';
import { appLocalDataDir } from '@tauri-apps/api/path';
import { exists, createDir } from '@tauri-apps/api/fs';

// 스냅샷 유형 정의
export enum SnapshotType {
  AUTO = 'auto',       // 자동 생성된 스냅샷
  MANUAL = 'manual',   // 수동으로 생성된 스냅샷
  SAVE = 'save',       // 저장 시 생성된 스냅샷
  RESTORE = 'restore', // 복원 시 생성된 스냅샷
  OPEN = 'open'        // 파일 열기 시 생성된 스냅샷
}

// 확장된 스냅샷 인터페이스
interface EnhancedTimelineSnapshot extends TimelineSnapshot {
  type: SnapshotType;
  tags?: string[];
  diff?: string;
}

// 스냅샷 그룹 인터페이스
interface SnapshotGroup {
  tabId: string;
  fileName: string;
  snapshots: EnhancedTimelineSnapshot[];
}

export const useTimeline = () => {
  // 모든 스냅샷을 저장하는 상태
  const [timelineSnapshots, setTimelineSnapshots] = useState<EnhancedTimelineSnapshot[]>([]);
  // 현재 활성화된 스냅샷 인덱스
  const [activeSnapshotIndex, setActiveSnapshotIndex] = useState<number>(-1);
  // 스냅샷 그룹 (탭별로 그룹화)
  const [snapshotGroups, setSnapshotGroups] = useState<SnapshotGroup[]>([]);
  // 마지막 스냅샷 생성 시간 (자동 스냅샷 생성 간격 제어용)
  const [lastSnapshotTime, setLastSnapshotTime] = useState<number>(0);
  // 스냅샷 로딩 상태
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 스냅샷 그룹 업데이트 함수
  const updateSnapshotGroups = useCallback(() => {
    // 탭 ID별로 스냅샷 그룹화
    const groups: { [key: string]: SnapshotGroup } = {};
    
    timelineSnapshots.forEach(snapshot => {
      if (!groups[snapshot.tabId]) {
        groups[snapshot.tabId] = {
          tabId: snapshot.tabId,
          fileName: snapshot.fileName,
          snapshots: []
        };
      }
      groups[snapshot.tabId].snapshots.push(snapshot);
    });
    
    // 각 그룹 내에서 스냅샷을 시간순으로 정렬
    Object.values(groups).forEach(group => {
      group.snapshots.sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
    });
    
    setSnapshotGroups(Object.values(groups));
  }, [timelineSnapshots]);

  // 스냅샷 그룹이 변경될 때마다 업데이트
  useEffect(() => {
    updateSnapshotGroups();
  }, [timelineSnapshots, updateSnapshotGroups]);

  // 스냅샷 생성 함수
  const createSnapshot = useCallback((
    description: string,
    content: string,
    fileName: string,
    filePath: string,
    tabId: string,
    cursorPosition?: { lineNumber: number; column: number },
    type: SnapshotType = SnapshotType.AUTO,
    tags: string[] = [],
    scrollPosition?: { scrollTop: number; scrollLeft: number },
    selections?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }[]
  ) => {
    // 이전 스냅샷 찾기 (같은 탭의 가장 최근 스냅샷)
    const previousSnapshots = timelineSnapshots.filter(s => s.tabId === tabId);
    const previousSnapshot = previousSnapshots.length > 0 
      ? previousSnapshots.sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return timeB - timeA; // 최신 순서
        })[0]
      : null;
    const previousContent = previousSnapshot?.content || '';

    // 내용이 같으면 스냅샷 생성하지 않음 (자동 스냅샷인 경우)
    if (type === SnapshotType.AUTO && content === previousContent) {
      return null;
    }

    // 현재 시간
    const now = Date.now();
    
    // 자동 스냅샷인 경우 최소 간격 확인 (3분 = 180초)
    if (type === SnapshotType.AUTO) {
      const lastAutoSnapshot = previousSnapshots.find(s => (s as any).type === SnapshotType.AUTO);
      if (lastAutoSnapshot) {
        const lastTime = lastAutoSnapshot.timestamp instanceof Date 
          ? lastAutoSnapshot.timestamp.getTime() 
          : new Date(lastAutoSnapshot.timestamp).getTime();
        
        if (now - lastTime < 180000) {
          return null;
        }
      }
    }
    
    // 새 스냅샷 생성
    const newSnapshot: EnhancedTimelineSnapshot = {
      id: now,
      timestamp: new Date(),
      description,
      content,
      previousContent,
      cursorPosition,
      scrollPosition,
      selections,
      fileName: fileName || '새 파일',
      filePath: filePath || '',
      tabId,
      type,
      tags
    };
    
    // 스냅샷 추가
    setTimelineSnapshots(prev => [...prev, newSnapshot]);
    
    // 마지막 스냅샷 시간 업데이트
    if (type === SnapshotType.AUTO) {
      setLastSnapshotTime(now);
    }
    
    // 활성 스냅샷 인덱스 업데이트
    const newIndex = timelineSnapshots.length;
    setActiveSnapshotIndex(newIndex);
    
    // 로컬 스토리지에 스냅샷 저장 (비동기)
    saveSnapshotsToStorage();
    
    return newSnapshot;
  }, [timelineSnapshots, lastSnapshotTime]);

  // 스냅샷 복원 함수
  const restoreSnapshot = useCallback((index: number) => {
    if (index < 0 || index >= timelineSnapshots.length) return null;
    
    // 활성 스냅샷 인덱스 업데이트
    setActiveSnapshotIndex(index);
    
    return timelineSnapshots[index];
  }, [timelineSnapshots]);

  // 스냅샷 삭제 함수
  const deleteSnapshot = useCallback((index: number) => {
    if (index < 0 || index >= timelineSnapshots.length) return;
    
    setTimelineSnapshots(prev => {
      const newSnapshots = [...prev];
      newSnapshots.splice(index, 1);
      
      // 로컬 스토리지에 변경사항 저장 (비동기)
      setTimeout(() => saveSnapshotsToStorage(), 0);
      
      return newSnapshots;
    });
    
    // 활성 스냅샷 인덱스 조정
    if (activeSnapshotIndex === index) {
      setActiveSnapshotIndex(Math.max(0, index - 1));
    } else if (activeSnapshotIndex > index) {
      setActiveSnapshotIndex(activeSnapshotIndex - 1);
    }
  }, [timelineSnapshots, activeSnapshotIndex]);

  // 스냅샷 내보내기 함수
  const exportSnapshot = useCallback(async (index: number) => {
    if (index < 0 || index >= timelineSnapshots.length) return;
    
    const snapshot = timelineSnapshots[index];
    
    try {
      // 저장 대화상자 표시
      const savePath = await save({
        filters: [{
          name: 'G-code',
          extensions: ['gcode', 'nc', 'ngc', 'tap']
        }],
        defaultPath: snapshot.fileName
      });
      
      if (savePath) {
        await writeTextFile(savePath, snapshot.content);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('스냅샷 내보내기 오류:', error);
      return false;
    }
  }, [timelineSnapshots]);

  // 특정 탭의 스냅샷 가져오기
  const getTabSnapshots = useCallback((tabId: string) => {
    return timelineSnapshots.filter(snapshot => snapshot.tabId === tabId);
  }, [timelineSnapshots]);

  // 스냅샷 가져오기 함수
  const importSnapshot = useCallback(async () => {
    try {
      // 파일 선택 대화상자 표시
      const filePath = await open({
        filters: [{
          name: 'G-code',
          extensions: ['gcode', 'nc', 'ngc', 'tap']
        }]
      });
      
      if (!filePath || Array.isArray(filePath)) return null;
      
      // 파일 내용 읽기
      const content = await readTextFile(filePath as string);
      
      // 파일 이름 추출
      const fileName = (filePath as string).split(/[/\\]/).pop() || '가져온 파일';
      
      // 새 스냅샷 생성
      return createSnapshot(
        `가져온 파일: ${fileName}`,
        content,
        fileName,
        filePath as string,
        `import-${Date.now()}`,
        undefined,
        SnapshotType.MANUAL,
        ['imported']
      );
    } catch (error) {
      console.error('스냅샷 가져오기 오류:', error);
      return null;
    }
  }, [createSnapshot]);

  // 스냅샷 비교 함수
  const compareSnapshots = useCallback((index1: number, index2: number) => {
    if (index1 < 0 || index1 >= timelineSnapshots.length || 
        index2 < 0 || index2 >= timelineSnapshots.length) {
      return null;
    }
    
    const snapshot1 = timelineSnapshots[index1];
    const snapshot2 = timelineSnapshots[index2];
    
    // 간단한 차이점 계산 (실제로는 더 정교한 diff 알고리즘 사용 가능)
    const lines1 = snapshot1.content.split('\n');
    const lines2 = snapshot2.content.split('\n');
    
    const diffLines: string[] = [];
    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLines; i++) {
      if (i >= lines1.length) {
        diffLines.push(`+ ${lines2[i]}`);
      } else if (i >= lines2.length) {
        diffLines.push(`- ${lines1[i]}`);
      } else if (lines1[i] !== lines2[i]) {
        diffLines.push(`- ${lines1[i]}`);
        diffLines.push(`+ ${lines2[i]}`);
      }
    }
    
    return diffLines.join('\n');
  }, [timelineSnapshots]);

  // 로컬 스토리지에 스냅샷 저장
  const saveSnapshotsToStorage = useCallback(async () => {
    try {
      // 앱 로컬 데이터 디렉토리 가져오기
      const appDataDir = await appLocalDataDir();
      const snapshotsDir = `${appDataDir}snapshots`;
      
      // 디렉토리가 없으면 생성
      const dirExists = await exists(snapshotsDir);
      if (!dirExists) {
        await createDir(snapshotsDir, { recursive: true });
      }
      
      // 스냅샷 데이터 저장
      const snapshotsData = JSON.stringify(timelineSnapshots);
      await writeTextFile(`${snapshotsDir}/snapshots.json`, snapshotsData);
      
      return true;
    } catch (error) {
      console.error('스냅샷 저장 오류:', error);
      return false;
    }
  }, [timelineSnapshots]);

  // 로컬 스토리지에서 스냅샷 로드
  const loadSnapshotsFromStorage = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // 앱 로컬 데이터 디렉토리 가져오기
      const appDataDir = await appLocalDataDir();
      const snapshotsDir = `${appDataDir}snapshots`;
      const snapshotsFile = `${snapshotsDir}/snapshots.json`;
      
      // 파일이 존재하는지 확인
      const fileExists = await exists(snapshotsFile);
      if (!fileExists) {
        setIsLoading(false);
        return false;
      }
      
      // 스냅샷 데이터 로드
      const snapshotsData = await readTextFile(snapshotsFile);
      const loadedSnapshots = JSON.parse(snapshotsData) as EnhancedTimelineSnapshot[];
      
      // 날짜 객체로 변환
      loadedSnapshots.forEach(snapshot => {
        snapshot.timestamp = new Date(snapshot.timestamp);
      });
      
      setTimelineSnapshots(loadedSnapshots);
      
      // 활성 스냅샷 인덱스 설정
      if (loadedSnapshots.length > 0) {
        setActiveSnapshotIndex(loadedSnapshots.length - 1);
      }
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('스냅샷 로드 오류:', error);
      setIsLoading(false);
      return false;
    }
  }, []);

  // 컴포넌트 마운트 시 로컬 스토리지에서 스냅샷 로드
  useEffect(() => {
    loadSnapshotsFromStorage();
  }, [loadSnapshotsFromStorage]);

  // 스냅샷 정리 함수 (오래된 자동 스냅샷 제거)
  const cleanupSnapshots = useCallback((maxAutoSnapshots: number = 50) => {
    // 자동 스냅샷만 필터링
    const autoSnapshots = timelineSnapshots.filter(
      snapshot => snapshot.type === SnapshotType.AUTO
    );
    
    // 자동 스냅샷이 최대 개수를 초과하는 경우
    if (autoSnapshots.length > maxAutoSnapshots) {
      // 시간순으로 정렬
      autoSnapshots.sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
      
      // 삭제할 스냅샷 ID 목록
      const snapshotsToRemove = autoSnapshots
        .slice(0, autoSnapshots.length - maxAutoSnapshots)
        .map(snapshot => snapshot.id);
      
      // 스냅샷 제거
      setTimelineSnapshots(prev => 
        prev.filter(snapshot => !snapshotsToRemove.includes(snapshot.id))
      );
      
      // 로컬 스토리지에 변경사항 저장 (비동기)
      setTimeout(() => saveSnapshotsToStorage(), 0);
      
      return snapshotsToRemove.length;
    }
    
    return 0;
  }, [timelineSnapshots, saveSnapshotsToStorage]);

  // 모든 스냅샷 지우기
  const clearAllSnapshots = useCallback(() => {
    setTimelineSnapshots([]);
    setActiveSnapshotIndex(-1);
    
    // 로컬 스토리지에 변경사항 저장 (비동기)
    setTimeout(() => saveSnapshotsToStorage(), 0);
  }, [saveSnapshotsToStorage]);

  // 특정 탭의 스냅샷 지우기
  const clearTabSnapshots = useCallback((tabId: string) => {
    setTimelineSnapshots(prev => prev.filter(snapshot => snapshot.tabId !== tabId));
    
    // 활성 스냅샷 인덱스 재설정
    setActiveSnapshotIndex(-1);
    
    // 로컬 스토리지에 변경사항 저장 (비동기)
    setTimeout(() => saveSnapshotsToStorage(), 0);
  }, [saveSnapshotsToStorage]);

  // snapshots 속성 추가 (timelineSnapshots의 별칭)
  const snapshots = timelineSnapshots;

  return {
    timelineSnapshots,
    snapshots,
    snapshotGroups,
    activeSnapshotIndex,
    isLoading,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    exportSnapshot,
    importSnapshot,
    getTabSnapshots,
    compareSnapshots,
    saveSnapshotsToStorage,
    loadSnapshotsFromStorage,
    cleanupSnapshots,
    clearAllSnapshots,
    clearTabSnapshots,
    setTimelineSnapshots,
    setActiveSnapshotIndex,
    SnapshotType
  };
}; 