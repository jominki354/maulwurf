import { useState, useEffect, useCallback } from 'react';

// 로그 항목 타입 정의
export interface LogItem {
  timestamp: string;
  type: 'info' | 'error' | 'warning' | 'success' | 'debug' | 'command';
  message: string;
}

// 디버그 콘솔 훅
export const useDebugConsole = () => {
  // 로그 상태 관리
  const [logs, setLogs] = useState<LogItem[]>([]);
  
  // 로그 추가 함수 (타입 기반)
  const addLogByType = useCallback((type: LogItem['type'], message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [...prevLogs, { timestamp, type, message }]);
  }, []);
  
  // 로그 추가 함수 (직접 메시지와 타입 지정)
  const addLog = useCallback((message: string, type: LogItem['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [...prevLogs, { timestamp, type, message }]);
  }, []);
  
  // 로그 초기화 함수
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);
  
  // 콘솔 로그 가로채기
  useEffect(() => {
    // 원본 콘솔 메서드 저장
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;
    
    // 콘솔 로그 오버라이드
    console.log = (...args) => {
      originalConsoleLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLogByType('debug', message);
    };
    
    // 콘솔 에러 오버라이드
    console.error = (...args) => {
      originalConsoleError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLogByType('error', message);
    };
    
    // 콘솔 경고 오버라이드
    console.warn = (...args) => {
      originalConsoleWarn(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLogByType('warning', message);
    };
    
    // 콘솔 정보 오버라이드
    console.info = (...args) => {
      originalConsoleInfo(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLogByType('info', message);
    };
    
    // 클린업 함수
    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
    };
  }, [addLogByType]);
  
  // 터미널 로그 이벤트 리스너
  useEffect(() => {
    const handleTerminalLog = (event: CustomEvent) => {
      const { type, message } = event.detail;
      addLogByType(type || 'info', `터미널 로그: ${message}`);
    };
    
    // 이벤트 리스너 등록
    window.addEventListener('terminal-log', handleTerminalLog as EventListener);
    
    // 클린업 함수
    return () => {
      window.removeEventListener('terminal-log', handleTerminalLog as EventListener);
    };
  }, [addLogByType]);
  
  return {
    logs,
    addLog,
    addLogByType,
    clearLogs
  };
};

export default useDebugConsole; 