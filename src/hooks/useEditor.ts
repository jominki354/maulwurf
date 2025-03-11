import { useState, useRef, useCallback } from 'react';
import { Monaco } from '@monaco-editor/react';

export const useEditor = () => {
  const [gcode, setGcode] = useState<string>('');
  const [fileName, setFileName] = useState<string>('새 파일');
  const [filePath, setFilePath] = useState<string | null>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [fontFamily, setFontFamily] = useState<string>('Consolas');
  const [fontSize, setFontSize] = useState<number>(18);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('off');
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(true);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  
  // 찾기/바꾸기 관련 상태
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [findReplaceVisible, setFindReplaceVisible] = useState<boolean>(false);
  const [matchCase, setMatchCase] = useState<boolean>(false);
  const [useRegex, setUseRegex] = useState<boolean>(false);
  const [wholeWord, setWholeWord] = useState<boolean>(false);
  const [findResults, setFindResults] = useState<{total: number, current: number}>({total: 0, current: 0});
  
  // 커서 위치 상태
  const [cursorPosition, setCursorPosition] = useState<{lineNumber: number, column: number} | null>(null);
  // 스크롤 위치 상태
  const [scrollPosition, setScrollPosition] = useState<{scrollTop: number, scrollLeft: number} | null>(null);
  
  const editorRef = useRef<any>(null);
  const editorChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 하이라이트 데코레이션 ID 저장
  const highlightDecorations = useRef<string[]>([]);
  // 찾기 결과 하이라이트 ID 저장
  const findHighlightDecorations = useRef<string[]>([]);
  // 바꾸기 결과 하이라이트 ID 저장
  const replaceHighlightDecorations = useRef<string[]>([]);
  
  // 하이라이트 제거 함수
  const clearHighlights = useCallback(() => {
    if (!editorRef.current) return;
    
    // 기존 하이라이트 제거
    if (highlightDecorations.current.length > 0) {
      editorRef.current.deltaDecorations(highlightDecorations.current, []);
      highlightDecorations.current = [];
    }
  }, []);
  
  // 찾기 하이라이트 제거 함수
  const clearFindHighlights = useCallback(() => {
    if (!editorRef.current) return;
    
    // 기존 찾기 하이라이트 제거
    if (findHighlightDecorations.current.length > 0) {
      editorRef.current.deltaDecorations(findHighlightDecorations.current, []);
      findHighlightDecorations.current = [];
    }
  }, []);
  
  // 바꾸기 하이라이트 제거 함수
  const clearReplaceHighlights = useCallback(() => {
    if (!editorRef.current) return;
    
    // 기존 바꾸기 하이라이트 제거
    if (replaceHighlightDecorations.current.length > 0) {
      editorRef.current.deltaDecorations(replaceHighlightDecorations.current, []);
      replaceHighlightDecorations.current = [];
    }
  }, []);
  
  // 찾기 결과 카운트 업데이트
  const updateFindResultsCount = useCallback((currentRange: any) => {
    if (!editorRef.current || !findText) return;
    
    const model = editorRef.current.getModel();
    if (!model) return;
    
    try {
      // 전체 일치 항목 찾기
      const allMatches = model.findMatches(
        findText,
        true, // searchOnlyEditableRange
        useRegex,
        matchCase,
        wholeWord ? ' \t\n,.;:\'"`~!@#$%^&*()-=+[]{}\\|/?<>' : null,
        false, // captureMatches
        1000, // 최대 1000개 결과
        null // 전체 문서 검색
      );
      
      // 현재 선택된 항목의 인덱스 찾기
      let currentIndex = -1;
      for (let i = 0; i < allMatches.length; i++) {
        const match = allMatches[i];
        if (match.range.startLineNumber === currentRange.startLineNumber && 
            match.range.startColumn === currentRange.startColumn) {
          currentIndex = i;
          break;
        }
      }
      
      // 찾기 결과 업데이트
      setFindResults({
        total: allMatches.length,
        current: currentIndex + 1 // 1부터 시작하는 인덱스로 표시
      });
    } catch (error) {
      console.error('찾기 결과 카운트 업데이트 오류:', error);
    }
  }, [findText, useRegex, matchCase, wholeWord]);
  
  // 찾기 결과 하이라이트 함수
  const highlightFindResult = useCallback((range: any) => {
    if (!editorRef.current) return;
    
    // 기존 찾기 하이라이트 제거
    clearFindHighlights();
    
    // 새 하이라이트 추가 - 텍스트 하이라이트
    const textDecorations = [
      {
        range: range,
        options: {
          inlineClassName: 'find-result-highlight',
          isWholeLine: false,
          stickiness: 1 // 텍스트 변경 시 하이라이트 유지
        }
      }
    ];
    
    // 라인 하이라이트 추가
    const lineDecorations = [
      {
        range: {
          startLineNumber: range.startLineNumber,
          startColumn: 1,
          endLineNumber: range.startLineNumber,
          endColumn: 1
        },
        options: {
          isWholeLine: true,
          className: 'find-line-highlight',
          stickiness: 1
        }
      }
    ];
    
    // 하이라이트 적용
    findHighlightDecorations.current = editorRef.current.deltaDecorations([], [...textDecorations, ...lineDecorations]);
    
    // 선택 영역 설정 (중요: 커서 위치만 설정하는 것이 아니라 전체 범위를 선택해야 함)
    try {
      editorRef.current.setSelection(range);
      
      // 해당 위치로 스크롤 (중앙에 표시)
      editorRef.current.revealRangeInCenterIfOutsideViewport(range);
      
      // 에디터에 포커스 설정 (약간의 지연 후)
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
          
          // 현재 찾기 결과 업데이트
          updateFindResultsCount(range);
        }
      }, 10);
    } catch (error) {
      console.error('하이라이트 설정 오류:', error);
    }
  }, [clearFindHighlights, updateFindResultsCount]);
  
  // 바꾸기 결과 하이라이트 함수
  const highlightReplaceResult = useCallback((range: any) => {
    if (!editorRef.current) return;
    
    // 기존 바꾸기 하이라이트 제거
    clearReplaceHighlights();
    
    // 새 하이라이트 추가 - 텍스트 하이라이트
    const textDecorations = [
      {
        range: range,
        options: {
          inlineClassName: 'replace-result-highlight',
          isWholeLine: false,
          stickiness: 1 // 텍스트 변경 시 하이라이트 유지
        }
      }
    ];
    
    // 라인 하이라이트 추가
    const lineDecorations = [
      {
        range: {
          startLineNumber: range.startLineNumber,
          startColumn: 1,
          endLineNumber: range.startLineNumber,
          endColumn: 1
        },
        options: {
          isWholeLine: true,
          className: 'replace-line-highlight',
          stickiness: 1
        }
      }
    ];
    
    // 하이라이트 적용
    replaceHighlightDecorations.current = editorRef.current.deltaDecorations([], [...textDecorations, ...lineDecorations]);
    
    // 선택 영역 설정 (중요: 커서 위치만 설정하는 것이 아니라 전체 범위를 선택해야 함)
    editorRef.current.setSelection(range);
    
    // 해당 위치로 스크롤 (중앙에 표시)
    editorRef.current.revealRangeInCenterIfOutsideViewport(range);
    
    // 에디터에 포커스 설정
    editorRef.current.focus();
  }, [clearReplaceHighlights, replaceText]);
  
  // 모든 바꾸기 결과 하이라이트 함수
  const highlightAllReplaceResults = useCallback((ranges: any[]) => {
    if (!editorRef.current || ranges.length === 0) return;
    
    // 기존 바꾸기 하이라이트 제거
    clearReplaceHighlights();
    
    // 새 하이라이트 추가 - 텍스트 하이라이트
    const textDecorations = ranges.map(range => ({
      range: range,
      options: {
        inlineClassName: 'replace-result-highlight',
        isWholeLine: false,
        stickiness: 1 // 텍스트 변경 시 하이라이트 유지
      }
    }));
    
    // 라인 하이라이트 추가
    const lineDecorations = ranges.map(range => ({
      range: {
        startLineNumber: range.startLineNumber,
        startColumn: 1,
        endLineNumber: range.startLineNumber,
        endColumn: 1
      },
      options: {
        isWholeLine: true,
        className: 'replace-line-highlight',
        stickiness: 1
      }
    }));
    
    // 하이라이트 적용
    replaceHighlightDecorations.current = editorRef.current.deltaDecorations([], [...textDecorations, ...lineDecorations]);
    
    // 마지막 바꾸기 결과로 스크롤 (일반적으로 가장 위에 있는 결과)
    if (ranges.length > 0) {
      const lastRange = ranges[0]; // 정렬된 순서에서 첫 번째가 가장 위에 있는 결과
      
      // 선택 영역 설정
      editorRef.current.setSelection(lastRange);
      
      // 해당 위치로 스크롤 (중앙에 표시)
      editorRef.current.revealRangeInCenterIfOutsideViewport(lastRange);
      
      // 에디터에 포커스 설정
      editorRef.current.focus();
    }
  }, [clearReplaceHighlights]);
  
  // 변경 내용 하이라이트 함수
  const highlightChanges = useCallback((oldContent: string, newContent: string) => {
    if (!editorRef.current) return;
    if (!oldContent || !newContent) return;
    if (oldContent === newContent) return;
    
    try {
      // 기존 하이라이트 제거
      clearHighlights();
      
      // Monaco 인스턴스 가져오기
      const monaco = (window as any).monaco;
      if (!monaco) {
        console.error('Monaco 인스턴스를 찾을 수 없습니다.');
        return;
      }
      
      // 라인별로 분리
      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');
      
      const addedDecorations: any[] = [];
      const removedDecorations: any[] = [];
      
      // 간단한 라인 비교 (실제로는 더 정교한 diff 알고리즘 사용 가능)
      const maxLines = Math.max(oldLines.length, newLines.length);
      
      for (let i = 0; i < maxLines; i++) {
        // 추가된 라인
        if (i >= oldLines.length) {
          if (i < newLines.length) {
            addedDecorations.push({
              range: new monaco.Range(i + 1, 1, i + 1, newLines[i].length + 1),
              options: {
                isWholeLine: true,
                className: 'added-line-highlight',
                linesDecorationsClassName: 'added-line-gutter'
              }
            });
          }
        }
        // 삭제된 라인 (빈 라인으로 표시)
        else if (i >= newLines.length) {
          // 삭제된 라인은 현재 에디터에 표시할 수 없으므로 건너뜀
        }
        // 변경된 라인
        else if (oldLines[i] !== newLines[i]) {
          // 변경된 라인은 추가된 것으로 표시
          addedDecorations.push({
            range: new monaco.Range(i + 1, 1, i + 1, newLines[i].length + 1),
            options: {
              isWholeLine: true,
              className: 'modified-line-highlight',
              linesDecorationsClassName: 'modified-line-gutter'
            }
          });
        }
      }
      
      // 하이라이트 적용
      const decorations = [...addedDecorations, ...removedDecorations];
      if (decorations.length > 0) {
        highlightDecorations.current = editorRef.current.deltaDecorations([], decorations);
      }
    } catch (error) {
      console.error('하이라이트 적용 중 오류 발생:', error);
    }
  }, [clearHighlights]);
  
  // 에디터 마운트 핸들러
  const handleEditorDidMount = useCallback((editor: any, monaco: Monaco) => {
    console.log("Editor mounted successfully");
    editorRef.current = editor;
    
    // 커서 위치 변경 이벤트 리스너 등록
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPosition({
        lineNumber: e.position.lineNumber,
        column: e.position.column
      });
      
      // 커서 위치가 변경되면 하이라이트 제거
      clearHighlights();
    });
    
    // 스크롤 위치 변경 이벤트 리스너 등록
    editor.onDidScrollChange((e: any) => {
      setScrollPosition({
        scrollTop: e.scrollTop,
        scrollLeft: e.scrollLeft
      });
    });
    
    // 에디터 내용 변경 이벤트 리스너 등록
    editor.onDidChangeModelContent(() => {
      // 내용이 변경되면 하이라이트 제거
      clearHighlights();
    });
    
    // 다크 테마 정의
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
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorCursor.foreground': '#FFFFFF',
        'editor.lineHighlightBackground': '#2A2D2E',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41'
      }
    });
  }, []);
  
  // 에디터 내용 변경 핸들러
  const handleEditorChange = useCallback((value: string | undefined) => {
    // 이전 타이머 취소
    if (editorChangeTimeoutRef.current !== null) {
      clearTimeout(editorChangeTimeoutRef.current);
    }
    
    // 새 타이머 설정 (300ms 디바운스)
    editorChangeTimeoutRef.current = setTimeout(() => {
      const newValue = value || '';
      setGcode(newValue);
      editorChangeTimeoutRef.current = null;
    }, 300);
  }, []);
  
  // 에디터 내용 직접 설정 (undefined 처리)
  const setGcodeWrapper = useCallback((value: string | undefined) => {
    setGcode(value || '');
  }, []);
  
  // 토스트 메시지 표시 함수 (중복 방지)
  const showToastMessage = useCallback((type: string, message: string) => {
    // 이벤트 한 번만 발생시키기
    if (window.dispatchEvent) {
      const uniqueId = `${type}-${message}-${Date.now()}`;
      const event = new CustomEvent('showToast', { 
        detail: { 
          type, 
          message,
          unique: uniqueId // 고유 ID 추가
        } 
      });
      window.dispatchEvent(event);
    }
  }, []);
  
  // 다음 찾기
  const findNext = useCallback(() => {
    if (!editorRef.current || !findText) return false;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return false;
    
    try {
      // 현재 선택 영역 가져오기
      const selection = editor.getSelection();
      
      // 검색 시작 위치 설정 (현재 선택 영역 끝 또는 현재 커서 위치)
      let startPosition;
      if (selection && !selection.isEmpty()) {
        // 현재 선택 영역이 있으면 그 다음부터 검색
        startPosition = {
          lineNumber: selection.endLineNumber,
          column: selection.endColumn
        };
      } else {
        // 현재 커서 위치에서 검색
        startPosition = editor.getPosition();
      }
      
      // 전체 문서에서 모든 일치 항목 찾기
      const allMatches = model.findMatches(
        findText,
        true, // searchOnlyEditableRange
        useRegex,
        matchCase,
        wholeWord ? ' \t\n,.;:\'"`~!@#$%^&*()-=+[]{}\\|/?<>' : null,
        false, // captureMatches
        1000, // 최대 1000개 결과
        null // 전체 문서 검색
      );
      
      if (allMatches.length === 0) {
        // 일치하는 항목이 없음
        showToastMessage('warning', `'${findText}'에 대한 검색 결과가 없습니다.`);
        return false;
      }
      
      // 현재 위치보다 다음에 있는 일치 항목 찾기
      let nextMatch = null;
      let currentMatchIndex = -1;
      
      // 현재 선택된 항목이 있는 경우, 그 인덱스 찾기
      if (selection && !selection.isEmpty()) {
        for (let i = 0; i < allMatches.length; i++) {
          const match = allMatches[i];
          if (match.range.startLineNumber === selection.startLineNumber && 
              match.range.startColumn === selection.startColumn) {
            currentMatchIndex = i;
            break;
          }
        }
      }
      
      if (currentMatchIndex >= 0 && currentMatchIndex < allMatches.length - 1) {
        // 현재 선택된 항목이 있고, 그 다음 항목이 있는 경우
        nextMatch = allMatches[currentMatchIndex + 1];
      } else if (currentMatchIndex === allMatches.length - 1) {
        // 현재 선택된 항목이 마지막 항목인 경우, 첫 번째 항목으로 이동
        nextMatch = allMatches[0];
        showToastMessage('info', '문서의 처음부터 다시 검색합니다.');
      } else {
        // 현재 선택된 항목이 없는 경우, 현재 위치보다 다음에 있는 항목 찾기
        const cursorLine = startPosition.lineNumber;
        const cursorColumn = startPosition.column;
        
        // 현재 위치보다 다음에 있는 항목 중 가장 가까운 항목 찾기
        for (let i = 0; i < allMatches.length; i++) {
          const match = allMatches[i];
          if (match.range.startLineNumber > cursorLine || 
              (match.range.startLineNumber === cursorLine && match.range.startColumn >= cursorColumn)) {
            nextMatch = match;
            break;
          }
        }
        
        // 다음 항목이 없으면 첫 번째 항목으로 이동
        if (!nextMatch && allMatches.length > 0) {
          nextMatch = allMatches[0];
          showToastMessage('info', '문서의 처음부터 다시 검색합니다.');
        }
      }
      
      if (nextMatch) {
        // 하이라이트 적용 (이 함수가 선택 영역 설정과 스크롤도 처리함)
        highlightFindResult(nextMatch.range);
        return true;
      } else {
        // 결과가 없음 (이 경우는 발생하지 않아야 함)
        showToastMessage('warning', `'${findText}'에 대한 검색 결과가 없습니다.`);
        return false;
      }
    } catch (error) {
      console.error('다음 찾기 오류:', error);
      // 오류 메시지를 더 자세히 표시
      if (error instanceof Error) {
        showToastMessage('error', `검색 중 오류가 발생했습니다: ${error.message}`);
      } else {
        showToastMessage('error', '검색 중 알 수 없는 오류가 발생했습니다.');
      }
      return false;
    }
  }, [findText, useRegex, matchCase, wholeWord, highlightFindResult, showToastMessage]);
  
  // 이전 찾기
  const findPrevious = useCallback(() => {
    if (!editorRef.current || !findText) return false;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return false;
    
    try {
      // 현재 선택 영역 가져오기
      const selection = editor.getSelection();
      
      // 검색 시작 위치 설정 (현재 선택 영역 시작 또는 현재 커서 위치)
      let startPosition;
      if (selection && !selection.isEmpty()) {
        // 현재 선택 영역이 있으면 그 이전부터 검색
        startPosition = {
          lineNumber: selection.startLineNumber,
          column: selection.startColumn
        };
      } else {
        // 현재 커서 위치에서 검색
        startPosition = editor.getPosition();
      }
      
      // 전체 문서에서 모든 일치 항목 찾기
      const allMatches = model.findMatches(
        findText,
        true, // searchOnlyEditableRange
        useRegex,
        matchCase,
        wholeWord ? ' \t\n,.;:\'"`~!@#$%^&*()-=+[]{}\\|/?<>' : null,
        false, // captureMatches
        1000, // 최대 1000개 결과
        null // 전체 문서 검색
      );
      
      if (allMatches.length === 0) {
        // 일치하는 항목이 없음
        showToastMessage('warning', `'${findText}'에 대한 검색 결과가 없습니다.`);
        return false;
      }
      
      // 현재 위치보다 이전에 있는 일치 항목 찾기
      let prevMatch = null;
      let currentMatchIndex = -1;
      
      // 현재 선택된 항목이 있는 경우, 그 인덱스 찾기
      if (selection && !selection.isEmpty()) {
        for (let i = 0; i < allMatches.length; i++) {
          const match = allMatches[i];
          if (match.range.startLineNumber === selection.startLineNumber && 
              match.range.startColumn === selection.startColumn) {
            currentMatchIndex = i;
            break;
          }
        }
      }
      
      if (currentMatchIndex > 0) {
        // 현재 선택된 항목이 있고, 그 이전 항목이 있는 경우
        prevMatch = allMatches[currentMatchIndex - 1];
      } else if (currentMatchIndex === 0) {
        // 현재 선택된 항목이 첫 번째 항목인 경우, 마지막 항목으로 이동
        prevMatch = allMatches[allMatches.length - 1];
        showToastMessage('info', '문서의 끝에서부터 다시 검색합니다.');
      } else {
        // 현재 선택된 항목이 없는 경우, 현재 위치보다 이전에 있는 항목 찾기
        const cursorLine = startPosition.lineNumber;
        const cursorColumn = startPosition.column;
        
        // 현재 위치보다 이전에 있는 항목 중 가장 가까운 항목 찾기
        for (let i = allMatches.length - 1; i >= 0; i--) {
          const match = allMatches[i];
          if (match.range.startLineNumber < cursorLine || 
              (match.range.startLineNumber === cursorLine && match.range.startColumn < cursorColumn)) {
            prevMatch = match;
            break;
          }
        }
        
        // 이전 항목이 없으면 마지막 항목으로 이동
        if (!prevMatch && allMatches.length > 0) {
          prevMatch = allMatches[allMatches.length - 1];
          showToastMessage('info', '문서의 끝에서부터 다시 검색합니다.');
        }
      }
      
      if (prevMatch) {
        // 하이라이트 적용 (이 함수가 선택 영역 설정과 스크롤도 처리함)
        highlightFindResult(prevMatch.range);
        return true;
      } else {
        // 결과가 없음 (이 경우는 발생하지 않아야 함)
        showToastMessage('warning', `'${findText}'에 대한 검색 결과가 없습니다.`);
        return false;
      }
    } catch (error) {
      console.error('이전 찾기 오류:', error);
      // 오류 메시지를 더 자세히 표시
      if (error instanceof Error) {
        showToastMessage('error', `검색 중 오류가 발생했습니다: ${error.message}`);
      } else {
        showToastMessage('error', '검색 중 알 수 없는 오류가 발생했습니다.');
      }
      return false;
    }
  }, [findText, useRegex, matchCase, wholeWord, highlightFindResult, showToastMessage]);
  
  // 찾기/바꾸기 토글
  const toggleFindReplace = useCallback(() => {
    setFindReplaceVisible(prev => !prev);
    
    // 찾기/바꾸기 패널이 열릴 때 에디터에서 선택된 텍스트가 있으면 찾기 필드에 설정
    if (!findReplaceVisible && editorRef.current) {
      const selection = editorRef.current.getSelection();
      const selectedText = editorRef.current.getModel().getValueInRange(selection);
      
      if (selectedText) {
        setFindText(selectedText);
        
        // 약간의 지연 후 자동으로 검색 수행 (UI가 업데이트된 후)
        setTimeout(() => {
          if (editorRef.current) {
            // 다음 찾기 실행
            findNext();
            
            // 에디터에 포커스 유지
            editorRef.current.focus();
          }
        }, 100);
      } else if (findText) {
        // 이미 찾기 텍스트가 있으면 자동으로 검색 수행
        setTimeout(() => {
          if (editorRef.current) {
            findNext();
            editorRef.current.focus();
          }
        }, 100);
      }
    }
  }, [findReplaceVisible, findText, findNext]);
  
  // 실행 취소
  const undo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'undo', null);
    }
  }, []);
  
  // 다시 실행
  const redo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'redo', null);
    }
  }, []);
  
  // 바꾸기
  const replace = useCallback(() => {
    if (!editorRef.current || !findText) return false;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return false;
    
    try {
      // 현재 선택 영역 가져오기
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        // 선택된 영역이 없으면 먼저 다음 찾기 실행
        findNext();
        return false;
      }
      
      // 선택된 텍스트 가져오기
      const selectedText = model.getValueInRange(selection);
      
      // 선택된 텍스트가 검색어와 일치하는지 확인
      let isMatch = false;
      
      if (useRegex) {
        // 정규식 검색
        try {
          const regex = new RegExp(`^${findText}$`, matchCase ? '' : 'i');
          isMatch = regex.test(selectedText);
        } catch (regexError) {
          console.error('정규식 오류:', regexError);
          showToastMessage('error', '정규식 오류: ' + (regexError instanceof Error ? regexError.message : String(regexError)));
          return false;
        }
      } else if (matchCase) {
        // 대소문자 구분 검색
        isMatch = selectedText === findText;
      } else {
        // 대소문자 구분 없는 검색
        isMatch = selectedText.toLowerCase() === findText.toLowerCase();
      }
      
      if (wholeWord && isMatch) {
        // 단어 단위 검색 (이미 선택된 텍스트가 있으므로 단어 경계 확인은 필요 없음)
        isMatch = true;
      }
      
      // 일치하면 바꾸기 수행
      if (isMatch) {
        // 바꾸기 전 범위 저장 (selection.clone 대신 직접 객체 생성)
        const replaceRange = {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn
        };
        
        // 바꾸기 수행
        editor.executeEdits('replace', [{
          range: selection,
          text: replaceText,
          forceMoveMarkers: true
        }]);
        
        // 바꾼 결과 하이라이트
        const newRange = {
          startLineNumber: replaceRange.startLineNumber,
          startColumn: replaceRange.startColumn,
          endLineNumber: replaceRange.startLineNumber,
          endColumn: replaceRange.startColumn + replaceText.length
        };
        
        // 하이라이트 적용
        highlightReplaceResult(newRange);
        
        // 바꾸기 성공 메시지
        showToastMessage('success', '텍스트가 성공적으로 바뀌었습니다.');
        
        // 다음 찾기 실행 (약간 지연 후 실행하여 하이라이트가 보이도록)
        setTimeout(() => {
          findNext();
        }, 100);
        
        return true;
      } else {
        // 선택된 텍스트가 검색어와 일치하지 않으면 다음 찾기 실행
        showToastMessage('info', '선택된 텍스트가 검색어와 일치하지 않습니다. 다음 항목을 찾습니다.');
        findNext();
        return false;
      }
    } catch (error) {
      console.error('바꾸기 오류:', error);
      // 오류 메시지를 더 자세히 표시
      if (error instanceof Error) {
        showToastMessage('error', `바꾸기 중 오류가 발생했습니다: ${error.message}`);
      } else {
        showToastMessage('error', '바꾸기 중 알 수 없는 오류가 발생했습니다.');
      }
      return false;
    }
  }, [findText, replaceText, useRegex, matchCase, wholeWord, findNext, highlightReplaceResult, showToastMessage]);
  
  // 모두 바꾸기
  const replaceAll = useCallback(() => {
    if (!editorRef.current || !findText) return 0;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return 0;
    
    try {
      // 모든 일치 항목 찾기
      const matches = model.findMatches(
        findText,
        true, // searchOnlyEditableRange
        useRegex,
        matchCase,
        wholeWord ? ' \t\n,.;:\'"`~!@#$%^&*()-=+[]{}\\|/?<>' : null,
        false, // captureMatches
        1000, // 최대 1000개 결과
        null // 전체 문서 검색
      );
      
      if (matches.length === 0) {
        // 일치하는 항목이 없음
        showToastMessage('warning', `'${findText}'에 대한 검색 결과가 없습니다.`);
        return 0;
      }
      
      // 뒤에서부터 바꾸기 (앞에서부터 바꾸면 인덱스가 변경됨)
      const sortedMatches = [...matches].sort((a, b) => {
        if (a.range.startLineNumber !== b.range.startLineNumber) {
          return b.range.startLineNumber - a.range.startLineNumber;
        }
        return b.range.startColumn - a.range.startColumn;
      });
      
      // 바꾸기 전 범위 저장
      const replaceRanges = sortedMatches.map(match => ({
        startLineNumber: match.range.startLineNumber,
        startColumn: match.range.startColumn,
        endLineNumber: match.range.startLineNumber,
        endColumn: match.range.startColumn + replaceText.length
      }));
      
      // 모든 일치 항목 바꾸기
      editor.pushUndoStop();
      
      const edits = sortedMatches.map(match => ({
        range: match.range,
        text: replaceText,
        forceMoveMarkers: true
      }));
      
      // 에디터 편집 실행
      try {
        editor.executeEdits('replaceAll', edits);
        editor.pushUndoStop();
        
        // 바꾼 결과 하이라이트
        if (replaceRanges.length > 0) {
          // 약간의 지연 후 하이라이트 적용 (에디터 업데이트 후)
          setTimeout(() => {
            highlightAllReplaceResults(replaceRanges);
          }, 10);
        }
        
        // 바꾸기 완료 메시지
        const count = matches.length;
        showToastMessage('success', `${count}개의 항목이 성공적으로 바뀌었습니다.`);
        
        return count;
      } catch (editError) {
        console.error('에디터 편집 오류:', editError);
        showToastMessage('error', '바꾸기 작업 중 오류가 발생했습니다.');
        return 0;
      }
    } catch (error) {
      console.error('모두 바꾸기 오류:', error);
      // 오류 메시지를 더 자세히 표시
      if (error instanceof Error) {
        showToastMessage('error', `모두 바꾸기 중 오류가 발생했습니다: ${error.message}`);
      } else {
        showToastMessage('error', '모두 바꾸기 중 알 수 없는 오류가 발생했습니다.');
      }
      return 0;
    }
  }, [findText, replaceText, useRegex, matchCase, wholeWord, highlightAllReplaceResults, showToastMessage]);
  
  // 커서 위치 설정
  const setCursorPositionInEditor = useCallback((position: {lineNumber: number, column: number} | undefined) => {
    if (!editorRef.current || !position) return;
    
    editorRef.current.setPosition(position);
    editorRef.current.revealPositionInCenter(position);
  }, []);

  // 스크롤 위치 설정
  const setScrollPositionInEditor = useCallback((position: {scrollTop: number, scrollLeft: number} | undefined) => {
    if (!editorRef.current || !position) return;
    
    editorRef.current.setScrollPosition(position);
  }, []);

  // 선택 영역 설정
  const setSelectionsInEditor = useCallback((selections: {startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number}[] | undefined) => {
    if (!editorRef.current || !selections || selections.length === 0) return;
    
    const editorSelections = selections.map((selection) => {
      return {
        selectionStartLineNumber: selection.startLineNumber,
        selectionStartColumn: selection.startColumn,
        positionLineNumber: selection.endLineNumber,
        positionColumn: selection.endColumn
      };
    });
    
    editorRef.current.setSelections(editorSelections);
  }, []);

  // 현재 선택 영역 가져오기
  const getSelectionsFromEditor = useCallback(() => {
    if (!editorRef.current) return [];
    
    const selections = editorRef.current.getSelections();
    if (!selections) return [];
    
    return selections.map((selection: any) => {
      return {
        startLineNumber: selection.selectionStartLineNumber,
        startColumn: selection.selectionStartColumn,
        endLineNumber: selection.positionLineNumber,
        endColumn: selection.positionColumn
      };
    });
  }, []);
  
  return {
    gcode,
    fileName,
    filePath,
    validationErrors,
    isValid,
    fontFamily,
    fontSize,
    wordWrap,
    showLineNumbers,
    showMinimap,
    findText,
    replaceText,
    findReplaceVisible,
    matchCase,
    useRegex,
    wholeWord,
    findResults,
    cursorPosition,
    scrollPosition,
    handleEditorDidMount,
    handleEditorChange,
    toggleFindReplace,
    undo,
    redo,
    findNext,
    findPrevious,
    replace,
    replaceAll,
    setGcode,
    setGcodeWrapper,
    setFileName,
    setFilePath,
    setValidationErrors,
    setIsValid,
    setFontFamily,
    setFontSize,
    setWordWrap,
    setShowLineNumbers,
    setShowMinimap,
    setFindText,
    setReplaceText,
    setFindReplaceVisible,
    setMatchCase,
    setUseRegex,
    setWholeWord,
    setCursorPositionInEditor,
    setScrollPositionInEditor,
    setSelectionsInEditor,
    getSelectionsFromEditor,
    clearHighlights,
    highlightChanges
  };
}; 