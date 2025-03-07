import { useState, useCallback } from 'react';
import { readTextFile, writeTextFile, readDir } from '@tauri-apps/api/fs';
import { open, save } from '@tauri-apps/api/dialog';
import { getFileFilters, extractFileName, showOpenFolderDialog } from '../utils/fileUtils';

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
      const pathParts = path.split(/[/\\]/);
      setHasParentFolder(pathParts.length > 1);
    } catch (error) {
      console.error('폴더 접근 오류:', error);
      setFolderStructure([]);
    }
  }, [folderPath]);

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

  // 상위 폴더로 이동
  const navigateToParentFolder = useCallback(async () => {
    if (!folderPath) return;
    
    const pathParts = folderPath.split(/[/\\]/);
    if (pathParts.length <= 1) return;
    
    pathParts.pop();
    const parentPath = pathParts.join('/');
    await handleOpenFolder(parentPath);
  }, [folderPath, handleOpenFolder]);

  // 폴더 구조 로드
  const loadFolderStructure = useCallback(async (path: string) => {
    if (!path) return;
    
    try {
      await fetchFolderStructure(path);
    } catch (error) {
      console.error('폴더 구조 로드 오류:', error);
    }
  }, [fetchFolderStructure]);

  return {
    folderPath,
    folderStructure,
    hasParentFolder,
    selectedFilePath,
    fetchFolderStructure,
    handleOpenFolder,
    handleBrowseFolder,
    openFile,
    saveFile,
    showSaveDialog,
    showOpenDialog,
    showOpenFolderDialog,
    navigateToParentFolder,
    loadFolderStructure,
    setSelectedFilePath
  };
}; 