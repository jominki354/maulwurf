import React, { createContext, ReactNode } from 'react';
import { useEditor } from '../hooks/useEditor';
import { useTabs } from '../hooks/useTabs';
import { useFileSystem } from '../hooks/useFileSystem';
import { useTimeline } from '../hooks/useTimeline';
import { useLayout } from '../hooks/useLayout';
import { useToast } from '../hooks/useToast';
import { useLogging } from '../hooks/useLogging';

// Context 타입 정의
export type AppContextType = {
  editor: ReturnType<typeof useEditor>;
  tabs: ReturnType<typeof useTabs>;
  fileSystem: ReturnType<typeof useFileSystem>;
  timeline: ReturnType<typeof useTimeline>;
  layout: ReturnType<typeof useLayout>;
  toast: ReturnType<typeof useToast>;
  logging: ReturnType<typeof useLogging>;
};

// Context 생성
export const AppContext = createContext<AppContextType | undefined>(undefined);
AppContext.displayName = 'AppContext';

// Context Provider 컴포넌트
export default function AppProvider({ children }: { children: ReactNode }) {
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
} 