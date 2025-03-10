import React, { useRef, useCallback, useEffect } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { findGCodeDefinition, parseGCodeLine } from '../../utils/gcodeDefinitions';
import { editor as monacoEditor } from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onMount: (editor: any, monaco: Monaco) => void;
  fontFamily: string;
  fontSize: number;
  wordWrap: 'on' | 'off';
  showLineNumbers: boolean;
  showMinimap: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  onMount,
  fontFamily,
  fontSize,
  wordWrap,
  showLineNumbers,
  showMinimap
}) => {
  // 에디터 참조
  const editorRef = useRef<any>(null);
  // 커서 상태 추적을 위한 참조
  const cursorStateRef = useRef({
    position: { lineNumber: 1, column: 1 },
    selection: null as monaco.Selection | null,
    hasFocus: false
  });
  
  // 실행 취소/다시 실행 상태 관리
  const undoStackRef = useRef<{
    undoStack: string[];
    redoStack: string[];
    currentContent: string;
    isUndoRedoOperation: boolean;
    lastCursorPosition: monaco.Position | null;
  }>({
    undoStack: [],
    redoStack: [],
    currentContent: value || '',
    isUndoRedoOperation: false,
    lastCursorPosition: null
  });
  
  // 실행 취소 함수
  const handleUndo = useCallback(() => {
    if (editorRef.current) {
      try {
        console.log('[실행 취소] 모나코 에디터 실행 취소 시작');
        
        // 현재 커서 위치 저장
        undoStackRef.current.lastCursorPosition = editorRef.current.getPosition();
        
        // 모나코 에디터의 실행 취소 기능 사용
        editorRef.current.trigger('keyboard', 'undo', null);
        
        // 실행 취소 후 로그
        console.log('[실행 취소] 모나코 에디터 실행 취소 완료');
        
        // 포커스 유지
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        }, 0);
      } catch (error) {
        console.error('[실행 취소] 오류 발생:', error);
      }
    } else {
      console.log('[실행 취소] 에디터 참조 없음');
    }
  }, []);
  
  // 다시 실행 함수
  const handleRedo = useCallback(() => {
    if (editorRef.current) {
      try {
        console.log('[다시 실행] 모나코 에디터 다시 실행 시작');
        
        // 현재 커서 위치 저장
        undoStackRef.current.lastCursorPosition = editorRef.current.getPosition();
        
        // 모나코 에디터의 다시 실행 기능 사용
        editorRef.current.trigger('keyboard', 'redo', null);
        
        // 다시 실행 후 로그
        console.log('[다시 실행] 모나코 에디터 다시 실행 완료');
        
        // 포커스 유지
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        }, 0);
      } catch (error) {
        console.error('[다시 실행] 오류 발생:', error);
      }
    } else {
      console.log('[다시 실행] 에디터 참조 없음');
    }
  }, []);
  
  // 에디터 내용 변경 핸들러
  const handleEditorChange = (newValue: string | undefined) => {
    // 변경 전 커서 위치 저장
    let cursorPositionBefore = null;
    let selectionBefore = null;
    
    if (editorRef.current) {
      cursorPositionBefore = editorRef.current.getPosition();
      selectionBefore = editorRef.current.getSelection();
      console.log('[에디터 변경 전] 커서 위치:', cursorPositionBefore, '선택 영역:', selectionBefore);
    }
    
    // 부모 컴포넌트의 onChange 호출
    onChange(newValue);
    
    // 변경 후 커서 위치 확인
    setTimeout(() => {
      if (editorRef.current) {
        const cursorPositionAfter = editorRef.current.getPosition();
        const selectionAfter = editorRef.current.getSelection();
        
        console.log('[에디터 변경 후] 커서 위치:', cursorPositionAfter, '선택 영역:', selectionAfter, 
          '위치 유지됨:', 
          cursorPositionBefore && cursorPositionAfter && 
          cursorPositionBefore.lineNumber === cursorPositionAfter.lineNumber && 
          cursorPositionBefore.column === cursorPositionAfter.column
        );
        
        // 포커스 상태 확인
        const hasFocus = document.activeElement === editorRef.current.getDomNode();
        console.log('[에디터 변경 후] 포커스 상태:', hasFocus);
        
        // 포커스가 없으면 다시 설정
        if (!hasFocus) {
          console.log('[에디터 변경 후] 포커스 재설정 시도');
          editorRef.current.focus();
        }
      }
    }, 0);
    
    // 현재 커서 상태 로깅
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      const selection = editorRef.current.getSelection();
      console.log('[에디터 내용 변경] 커서 위치:', position, '선택 영역:', selection);
    }
    
    // 에디터 내용 변경 이벤트 발생
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const filePath = model.uri?.path || '';
        const fileName = filePath.split('/').pop() || '새 파일';
        const tabId = model.uri?.toString() || '';
        
        // 이벤트 발생 - 커스텀 이벤트 객체 생성
        const customEvent = new CustomEvent('content-changed', {
          detail: {
            tabId,
            content: newValue || '',
            fileName,
            filePath,
            cursorPosition: editorRef.current.getPosition()
          }
        });
        
        // 이벤트 발생 - 직접 window 객체에 디스패치
        window.dispatchEvent(customEvent);
      }
    }
  };
  
  // 에디터 마운트 후 추가 설정을 위한 핸들러
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    // 에디터 참조 저장
    editorRef.current = editor;
    console.log('[에디터 마운트] 에디터 인스턴스 생성됨');
    
    // 에디터에 포커스 설정
    setTimeout(() => {
      if (editor) {
        editor.focus();
        console.log('[에디터 마운트] 에디터에 포커스 설정됨');
      }
    }, 100);
    
    // 실행 취소/다시 실행 단축키 등록
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
      console.log('[키보드 단축키] Ctrl+Z (실행 취소)');
      handleUndo();
    });
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
      console.log('[키보드 단축키] Ctrl+Shift+Z (다시 실행)');
      handleRedo();
    });
    
    // 또는 Ctrl+Y로 다시 실행 (Windows 스타일)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
      console.log('[키보드 단축키] Ctrl+Y (다시 실행)');
      handleRedo();
    });
    
    // 기존 onMount 콜백 호출
    onMount(editor, monaco);
    
    // 커서 위치 변경 이벤트 리스너
    editor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
      const position = { lineNumber: e.position.lineNumber, column: e.position.column };
      cursorStateRef.current.position = position;
      console.log('[커서 위치 변경]', position, '이전 위치:', e.secondaryPositions);
    });
    
    // 선택 영역 변경 이벤트 리스너
    editor.onDidChangeCursorSelection((e: monaco.editor.ICursorSelectionChangedEvent) => {
      cursorStateRef.current.selection = e.selection;
      console.log('[선택 영역 변경]', e.selection, '이전 선택:', e.secondarySelections);
    });
    
    // 포커스 이벤트 리스너
    editor.onDidFocusEditorText(() => {
      cursorStateRef.current.hasFocus = true;
      console.log('[에디터 포커스] 에디터가 포커스를 얻음');
    });
    
    // 포커스 해제 이벤트 리스너
    editor.onDidBlurEditorText(() => {
      cursorStateRef.current.hasFocus = false;
      console.log('[에디터 포커스 해제] 에디터가 포커스를 잃음');
      
      // 포커스 해제 후 자동으로 다시 포커스 설정 (필요한 경우)
      setTimeout(() => {
        // 다른 입력 요소에 포커스가 없는 경우에만 에디터에 다시 포커스
        const activeElement = document.activeElement;
        const isInputElement = activeElement instanceof HTMLInputElement || 
                              activeElement instanceof HTMLTextAreaElement || 
                              (activeElement && (activeElement as HTMLElement).isContentEditable);
        
        if (!isInputElement && editor) {
          console.log('[에디터 포커스 복구] 자동 포커스 시도');
          editor.focus();
        }
      }, 10);
    });
    
    // 에디터 내용 변경 이벤트 리스너
    editor.onDidChangeModelContent((e: monaco.editor.IModelContentChangedEvent) => {
      console.log('[모델 내용 변경]', e.changes, '커서 위치:', editor.getPosition());
      
      // 내용 변경 후 포커스 확인 및 복구
      setTimeout(() => {
        if (editor) {
          const hasFocus = document.activeElement === editor.getDomNode();
          console.log('[모델 내용 변경 후] 포커스 상태:', hasFocus);
          
          if (!hasFocus) {
            console.log('[모델 내용 변경 후] 포커스 복구 시도');
            editor.focus();
          }
        }
      }, 0);
    });
    
    // 에디터 여백 설정
    editor.updateOptions({
      lineDecorationsWidth: 5,
      lineNumbersMinChars: 3,
      folding: false,
      glyphMargin: false,
      // 브라우저 기본 찾기 기능 비활성화
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'never'
      },
      // Ctrl+F 단축키 비활성화
      readOnly: false
    });
    
    // Ctrl+F 단축키 재정의 (기본 브라우저 찾기 방지)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      // 커스텀 찾기 패널 표시 로직
      const editorService = editor.getContribution('editor.contrib.findController');
      if (editorService && editorService.closeFindWidget) {
        editorService.closeFindWidget();
      }
      
      // 앱 내 찾기/바꾸기 패널 표시 이벤트 발생
      const event = new CustomEvent('toggleFindReplace', { detail: { editor } });
      window.dispatchEvent(event);
      
      // 기본 동작 방지
      return null;
    });
    
    // 브라우저 기본 찾기 기능 비활성화
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const event = new CustomEvent('toggleFindReplace', { detail: { editor } });
        window.dispatchEvent(event);
      }
    });
    
    // G코드 언어 정의
    monaco.languages.register({ id: 'gcode' });
    
    // G코드 토큰 정의
    monaco.languages.setMonarchTokensProvider('gcode', {
      tokenizer: {
        root: [
          // 주석
          [/;.*$/, 'comment'],
          [/\(.*?\)/, 'comment'],
          
          // 기본 이동 G 코드
          [/\b(G0|G00)\b/, 'gcode.rapid'],
          [/\b(G1|G01)\b/, 'gcode.linear'],
          [/\b(G2|G02|G3|G03)\b/, 'gcode.arc'],
          
          // 공구 보정 관련 G 코드 (FANUC)
          [/\b(G40|G41|G42|G43|G44|G49)\b/, 'gcode.compensation'],
          
          // 공작물 좌표계 (FANUC)
          [/\b(G53|G54|G55|G56|G57|G58|G59|G54\.1|GP1|GP2|GP3|GP4)\b/, 'gcode.workpiece'],
          
          // 평면 선택 및 단위 설정
          [/\b(G17|G18|G19|G20|G21)\b/, 'gcode.plane'],
          
          // 좌표계 및 이동 모드
          [/\b(G90|G91|G92|G28|G30)\b/, 'gcode.coordinate-sys'],
          
          // 고정 사이클 (FANUC)
          [/\b(G70|G71|G72|G73|G74|G75|G76|G80|G81|G82|G83|G84|G85|G86|G87|G88|G89)\b/, 'gcode.cycle'],
          
          // 기타 G 코드
          [/\bG\d+\.?\d*\b/, 'gcode.other'],
          
          // M 코드 (FANUC)
          [/\b(M0|M1|M2|M3|M4|M5|M6|M8|M9|M30|M98|M99)\b/, 'gcode.mcode-common'],
          [/\bM\d+\.?\d*\b/, 'gcode.mcode'],
          
          // 좌표값과 파라미터
          [/[XYZIJKPQR]-?\d*\.?\d+/, 'gcode.coordinate'],
          [/[FS]-?\d*\.?\d+/, 'gcode.parameter'],
          [/[DH]\d+/, 'gcode.tool-comp'],
          [/P\d+/, 'gcode.parameter'],
          
          // 프로그램 번호 및 시퀀스 번호
          [/O\d+/, 'gcode.program'],
          [/N\d+/, 'gcode.sequence'],
          
          // 숫자
          [/-?\d*\.?\d+/, 'number'],
          
          // 기타 텍스트
          [/\w+/, 'identifier'],
        ]
      }
    });
    
    // G코드 테마 정의
    monaco.editor.defineTheme('gcode-theme-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'gcode.rapid', foreground: 'FF6B6B', fontStyle: 'bold' },
        { token: 'gcode.linear', foreground: '4ECDC4', fontStyle: 'bold' },
        { token: 'gcode.arc', foreground: '95E1D3', fontStyle: 'bold' },
        { token: 'gcode.compensation', foreground: 'FFB347', fontStyle: 'bold' },
        { token: 'gcode.workpiece', foreground: 'FFA07A', fontStyle: 'bold' },
        { token: 'gcode.plane', foreground: 'A8E6CF', fontStyle: 'bold' },
        { token: 'gcode.coordinate-sys', foreground: 'B8F2E6', fontStyle: 'bold' },
        { token: 'gcode.cycle', foreground: 'FFA07A', fontStyle: 'bold' },
        { token: 'gcode.other', foreground: 'AEC6CF', fontStyle: 'bold' },
        { token: 'gcode.mcode-common', foreground: 'FFD93D', fontStyle: 'bold' },
        { token: 'gcode.mcode', foreground: 'FFE156', fontStyle: 'bold' },
        { token: 'gcode.coordinate', foreground: '98DDCA', fontStyle: 'bold' },
        { token: 'gcode.parameter', foreground: 'FFB7B2', fontStyle: 'bold' },
        { token: 'gcode.tool-comp', foreground: 'FF9AA2', fontStyle: 'bold' },
        { token: 'gcode.program', foreground: 'DDA0DD', fontStyle: 'bold' },
        { token: 'gcode.sequence', foreground: 'E0BBE4', fontStyle: 'bold' },
        { token: 'number', foreground: 'C7F9CC' },
        { token: 'identifier', foreground: 'E2F0CB' }
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorCursor.foreground': '#FFFFFF',
        'editor.lineHighlightBackground': '#2A2D2E',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editor.selectionHighlightBackground': '#2D4765',
        'editor.findMatchBackground': '#515C6A',
        'editor.findMatchHighlightBackground': '#3A4150'
      }
    });
    
    // 테마 적용
    monaco.editor.setTheme('gcode-theme-dark');
    
    // 언어 설정
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, 'gcode');
    }
    
    // 키 바인딩 설정 - 전역 단축키가 작동하도록 에디터 단축키 비활성화
    try {
      // 에디터 내부 키 바인딩 비활성화 대신 이벤트 핸들러 추가
      editor.onKeyDown((e: any) => {
        // Ctrl+S, Ctrl+O, Ctrl+N 등의 키 조합 감지
        const isCtrl = e.ctrlKey || e.metaKey;
        if (isCtrl) {
          // 저장 (Ctrl+S)
          if (e.keyCode === monaco.KeyCode.KeyS && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            // 이벤트 버블링 방지
            window.dispatchEvent(new CustomEvent('editor-command', { detail: { command: 'save' } }));
            return;
          }
          
          // 파일 열기 (Ctrl+O)
          if (e.keyCode === monaco.KeyCode.KeyO) {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('editor-command', { detail: { command: 'open' } }));
            return;
          }
          
          // 새 파일 (Ctrl+N)
          if (e.keyCode === monaco.KeyCode.KeyN) {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('editor-command', { detail: { command: 'new' } }));
            return;
          }
          
          // 찾기 (Ctrl+F)
          if (e.keyCode === monaco.KeyCode.KeyF) {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('editor-command', { detail: { command: 'find' } }));
            return;
          }
        }
      });
    } catch (error) {
      console.error('키 바인딩 설정 오류:', error);
    }

    // G코드 호버 제공자 추가
    monaco.languages.registerHoverProvider('gcode', {
      provideHover: function(model, position) {
        const lineContent = model.getLineContent(position.lineNumber);
        
        // 라인 전체를 블록으로 처리
        const hoverRange = {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: lineContent.length + 1
        };
        
        // 프로그램 번호, N번호, 좌표값 추출
        const programMatch = lineContent.match(/O(\d+)/);
        const nNumberMatch = lineContent.match(/N(\d+)/);
        const coordMatches: Record<string, RegExpMatchArray | null> = {
          X: lineContent.match(/X(-?\d*\.?\d+)/),
          Y: lineContent.match(/Y(-?\d*\.?\d+)/),
          Z: lineContent.match(/Z(-?\d*\.?\d+)/),
          I: lineContent.match(/I(-?\d*\.?\d+)/),
          J: lineContent.match(/J(-?\d*\.?\d+)/),
          K: lineContent.match(/K(-?\d*\.?\d+)/),
          F: lineContent.match(/F(-?\d*\.?\d+)/),
          S: lineContent.match(/S(-?\d*\.?\d+)/),
          H: lineContent.match(/H(\d+)/),
          D: lineContent.match(/D(\d+)/),
          P: lineContent.match(/P(\d+)/)
        };

        // G코드와 M코드 추출
        const gcodeMatches = lineContent.match(/G\d+\.?\d*|GP\d+/g) || [];
        const mcodeMatches = lineContent.match(/M\d+/g) || [];
        
        const lineInfo = [];
        
        // 프로그램 번호 추가
        if (programMatch) {
          lineInfo.push(`### 프로그램 번호\nO${programMatch[1]}`);
        }
        
        // N번호 추가
        if (nNumberMatch) {
          lineInfo.push(`### 블록 번호\nN${nNumberMatch[1]}`);
        }
        
        // G코드 분석
        if (gcodeMatches.length > 0) {
          lineInfo.push('### G코드');
          gcodeMatches.forEach(code => {
            const def = findGCodeDefinition(code);
            if (def) {
              if (def.brand) {
                lineInfo.push(`**${code}**: ${def.description}\n_${def.brand}_`);
              } else {
                lineInfo.push(`**${code}**: ${def.description}`);
              }
            }
          });
        }
        
        // M코드 분석
        if (mcodeMatches.length > 0) {
          lineInfo.push('### M코드');
          mcodeMatches.forEach(code => {
            const def = findGCodeDefinition(code);
            if (def) {
              if (def.brand) {
                lineInfo.push(`**${code}**: ${def.description}\n_${def.brand}_`);
              } else {
                lineInfo.push(`**${code}**: ${def.description}`);
              }
            }
          });
        }
        
        // 좌표값과 파라미터 추가
        const parameters = Object.entries(coordMatches)
          .filter(([_, match]) => match !== null)
          .map(([axis, match]) => {
            if (axis === 'H') {
              return `**H${match![1]}**: 공구장 보정번호`;
            } else if (axis === 'D') {
              return `**D${match![1]}**: 공구경 보정번호`;
            } else if (axis === 'F') {
              return `**F${match![1]}**: 이송속도`;
            } else if (axis === 'S') {
              return `**S${match![1]}**: 주축회전수`;
            } else if (axis === 'P') {
              return `**P${match![1]}**: 파라미터 번호`;
            } else {
              return `**${axis}${match![1]}**: ${axis}축 위치`;
            }
          });
        
        if (parameters.length > 0) {
          lineInfo.push('### 좌표 및 파라미터');
          lineInfo.push(parameters.join('\n'));
        }

        // 현재 라인 전체 표시
        lineInfo.push('### 전체 블록');
        lineInfo.push(`\`\`\`gcode\n${lineContent.trim()}\n\`\`\``);

        return {
          range: hoverRange,
          contents: [
            { value: lineInfo.join('\n\n') }
          ]
        };
      }
    });

    // editor-command 이벤트 리스너 추가
    const handleEditorCommand = (e: CustomEvent) => {
      const { command } = e.detail;
      if (command === 'find') {
        const findController = editor.getContribution('editor.contrib.findController');
        if (findController) {
          findController.start({
            forceRevealReplace: false,
            seedSearchStringFromSelection: 'single',
            shouldFocus: true,
            shouldAnimate: true
          });
        }
      }
    };

    window.addEventListener('editor-command', handleEditorCommand as EventListener);

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      console.log('[CodeEditor] 컴포넌트 언마운트됨');
      window.removeEventListener('editor-command', handleEditorCommand as EventListener);
    };
  };

  // 컴포넌트 마운트/언마운트 시 디버깅 로그
  useEffect(() => {
    console.log('[CodeEditor] 컴포넌트 마운트됨');
    
    // 전역 키보드 단축키 이벤트 리스너 등록
    const handleKeyDown = (e: KeyboardEvent) => {
      // 에디터가 포커스를 가지고 있지 않을 때도 단축키 처리
      if (editorRef.current && !cursorStateRef.current.hasFocus) {
        // Ctrl+Z: 실행 취소
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
          console.log('[전역 키보드 단축키] Ctrl+Z (실행 취소)');
          e.preventDefault();
          handleUndo();
        }
        
        // Ctrl+Shift+Z 또는 Ctrl+Y: 다시 실행
        if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || (!e.shiftKey && e.key === 'y'))) {
          console.log('[전역 키보드 단축키] Ctrl+Shift+Z 또는 Ctrl+Y (다시 실행)');
          e.preventDefault();
          handleRedo();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      console.log('[CodeEditor] 컴포넌트 언마운트됨');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);
  
  // value prop 변경 시 디버깅 로그
  useEffect(() => {
    console.log('[CodeEditor] value prop 변경됨:', value?.length, '자');
  }, [value]);
  
  // 컴포넌트 렌더링 후 포커스 유지를 위한 효과
  useEffect(() => {
    // 컴포넌트가 렌더링될 때마다 에디터 포커스 확인
    if (editorRef.current) {
      const hasFocus = document.activeElement === editorRef.current.getDomNode();
      console.log('[렌더링 후] 에디터 포커스 상태:', hasFocus);
      
      if (!hasFocus) {
        console.log('[렌더링 후] 에디터 포커스 복구 시도');
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        }, 10);
      }
    }
  });

  return (
    <div className="editor-container">
      <Editor
        key="monaco-editor-instance"
        height="100%"
        defaultLanguage="gcode"
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="gcode-theme-dark"
        options={{
          fontFamily,
          fontSize,
          wordWrap,
          lineNumbers: showLineNumbers ? 'on' : 'off',
          minimap: {
            enabled: showMinimap,
            scale: 1,
            showSlider: 'mouseover',
            side: 'right',
            size: 'proportional'
          },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          tabSize: 2,
          insertSpaces: true,
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
          renderWhitespace: 'selection',
          renderControlCharacters: true,
          guides: {
            indentation: true
          },
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            useShadows: true,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            vertical: 'visible',
            horizontal: 'visible'
          },
          colorDecorators: true,
          contextmenu: true,
          folding: false,
          glyphMargin: false,
          padding: {
            top: 5,
            bottom: 5
          },
          lineDecorationsWidth: 5,
          lineNumbersMinChars: 3
        }}
      />
    </div>
  );
};

export default CodeEditor; 