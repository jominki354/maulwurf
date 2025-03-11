import React from 'react';
import { TimelineSnapshot } from '../../types';
import TimelineItem from './TimelineItem';

interface TimelineProps {
  snapshots: TimelineSnapshot[];
  activeSnapshotIndex: number;
  onRestoreSnapshot: (index: number) => void;
  onDeleteSnapshot: (index: number, event: React.MouseEvent) => void;
  onExportSnapshot: (index: number, event: React.MouseEvent) => void;
}

const Timeline: React.FC<TimelineProps> = ({
  snapshots,
  activeSnapshotIndex,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onExportSnapshot
}) => {
  // 정렬 적용 (최신 순서로)
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return timeB - timeA; // 최신 순서
  });

  return (
    <div className="history-content">
      {sortedSnapshots.length === 0 ? (
        <div className="history-empty">스냅샷이 없습니다.</div>
      ) : (
        <ul className="history-list">
          {sortedSnapshots.map((snapshot, index) => {
            // 원래 인덱스 찾기
            const originalIndex = snapshots.findIndex(s => s.id === snapshot.id);
            
            return (
              <TimelineItem
                key={snapshot.id}
                snapshot={snapshot}
                index={index}
                totalCount={sortedSnapshots.length}
                isActive={originalIndex === activeSnapshotIndex}
                onRestore={() => onRestoreSnapshot(originalIndex)}
                onDelete={(e) => onDeleteSnapshot(originalIndex, e)}
                onExport={(e) => onExportSnapshot(originalIndex, e)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Timeline; 