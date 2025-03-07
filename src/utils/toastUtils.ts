import { Toast } from '../types';

// 토스트 메시지 생성
export const createToast = (
  message: string, 
  type: 'success' | 'error' | 'warning' | 'info' = 'info', 
  duration: number = 3000,
  toastId?: string
): Toast => {
  return {
    id: Date.now(),
    message,
    type,
    duration,
    removing: false,
    toastId
  };
};

// 토스트 메시지 추가
export const addToast = (
  toasts: Toast[], 
  message: string, 
  type: 'success' | 'error' | 'warning' | 'info' = 'info', 
  duration: number = 3000,
  toastId?: string
): Toast[] => {
  const newToast = createToast(message, type, duration, toastId);
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