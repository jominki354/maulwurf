import { useState, useCallback } from 'react';
import { LogMessage } from '../types';
import { log, LogLevel } from '../components/logger';

export const useLogging = () => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  
  // 로그 추가
  const addLog = useCallback(async (level: string, message: string) => {
    try {
      await log(level as LogLevel, message);
    } catch (error) {
      console.error('로그 추가 오류:', error);
    }
  }, []);
  
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
  
  // 로그 가져오기
  const fetchLogs = useCallback(async () => {
    try {
      const logs = window.getDebugLogs ? window.getDebugLogs() : [];
      setLogs(logs);
      return logs;
    } catch (error) {
      console.error('로그 가져오기 오류:', error);
      return [];
    }
  }, []);
  
  // 히스토리에 추가
  const addToHistory = useCallback((change: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setHistory(prev => [`${timestamp} - ${change}`, ...prev]);
  }, []);
  
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
      default:
        return { color: '#ffffff' };
    }
  }, []);
  
  // 로그 지우기
  const clearLogs = useCallback(() => {
    setLogs([]);
    addToHistory('로그가 지워졌습니다.');
  }, [addToHistory]);
  
  return {
    logs,
    history,
    addLog,
    logInfo,
    logWarning,
    logError,
    fetchLogs,
    addToHistory,
    getLogLevelStyle,
    clearLogs,
    setLogs,
    setHistory
  };
}; 