import { useState, useCallback, useEffect } from 'react';
import { readTextFile, writeTextFile, readDir, copyFile, removeFile, renameFile } from '@tauri-apps/api/fs';
import { open, save } from '@tauri-apps/api/dialog';
import { getFileFilters, extractFileName, showOpenFolderDialog } from '../utils/fileUtils';
import { dirname } from '@tauri-apps/api/path';
import { listen } from '@tauri-apps/api/event';
import { watch } from 'tauri-plugin-fs-watch-api';

export const useFileSystem = () => {
  const [folderPath, setFolderPath] = useState<string>('');
  const [folderStructure, setFolderStructure] = useState<any[]>([]);
  const [hasParentFolder, setHasParentFolder] = useState<boolean>(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [lastOperation, setLastOperation] = useState<{type: string, path: string} | null>(null);
  const [fileWatcher, setFileWatcher] = useState<(() => void) | null>(null);
  const [isFileOperationInProgress, setIsFileOperationInProgress] = useState<boolean>(false);
  const [fileOperationDebounceTimer, setFileOperationDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // 폴더 구조 가져오기
  const fetchFolderStructure = useCallback(async (path: string = folderPath) => {
    // 경로가 없으면 현재 폴더 경로 사용
    const targetPath = path || folderPath;
    if (!targetPath) return;

    try {
      console.log(`디렉토리 읽기 시도: ${targetPath}`);
      const entries = await readDir(targetPath, { recursive: false });
      console.log(`디렉토리 읽기 성공: ${targetPath} (항목 수: ${entries.length})`);
      
      // 항목 정렬 (폴더 먼저, 그 다음 파일)
      const sortedEntries = [...entries].sort((a, b) => {
        if (a.children && !b.children) return -1;
        if (!a.children && b.children) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      
      setFolderStructure(sortedEntries);
      setFolderPath(targetPath);
      
      // 상위 폴더 존재 여부 확인
      // 윈도우 드라이브 루트 경로 확인 (예: C:\, D:\ 등)
      const isWindowsDriveRoot = /^[A-Za-z]:[\\/]?$/.test(targetPath);
      // 리눅스/맥 루트 경로 확인
      const isUnixRoot = targetPath === '/';
      
      // 루트 경로가 아닌 경우에만 상위 폴더가 있음
      setHasParentFolder(!isWindowsDriveRoot && !isUnixRoot);
    } catch (error) {
      console.error('폴더 접근 오류:', error);
      setFolderStructure([]);
    }
  }, [folderPath]);

  // 폴더 구조 로드
  const loadFolderStructure = useCallback(async (path?: string) => {
    // 경로가 없으면 현재 폴더 경로 사용
    const targetPath = path || folderPath;
    if (!targetPath) return;
    
    try {
      console.log(`폴더 구조 로드 시작: ${targetPath}`);
      await fetchFolderStructure(targetPath);
      console.log(`폴더 구조 로드 완료: ${targetPath}`);
    } catch (error) {
      console.error('폴더 구조 로드 오류:', error);
    }
  }, [fetchFolderStructure, folderPath]);

  // 상위 폴더 경로 가져오기
  const getParentFolderPath = useCallback(async (path: string): Promise<string | null> => {
    if (!path) return null;
    
    try {
      // Tauri API를 사용하여 상위 디렉토리 경로 가져오기
      const parentPath = await dirname(path);
      
      // 현재 경로와 상위 경로가 같으면 루트로 간주
      if (parentPath === path) {
        return null;
      }
      
      return parentPath;
    } catch (error) {
      console.error('상위 폴더 경로 가져오기 오류:', error);
      return null;
    }
  }, []);

  // 상위 폴더로 이동
  const navigateToParentFolder = useCallback(async () => {
    if (!folderPath || !hasParentFolder) return;
    
    try {
      const parentPath = await getParentFolderPath(folderPath);
      if (parentPath) {
        await fetchFolderStructure(parentPath);
      }
    } catch (error) {
      console.error('상위 폴더 이동 오류:', error);
    }
  }, [folderPath, hasParentFolder, getParentFolderPath, fetchFolderStructure]);

  // 폴더 열기
  const handleOpenFolder = useCallback(async (path: string) => {
    try {
      setFolderPath(path);
      await fetchFolderStructure(path);
    } catch (error) {
      console.error('폴더 접근 오류:', error);
    }
  }, [fetchFolderStructure]);

  // 폴더 선택 대화상자 표시
  const handleBrowseFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false
      });
      
      if (selected) {
        await handleOpenFolder(selected as string);
      }
    } catch (error) {
      console.error('폴더 선택 오류:', error);
    }
  }, [handleOpenFolder]);

  // 폴더 열기 대화상자 표시
  const showOpenFolderDialog = useCallback(async () => {
    const result = await open({
      directory: true,
      multiple: false
    });
    
    // 문자열 배열이 아닌 단일 문자열 반환
    if (Array.isArray(result)) {
      return result[0];
    }
    return result;
  }, []);

  // 파일 열기
  const openFile = useCallback(async (filePath: string): Promise<string> => {
    try {
      return await readTextFile(filePath);
    } catch (error) {
      console.error('파일 열기 오류:', error);
      throw error;
    }
  }, []);

  // 파일 저장
  const saveFile = useCallback(async (filePath: string, content: string): Promise<void> => {
    try {
      await writeTextFile(filePath, content);
    } catch (error) {
      console.error('파일 저장 오류:', error);
      throw error;
    }
  }, []);

  // 파일 저장 대화상자 표시
  const showSaveDialog = useCallback(async () => {
    return await save({
      filters: getFileFilters()
    });
  }, []);

  // 파일 열기 대화상자 표시
  const showOpenDialog = useCallback(async () => {
    const result = await open({
      multiple: false,
      filters: getFileFilters()
    });
    
    // 문자열 배열이 아닌 단일 문자열 반환
    if (Array.isArray(result)) {
      return result[0];
    }
    return result;
  }, []);

  // 파일 시스템 작업 후 폴더 구조 새로고침을 위한 이벤트 리스너
  useEffect(() => {
    // 파일 시스템 작업이 완료되면 폴더 구조 새로고침
    if (lastOperation && folderPath) {
      console.log(`파일 시스템 작업 감지: ${lastOperation.type} - ${lastOperation.path}`);
      
      // 작업 경로가 현재 폴더 내에 있는지 확인
      const isInCurrentFolder = lastOperation.path.startsWith(folderPath) || 
                               (lastOperation.type === 'delete' && lastOperation.path.startsWith(folderPath));
      
      if (isInCurrentFolder) {
        console.log('현재 폴더 내 파일 시스템 변경 감지, 폴더 구조 새로고침');
        loadFolderStructure();
      }
      
      setLastOperation(null);
    }
  }, [lastOperation, folderPath, loadFolderStructure]);

  // 외부 도구에 의한 파일 시스템 변경 감지
  useEffect(() => {
    // 이전 파일 감시자 정리
    return () => {
      if (fileWatcher) {
        fileWatcher();
      }
    };
  }, [fileWatcher]);

  // 폴더 경로가 변경될 때마다 파일 감시자 설정
  useEffect(() => {
    const setupWatcher = async () => {
      // 이전 감시자 정리
      if (fileWatcher) {
        fileWatcher();
      }

      if (!folderPath) return;

      try {
        console.log(`폴더 감시 시작: ${folderPath}`);
        
        // 폴더 변경 감시 설정
        const stopWatching = await watch(folderPath, (event) => {
          console.log('파일 시스템 변경 감지:', event);
          
          // 파일 작업 중에는 폴더 구조 새로고침 건너뛰기
          if (isFileOperationInProgress) {
            console.log('파일 작업 중이므로 폴더 구조 새로고침 건너뜀');
            return;
          }
          
          // 폴더 구조 새로고침
          loadFolderStructure();
        }, { recursive: true });
        
        setFileWatcher(() => stopWatching);
        console.log('파일 시스템 감시자 설정 완료');
      } catch (error) {
        console.error('파일 시스템 감시자 설정 오류:', error);
      }
    };

    setupWatcher();
  }, [folderPath, loadFolderStructure, isFileOperationInProgress]);

  // 파일 작업 시작/종료 처리 함수
  const startFileOperation = useCallback(() => {
    setIsFileOperationInProgress(true);
    
    // 이전 타이머가 있으면 취소
    if (fileOperationDebounceTimer) {
      clearTimeout(fileOperationDebounceTimer);
    }
  }, [fileOperationDebounceTimer]);
  
  const endFileOperation = useCallback(() => {
    // 파일 작업 종료 후 일정 시간 후에 상태 변경 (디바운싱)
    const timer = setTimeout(() => {
      setIsFileOperationInProgress(false);
      console.log('파일 작업 종료, 감시자 재활성화');
    }, 1000); // 1초 후에 감시자 재활성화
    
    setFileOperationDebounceTimer(timer);
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 파일 복사
  const copyFileToDestination = useCallback(async (sourcePath: string, destinationPath: string): Promise<boolean> => {
    try {
      // 파일 작업 시작 - 감시자 일시 중지
      startFileOperation();
      
      // 경로 구분자 통일 (Windows에서는 백슬래시를 사용하도록)
      const normalizedDestPath = destinationPath.replace(/\//g, '\\');
      
      // 대상 파일이 이미 존재하는지 확인하고 삭제
      try {
        // 파일이 존재하는지 확인하기 위해 읽기 시도
        await readTextFile(normalizedDestPath);
        // 파일이 존재하면 삭제
        await removeFile(normalizedDestPath);
        console.log('기존 파일 삭제:', normalizedDestPath);
      } catch (error) {
        // 파일이 존재하지 않으면 무시 (오류는 예상된 것)
        console.log('대상 경로에 파일이 없음, 계속 진행');
      }
      
      // 약간의 지연 후 복사 시도
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await copyFile(sourcePath, normalizedDestPath);
      console.log('파일 복사 완료:', sourcePath, '->', normalizedDestPath);
      
      // 파일 시스템 작업 기록
      setLastOperation({type: 'copy', path: normalizedDestPath});
      
      // 현재 폴더 구조 새로고침
      if (folderPath) {
        console.log('폴더 구조 새로고침 시작');
        await loadFolderStructure();
        console.log('폴더 구조 새로고침 완료');
      }
      
      // 파일 작업 종료 - 감시자 재활성화
      endFileOperation();
      
      return true;
    } catch (error) {
      console.error('파일 복사 오류:', error);
      
      // 파일 작업 종료 - 감시자 재활성화
      endFileOperation();
      
      return false;
    }
  }, [folderPath, loadFolderStructure, startFileOperation, endFileOperation]);

  // 파일 삭제
  const deleteFile = useCallback(async (filePath: string): Promise<boolean> => {
    try {
      // 파일 작업 시작 - 감시자 일시 중지
      startFileOperation();
      
      await removeFile(filePath);
      console.log('파일 삭제 완료:', filePath);
      
      // 파일 시스템 작업 기록
      setLastOperation({type: 'delete', path: filePath});
      
      // 현재 폴더 구조 새로고침
      if (folderPath) {
        console.log('폴더 구조 새로고침 시작');
        await loadFolderStructure();
        console.log('폴더 구조 새로고침 완료');
      }
      
      // 파일 작업 종료 - 감시자 재활성화
      endFileOperation();
      
      return true;
    } catch (error) {
      console.error('파일 삭제 오류:', error);
      
      // 파일 작업 종료 - 감시자 재활성화
      endFileOperation();
      
      return false;
    }
  }, [folderPath, loadFolderStructure, startFileOperation, endFileOperation]);

  // 파일 이름 변경
  const renameFileOrFolder = useCallback(async (oldPath: string, newPath: string): Promise<boolean> => {
    try {
      // 파일 작업 시작 - 감시자 일시 중지
      startFileOperation();
      
      await renameFile(oldPath, newPath);
      console.log('파일 이름 변경 완료:', oldPath, '->', newPath);
      
      // 파일 시스템 작업 기록
      setLastOperation({type: 'rename', path: newPath});
      
      // 현재 폴더 구조 새로고침
      if (folderPath) {
        console.log('폴더 구조 새로고침 시작');
        await loadFolderStructure();
        console.log('폴더 구조 새로고침 완료');
      }
      
      // 파일 작업 종료 - 감시자 재활성화
      endFileOperation();
      
      return true;
    } catch (error) {
      console.error('파일 이름 변경 오류:', error);
      
      // 파일 작업 종료 - 감시자 재활성화
      endFileOperation();
      
      return false;
    }
  }, [folderPath, loadFolderStructure, startFileOperation, endFileOperation]);

  return {
    folderPath,
    folderStructure,
    hasParentFolder,
    selectedFilePath,
    setSelectedFilePath,
    loadFolderStructure,
    openFolder: handleOpenFolder,
    showOpenFolderDialog,
    handleBrowseFolder,
    openFile,
    saveFile,
    showSaveDialog,
    showOpenDialog,
    navigateToParentFolder,
    getParentFolderPath,
    copyFileToDestination,
    deleteFile,
    renameFileOrFolder
  };
}; 