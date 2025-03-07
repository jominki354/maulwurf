import React, { createContext, useContext, ReactNode } from 'react';
import { useEditor } from '../hooks/useEditor';
import { useTabs } from '../hooks/useTabs';
import { useFileSystem } from '../hooks/useFileSystem';
import { useTimeline } from '../hooks/useTimeline';
import { useLayout } from '../hooks/useLayout';
import { useToast } from '../hooks/useToast';
import { useLogging } from '../hooks/useLogging';

// Context 타입 정의
type AppContextType = {
  editor: ReturnType<typeof useEditor>;
  tabs: ReturnType<typeof useTabs>;
  fileSystem: ReturnType<typeof useFileSystem>;
  timeline: ReturnType<typeof useTimeline>;
  layout: ReturnType<typeof useLayout>;
  toast: ReturnType<typeof useToast>;
  logging: ReturnType<typeof useLogging>;
};

// Context 생성
const AppContext = createContext<AppContextType | undefined>(undefined);

// Context Provider 컴포넌트
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const editor = useEditor();
  const tabs = useTabs();
  const fileSystem = useFileSystem();
  const timeline = useTimeline();
  const layout = useLayout();
  const toast = useToast();
  const logging = useLogging();

  return (
    <AppContext.Provider
      value={{
        editor,
        tabs,
        fileSystem,
        timeline,
        layout,
        toast,
        logging
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// Context 사용을 위한 커스텀 훅
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}; 