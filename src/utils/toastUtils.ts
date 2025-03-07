import { Toast } from '../types';

// 토스트 메시지 생성
export const createToast = (
  message: string, 
  type: 'success' | 'error' | 'warning' | 'info' = 'info', 
  duration: number = 3000
): Toast => {
  return {
    id: Date.now(),
    message,
    type,
    duration,
    removing: false
  };
};

// 토스트 메시지 추가
export const addToast = (
  toasts: Toast[], 
  message: string, 
  type: 'success' | 'error' | 'warning' | 'info' = 'info', 
  duration: number = 3000
): Toast[] => {
  const newToast = createToast(message, type, duration);
  return [...toasts, newToast];
};

// 토스트 메시지 제거 표시
export const markToastForRemoval = (toasts: Toast[], id: number): Toast[] => {
  return toasts.map(toast => 
    toast.id === id ? { ...toast, removing: true } : toast
  );
};

// 토스트 메시지 제거
export const removeToast = (toasts: Toast[], id: number): Toast[] => {
  return toasts.filter(toast => toast.id !== id);
}; 