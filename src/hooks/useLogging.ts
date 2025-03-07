import { useState, useCallback, useEffect } from 'react';
import { LogMessage } from '../types';
import { log, LogLevel } from '../components/logger';
import { invoke } from '@tauri-apps/api/tauri';

export const useLogging = () => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  
  // 로그 메시지를 메모리에 추가하는 함수
  const addLogToMemory = useCallback((level: string, message: string, timestamp?: string) => {
    const now = timestamp || new Date().toLocaleTimeString();
    
    // 중복 로그 방지 및 필터링
    setLogs(prevLogs => {
      // 이미 동일한 메시지가 있는지 확인 (최근 10개 로그 내에서)
      const recentLogs = prevLogs.slice(-10);
      const isDuplicate = recentLogs.some(
        log => log.message === message && log.level === level
      );
      
      // 중복 로그이면 추가하지 않음
      if (isDuplicate) {
        return prevLogs;
      }
      
      // 앱 초기화 관련 반복 로그 필터링
      if (message.includes('앱 초기화') && prevLogs.some(log => log.message.includes('앱 초기화'))) {
        // 이미 앱 초기화 로그가 있으면 추가하지 않음
        return prevLogs;
      }
      
      // 중요하지 않은 로그 필터링
      const isImportantLog = 
        // 오류 및 경고는 항상 중요
        level === 'error' || 
        level === 'warning' || 
        // 사용자 입력 관련 로그
        message.includes('입력') || 
        message.includes('클릭') || 
        message.includes('선택') || 
        // 파일 작업 관련 로그
        message.includes('파일') || 
        message.includes('저장') || 
        message.includes('열기') || 
        // 실행 관련 로그
        message.includes('실행') || 
        message.includes('시작') || 
        message.includes('종료') ||
        // 디버그 콘솔에서 직접 추가된 로그
        level === 'terminal';
      
      if (!isImportantLog) {
        // 중요하지 않은 로그는 디버그 레벨일 때만 추가
        if (level !== 'debug') {
          return prevLogs;
        }
      }
      
      // 최대 1000개 로그만 유지
      const newLogs = [...prevLogs, { level, message, timestamp: now }];
      if (newLogs.length > 1000) {
        return newLogs.slice(-1000);
      }
      return newLogs;
    });
  }, []);
  
  // 로그 추가
  const addLog = useCallback(async (level: string, message: string) => {
    try {
      // 로그를 백엔드에 전송
      await log(level as LogLevel, message);
      
      // 로그를 메모리에 추가
      addLogToMemory(level, message);
    } catch (error) {
      console.error('로그 추가 오류:', error);
      // 오류가 발생해도 메모리에는 추가
      addLogToMemory('error', `로그 추가 오류: ${error}`);
    }
  }, [addLogToMemory]);
  
  // 정보 로그
  const logInfo = useCallback(async (message: string) => {
    await addLog(LogLevel.INFO, message);
  }, [addLog]);
  
  // 경고 로그
  const logWarning = useCallback(async (message: string) => {
    await addLog(LogLevel.WARNING, message);
  }, [addLog]);
  
  // 오류 로그
  const logError = useCallback(async (message: string | Error, context?: string) => {
    if (message instanceof Error) {
      await addLog(LogLevel.ERROR, context ? `${context}: ${message.message}` : message.message);
    } else {
      await addLog(LogLevel.ERROR, context ? `${context}: ${message}` : message);
    }
  }, [addLog]);
  
  // 디버그 로그
  const logDebug = useCallback(async (message: string) => {
    await addLog(LogLevel.DEBUG, message);
  }, [addLog]);
  
  // 성공 로그
  const logSuccess = useCallback(async (message: string) => {
    await addLog('success', message);
  }, [addLog]);
  
  // 터미널 로그 (백엔드에서 전송된 로그)
  const logTerminal = useCallback((message: string) => {
    // 터미널 로그는 백엔드에 전송하지 않고 메모리에만 추가
    addLogToMemory('terminal', message);
  }, [addLogToMemory]);
  
  // 로그 인자 포맷팅
  const formatLogArgument = (arg: any): string => {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  };
  
  // 브라우저 콘솔 로그 캡처 설정
  const setupConsoleCapture = useCallback(() => {
    // 이미 설정되었는지 확인
    if ((window as any).__consoleCaptureDone) {
      return;
    }
    
    // 설정 완료 플래그 설정
    (window as any).__consoleCaptureDone = true;
    
    // 원본 콘솔 메서드 저장
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
    
    // 콘솔 로그 오버라이드
    console.log = function(...args) {
      // 원본 함수 호출
      originalConsole.log.apply(console, args);
      // 로그 캡처
      addLogToMemory('log', args.map(arg => formatLogArgument(arg)).join(' '));
    };
    
    console.info = function(...args) {
      originalConsole.info.apply(console, args);
      addLogToMemory('info', args.map(arg => formatLogArgument(arg)).join(' '));
    };
    
    console.warn = function(...args) {
      originalConsole.warn.apply(console, args);
      addLogToMemory('warning', args.map(arg => formatLogArgument(arg)).join(' '));
    };
    
    console.error = function(...args) {
      originalConsole.error.apply(console, args);
      addLogToMemory('error', args.map(arg => formatLogArgument(arg)).join(' '));
    };
    
    console.debug = function(...args) {
      originalConsole.debug.apply(console, args);
      addLogToMemory('debug', args.map(arg => formatLogArgument(arg)).join(' '));
    };
    
    console.log('콘솔 로그 캡처 설정 완료');
  }, [addLogToMemory]);
  
  // 로그 가져오기
  const fetchLogs = useCallback(async () => {
    try {
      // 백엔드에서 로그 가져오기
      const backendLogs = await invoke<LogMessage[]>('get_logs');
      
      // 백엔드 로그를 메모리에 추가
      if (backendLogs && backendLogs.length > 0) {
        setLogs(prevLogs => {
          const newLogs = [...prevLogs];
          
          // 중복 방지를 위해 이미 있는 로그는 제외
          backendLogs.forEach(log => {
            const isDuplicate = newLogs.some(
              existingLog => 
                existingLog.timestamp === log.timestamp && 
                existingLog.level === log.level && 
                existingLog.message === log.message
            );
            
            if (!isDuplicate) {
              newLogs.push(log);
            }
          });
          
          // 시간순으로 정렬
          newLogs.sort((a, b) => {
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          });
          
          // 최대 1000개 로그만 유지
          if (newLogs.length > 1000) {
            return newLogs.slice(-1000);
          }
          
          return newLogs;
        });
      }
      
      return true; // 성공 여부만 반환
    } catch (error) {
      console.error('로그 가져오기 오류:', error);
      addLogToMemory('error', `로그 가져오기 오류: ${error}`);
      return false;
    }
  }, [addLogToMemory]);
  
  // 히스토리에 추가
  const addToHistory = useCallback((change: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setHistory(prev => [`${timestamp} - ${change}`, ...prev]);
    // 히스토리 변경 사항도 로그로 기록
    addLogToMemory('history', change, timestamp);
  }, [addLogToMemory]);
  
  // 로그 레벨에 따른 스타일 반환
  const getLogLevelStyle = useCallback((level: string): React.CSSProperties => {
    switch (level.toLowerCase()) {
      case 'error':
        return { color: '#ff5555' };
      case 'warning':
        return { color: '#ffaa00' };
      case 'info':
        return { color: '#55aaff' };
      case 'debug':
        return { color: '#aaaaaa' };
      case 'success':
        return { color: '#55ff55' };
      case 'terminal':
        return { color: '#ffffff', fontFamily: 'monospace' };
      case 'log':
        return { color: '#dddddd' };
      case 'history':
        return { color: '#bb88ff' };
      default:
        return { color: '#ffffff' };
    }
  }, []);
  
  // 로그 지우기
  const clearLogs = useCallback(() => {
    setLogs([]);
    addToHistory('로그가 지워졌습니다.');
  }, [addToHistory]);
  
  // 주기적으로 백엔드 로그 가져오기
  useEffect(() => {
    // 콘솔 로그 캡처 설정 (한 번만 실행)
    setupConsoleCapture();
    
    // 초기 로그 가져오기
    fetchLogs().catch(error => {
      console.error('초기 로그 가져오기 오류:', error);
    });
    
    // 주기적으로 로그 가져오기
    const intervalId = setInterval(() => {
      fetchLogs().catch(error => {
        console.error('주기적 로그 가져오기 오류:', error);
      });
    }, 5000); // 5초마다 로그 가져오기
    
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 의존성 배열로 컴포넌트 마운트 시 한 번만 실행
  
  return {
    logs,
    history,
    addLog,
    logInfo,
    logWarning,
    logError,
    logDebug,
    logSuccess,
    logTerminal,
    fetchLogs,
    addToHistory,
    getLogLevelStyle,
    clearLogs,
    setLogs,
    setHistory,
    addLogToMemory
  };
}; 