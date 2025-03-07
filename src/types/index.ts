// 토스트 메시지 인터페이스
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  removing?: boolean;
  toastId?: string; // 토스트 요소의 HTML ID
}

// 로그 메시지 인터페이스
export interface LogMessage {
  level: string;
  message: string;
  timestamp: string;
}

// 타임라인 스냅샷 인터페이스
export interface TimelineSnapshot {
  id: number;
  timestamp: Date;
  description: string;
  content: string;
  previousContent?: string;
  cursorPosition?: { lineNumber: number; column: number };
  scrollPosition?: { scrollTop: number; scrollLeft: number };
  selections?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }[];
  fileName: string;
  filePath: string;
  tabId: string;
}

// 파일 탭 인터페이스
export interface FileTab {
  id: string;
  title: string;
  fileName?: string;
  path: string | null;
  filePath?: string;
  content: string;
  isModified?: boolean;
  timelineSnapshots?: TimelineSnapshot[];
}

// 폰트 옵션
export const FONT_OPTIONS = [
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

// Window 인터페이스 확장
declare global {
  interface Window {
    getDebugLogs: () => LogMessage[];
    debugWindowClosed: () => void;
  }
} 