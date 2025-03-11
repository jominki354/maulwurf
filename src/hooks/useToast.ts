import { useState, useCallback, useRef } from 'react';
import { Toast } from '../types';
import { createToast, markToastForRemoval, removeToast } from '../utils/toastUtils';

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const activeToastRef = useRef<Toast | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageRef = useRef<string>('');

  const showToast = useCallback((
    message: string, 
    type: 'success' | 'error' | 'warning' | 'info' = 'info', 
    toastId?: string,
    duration: number = 3000
  ) => {
    // 메시지가 이전 메시지와 동일한지 확인
    const isSameMessage = message === lastMessageRef.current;
    lastMessageRef.current = message;
    
    // 이미 활성화된 토스트가 있는 경우
    if (activeToastRef.current) {
      // 타이머가 있으면 취소
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      
      // 동일한 메시지인 경우 하이라이트만 적용
      if (isSameMessage) {
        const toastElement = document.getElementById('active-toast');
        if (toastElement) {
          // 하이라이트 효과 적용
          toastElement.classList.remove('toast-highlight');
          void toastElement.offsetWidth; // 리플로우 강제 발생
          toastElement.classList.add('toast-highlight');
        }
        
        // 새 타이머 설정
        toastTimerRef.current = setTimeout(() => {
          setToasts(prev => markToastForRemoval(prev, activeToastRef.current!.id));
          
          // 애니메이션 후 실제 제거
          setTimeout(() => {
            setToasts([]);
            activeToastRef.current = null;
          }, 300);
          
          toastTimerRef.current = null;
        }, duration);
        
        return;
      }
      
      // 다른 메시지인 경우 내용 업데이트
      const updatedToast = {
        ...activeToastRef.current,
        message,
        type,
        removing: false
      };
      
      activeToastRef.current = updatedToast;
      setToasts([updatedToast]);
      
      // 새 타이머 설정
      toastTimerRef.current = setTimeout(() => {
        setToasts(prev => markToastForRemoval(prev, updatedToast.id));
        
        // 애니메이션 후 실제 제거
        setTimeout(() => {
          setToasts([]);
          activeToastRef.current = null;
        }, 300);
        
        toastTimerRef.current = null;
      }, duration);
      
      return;
    }
    
    // 활성화된 토스트가 없는 경우 새로 생성
    const newToast = createToast(message, type, duration, toastId || 'active-toast');
    activeToastRef.current = newToast;
    setToasts([newToast]);
    
    // 자동 제거 타이머 설정
    toastTimerRef.current = setTimeout(() => {
      setToasts(prev => markToastForRemoval(prev, newToast.id));
      
      // 애니메이션 후 실제 제거
      setTimeout(() => {
        setToasts([]);
        activeToastRef.current = null;
      }, 300);
      
      toastTimerRef.current = null;
    }, duration);
  }, []);

  const removeToastById = useCallback((id: number) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    
    setToasts(prev => markToastForRemoval(prev, id));
    
    // 애니메이션 후 실제 제거
    setTimeout(() => {
      setToasts([]);
      activeToastRef.current = null;
    }, 300);
  }, []);

  return {
    toasts,
    showToast,
    removeToast: removeToastById
  };
}; 