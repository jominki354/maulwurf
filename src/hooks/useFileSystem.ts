import { useState, useCallback } from 'react';
import { readTextFile, writeTextFile, readDir, copyFile, removeFile, renameFile } from '@tauri-apps/api/fs';
import { open, save } from '@tauri-apps/api/dialog';
import { getFileFilters, extractFileName, showOpenFolderDialog } from '../utils/fileUtils';
import { dirname } from '@tauri-apps/api/path';

export const useFileSystem = () => {
  const [folderPath, setFolderPath] = useState<string>('');
  const [folderStructure, setFolderStructure] = useState<any[]>([]);
  const [hasParentFolder, setHasParentFolder] = useState<boolean>(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  // 폴더 구조 가져오기
  const fetchFolderStructure = useCallback(async (path: string = folderPath) => {
    if (!path) return;

    try {
      console.log(`디렉토리 읽기 시도: ${path}`);
      const entries = await readDir(path, { recursive: false });
      console.log(`디렉토리 읽기 성공: ${path} (항목 수: ${entries.length})`);
      
      // 항목 정렬 (폴더 먼저, 그 다음 파일)
      const sortedEntries = [...entries].sort((a, b) => {
        if (a.children && !b.children) return -1;
        if (!a.children && b.children) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      
      setFolderStructure(sortedEntries);
      setFolderPath(path);
      
      // 상위 폴더 존재 여부 확인
      // 윈도우 드라이브 루트 경로 확인 (예: C:\, D:\ 등)
      const isWindowsDriveRoot = /^[A-Za-z]:[\\/]?$/.test(path);
      // 리눅스/맥 루트 경로 확인
      const isUnixRoot = path === '/';
      
      // 루트 경로가 아닌 경우에만 상위 폴더가 있음
      setHasParentFolder(!isWindowsDriveRoot && !isUnixRoot);
    } catch (error) {
      console.error('폴더 접근 오류:', error);
      setFolderStructure([]);
    }
  }, [folderPath]);

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

  // 폴더 구조 로드
  const loadFolderStructure = useCallback(async (path: string) => {
    if (!path) return;
    
    try {
      await fetchFolderStructure(path);
    } catch (error) {
      console.error('폴더 구조 로드 오류:', error);
    }
  }, [fetchFolderStructure]);

  // 파일 복사
  const copyFileToDestination = useCallback(async (sourcePath: string, destinationPath: string): Promise<boolean> => {
    try {
      await copyFile(sourcePath, destinationPath);
      return true;
    } catch (error) {
      console.error('파일 복사 오류:', error);
      return false;
    }
  }, []);

  // 파일 삭제
  const deleteFile = useCallback(async (filePath: string): Promise<boolean> => {
    try {
      await removeFile(filePath);
      return true;
    } catch (error) {
      console.error('파일 삭제 오류:', error);
      return false;
    }
  }, []);

  // 파일 이름 변경
  const renameFileOrFolder = useCallback(async (oldPath: string, newPath: string): Promise<boolean> => {
    try {
      await renameFile(oldPath, newPath);
      return true;
    } catch (error) {
      console.error('파일 이름 변경 오류:', error);
      return false;
    }
  }, []);

  return {
    folderPath,
    folderStructure,
    hasParentFolder,
    selectedFilePath,
    setSelectedFilePath,
    loadFolderStructure: fetchFolderStructure,
    openFolder: handleOpenFolder,
    showOpenFolderDialog,
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