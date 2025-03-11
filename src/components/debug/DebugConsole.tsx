import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { useDebugConsole } from '../../hooks/useDebugConsole';
import './DebugConsole.css';

const DebugConsole: React.FC = () => {
  const { logs, clearLogs } = useDebugConsole();
  const consoleRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef<boolean>(true);
  const lastLogCountRef = useRef<number>(0);
  const [isReversed, setIsReversed] = useState<boolean>(false);
  
  // 새 로그가 추가될 때마다 스크롤을 적절한 위치로 이동
  useLayoutEffect(() => {
    if (consoleRef.current && isAutoScrollRef.current) {
      if (logs.length > lastLogCountRef.current) {
        if (isReversed) {
          scrollToBottom();
        } else {
          scrollToTop();
        }
      }
      lastLogCountRef.current = logs.length;
    }
  }, [logs, isReversed]);
  
  // 컴포넌트 마운트 시 스크롤 조정
  useEffect(() => {
    console.log('[디버그 콘솔] 컴포넌트 마운트, 스크롤 조정');
    if (isReversed) {
      scrollToBottom();
    } else {
      scrollToTop();
    }
    
    // 주기적으로 스크롤 위치 확인 및 조정
    const intervalId = setInterval(() => {
      if (isAutoScrollRef.current && consoleRef.current) {
        if (isReversed) {
          const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
          
          if (!isNearBottom) {
            console.log('[디버그 콘솔] 자동 스크롤 조정 (하단)');
            scrollToBottom();
          }
        } else {
          const { scrollTop } = consoleRef.current;
          const isNearTop = scrollTop < 100;
          
          if (!isNearTop) {
            console.log('[디버그 콘솔] 자동 스크롤 조정 (상단)');
            scrollToTop();
          }
        }
      }
    }, 2000); // 2초마다 확인
    
    return () => {
      clearInterval(intervalId);
    };
  }, [isReversed]);
  
  // 사용자 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      if (consoleRef.current) {
        if (isReversed) {
          const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
          
          if (isNearBottom !== isAutoScrollRef.current) {
            console.log('[디버그 콘솔] 자동 스크롤 상태 변경:', isAutoScrollRef.current, '->', isNearBottom);
            isAutoScrollRef.current = isNearBottom;
          }
        } else {
          const { scrollTop } = consoleRef.current;
          const isNearTop = scrollTop < 100;
          
          if (isNearTop !== isAutoScrollRef.current) {
            console.log('[디버그 콘솔] 자동 스크롤 상태 변경:', isAutoScrollRef.current, '->', isNearTop);
            isAutoScrollRef.current = isNearTop;
          }
        }
      }
    };
    
    const consoleElement = consoleRef.current;
    if (consoleElement) {
      consoleElement.addEventListener('scroll', handleScroll);
      return () => {
        consoleElement.removeEventListener('scroll', handleScroll);
      };
    }
  }, [isReversed]);
  
  // 디버그 콘솔 토글 이벤트 리스너
  useEffect(() => {
    const handleDebugConsoleToggled = (event: CustomEvent) => {
      const { visible } = event.detail;
      console.log('[디버그 콘솔] 토글 이벤트 수신:', visible);
      
      // 디버그 콘솔이 표시될 때 스크롤을 적절한 위치로 이동
      if (visible) {
        setTimeout(() => {
          if (isReversed) {
            scrollToBottom();
          } else {
            scrollToTop();
          }
          console.log('[디버그 콘솔] 자동 스크롤 실행');
        }, 100);
      }
    };
    
    window.addEventListener('debug-console-toggled', handleDebugConsoleToggled as EventListener);
    
    return () => {
      window.removeEventListener('debug-console-toggled', handleDebugConsoleToggled as EventListener);
    };
  }, [isReversed]);
  
  // 로그 타입에 따른 스타일 클래스 반환
  const getLogClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'error':
        return 'log-error';
      case 'warning':
        return 'log-warning';
      case 'info':
        return 'log-info';
      case 'success':
        return 'log-success';
      case 'command':
        return 'log-command';
      default:
        return '';
    }
  };
  
  // 스크롤을 최하단으로 이동시키는 함수
  const scrollToBottom = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  };
  
  // 스크롤을 최상단으로 이동시키는 함수
  const scrollToTop = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = 0;
    }
  };
  
  // 정렬 순서 변경 핸들러
  const toggleSortOrder = () => {
    setIsReversed(prev => !prev);
  };

  return (
    <div className="debug-console">
      <div className="debug-console-header">
        <h3>디버그 콘솔</h3>
        <div className="debug-console-actions">
          <button 
            className="sort-order-button"
            onClick={toggleSortOrder}
            title={isReversed ? "최신 로그를 아래에 표시" : "최신 로그를 위에 표시"}
          >
            {isReversed ? "↓ 최신 로그 아래" : "↑ 최신 로그 위"}
          </button>
          <button onClick={clearLogs}>지우기</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('debug-console-toggled', { detail: { visible: false } }))}>
            닫기
          </button>
        </div>
      </div>
      <div className="debug-console-content" ref={consoleRef}>
        {[...logs]
          .sort((a, b) => isReversed ? 0 : -1)
          .map((log, index) => (
            <div 
              key={index} 
              className={`log-entry log-level-${log.type.toLowerCase()}`}
            >
              <span className="log-timestamp">{log.timestamp}</span>
              <span className="log-level">[{log.type}]</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default DebugConsole; 