import { useState, useCallback } from 'react';
import { Toast } from '../types';
import { createToast, markToastForRemoval, removeToast } from '../utils/toastUtils';

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((
    message: string, 
    type: 'success' | 'error' | 'warning' | 'info' = 'info', 
    duration: number = 3000
  ) => {
    const newToast = createToast(message, type, duration);
    setToasts(prev => [...prev, newToast]);

    // 자동 제거 타이머 설정
    setTimeout(() => {
      setToasts(prev => markToastForRemoval(prev, newToast.id));
      
      // 애니메이션 후 실제 제거
      setTimeout(() => {
        setToasts(prev => removeToast(prev, newToast.id));
      }, 300);
    }, duration);
  }, []);

  const removeToastById = useCallback((id: number) => {
    setToasts(prev => markToastForRemoval(prev, id));
    
    // 애니메이션 후 실제 제거
    setTimeout(() => {
      setToasts(prev => removeToast(prev, id));
    }, 300);
  }, []);

  return {
    toasts,
    showToast,
    removeToast: removeToastById
  };
}; 