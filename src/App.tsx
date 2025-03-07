import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { open, save } from '@tauri-apps/api/dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';
import { invoke } from '@tauri-apps/api/tauri';
import './App.css';
import { createNewTab, FileTab, TimelineSnapshot } from './components/tabUtils';
import { log, LogLevel, logError } from './components/logger';

// G코드 확장자 목록
// const GCODE_EXTENSIONS = ['gcode', 'nc', 'ngc', 'ncl', 'iso', 'ncf', 'cnc', 'tap', 'txt', 'mpt'];

// G코드 명령어 정규식 패턴
// const GCODE_PATTERNS = {
//   movement: /\b(G0|G00|G1|G01|G2|G02|G3|G03)\b/g,
//   settings: /\b(G20|G21|G28|G90|G91|G92|G94|G95)\b/g,
//   spindle: /\b(M3|M03|M4|M04|M5|M05|S\d+)\b/g,
//   coolant: /\b(M7|M07|M8|M08|M9|M09)\b/g,
//   toolChange: /\b(M6|M06|T\d+)\b/g,
//   coordinates: /\b([XYZ])-?\d+\.?\d*/g,
//   feedRate: /\b(F)-?\d+\.?\d*/g,
//   comments: /\(.*?\)|\;.*/g,
// };

// 폰트 옵션
const FONT_OPTIONS = [
  'Consolas',
  'Courier New',
  'Lucida Console',
  'Monaco',
  'Menlo',
  'Source Code Pro',
  'Fira Code',
  'Roboto Mono',
  'Ubuntu Mono',
  'Nanum Gothic Coding',
  'D2Coding',
  'Noto Sans KR',
];

// 시스템 폰트 가져오기 함수 삭제

// 토스트 메시지 인터페이스
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  removing?: boolean;
}

// 로그 메시지 인터페이스
interface LogMessage {
  level: string;
  message: string;
  timestamp: string;
}

