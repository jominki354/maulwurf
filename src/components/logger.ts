import { invoke } from '@tauri-apps/api/tauri';

// 로그 레벨 정의
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

// 로그 메시지 인터페이스
export interface LogMessage {
  level: string;
  message: string;
  timestamp: string;
}

// 로그 함수
export const log = async (level: LogLevel, message: string): Promise<void> => {
  try {
    // 콘솔에 로그 출력
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`[${level}] ${message}`);
        break;
      case LogLevel.INFO:
        console.info(`[${level}] ${message}`);
        break;
      case LogLevel.WARNING:
        console.warn(`[${level}] ${message}`);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(`[${level}] ${message}`);
        break;
    }
    
    // Rust 백엔드에 로그 전송
    await invoke('add_log_message', { level, message });
  } catch (error) {
    console.error('로그 전송 실패:', error);
  }
};

// 성능 측정 로그
export const logPerformance = async (operation: string, startTime: number): Promise<void> => {
  const endTime = performance.now();
  const duration = endTime - startTime;
  await log(LogLevel.DEBUG, `성능 측정 [${operation}]: ${duration.toFixed(2)}ms`);
};

// 컴포넌트 렌더링 로그
export const logRender = async (componentName: string): Promise<void> => {
  await log(LogLevel.DEBUG, `컴포넌트 렌더링: ${componentName}`);
};

// 에러 로그
export const logError = async (error: Error, context?: string): Promise<void> => {
  const message = context 
    ? `${context} - ${error.message}\n${error.stack}` 
    : `${error.message}\n${error.stack}`;
  await log(LogLevel.ERROR, message);
};

// 로그 가져오기
export const getLogs = async (): Promise<LogMessage[]> => {
  try {
    return await invoke<LogMessage[]>('get_logs');
  } catch (error) {
    console.error('로그 가져오기 실패:', error);
    return [];
  }
}; 