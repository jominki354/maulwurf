export interface TimelineSnapshot {
  id: number;
  timestamp: Date;
  description: string;
  content: string;
  cursorPosition?: { lineNumber: number; column: number };
  fileName: string;
  filePath: string;
  tabId: string;
}

export interface FileTab {
  id: string;
  fileName: string;
  filePath: string;
  content: string;
  isModified: boolean;
  timelineSnapshots: TimelineSnapshot[];
}

export const createNewTab = (): FileTab => {
  const newTabId = `tab-${Date.now()}`;
  return {
    id: newTabId,
    filePath: '',
    content: '',
    isModified: false,
    timelineSnapshots: [],
    fileName: '새 파일',
  };
}; 