function App() {
  const [gcode, setGcode] = useState<string>('');
  const [fileName, setFileName] = useState<string>('새 파일');
  const [filePath, setFilePath] = useState<string>('');
  // const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState<boolean>(true);
  // const [editorReady, setEditorReady] = useState<boolean>(false);
  const [fontFamily, setFontFamily] = useState<string>('Consolas');
  const [fontSize, setFontSize] = useState<number>(18);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('off');
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(true);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
  const [folderStructure, setFolderStructure] = useState<any[]>([]);
  // const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [showFolderPanel, setShowFolderPanel] = useState<boolean>(true);
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(true);
  const [folderPath, setFolderPath] = useState<string>('');  // 빈 문자열로 초기화하여 자동 로드 방지
  const [systemFonts, setSystemFonts] = useState<string[]>(FONT_OPTIONS);
  const [searchFontTerm, setSearchFontTerm] = useState<string>('');
  const [timelineSnapshots, setTimelineSnapshots] = useState<TimelineSnapshot[]>([]);
  const [activeSnapshotIndex, setActiveSnapshotIndex] = useState<number>(-1);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tabs, setTabs] = useState<FileTab[]>([
    {
      id: 'new-file',
      fileName: '새 파일',
      filePath: '',
      content: '',
      isModified: false,
      timelineSnapshots: []
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('new-file');
  const [hasParentFolder, setHasParentFolder] = useState<boolean>(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  
  const editorRef = useRef<any>(null);
  const editorChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // const monacoRef = useRef<Monaco | null>(null);

  // 메뉴 위치 계산을 위한 참조 추가
  // const fileMenuRef = useRef<HTMLDivElement>(null);
  // const editMenuRef = useRef<HTMLDivElement>(null);
  // const viewMenuRef = useRef<HTMLDivElement>(null);
  // const fontMenuRef = useRef<HTMLDivElement>(null);

  // 레이아웃 크기 조절을 위한 상태 변수
  const [folderPanelWidth, setFolderPanelWidth] = useState(250);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  
  // 크기 조절 참조
  const folderPanelResizeRef = useRef<HTMLDivElement>(null);
  const bottomPanelResizeRef = useRef<HTMLDivElement>(null);
  
  // 드래그 상태
  const [isDraggingFolderPanel, setIsDraggingFolderPanel] = useState(false);
  const [isDraggingBottomPanel, setIsDraggingBottomPanel] = useState(false);
  // const [startX, setStartX] = useState(0);
  // const [startY, setStartY] = useState(0);

  // 드라이브 이름 포맷팅 함수
  const formatDrivePath = (path: string): string => {
    // 윈도우 드라이브 경로 포맷팅 (예: C: -> C 드라이브)
    return path.replace(/^([A-Z]):/, '$1 드라이브');
  };

  // 에디터 초기화 완료 핸들러
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    console.log("Editor mounted successfully");
    editorRef.current = editor;
    // setEditorReady(true);
    
    // 다크 테마 적용
    monaco.editor.defineTheme('gcode-theme-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'gcode.movement', foreground: '4FC1FF', fontStyle: 'bold' },
        { token: 'gcode.settings', foreground: 'C586C0' },
        { token: 'gcode.spindle', foreground: 'DCDCAA' },
        { token: 'gcode.coolant', foreground: '4EC9B0' },
        { token: 'gcode.toolchange', foreground: 'CE9178' },
        { token: 'gcode.coordinates', foreground: 'B5CEA8' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorCursor.foreground': '#AEAFAD',
        'editor.lineHighlightBackground': '#2D2D30',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorIndentGuide.background': '#404040',
      }
    });
    
    monaco.editor.setTheme('gcode-theme-dark');
    
    // G코드 언어 정의
    monaco.languages.register({ id: 'gcode' });
    
    // G코드 구문 강조 설정
    monaco.languages.setMonarchTokensProvider('gcode', {
      tokenizer: {
        root: [
          [/;.*$/, 'comment'],
          [/\b(G0|G00|G1|G01|G2|G02|G3|G03)\b/, 'gcode.movement'],
          [/\b(G20|G21|G28|G90|G91|G92|G94|G95)\b/, 'gcode.settings'],
          [/\b(M3|M03|M4|M04|M5|M05|S\d+)\b/, 'gcode.spindle'],
          [/\b(M7|M07|M8|M08|M9|M09)\b/, 'gcode.coolant'],
          [/\b(M6|M06|T\d+)\b/, 'gcode.toolchange'],
          [/\b([XYZ])-?\d+\.?\d*/, 'gcode.coordinates'],
          [/-?\d+\.?\d*/, 'number'],
        ]
      }
    });
  };

  // 현재 활성 탭 가져오기
  // const getActiveTab = (): FileTab => {
  //   return tabs.find(tab => tab.id === activeTabId) || tabs[0];
  // };

  // 탭 내용 업데이트
  const updateTabContent = (tabId: string, content: string) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === tabId 
          ? { ...tab, content, isModified: tab.filePath ? true : false } 
          : tab
      )
    );
  };

  // 에디터 내용 변경 핸들러 최적화
  const handleEditorChange = useCallback((value: string | undefined) => {
    console.log("Editor change triggered", { valueLength: value?.length });
    
    // 이전 타이머 취소
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    
    // 새 타이머 설정 (300ms 디바운스)
    debounceTimerRef.current = window.setTimeout(() => {
      const newValue = value || '';
      setGcode(newValue);
      
      // 현재 활성 탭 업데이트
      updateTabContent(activeTabId, newValue);
      
      // 코드 유효성 검사 - 단순 뷰어 역할에서는 필요 없음
      // validateGcode(newValue);
      
      debounceTimerRef.current = null;
    }, 300);
  }, [activeTabId]);
  
  // 새 탭 생성 로직을 별도의 컴포넌트로 분리
  // export const createNewTab = (): FileTab => {
  //   const newTabId = `tab-${Date.now()}`;
  //   return {
  //     id: newTabId,
  //     filePath: '',
  //     content: '',
  //     isModified: false,
  //     timelineSnapshots: [],
  //     fileName: '새 탭',
  //   };
  // };

  // 탭 닫기
  const closeTab = (tabId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isModified) {
      const shouldClose = window.confirm('파일이 수정되었습니다. 저장하지 않고 닫으시겠습니까?');
      if (!shouldClose) return;
    }
    
    // 마지막 탭은 닫지 않고 새 파일로 초기화
    if (tabs.length === 1) {
      setTabs([{
        id: 'new-file',
        fileName: '새 파일',
        filePath: '',
        content: '',
        isModified: false,
        timelineSnapshots: []
      }]);
      setActiveTabId('new-file');
      setGcode('');
      setFileName('새 파일');
      setFilePath('');
      setTimelineSnapshots([]);
      setActiveSnapshotIndex(-1);
      return;
    }
    
    // 탭 제거
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    
    // 현재 활성 탭이 닫히는 경우 다른 탭으로 전환
    if (activeTabId === tabId) {
      const newActiveTab = newTabs[newTabs.length - 1];
      setActiveTabId(newActiveTab.id);
      setGcode(newActiveTab.content);
      setFileName(newActiveTab.fileName);
      setFilePath(newActiveTab.filePath);
      setTimelineSnapshots(newActiveTab.timelineSnapshots);
      setActiveSnapshotIndex(-1);
    }
  };

  // 탭 활성화
  const activateTab = (tabId: string) => {
    if (tabId === activeTabId) return;
    
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // 현재 탭의 상태 저장
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      setTabs(prevTabs => 
        prevTabs.map(t => 
          t.id === activeTabId 
            ? { ...t, content: gcode, timelineSnapshots } 
            : t
        )
      );
    }
    
    // 새 탭으로 전환
    setActiveTabId(tabId);
    setGcode(tab.content);
    setFileName(tab.fileName);
    setFilePath(tab.filePath);
    setTimelineSnapshots(tab.timelineSnapshots);
    setActiveSnapshotIndex(-1);
  };

  // G코드 검증 함수
  const validateGcode = useMemo(() => {
    return (code: string) => {
      const errors: string[] = [];
      const lines = code.split('\n');
      
      // 코드가 너무 길면 부분적으로만 검증
      const maxLinesToValidate = 1000;
      const linesToValidate = lines.length > maxLinesToValidate 
        ? lines.slice(0, maxLinesToValidate) 
        : lines;
      
      linesToValidate.forEach((line, index) => {
        // 주석 제거
        const cleanLine = line.replace(/\(.*?\)|\;.*/, '').trim();
        
        if (cleanLine.length === 0) return;
        
        // 잘못된 G코드 명령어 검사
        if (/G\d+/.test(cleanLine) && !/G[0-9]{1,3}/.test(cleanLine)) {
          errors.push(`라인 ${index + 1}: 잘못된 G코드 형식`);
        }
        
        // 잘못된 M코드 명령어 검사
        if (/M\d+/.test(cleanLine) && !/M[0-9]{1,3}/.test(cleanLine)) {
          errors.push(`라인 ${index + 1}: 잘못된 M코드 형식`);
        }
        
        // 좌표값 검사
        if (/[XYZ]-?\d*\.?\d*/.test(cleanLine)) {
          const coords = cleanLine.match(/[XYZ]-?\d*\.?\d*/g) || [];
          coords.forEach(coord => {
            if (!/[XYZ]-?\d+\.?\d*/.test(coord)) {
              errors.push(`라인 ${index + 1}: 잘못된 좌표값 ${coord}`);
            }
          });
        }
      });
      
      if (lines.length > maxLinesToValidate) {
        errors.push(`주의: 처음 ${maxLinesToValidate}줄만 검증되었습니다.`);
      }
      
      setValidationErrors(errors);
      setIsValid(errors.length === 0);
    };
  }, []);

  // 폴더 구조 가져오기 - 단순 뷰어 역할로 수정
  const fetchFolderStructure = async (path: string = folderPath) => {
    try {
      if (!path) return;
      
      // 상위 폴더 존재 여부 확인
      const pathParts = path.split(/[/\\]/);
      setHasParentFolder(pathParts.length > 1);
      
      // 폴더 내용 읽기
      const result = await invoke('read_dir', { path });
      
      // 윈도우 숨김 파일만 필터링
      const filteredResult = (result as any[]).filter(item => !item.hidden);
      
      // 폴더를 파일보다 위에 정렬
      const sortedResult = filteredResult.sort((a, b) => {
        // 폴더를 먼저 정렬
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        // 같은 타입이면 이름으로 정렬
        return a.name.localeCompare(b.name);
      });
      
      // 단순히 폴더 구조만 표시
      setFolderStructure(sortedResult);
      setFolderPath(path);
      
      // 로그만 남기고 다른 작업은 하지 않음
      await log(LogLevel.INFO, `폴더 내용 표시: ${formatDrivePath(path)}`);
    } catch (error) {
      console.error('폴더 구조 가져오기 오류:', error);
      setFolderStructure([]);
      showToast(`폴더 내용을 가져올 수 없습니다: ${error}`, 'error');
    }
  };

  // 폴더 열기 핸들러 - 단순 뷰어 역할로 수정
  const handleOpenFolder = async (path: string) => {
    try {
      // 단순히 폴더 경로 설정 및 내용 표시
      setFolderPath(path);
      await fetchFolderStructure(path);
      setHasParentFolder(path.length > 3); // 드라이브 루트가 아닌 경우 (예: "C:\" 보다 긴 경우)
      await log(LogLevel.INFO, `폴더 내용 표시: ${path}`);
    } catch (error) {
      console.error('폴더 접근 오류:', error);
      await logError(error as Error, `폴더 접근 오류: ${path}`);
      showToast(`폴더를 열 수 없습니다: ${error}`, 'error');
    }
  };

  // 폴더 선택 대화상자 표시 - 단순 뷰어 역할로 수정
  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '폴더 선택'
      });
      
      if (selected) {
        // 선택한 폴더 내용만 표시
        await handleOpenFolder(selected as string);
        await log(LogLevel.INFO, `폴더 선택됨: ${selected}`);
      }
    } catch (error) {
      console.error('폴더 선택 오류:', error);
      showToast(`폴더를 선택할 수 없습니다: ${error}`, 'error');
    }
  };

  // 히스토리에 변경 사항 추가
  const addToHistory = (change: string) => {
    setHistory(prev => [...prev, `${new Date().toLocaleTimeString()}: ${change}`]);
  };

  // 컴포넌트 마운트 시 관리자 권한 확인
  useEffect(() => {
    const checkAdminRights = async () => {
      try {
        const isAdmin = await invoke('check_admin');
        
        if (!isAdmin) {
          const shouldRestart = window.confirm(
            '관리자 권한이 필요합니다. 관리자 권한으로 다시 시작하시겠습니까?\n' +
            '(폴더 접근 권한 오류를 방지하기 위해 필요합니다.)'
          );
          
          if (shouldRestart) {
            await invoke('restart_with_admin');
          } else {
            addToHistory('경고: 관리자 권한 없이 실행 중입니다. 일부 폴더에 접근할 수 없을 수 있습니다.');
          }
        }
      } catch (error) {
        console.error('관리자 권한 확인 오류:', error);
      }
    };
    
    checkAdminRights();
  }, []);

  // 컴포넌트 마운트 시 폴더 구조 가져오기
  useEffect(() => {
    if (folderPath) {
      fetchFolderStructure();
    }
  }, [folderPath]);

  // 폴더 패널 토글
  const toggleFolderPanel = () => {
    setShowFolderPanel(!showFolderPanel);
  };

  // 히스토리 패널 토글
  const toggleHistoryPanel = () => {
    setShowHistoryPanel(!showHistoryPanel);
  };

  // 토스트 메시지 추가 함수
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 3000) => {
    const id = Date.now();
    const toast: Toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);
    
    // 지정된 시간 후 토스트 메시지 제거
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };
  
  // 토스트 메시지 제거 함수
  const removeToast = (id: number) => {
    // 애니메이션을 위해 removing 클래스 추가
    setToasts(prev => 
      prev.map(toast => 
        toast.id === id ? { ...toast, removing: true } : toast
      )
    );
    
    // 애니메이션 후 실제로 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 300);
  };

  // 파일 저장 함수
  const handleSaveFile = async () => {
    try {
      // 현재 열린 파일이 있는 경우 바로 저장
      if (filePath) {
        await writeTextFile(filePath, gcode);
        showToast(`파일 저장 완료: ${fileName}`, 'success');
        addToHistory(`파일 저장됨: ${fileName}`);
        
        // 탭 수정 상태 업데이트
        setTabs(prevTabs => 
          prevTabs.map(tab => 
            tab.id === activeTabId 
              ? { ...tab, isModified: false } 
              : tab
          )
        );
        
        // 타임라인 스냅샷 생성
        createSnapshot(`파일 저장: ${fileName}`);
        return;
      }
      
      // 새 파일인 경우 저장 대화상자 표시
      const savePath = await save({
        filters: [
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
        ]
      });
      
      if (savePath) {
        await writeTextFile(savePath, gcode);
        const newFileName = savePath.split(/[/\\]/).pop() || '새 파일';
        
        // 상태 업데이트
        setFilePath(savePath);
        setFileName(newFileName);
        
        // 탭 정보 업데이트
        setTabs(prevTabs => 
          prevTabs.map(tab => 
            tab.id === activeTabId 
              ? { 
                  ...tab, 
                  fileName: newFileName, 
                  filePath: savePath, 
                  isModified: false 
                } 
              : tab
          )
        );
        
        showToast(`파일 저장 완료: ${newFileName}`, 'success');
        addToHistory(`파일 저장됨: ${newFileName}`);
        
        // 타임라인 스냅샷 생성
        createSnapshot(`파일 저장: ${newFileName}`);
      }
    } catch (error) {
      console.error('파일 저장 오류:', error);
      showToast(`파일 저장 실패: ${error}`, 'error');
      addToHistory(`파일 저장 실패: ${error}`);
    }
  };

  // 새 파일 생성 핸들러
  const handleNewFile = () => {
    const newTab = createNewTab();
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
    setGcode('');
    setFileName(newTab.fileName);
    setFilePath('');
    setTimelineSnapshots([]);
    setActiveSnapshotIndex(-1);
  };

  // 메뉴 토글 함수
  const toggleMenu = (menuName: string) => {
    if (activeMenu === menuName) {
      setActiveMenu(null);
    } else {
      setActiveMenu(menuName);
    }
    // 메뉴 토글 시 다른 UI 요소 닫기
    setShowFindReplace(false);
  };

  // 메뉴 외부 클릭 시 닫기 이벤트 핸들러
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.menu-item') && !target.closest('.menu-dropdown')) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 찾기 및 바꾸기 토글
  const toggleFindReplace = () => {
    setShowFindReplace(!showFindReplace);
  };

  // 찾기 실행
  const handleFind = () => {
    if (!editorRef.current || !findText) return;
    
    const editor = editorRef.current;
    const selection = editor.getSelection();
    const searchParams = {
      searchString: findText,
      isRegex: false,
      matchCase: false,
      wholeWord: false,
      captureMatches: true
    };
    
    const matches = editor.getModel().findMatches(
      searchParams.searchString,
      true,
      searchParams.isRegex,
      searchParams.matchCase,
      searchParams.wholeWord,
      searchParams.captureMatches
    );
    
    if (matches.length > 0) {
      let currentMatchIndex = 0;
      
      // 현재 선택 영역 이후의 첫 번째 일치 항목 찾기
      if (selection) {
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i].range;
          if (match.startLineNumber > selection.startLineNumber || 
              (match.startLineNumber === selection.startLineNumber && 
               match.startColumn > selection.startColumn)) {
            currentMatchIndex = i;
            break;
          }
        }
      }
      
      const match = matches[currentMatchIndex].range;
      editor.setSelection(match);
      editor.revealRangeInCenter(match);
    }
  };

  // 모두 바꾸기 실행
  const handleReplaceAll = () => {
    if (!editorRef.current || !findText) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    const value = model.getValue();
    const newValue = value.replaceAll(findText, replaceText);
    
    model.setValue(newValue);
  };

  // 현재 선택 영역 바꾸기
  const handleReplace = () => {
    if (!editorRef.current || !findText) return;
    
    const editor = editorRef.current;
    const selection = editor.getSelection();
    
    if (selection && !selection.isEmpty()) {
      const selectedText = editor.getModel().getValueInRange(selection);
      
      if (selectedText === findText) {
        editor.executeEdits('replace', [{
          range: selection,
          text: replaceText
        }]);
        
        // 다음 일치 항목 찾기
        handleFind();
      } else {
        // 선택 영역이 찾는 텍스트와 일치하지 않으면 먼저 찾기 실행
        handleFind();
      }
    } else {
      // 선택 영역이 없으면 찾기 실행
      handleFind();
    }
  };

  // 줄 이동 핸들러
  const handleGoToLine = () => {
    const lineNumber = prompt('이동할 줄 번호를 입력하세요:');
    if (lineNumber && !isNaN(Number(lineNumber))) {
      const line = parseInt(lineNumber, 10);
      editorRef.current?.revealLineInCenter(line);
      editorRef.current?.setPosition({ lineNumber: line, column: 1 });
      editorRef.current?.focus();
    }
  };

  // 편집 메뉴 - 실행 취소
  const handleUndo = () => {
    if (editorRef.current) {
      editorRef.current.trigger('', 'undo', null);
    }
  };

  // 편집 메뉴 - 다시 실행
  const handleRedo = () => {
    if (editorRef.current) {
      editorRef.current.trigger('', 'redo', null);
    }
  };

  // 들여쓰기 추가
  const handleIndent = () => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    editor.trigger('', 'editor.action.indentLines', null);
  };

  // 들여쓰기 제거
  const handleOutdent = () => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    editor.trigger('', 'editor.action.outdentLines', null);
  };

  // 주석 토글
  const handleToggleComment = () => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    const selection = editor.getSelection();
    
    if (selection && !selection.isEmpty()) {
      const model = editor.getModel();
      const lines = [];
      
      for (let i = selection.startLineNumber; i <= selection.endLineNumber; i++) {
        lines.push(model.getLineContent(i));
      }
      
      const hasComment = lines.every(line => line.trimStart().startsWith(';'));
      const newLines = lines.map(line => {
        if (hasComment) {
          // 주석 제거
          return line.replace(/^\s*;/, '');
        } else {
          // 주석 추가
          return '; ' + line;
        }
      });
      
      const edits = [];
      for (let i = 0; i < newLines.length; i++) {
        const lineNumber = selection.startLineNumber + i;
        const range = {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: model.getLineMaxColumn(lineNumber)
        };
        
        edits.push({
          range: range,
          text: newLines[i]
        });
      }
      
      editor.executeEdits('toggle-comment', edits);
    }
  };

  // 파일 확장자에 따른 아이콘 반환
  const getFileIcon = (fileName: string): JSX.Element => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    // 파일 타입에 따른 아이콘 클래스 결정
    let iconClass = 'file-icon';
    let iconSymbol = '📄'; // 기본 문서 아이콘
    
    switch (extension) {
      case 'gcode':
      case 'nc':
      case 'ngc':
      case 'ncl':
      case 'iso':
      case 'ncf':
        iconClass += ' gcode';
        iconSymbol = '📝';
        break;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        iconClass += ' image';
        iconSymbol = '🖼️';
        break;
      case 'mp3':
      case 'wav':
      case 'ogg':
        iconClass += ' audio';
        iconSymbol = '🎵';
        break;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'mkv':
        iconClass += ' video';
        iconSymbol = '🎬';
        break;
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        iconClass += ' archive';
        iconSymbol = '🗜️';
        break;
      default:
        // 기본 문서 아이콘
        break;
    }
    
    return <span className={iconClass}>{iconSymbol}</span>;
  };

  // 폴더 구조 렌더링 - 단순 뷰어 역할로 수정
  const renderFolderStructure = (items: any[], level = 0) => {
    if (!items || items.length === 0) {
      return <div className="empty-folder">폴더가 비어 있습니다.</div>;
    }
    
    // 현재 폴더의 상위 폴더 경로 계산
    const getParentFolder = () => {
      if (!folderPath) return null;
      
      const pathParts = folderPath.split(/[/\\]/);
      if (pathParts.length <= 1) return null; // 루트 폴더인 경우
      
      pathParts.pop(); // 마지막 부분(현재 폴더명) 제거
      return pathParts.join('\\');
    };
    
    const parentFolder = getParentFolder();
    
    return (
      <ul className="folder-list" style={{ paddingLeft: level * 16 + 'px' }}>
        {/* 상위 폴더로 가기 항목 추가 */}
        {hasParentFolder ? (
          <li 
            className="folder-item parent-folder"
            onClick={() => {
              // 단순히 상위 폴더 내용 표시
              if (parentFolder) {
                handleOpenFolder(parentFolder);
              }
            }}
          >
            <div className="item-name">
              <span className="folder-icon">📂</span>
              상위 폴더로 이동
            </div>
          </li>
        ) : (
          <li className="folder-item parent-folder disabled">
            <div className="item-name">
              <span className="folder-icon disabled">📂</span>
              상위 폴더 없음
            </div>
          </li>
        )}
        
        {items.map((item, index) => (
          <li 
            key={index} 
            className={item.is_dir ? 'folder-item' : 'file-item'}
            onClick={() => {
              // 단일 클릭으로 폴더/파일 처리
              if (item.is_dir) {
                // 폴더인 경우 내용 표시
                handleOpenFolder(item.path);
              } else {
                // 파일인 경우 파일 열기
                handleFileSelect(item.path);
              }
            }}
          >
            <div className={`item-name ${filePath === item.path ? 'selected' : ''}`}>
              {item.is_dir ? (
                <span className="folder-icon">📁</span>
              ) : (
                getFileIcon(item.name)
              )}
              {item.name}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  // 필터링된 폰트 목록
  const filteredFonts = useMemo(() => {
    if (!searchFontTerm) return systemFonts;
    return systemFonts.filter(font => 
      font.toLowerCase().includes(searchFontTerm.toLowerCase())
    );
  }, [systemFonts, searchFontTerm]);
  
  // 타임라인 스냅샷 생성 함수
  const createSnapshot = (description: string) => {
    if (!editorRef.current) return;
    
    const position = editorRef.current.getPosition();
    const cursorPosition = position ? {
      lineNumber: position.lineNumber,
      column: position.column
    } : undefined;
    
    const newSnapshot: TimelineSnapshot = {
      id: Date.now(),
      timestamp: new Date(),
      description,
      content: gcode,
      cursorPosition,
      fileName: fileName || '새 파일',
      filePath: filePath || '',
      tabId: activeTabId
    };
    
    // 현재 탭의 타임라인에 스냅샷 추가
    setTimelineSnapshots(prev => [...prev, newSnapshot]);
    setActiveSnapshotIndex(timelineSnapshots.length);
    
    // 탭 상태 업데이트
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === activeTabId 
          ? { 
              ...tab, 
              timelineSnapshots: [...tab.timelineSnapshots, newSnapshot] 
            } 
          : tab
      )
    );
    
    // 히스토리에 추가
    addToHistory(`스냅샷 생성: ${description}`);
  };
  
  // 스냅샷 복원 함수
  const restoreSnapshot = (index: number) => {
    if (index < 0 || index >= timelineSnapshots.length) return;
    
    const snapshot = timelineSnapshots[index];
    setGcode(snapshot.content);
    setActiveSnapshotIndex(index);
    
    // 파일 정보 복원
    setFileName(snapshot.fileName);
    setFilePath(snapshot.filePath);
    
    // 커서 위치 복원
    if (snapshot.cursorPosition && editorRef.current) {
      setTimeout(() => {
        editorRef.current?.setPosition(snapshot.cursorPosition!);
        editorRef.current?.revealPositionInCenter(snapshot.cursorPosition!);
        editorRef.current?.focus();
      }, 100);
    }
    
    // 히스토리에 추가
    addToHistory(`스냅샷 복원: ${snapshot.description}`);
  };
  
  // 스냅샷 삭제 함수
  const deleteSnapshot = (index: number, event: React.MouseEvent) => {
    event.stopPropagation(); // 클릭 이벤트 전파 방지
    
    if (index < 0 || index >= timelineSnapshots.length) return;
    
    setTimelineSnapshots(prev => {
      const newSnapshots = [...prev];
      newSnapshots.splice(index, 1);
      return newSnapshots;
    });
    
    // 활성 스냅샷 인덱스 조정
    if (activeSnapshotIndex === index) {
      setActiveSnapshotIndex(-1);
    } else if (activeSnapshotIndex > index) {
      setActiveSnapshotIndex(activeSnapshotIndex - 1);
    }
    
    // 히스토리에 추가
    addToHistory(`스냅샷 삭제: #${index + 1}`);
  };

  // 스냅샷 내보내기 함수
  const exportSnapshot = async (index: number, event: React.MouseEvent) => {
    event.stopPropagation(); // 클릭 이벤트 전파 방지
    
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
        addToHistory(`스냅샷 내보내기 완료: ${savePath}`);
      }
    } catch (error) {
      console.error('스냅샷 내보내기 오류:', error);
      addToHistory(`스냅샷 내보내기 실패: ${error}`);
    }
  };

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: 저장
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSaveFile();
      }
      
      // Ctrl/Cmd + Shift + S: 다른 이름으로 저장
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleSaveAsFile();
      }
      
      // Ctrl/Cmd + O: 폴더 열기
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleBrowseFolder();
      }
      
      // Ctrl/Cmd + Z: 실행 취소
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      // Ctrl/Cmd + Shift + Z 또는 Ctrl/Cmd + Y: 다시 실행
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || 
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      
      // Ctrl/Cmd + F: 찾기/바꾸기
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        toggleFindReplace();
      }
      
      // Ctrl/Cmd + N: 새 파일
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      }
      
      // F5: 스냅샷 생성
      if (e.key === 'F5') {
        e.preventDefault();
        createSnapshot('수동 스냅샷 (F5)');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filePath, gcode, fileName]);
  
  // 폴더 패널 크기 조절 이벤트 핸들러
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingFolderPanel) {
        const newWidth = e.clientX;
        setFolderPanelWidth(Math.max(150, Math.min(500, newWidth)));
      }
      
      if (isDraggingBottomPanel) {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
          const rect = mainContent.getBoundingClientRect();
          const totalHeight = rect.height;
          const newBottomHeight = totalHeight - e.clientY + rect.top;
          
          // 최소 높이 100px, 최대 높이는 전체 높이의 80%
          const minHeight = 100;
          const maxHeight = totalHeight * 0.8;
          
          setBottomPanelHeight(Math.max(minHeight, Math.min(maxHeight, newBottomHeight)));
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDraggingFolderPanel(false);
      setIsDraggingBottomPanel(false);
      document.body.style.cursor = 'default';
    };
    
    if (isDraggingFolderPanel || isDraggingBottomPanel) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      if (isDraggingFolderPanel) {
        document.body.style.cursor = 'col-resize';
      } else if (isDraggingBottomPanel) {
        document.body.style.cursor = 'row-resize';
      }
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDraggingFolderPanel, isDraggingBottomPanel]);
  
  // 폴더 패널 크기 조절 시작
  const startFolderPanelResize = (e: React.MouseEvent) => {
    setIsDraggingFolderPanel(true);
    e.preventDefault();
  };
  
  // 하단 패널 크기 조절 시작
  const startBottomPanelResize = (e: React.MouseEvent) => {
    setIsDraggingBottomPanel(true);
    e.preventDefault();
  };

  // 드래그 앤 드롭 이벤트 핸들러
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    
    // 드래그 중인 요소에 클래스 추가
    if (e.currentTarget.classList.contains('folder-content')) {
      e.currentTarget.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    // 드래그가 떠난 요소에서 클래스 제거
    if (e.currentTarget.classList.contains('folder-content')) {
      e.currentTarget.classList.remove('drag-over');
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    // 드롭된 요소에서 클래스 제거
    if (e.currentTarget.classList.contains('folder-content')) {
      e.currentTarget.classList.remove('drag-over');
    }

    // 드롭된 파일 또는 폴더 처리
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      
      try {
        // Tauri에서는 File 객체에 path 속성이 없으므로 invoke를 통해 경로 가져오기
        const path = await invoke('get_dropped_file_path', { 
          filePath: (file as any).path || file.name 
        });
        
        if (path) {
          // 폴더인지 확인 (Tauri API를 통해)
          const isDirectory = await invoke('is_directory', { path });
          
          if (isDirectory) {
            // 폴더인 경우 작업 폴더로 설정
            await handleOpenFolder(path as string);
            addToHistory(`드래그 앤 드롭으로 폴더 열기: ${formatDrivePath(path as string)}`);
          } else {
            // 파일인 경우 열기
            await handleFileSelect(path as string);
            addToHistory(`드래그 앤 드롭으로 파일 열기: ${path}`);
          }
        }
      } catch (error) {
        console.error('드롭된 항목 처리 오류:', error);
        addToHistory(`드롭된 항목 처리 실패: ${error}`);
      }
    }
  };

  // 다른 이름으로 저장 핸들러
  const handleSaveAsFile = async () => {
    try {
      const savePath = await save({
        filters: [
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
        ]
      });
      
      if (savePath) {
        await writeTextFile(savePath as string, gcode);
        setFilePath(savePath as string);
        
        // 파일 이름 추출
        const newFileName = (savePath as string).split(/[/\\]/).pop() || '새 파일';
        setFileName(newFileName);
        
        // 히스토리에 추가
        showToast(`다른 이름으로 저장 완료: ${newFileName}`, 'success');
        addToHistory(`다른 이름으로 저장: ${newFileName}`);
        
        // 타임라인 스냅샷 생성
        createSnapshot(`다른 이름으로 저장: ${newFileName}`);
      }
    } catch (error) {
      console.error('파일 저장 오류:', error);
      showToast(`다른 이름으로 저장 실패: ${error}`, 'error');
      addToHistory(`다른 이름으로 저장 실패: ${error}`);
    }
  };

  // 파일 열기 대화상자 표시
  const handleBrowseFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
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
        ]
      });
      
      if (selected) {
        await handleFileSelect(selected as string);
      }
    } catch (error) {
      console.error('파일 열기 오류:', error);
      addToHistory(`파일 열기 실패: ${error}`);
    }
  };

  // 파일 선택 핸들러 - 단순 뷰어 역할로 수정
  const handleFileSelect = async (filePath: string) => {
    try {
      // 이미 열려있는 탭인지 확인
      const existingTab = tabs.find(tab => tab.filePath === filePath);
      if (existingTab) {
        // 이미 열려있는 탭이면 해당 탭으로 전환
        activateTab(existingTab.id);
        return;
      }
      
      // 파일 내용 읽기
      const content = await readTextFile(filePath);
      
      // 파일 이름 추출
      const newFileName = filePath.split(/[/\\]/).pop() || '새 파일';
      
      // 새 탭 생성
      const newTabId = `tab-${Date.now()}`;
      const newTab: FileTab = {
        id: newTabId,
        fileName: newFileName,
        filePath,
        content,
        isModified: false,
        timelineSnapshots: []
      };
      
      // 탭 추가 및 활성화
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId(newTabId);
      
      // 상태 업데이트
      setGcode(content);
      setFileName(newFileName);
      setFilePath(filePath);
      
      // 로그 기록
      await log(LogLevel.INFO, `파일 열기: ${filePath}`);
    } catch (error) {
      console.error('파일 열기 오류:', error);
      showToast(`파일을 열 수 없습니다: ${error}`, 'error');
    }
  };

  // 탭 드래그 시작
  const handleTabDragStart = (tabId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('text/plain', tabId);
    setDraggedTabId(tabId);
    
    // 드래그 이미지 설정 (투명하게)
    const dragImage = document.createElement('div');
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // 드래그 효과 설정
    event.dataTransfer.effectAllowed = 'move';
    
    // 다음 프레임에서 드래그 이미지 요소 제거
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };
  
  // 탭 드래그 오버
  const handleTabDragOver = (tabId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggedTabId && draggedTabId !== tabId) {
      setDragOverTabId(tabId);
    }
  };
  
  // 탭 드래그 종료
  const handleTabDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };
  
  // 탭 드롭
  const handleTabDrop = (tabId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    if (!draggedTabId || draggedTabId === tabId) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }
    
    // 탭 순서 변경
    const newTabs = [...tabs];
    const draggedTabIndex = newTabs.findIndex(tab => tab.id === draggedTabId);
    const dropTabIndex = newTabs.findIndex(tab => tab.id === tabId);
    
    if (draggedTabIndex !== -1 && dropTabIndex !== -1) {
      const [draggedTab] = newTabs.splice(draggedTabIndex, 1);
      newTabs.splice(dropTabIndex, 0, draggedTab);
      setTabs(newTabs);
    }
    
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  // 디버그 콘솔 관련 상태
  const [showDebugConsole, setShowDebugConsole] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [f12KeyPressCount, setF12KeyPressCount] = useState<number>(0);
  const [f12KeyPressTimer, setF12KeyPressTimer] = useState<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // 로그 추가 함수
  const addLog = async (level: string, message: string) => {
    try {
      await invoke('add_log_message', { level, message });
      fetchLogs();
    } catch (error) {
      console.error('로그 추가 오류:', error);
    }
  };
  
  // 로그 가져오기 함수
  const fetchLogs = async () => {
    try {
      const logs = await invoke('get_logs') as LogMessage[];
      setLogs(logs);
      
      // 로그가 업데이트되면 스크롤을 맨 아래로 이동
      setTimeout(() => {
        if (logsEndRef.current) {
          logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      console.error('로그 가져오기 오류:', error);
    }
  };
  
  // F12 키 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault(); // 기본 개발자 도구 열림 방지
        
        // F12 키 누름 횟수 증가
        setF12KeyPressCount(prev => {
          const newCount = prev + 1;
          
          // 타이머가 있으면 제거
          if (f12KeyPressTimer) {
            clearTimeout(f12KeyPressTimer);
          }
          
          // 3초 후에 카운트 리셋하는 타이머 설정
          const timer = setTimeout(() => {
            setF12KeyPressCount(0);
          }, 3000);
          
          setF12KeyPressTimer(timer);
          
          // 3번 누르면 디버그 콘솔 토글
          if (newCount >= 3) {
            setShowDebugConsole(prev => !prev);
            setF12KeyPressCount(0);
            if (!showDebugConsole) {
              fetchLogs();
            }
          }
          
          return newCount;
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (f12KeyPressTimer) {
        clearTimeout(f12KeyPressTimer);
      }
    };
  }, [f12KeyPressTimer, showDebugConsole]);
  
  // 주기적으로 로그 업데이트 (디버그 콘솔이 열려있을 때만)
  useEffect(() => {
    let interval: any = null;
    
    if (showDebugConsole) {
      fetchLogs();
      interval = setInterval(fetchLogs, 2000); // 2초마다 로그 업데이트
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [showDebugConsole]);
  
  // 앱 시작 시 초기 로그 추가
  useEffect(() => {
    console.log("App component mounted");
    
    addLog('info', '애플리케이션 UI 초기화');
  }, []);

  // 로그 레벨에 따른 스타일 반환
  const getLogLevelStyle = (level: string): React.CSSProperties => {
    switch (level) {
      case 'error':
        return { color: '#ff5555' };
      case 'warn':
        return { color: '#ffaa00' };
      case 'info':
        return { color: '#55aaff' };
      default:
        return { color: '#ffffff' };
    }
  };

  // 앱 초기화 및 에러 처리
  useEffect(() => {
    const initApp = async () => {
      console.log("App initialization started");
      try {
        await log(LogLevel.INFO, '앱 초기화 시작');
        
        // 시스템 폰트 로드 부분 삭제
        // 기본 폰트 목록 사용
        setSystemFonts(FONT_OPTIONS);
        
        // 기본 폴더 경로를 설정하지 않음 (사용자가 직접 선택하도록 함)
        // 필요한 경우 사용자 문서 폴더 등으로 설정할 수 있음
        
        await log(LogLevel.INFO, '앱 초기화 완료');
        console.log("App initialization completed successfully");
      } catch (error) {
        console.error("App initialization failed:", error);
        if (error instanceof Error) {
          await logError(error, '앱 초기화 중 오류 발생');
        }
      }
    };

    initApp();
    
    // 전역 에러 핸들러 추가
    const handleError = async (event: ErrorEvent) => {
      console.error('앱 오류 발생:', event.error);
      await logError(event.error, '전역 오류 발생');
      showToast(`앱 오류가 발생했습니다: ${event.error?.message || '알 수 없는 오류'}`, 'error');
    };

    // 비동기 작업 오류 핸들러 추가
    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      console.error('비동기 작업 오류:', event.reason);
      if (event.reason instanceof Error) {
        await logError(event.reason, '비동기 작업 오류');
      } else {
        await log(LogLevel.ERROR, `비동기 작업 오류: ${String(event.reason)}`);
      }
      showToast(`비동기 작업 오류가 발생했습니다: ${event.reason?.message || '알 수 없는 오류'}`, 'error');
    };

    // 이벤트 리스너 등록
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // 디바운스 타이머 참조 추가
  const debounceTimerRef = useRef<number | null>(null);

  // 렌더링 부분
  return (
    <div className="app-container" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className="window-titlebar">
        <div className="titlebar-controls">
          {/* 파일 메뉴 */}
          <div 
            className={`menu-item ${activeMenu === 'file' ? 'active' : ''}`}
            onClick={() => toggleMenu('file')}
          >
            파일
            {activeMenu === 'file' && (
              <div className="menu-dropdown">
                <div className="menu-button" onClick={handleNewFile}>
                  새 파일
                  <span className="shortcut-hint">Ctrl+N</span>
                </div>
                <div className="menu-button" onClick={handleBrowseFile}>
                  파일 열기
                  <span className="shortcut-hint">Ctrl+O</span>
                </div>
                <div className="menu-button" onClick={handleBrowseFolder}>
                  폴더 열기
                </div>
                <div className="menu-separator"></div>
                <div className="menu-button" onClick={handleSaveFile}>
                  저장
                  <span className="shortcut-hint">Ctrl+S</span>
                </div>
                <div className="menu-button save-as-button" onClick={handleSaveAsFile}>
                  다른 이름으로 저장<span className="shortcut-hint">Ctrl+Shift+S</span>
                </div>
              </div>
            )}
          </div>
          
          {/* 편집 메뉴 */}
          <div 
            className={`menu-item ${activeMenu === 'edit' ? 'active' : ''}`}
            onClick={() => toggleMenu('edit')}
          >
            편집
            {activeMenu === 'edit' && (
              <div className="menu-dropdown">
                <div className="menu-button" onClick={handleUndo}>
                  실행 취소
                  <span className="shortcut-hint">Ctrl+Z</span>
                </div>
                <div className="menu-button" onClick={handleRedo}>
                  다시 실행
                  <span className="shortcut-hint">Ctrl+Y</span>
                </div>
                <div className="menu-separator"></div>
                <div className="menu-button" onClick={toggleFindReplace}>
                  찾기/바꾸기
                  <span className="shortcut-hint">Ctrl+F</span>
                </div>
                <div className="menu-button" onClick={handleGoToLine}>
                  줄 이동
                  <span className="shortcut-hint">Ctrl+G</span>
                </div>
                <div className="menu-separator"></div>
                <div className="menu-button" onClick={handleIndent}>
                  들여쓰기
                  <span className="shortcut-hint">Tab</span>
                </div>
                <div className="menu-button" onClick={handleOutdent}>
                  내어쓰기
                  <span className="shortcut-hint">Shift+Tab</span>
                </div>
                <div className="menu-button" onClick={handleToggleComment}>
                  주석 토글
                  <span className="shortcut-hint">Ctrl+/</span>
                </div>
              </div>
            )}
          </div>
          
          {/* 보기 메뉴 */}
          <div 
            className={`menu-item ${activeMenu === 'view' ? 'active' : ''}`}
            onClick={() => toggleMenu('view')}
          >
            보기
            {activeMenu === 'view' && (
              <div className="menu-dropdown">
                <div className="menu-button" onClick={toggleFolderPanel}>
                  작업 영역
                  <span className="shortcut-hint">Ctrl+B</span>
                </div>
                <div className="menu-button" onClick={toggleHistoryPanel}>
                  작업 히스토리
                  <span className="shortcut-hint">Ctrl+H</span>
                </div>
                <div className="menu-separator"></div>
                <div className="checkbox-option">
                  <input 
                    type="checkbox" 
                    id="wordWrap" 
                    checked={wordWrap === 'on'} 
                    onChange={() => setWordWrap(wordWrap === 'on' ? 'off' : 'on')}
                  />
                  <label htmlFor="wordWrap">자동 줄바꿈</label>
                </div>
              </div>
            )}
          </div>
          
          {/* 에디터 설정 메뉴 */}
          <div 
            className={`menu-item ${activeMenu === 'editor' ? 'active' : ''}`}
            onClick={() => toggleMenu('editor')}
          >
            에디터 설정
            {activeMenu === 'editor' && (
              <div className="menu-dropdown">
                <div className="checkbox-option">
                  <input 
                    type="checkbox" 
                    id="showLineNumbers" 
                    checked={showLineNumbers} 
                    onChange={() => setShowLineNumbers(!showLineNumbers)}
                  />
                  <label htmlFor="showLineNumbers">줄 번호 표시</label>
                </div>
                <div className="checkbox-option">
                  <input 
                    type="checkbox" 
                    id="showMinimap" 
                    checked={showMinimap} 
                    onChange={() => setShowMinimap(!showMinimap)}
                  />
                  <label htmlFor="showMinimap">미니맵 표시</label>
                </div>
              </div>
            )}
          </div>
          
          {/* 폰트 설정 메뉴 */}
          <div 
            className={`menu-item ${activeMenu === 'settings' ? 'active' : ''}`}
            onClick={() => toggleMenu('settings')}
          >
            폰트 설정
            {activeMenu === 'settings' && (
              <div className="menu-dropdown">
                <div className="font-dropdown">
                  <div className="dropdown-section">
                    <div className="dropdown-label">폰트 선택</div>
                    <div className="dropdown-options">
                      <input 
                        type="text" 
                        className="font-search-input" 
                        placeholder="폰트 검색..." 
                        value={searchFontTerm}
                        onChange={(e) => setSearchFontTerm(e.target.value)}
                      />
                      <div className="font-list">
                        {filteredFonts.map((font, index) => (
                          <div 
                            key={index} 
                            className={`font-option ${font === fontFamily ? 'selected' : ''}`}
                            onClick={() => setFontFamily(font)}
                            style={{ fontFamily: font }}
                          >
                            {font}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="dropdown-section">
                    <div className="dropdown-label">폰트 크기</div>
                    <div className="dropdown-options">
                      {[10, 12, 14, 16, 18, 20, 22, 24].map((size) => (
                        <div 
                          key={size} 
                          className={`font-option ${size === fontSize ? 'selected' : ''}`}
                          onClick={() => setFontSize(size)}
                        >
                          {size}px
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 현재 편집 중인 파일명 */}
        <div className="current-file-name">
          {fileName || '새 파일'}
        </div>
        
        <div className="titlebar-text">
          <img src="/icon.ico" alt="Maulwurf" className="titlebar-icon" />
          Maulwurf
        </div>
      </div>
      
      <div className="main-content">
        {showFindReplace && (
          <div className="find-replace-bar">
            <div className="find-replace-group">
              <input 
                type="text" 
                className="find-replace-input" 
                placeholder="찾기..." 
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFind()}
              />
              <button className="find-button" onClick={handleFind}>찾기</button>
            </div>
            <div className="find-replace-group">
              <input 
                type="text" 
                className="find-replace-input" 
                placeholder="바꾸기..." 
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
              />
              <button className="find-button" onClick={handleReplace}>바꾸기</button>
              <button className="find-button" onClick={handleReplaceAll}>모두 바꾸기</button>
            </div>
            <button className="close-find-replace" onClick={toggleFindReplace}>✕</button>
          </div>
        )}
        
        <div className="editor-workspace">
          {showFolderPanel && (
            <div 
              className={`folder-panel resizable ${isDragOver ? 'drag-over' : ''}`} 
              style={{ width: `${folderPanelWidth}px` }}
            >
              <div className="panel-header">
                <h3>폴더 뷰어</h3>
              </div>
              <div 
                className="folder-path-container"
                onClick={handleBrowseFolder}
                title="클릭하여 폴더 선택"
              >
                <div className="folder-path-text">
                  {formatDrivePath(folderPath) || '폴더를 선택하세요'}
                </div>
              </div>
              <div className="folder-content">
                {renderFolderStructure(folderStructure)}
              </div>
              <div 
                className="resizer resizer-horizontal" 
                ref={folderPanelResizeRef}
                onMouseDown={startFolderPanelResize}
                title="드래그하여 크기 조절"
              ></div>
            </div>
          )}
          
          <div className="editor-container">
            {/* 탭 컨테이너 */}
            <div className="tabs-container">
              {tabs.map(tab => (
                <div 
                  key={tab.id}
                  className={`tab ${tab.id === activeTabId ? 'active' : ''} ${draggedTabId === tab.id ? 'dragging' : ''} ${dragOverTabId === tab.id ? 'drag-over' : ''}`}
                  onClick={() => activateTab(tab.id)}
                  draggable
                  onDragStart={(e) => handleTabDragStart(tab.id, e)}
                  onDragOver={(e) => handleTabDragOver(tab.id, e)}
                  onDragEnd={handleTabDragEnd}
                  onDrop={(e) => handleTabDrop(tab.id, e)}
                >
                  <div className="tab-title">
                    {tab.fileName}{tab.isModified ? ' *' : ''}
                  </div>
                  <div 
                    className="tab-close"
                    onClick={(e) => closeTab(tab.id, e)}
                  >
                    ✕
                  </div>
                </div>
              ))}
              <button 
                className="new-tab-button"
                onClick={handleNewFile}
                title="새 탭"
              >
                +
              </button>
            </div>
            
            <div className="editor-wrapper">
              <Editor
                height="100%"
                defaultLanguage="gcode"
                language="gcode"
                value={gcode}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme="gcode-theme-dark"
                options={{
                  minimap: { enabled: showMinimap },
                  scrollBeyondLastLine: false,
                  fontSize: fontSize,
                  fontFamily: fontFamily,
                  lineNumbers: showLineNumbers ? 'on' : 'off',
                  wordWrap: wordWrap,
                  automaticLayout: true,
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    verticalScrollbarSize: 12,
                    horizontalScrollbarSize: 12,
                  },
                  renderLineHighlight: 'all',
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  fontLigatures: true,
                }}
              />
            </div>
            
            <div 
              className="resizer resizer-vertical bottom-panels-resizer" 
              ref={bottomPanelResizeRef}
              onMouseDown={startBottomPanelResize}
              title="드래그하여 패널 높이 조절"
            ></div>
            
            <div className="bottom-panels" style={{ height: `${bottomPanelHeight}px` }}>
              {/* 히스토리 패널 */}
              <div className="history-panel">
                <div className="panel-header">
                  <h3>작업 히스토리</h3>
                  <button className="clear-button" onClick={() => setHistory([])}>🗑️</button>
                </div>
                <div className="history-content">
                  {history.length === 0 ? (
                    <div className="empty-history">히스토리가 없습니다.</div>
                  ) : (
                    <ul className="history-list">
                      {history.map((item, index) => (
                        <li key={index} className="history-item">{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              
              {/* 타임라인 패널 */}
              <div className="timeline-container">
                <div className="panel-header">
                  <h3>타임라인 (F5 키로 스냅샷 생성)</h3>
                  <button 
                    className="refresh-button" 
                    onClick={() => createSnapshot('수동 스냅샷')}
                    title="현재 상태 스냅샷 생성 (F5)"
                  >
                    📸
                  </button>
                </div>
                <div className="timeline-panel">
                  <div className="timeline-content">
                    {timelineSnapshots.length === 0 ? (
                      <div className="empty-history">타임라인 스냅샷이 없습니다.</div>
                    ) : (
                      timelineSnapshots.map((snapshot, index) => (
                        <div 
                          key={snapshot.id}
                          className={`timeline-item ${index === activeSnapshotIndex ? 'active' : ''}`}
                          onClick={() => restoreSnapshot(index)}
                          title={`${snapshot.description} - ${snapshot.fileName}`}
                        >
                          <div className="timeline-index">
                            #{index + 1}
                          </div>
                          <div className="timeline-timestamp">
                            {snapshot.timestamp.toLocaleTimeString()}
                          </div>
                          <div className="timeline-description">
                            {snapshot.description}
                          </div>
                          <div className="timeline-actions">
                            <button 
                              className="timeline-action-button"
                              onClick={(e) => exportSnapshot(index, e)}
                              title="스냅샷 내보내기"
                            >
                              💾
                            </button>
                            <button 
                              className="timeline-action-button"
                              onClick={(e) => deleteSnapshot(index, e)}
                              title="스냅샷 삭제"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="status-bar">
        <div className="status-items">
          <div className="status-item">
            {isValid === true ? (
              <span className="valid-indicator">
                ✓ 유효한 G코드
              </span>
            ) : (
              <span className="error-indicator">
                ✗ 오류: {validationErrors.length}개
              </span>
            )}
          </div>
          <div className="status-item">
            <span className="file-path">
              {filePath ? formatDrivePath(filePath) : '새 파일'}
            </span>
          </div>
          <div className="status-item">
            <span className="file-type">
              G코드
            </span>
          </div>
        </div>
      </div>

      {/* 토스트 메시지 컨테이너 */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`toast-message ${toast.type} ${toast.removing ? 'removing' : ''}`}
          >
            <div className="toast-content">{toast.message}</div>
            <button 
              className="toast-close" 
              onClick={() => removeToast(toast.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 디버그 콘솔 */}
      {showDebugConsole && (
        <div className="debug-console">
          <div className="debug-console-header">
            <h3>디버그 콘솔</h3>
            <button onClick={() => setShowDebugConsole(false)}>닫기</button>
          </div>
          <div className="debug-console-content">
            {logs.map((log, index) => (
              <div key={index} className="log-entry">
                <span className="log-timestamp">[{log.timestamp}]</span>
                <span className="log-level" style={getLogLevelStyle(log.level)}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 