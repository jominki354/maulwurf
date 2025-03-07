import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import MainLayout from './components/layout/MainLayout';
import { useApp } from './hooks/useApp';
import { LogLevel } from './components/logger';

function App() {
  const { logging } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 앱 초기화
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('앱 초기화 시작');
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
        
        // 터미널 로그 이벤트 리스너 설정
        setupTerminalLogListener();
        
        console.log('앱 초기화 완료');
        await logging.logInfo('앱 초기화 완료');
        
        // 로딩 상태 업데이트
        setTimeout(() => {
          setIsLoading(false);
        }, 1000); // 1초 지연 후 로딩 완료 처리
      } catch (error) {
        console.error("App initialization failed:", error);
        setError(`앱 초기화 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error) {
          await logging.logError(error, '앱 초기화 중 오류 발생');
        }
        setIsLoading(false); // 오류 발생 시에도 로딩 상태 해제
      }
    };

    initApp();
    
    // 전역 오류 핸들러 등록
    const handleError = async (event: ErrorEvent) => {
      console.error('앱 오류 발생:', event.error);
      setError(`앱 오류 발생: ${event.error?.message || '알 수 없는 오류'}`);
      await logging.logError(event.error, '전역 오류 발생');
      logging.addToHistory(`앱 오류가 발생했습니다: ${event.error?.message || '알 수 없는 오류'}`);
    };

    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      console.error('비동기 작업 오류:', event.reason);
      setError(`비동기 작업 오류: ${event.reason instanceof Error ? event.reason.message : String(event.reason)}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // 터미널 로그 이벤트 리스너 설정
  const setupTerminalLogListener = async () => {
    try {
      // Tauri 이벤트 리스너 설정
      const unlisten = await listen('terminal-log', (event) => {
        const { payload } = event;
        if (payload && typeof payload === 'string') {
          // 터미널 로그 메시지 처리
          logging.logTerminal(payload);
        } else if (payload && typeof payload === 'object') {
          // 구조화된 로그 메시지 처리
          const { level, message } = payload as { level: string; message: string };
          if (level && message) {
            logging.addLogToMemory(level, message);
          }
        }
      });
      
      // 컴포넌트 언마운트 시 리스너 해제를 위해 window 객체에 저장
      window.terminalLogUnlisten = unlisten;
      
      // 백엔드에서 로그 가져오기
      try {
        const terminalLogs = await invoke<string[]>('get_terminal_logs');
        if (terminalLogs && terminalLogs.length > 0) {
          terminalLogs.forEach(log => {
            logging.logTerminal(log);
          });
        }
      } catch (error) {
        console.error('터미널 로그 가져오기 오류:', error);
      }
      
      logging.logInfo('터미널 로그 리스너 설정 완료');
    } catch (error) {
      console.error('터미널 로그 리스너 설정 오류:', error);
      logging.logError('터미널 로그 리스너 설정 오류: ' + String(error));
    }
  };

  // 로딩 상태에 따라 스플래시 화면 제어
  useEffect(() => {
    if (!isLoading) {
      const splashScreen = document.getElementById('splash-screen');
      if (splashScreen) {
        splashScreen.classList.add('hidden');
        // 애니메이션 완료 후 요소 제거
        setTimeout(() => {
          splashScreen.remove();
        }, 500);
      }
    }
  }, [isLoading]);

  // 오류가 있으면 오류 메시지 표시
  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        color: 'red', 
        backgroundColor: '#1e1e1e', 
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <h2>오류가 발생했습니다</h2>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginTop: '20px',
            cursor: 'pointer'
          }}
        >
          새로고침
        </button>
      </div>
    );
  }

  // 로딩 중이면 로딩 메시지 표시 (스플래시 화면이 이미 있으므로 추가 UI는 필요 없음)
  if (isLoading) {
    return null;
  }

  // 정상적인 UI 렌더링
  try {
    return <MainLayout />;
  } catch (renderError) {
    console.error('UI 렌더링 오류:', renderError);
    return (
      <div style={{ 
        padding: '20px', 
        color: 'red', 
        backgroundColor: '#1e1e1e', 
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <h2>UI 렌더링 오류</h2>
        <p>{renderError instanceof Error ? renderError.message : String(renderError)}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginTop: '20px',
            cursor: 'pointer'
          }}
        >
          새로고침
        </button>
      </div>
    );
  }
}

// Window 인터페이스 확장
declare global {
  interface Window {
    getDebugLogs: () => import('./types').LogMessage[];
    debugWindowClosed: () => void;
    terminalLogUnlisten?: () => void;
  }
}

export default App; 