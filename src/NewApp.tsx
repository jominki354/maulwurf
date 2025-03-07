import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import './App.css';
import MainLayout from './components/layout/MainLayout';
import { useApp } from './contexts/AppContext';
import { LogLevel } from './components/logger';

function App() {
  const { logging } = useApp();

  // 앱 초기화
  useEffect(() => {
    const initApp = async () => {
      try {
        await logging.logInfo('앱 초기화 시작');
        
        // 디버그 로그 함수 등록
        window.getDebugLogs = () => {
          return logging.logs;
        };
        
        // 디버그 창 닫힘 이벤트 핸들러
        window.debugWindowClosed = () => {
          console.log('디버그 창이 닫혔습니다.');
        };
        
        // 로그 가져오기
        await logging.fetchLogs();
        
        await logging.logInfo('앱 초기화 완료');
      } catch (error) {
        console.error("App initialization failed:", error);
        if (error instanceof Error) {
          await logging.logError(error, '앱 초기화 중 오류 발생');
        }
      }
    };
    
    initApp();
    
    // 전역 오류 핸들러 등록
    const handleError = async (event: ErrorEvent) => {
      console.error('앱 오류 발생:', event.error);
      await logging.logError(event.error, '전역 오류 발생');
      logging.addToHistory(`앱 오류가 발생했습니다: ${event.error?.message || '알 수 없는 오류'}`);
    };
    
    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      console.error('비동기 작업 오류:', event.reason);
      if (event.reason instanceof Error) {
        await logging.logError(event.reason, '비동기 작업 오류');
      } else {
        await logging.addLog(LogLevel.ERROR, `비동기 작업 오류: ${String(event.reason)}`);
      }
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [logging]);

  return <MainLayout />;
}

export default App; 