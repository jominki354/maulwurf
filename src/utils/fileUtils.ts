import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';
import { open, save } from '@tauri-apps/api/dialog';
import { FileTab } from '../types';

// 드라이브 이름 포맷팅 함수
export const formatDrivePath = (path: string): string => {
  // 윈도우 드라이브 경로 포맷팅 (예: C: -> C 드라이브)
  return path.replace(/^([A-Z]):/, '$1 드라이브');
};

// 파일 확장자에 따른 아이콘 클래스 반환
export const getFileIconClass = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'nc':
    case 'ncl':
    case 'iso':
    case 'ncf':
    case 'gcode':
    case 'ngc':
    case 'tap':
      return 'file-icon gcode-icon';
    case 'txt':
      return 'file-icon text-icon';
    case 'pdf':
      return 'file-icon pdf-icon';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
      return 'file-icon image-icon';
    default:
      return 'file-icon default-icon';
  }
};

// 파일 저장 대화상자 필터
export const getFileFilters = () => [
  {
    name: 'ISO 밀링 파일',
    extensions: ['nc', 'ncl', 'iso', 'ncf']
  },
  {
    name: 'G-code 파일',
    extensions: ['gcode', 'ngc', 'tap']
  },
  {
    name: '모든 파일',
    extensions: ['*']
  }
];

// 파일 열기
export const openFile = async (filePath: string): Promise<string> => {
  try {
    return await readTextFile(filePath);
  } catch (error) {
    console.error('파일 열기 오류:', error);
    throw error;
  }
};

// 파일 저장
export const saveFile = async (filePath: string, content: string): Promise<void> => {
  try {
    await writeTextFile(filePath, content);
  } catch (error) {
    console.error('파일 저장 오류:', error);
    throw error;
  }
};

// 파일 저장 대화상자 표시
export const showSaveDialog = async () => {
  return await save({
    filters: getFileFilters()
  });
};

// 파일 열기 대화상자 표시
export const showOpenDialog = async () => {
  return await open({
    multiple: false,
    filters: getFileFilters()
  });
};

// 폴더 열기 대화상자 표시
export const showOpenFolderDialog = async () => {
  return await open({
    directory: true,
    multiple: false
  });
};

// 파일 이름 추출
export const extractFileName = (filePath: string): string => {
  return filePath.split(/[/\\]/).pop() || '새 파일';
};

// 새 탭 생성
export const createNewTab = (): FileTab => {
  const newTabId = `tab-${Date.now()}`;
  return {
    id: newTabId,
    title: '새 파일',
    path: null,
    content: '',
    isModified: false,
    timelineSnapshots: []
  };
}; 