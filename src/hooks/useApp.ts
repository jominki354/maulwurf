import { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';

// Context 사용을 위한 커스텀 훅
export function useApp() {
  try {
    const context = useContext(AppContext);
    if (context === undefined) {
      console.error('AppContext가 정의되지 않았습니다. AppProvider 내에서 useApp을 사용해야 합니다.');
      throw new Error('useApp must be used within an AppProvider');
    }
    return context;
  } catch (error) {
    console.error('useApp 훅 사용 중 오류 발생:', error);
    // 기본 값을 반환하는 대신 오류를 다시 던집니다.
    // 이렇게 하면 App 컴포넌트에서 오류를 잡아 처리할 수 있습니다.
    throw error;
  }
} 