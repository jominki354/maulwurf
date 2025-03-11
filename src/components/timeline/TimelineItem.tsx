import React from 'react';
import { TimelineSnapshot } from '../../types';
import { SnapshotType } from '../../hooks/useTimeline';

interface TimelineItemProps {
  snapshot: TimelineSnapshot;
  index: number;
  totalCount: number;
  isActive: boolean;
  onRestore: () => void;
  onDelete: (e: React.MouseEvent<HTMLDivElement>) => void;
  onExport: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  snapshot,
  index,
  totalCount,
  isActive,
  onRestore,
  onDelete,
  onExport
}) => {
  // 시간 포맷팅
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // 1시간 이내
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}분 전`;
    }
    
    // 오늘 이내
    if (date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
      return `오늘 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // 그 외
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // 행동 유형 가져오기
  const getActionType = () => {
    const type = (snapshot as any).type;
    if (type === SnapshotType.MANUAL) return '수동 저장';
    if (type === SnapshotType.AUTO) return '자동 저장';
    if (type === SnapshotType.SAVE) return '파일 저장';
    if (type === SnapshotType.RESTORE) return '복원 지점';
    if (type === SnapshotType.OPEN) return '파일 열기';
    return '스냅샷';
  };

  // 변경 내용 분석
  const getChangeInfo = () => {
    const content = snapshot.content || '';
    const prevContent = snapshot.previousContent || '';
    
    if (!prevContent) return '';
    
    // 라인 수 변경 계산
    const prevLines = prevContent.split('\n').length;
    const currentLines = content.split('\n').length;
    const lineDiff = currentLines - prevLines;
    
    // 문자 수 변경 계산
    const prevChars = prevContent.length;
    const currentChars = content.length;
    const charDiff = currentChars - prevChars;
    
    let result = '';
    
    // 라인 변경 정보
    if (lineDiff !== 0) {
      result += lineDiff > 0 
        ? `<span class="added-lines">(+${lineDiff}줄)</span> ` 
        : `<span class="removed-lines">(${lineDiff}줄)</span> `;
    }
    
    // 문자 변경 정보
    if (charDiff !== 0) {
      result += charDiff > 0 
        ? `<span class="added-chars">(+${charDiff}자)</span>` 
        : `<span class="removed-chars">(${charDiff}자)</span>`;
    }
    
    return result;
  };

  // 이벤트 전파 방지
  const handleDeleteClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onDelete(e);
  };

  const handleExportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onExport(e);
  };

  const timestamp = snapshot.timestamp instanceof Date 
    ? snapshot.timestamp 
    : new Date(snapshot.timestamp);
    
  // 순번 계산 (전체 개수에서 역순으로)
  const sequenceNumber = totalCount - index;

  return (
    <li 
      className={`history-item ${isActive ? 'active' : ''}`}
      onClick={onRestore}
    >
      <div className="history-item-content">
        <div className="history-item-row">
          <span className="history-item-time">{formatTime(timestamp)}</span>
          <span className="history-item-type">{getActionType()}</span>
        </div>
        <div className="history-item-text">
          {snapshot.description}
          <span dangerouslySetInnerHTML={{ __html: getChangeInfo() }} />
        </div>
        <div className="history-item-actions">
          <div className="history-item-action export" onClick={handleExportClick} title="내보내기">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L12 16M12 16L8 12M12 16L16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 20H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="history-item-action delete" onClick={handleDeleteClick} title="삭제">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 7L18 19M18 7L6 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>
    </li>
  );
};

export default TimelineItem; 