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
    
    // 커서 위치 설정 및 해당 라인으로 스크롤
    editorRef.current.setPosition({
      lineNumber: range.startLineNumber,
      column: range.startColumn
    });
    editorRef.current.revealLineInCenter(range.startLineNumber);
    
    // 3초 후 하이라이트 제거
    setTimeout(() => {
      clearFindHighlights();
    }, 3000);
  }, [clearFindHighlights, findText]);
  
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
    
    // 커서 위치 설정 및 해당 라인으로 스크롤
    editorRef.current.setPosition({
      lineNumber: range.startLineNumber,
      column: range.startColumn + replaceText.length
    });
    editorRef.current.revealLineInCenter(range.startLineNumber);
    
    // 토스트 알림 표시 (AppContext의 toast 사용)
    if (window.dispatchEvent) {
      const event = new CustomEvent('showToast', { 
        detail: { 
          type: 'success', 
          message: `"${findText}"를 "${replaceText}"로 변경` 
        } 
      });
      window.dispatchEvent(event);
    }
    
    // 3초 후 하이라이트 제거
    setTimeout(() => {
      clearReplaceHighlights();
    }, 3000);
  }, [clearReplaceHighlights, findText, replaceText]);
  
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
    
    // 마지막 바꾸기 위치로 커서 이동 및 스크롤
    if (ranges.length > 0) {
      const lastRange = ranges[0]; // 첫 번째 범위가 마지막으로 바꾼 위치 (역순으로 정렬되어 있음)
      editorRef.current.setPosition({
        lineNumber: lastRange.startLineNumber,
        column: lastRange.startColumn + replaceText.length
      });
      editorRef.current.revealLineInCenter(lastRange.startLineNumber);
    }
    
    // 토스트 알림 표시 (AppContext의 toast 사용)
    if (window.dispatchEvent) {
      const event = new CustomEvent('showToast', { 
        detail: { 
          type: 'success', 
          message: `${ranges.length}개의 "${findText}"를 "${replaceText}"로 변경` 
        } 
      });
      window.dispatchEvent(event);
    }
    
    // 3초 후 하이라이트 제거
    setTimeout(() => {
      clearReplaceHighlights();
    }, 3000);
  }, [clearReplaceHighlights, findText, replaceText]);
  
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
  
  // 찾기/바꾸기 토글
  const toggleFindReplace = useCallback(() => {
    setFindReplaceVisible(prev => !prev);
    
    // 찾기/바꾸기 패널이 열릴 때 에디터에서 선택된 텍스트가 있으면 찾기 필드에 설정
    if (!findReplaceVisible && editorRef.current) {
      const selection = editorRef.current.getSelection();
      const selectedText = editorRef.current.getModel().getValueInRange(selection);
      
      if (selectedText) {
        setFindText(selectedText);
      }
    }
  }, [findReplaceVisible]);
  
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
    if (!editorRef.current || !findText) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;
    
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
      
      // 현재 위치부터 문서 끝까지 검색
      const matches = model.findMatches(
        findText,
        false, // searchOnlyEditableRange
        useRegex,
        matchCase,
        wholeWord ? ' \t\n,.;:\'"`~!@#$%^&*()-=+[]{}\\|/?<>' : null,
        false, // captureMatches
        1, // 최대 1개 결과
        startPosition
      );
      
      // 결과가 있으면 해당 위치로 이동
      if (matches && matches.length > 0) {
        const match = matches[0];
        
        // 선택 영역 설정
        editor.setSelection(match.range);
        
        // 해당 위치로 스크롤
        editor.revealRangeInCenter(match.range);
        
        // 하이라이트 적용
        highlightFindResult(match.range);
        
        // 토스트 알림 표시
        showToastMessage('info', `"${findText}" 찾음`);
        
        return true;
      } else {
        // 문서 처음부터 현재 위치까지 검색
        const firstPosition = { lineNumber: 1, column: 1 };
        const matchesFromStart = model.findMatches(
          findText,
          false,
          useRegex,
          matchCase,
          wholeWord ? ' \t\n,.;:\'"`~!@#$%^&*()-=+[]{}\\|/?<>' : null,
          false,
          1,
          firstPosition
        );
        
        if (matchesFromStart && matchesFromStart.length > 0) {
          const match = matchesFromStart[0];
          
          // 선택 영역 설정
          editor.setSelection(match.range);
          
          // 해당 위치로 스크롤
          editor.revealRangeInCenter(match.range);
          
          // 하이라이트 적용
          highlightFindResult(match.range);
          
          // 토스트 알림 표시
          showToastMessage('info', `"${findText}" 찾음 (처음으로 돌아옴)`);
          
          return true;
        } else {
          // 결과가 없음
          showToastMessage('warning', `"${findText}" 찾을 수 없음`);
          
          return false;
        }
      }
    } catch (error) {
      console.error('다음 찾기 오류:', error);
      return false;
    }
  }, [findText, useRegex, matchCase, wholeWord, highlightFindResult, showToastMessage]);
  
  // 이전 찾기
  const findPrevious = useCallback(() => {
    if (!editorRef.current || !findText) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;
    
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
      
      // 현재 위치부터 문서 시작까지 역방향 검색
      const matches = model.findPreviousMatches(
        findText,
        false, // searchOnlyEditableRange
        useRegex,
        matchCase,
        wholeWord ? ' \t\n,.;:\'"`~!@#$%^&*()-=+[]{}\\|/?<>' : null,
        false, // captureMatches
        1, // 최대 1개 결과
        startPosition
      );
      
      // 결과가 있으면 해당 위치로 이동
      if (matches && matches.length > 0) {
        const match = matches[0];
        
        // 선택 영역 설정
        editor.setSelection(match.range);
        
        // 해당 위치로 스크롤
        editor.revealRangeInCenter(match.range);
        
        // 하이라이트 적용
        highlightFindResult(match.range);
        
        // 토스트 알림 표시
        showToastMessage('info', `"${findText}" 찾음`);
        
        return true;
      } else {
        // 문서 끝부터 현재 위치까지 역방향 검색
        const lastLine = model.getLineCount();
        const lastLineLength = model.getLineMaxColumn(lastLine);
        const lastPosition = { lineNumber: lastLine, column: lastLineLength };
        
        const matchesFromEnd = model.findPreviousMatches(
          findText,
          false,
          useRegex,
          matchCase,
          wholeWord ? ' \t\n,.;:\'"`~!@#$%^&*()-=+[]{}\\|/?<>' : null,
          false,
          1,
          lastPosition
        );
        
        if (matchesFromEnd && matchesFromEnd.length > 0) {
          const match = matchesFromEnd[0];
          
          // 선택 영역 설정
          editor.setSelection(match.range);
          
          // 해당 위치로 스크롤
          editor.revealRangeInCenter(match.range);
          
          // 하이라이트 적용
          highlightFindResult(match.range);
          
          // 토스트 알림 표시
          showToastMessage('info', `"${findText}" 찾음 (끝으로 돌아옴)`);
          
          return true;
        } else {
          // 결과가 없음
          showToastMessage('warning', `"${findText}" 찾을 수 없음`);
          
          return false;
        }
      }
    } catch (error) {
      console.error('이전 찾기 오류:', error);
      return false;
    }
  }, [findText, useRegex, matchCase, wholeWord, highlightFindResult, showToastMessage]);
  
  // 바꾸기
  const replace = useCallback(() => {
    if (!editorRef.current || !findText) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;
    
    try {
      // 현재 선택 영역 가져오기
      const selection = editor.getSelection();
      
      // 선택된 텍스트 가져오기
      const selectedText = model.getValueInRange(selection);
      
      // 선택된 텍스트가 검색어와 일치하는지 확인
      let isMatch = false;
      
      if (useRegex) {
        // 정규식 검색
        const regex = new RegExp(`^${findText}$`, matchCase ? '' : 'i');
        isMatch = regex.test(selectedText);
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
        // 바꾸기 전 범위 저장
        const replaceRange = selection.clone();
        
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
        
        // 토스트 알림 표시
        showToastMessage('success', `"${findText}"를 "${replaceText}"로 변경`);
        
        // 다음 찾기 실행
        findNext();
        
        return true;
      } else {
        // 선택된 텍스트가 검색어와 일치하지 않으면 다음 찾기 실행
        findNext();
        return false;
      }
    } catch (error) {
      console.error('바꾸기 오류:', error);
      return false;
    }
  }, [findText, replaceText, useRegex, matchCase, wholeWord, findNext, highlightReplaceResult, showToastMessage]);
  
  // 모두 바꾸기
  const replaceAll = useCallback(() => {
    if (!editorRef.current || !findText) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;
    
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
        showToastMessage('warning', `"${findText}" 찾을 수 없음`);
        
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
      
      editor.executeEdits('replaceAll', edits);
      editor.pushUndoStop();
      
      // 바꾼 결과 하이라이트
      if (replaceRanges.length > 0) {
        highlightAllReplaceResults(replaceRanges);
      }
      
      // 토스트 알림 표시
      showToastMessage('success', `${matches.length}개의 "${findText}"를 "${replaceText}"로 변경`);
      
      return matches.length;
    } catch (error) {
      console.error('모두 바꾸기 오류:', error);
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