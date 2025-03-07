import React, { useRef, useCallback, useEffect } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { findGCodeDefinition, parseGCodeLine } from '../../utils/gcodeDefinitions';

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
  // 에디터 마운트 후 추가 설정을 위한 핸들러
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    // 기존 onMount 콜백 호출
    onMount(editor, monaco);
    
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
          
          // G 코드 (G0, G1, G2, G3 등)
          [/\b(G0|G00)\b/, 'gcode.rapid'],
          [/\b(G1|G01)\b/, 'gcode.linear'],
          [/\b(G2|G02|G3|G03)\b/, 'gcode.arc'],
          [/\b(G17|G18|G19|G20|G21|G28|G90|G91|G92)\b/, 'gcode.settings'],
          [/\b(G4[0-9]|G5[0-9]|G7[0-3])\b/, 'gcode.settings'],
          
          // M 코드
          [/\b(M0[0-9]|M1[0-9]|M2[0-9]|M3[0-9]|M5|M6|M8|M9)\b/, 'gcode.mcode'],
          [/\b(M0|M1|M2|M3|M4|M5|M6|M8|M9|M30)\b/, 'gcode.mcode'],
          
          // 좌표값
          [/\b[XYZ]-?[0-9]*\.?[0-9]+\b/, 'gcode.coordinate'],
          
          // 피드 레이트 및 스핀들 속도
          [/\bF-?[0-9]*\.?[0-9]+\b/, 'gcode.feed'],
          [/\bS-?[0-9]*\.?[0-9]+\b/, 'gcode.spindle'],
          
          // 기타 파라미터
          [/\b[IJKPQR]-?[0-9]*\.?[0-9]+\b/, 'gcode.parameter'],
          
          // 숫자
          [/\b[0-9]+\b/, 'number'],
          
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
        { token: 'gcode.rapid', foreground: 'FF5252', fontStyle: 'bold' },
        { token: 'gcode.linear', foreground: '4FC1FF', fontStyle: 'bold' },
        { token: 'gcode.arc', foreground: '9CDCFE', fontStyle: 'bold' },
        { token: 'gcode.settings', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'gcode.mcode', foreground: 'DCDCAA', fontStyle: 'bold' },
        { token: 'gcode.coordinate', foreground: '4EC9B0', fontStyle: 'bold' },
        { token: 'gcode.feed', foreground: 'CE9178', fontStyle: 'bold' },
        { token: 'gcode.spindle', foreground: 'B5CEA8', fontStyle: 'bold' },
        { token: 'gcode.parameter', foreground: 'D7BA7D', fontStyle: 'bold' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'identifier', foreground: 'D4D4D4' }
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
        const word = model.getWordAtPosition(position);
        
        if (!word) return null;
        
        // 현재 라인의 텍스트 가져오기
        const lineContent = model.getLineContent(position.lineNumber);
        
        // 현재 위치에 있는 코드 찾기
        let currentCode = null;
        let codeRange = null;
        
        // 1. 정확한 G코드 또는 M코드 패턴 찾기 (G0, G1, M3 등)
        const gcodePattern = /([GM]\d+)/gi;
        const matches = [...lineContent.matchAll(gcodePattern)];
        
        for (const match of matches) {
          const start = match.index || 0;
          const end = start + match[0].length;
          
          if (position.column >= start + 1 && position.column <= end + 1) {
            currentCode = match[0];
            codeRange = new monaco.Range(
              position.lineNumber,
              start + 1,
              position.lineNumber,
              end + 1
            );
            break;
          }
        }
        
        // 2. 좌표 또는 파라미터 패턴 찾기 (X, Y, Z, I, J, K, F, S, P, R, T)
        if (!currentCode) {
          const paramPattern = /([XYZIJKFSPRT])-?\d*\.?\d+/gi;
          const paramMatches = [...lineContent.matchAll(paramPattern)];
          
          for (const match of paramMatches) {
            const start = match.index || 0;
            const end = start + match[0].length;
            
            if (position.column >= start + 1 && position.column <= end + 1) {
              // 파라미터 코드만 추출 (숫자 제외)
              currentCode = match[0].charAt(0);
              codeRange = new monaco.Range(
                position.lineNumber,
                start + 1,
                position.lineNumber,
                start + 2 // 첫 글자만 (X, Y, Z 등)
              );
              break;
            }
          }
        }
        
        // 3. 한 줄로 이어진 G코드 처리 (G90G55X121.Y-16.75S4000M3 등)
        if (!currentCode && lineContent.match(/[GM]\d+[GM\d\.XYZIJKFSPRT\-]+/i)) {
          // 현재 커서 위치에서 가장 가까운 코드 찾기
          const codes = parseGCodeLine(lineContent);
          
          // 각 코드의 위치 찾기
          for (const code of codes) {
            const codeIndex = lineContent.toUpperCase().indexOf(code.toUpperCase());
            if (codeIndex >= 0) {
              const start = codeIndex;
              const end = start + code.length;
              
              // 커서가 코드 근처에 있는지 확인 (약간의 여유 허용)
              const cursorPos = position.column - 1;
              if (Math.abs(cursorPos - start) <= 3 || (cursorPos >= start && cursorPos <= end)) {
                currentCode = code;
                codeRange = new monaco.Range(
                  position.lineNumber,
                  start + 1,
                  position.lineNumber,
                  end + 1
                );
                break;
              }
            }
          }
        }
        
        // 코드 정의 찾기
        if (currentCode) {
          const definition = findGCodeDefinition(currentCode);
          
          if (definition) {
            // 브랜드 정보가 있으면 표시
            const brandInfo = definition.brand ? ` (${definition.brand})` : '';
            
            // 간소화된 툴팁 레이아웃
            return {
              range: codeRange || new monaco.Range(
                position.lineNumber,
                position.column - (word.word.length / 2),
                position.lineNumber,
                position.column + (word.word.length / 2)
              ),
              contents: [
                { value: `**${definition.code}${brandInfo}**: ${definition.description}` },
                { value: definition.details || '' }
              ]
            };
          }
        }
        
        return null;
      }
    });
  };

  return (
    <div className="editor-container">
      <Editor
        height="100%"
        defaultLanguage="gcode"
        value={value}
        onChange={onChange}
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