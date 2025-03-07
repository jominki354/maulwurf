// G코드 정의 및 설명
export interface GCodeDefinition {
  code: string;
  description: string;
  details?: string;
}

// G코드 정의 목록
export const gcodeDefinitions: GCodeDefinition[] = [
  // G 코드
  { code: 'G0', description: '급속 이동', details: '공구를 지정된 위치로 최대 속도로 이동합니다. 절삭이 발생하지 않습니다.' },
  { code: 'G00', description: '급속 이동', details: 'G0와 동일합니다. 공구를 지정된 위치로 최대 속도로 이동합니다.' },
  { code: 'G1', description: '선형 이동', details: '공구를 지정된 위치로 지정된 이송 속도(F)로 이동합니다. 절삭이 발생합니다.' },
  { code: 'G01', description: '선형 이동', details: 'G1과 동일합니다. 공구를 지정된 위치로 지정된 이송 속도로 이동합니다.' },
  { code: 'G2', description: '시계 방향 원호 이동', details: '시계 방향으로 원호를 그리며 이동합니다. I, J, K 또는 R 값이 필요합니다.' },
  { code: 'G02', description: '시계 방향 원호 이동', details: 'G2와 동일합니다. 시계 방향으로 원호를 그리며 이동합니다.' },
  { code: 'G3', description: '반시계 방향 원호 이동', details: '반시계 방향으로 원호를 그리며 이동합니다. I, J, K 또는 R 값이 필요합니다.' },
  { code: 'G03', description: '반시계 방향 원호 이동', details: 'G3와 동일합니다. 반시계 방향으로 원호를 그리며 이동합니다.' },
  { code: 'G4', description: '일시 정지', details: '지정된 시간(P) 동안 기계 동작을 일시 정지합니다.' },
  { code: 'G04', description: '일시 정지', details: 'G4와 동일합니다. 지정된 시간 동안 기계 동작을 일시 정지합니다.' },
  { code: 'G17', description: 'XY 평면 선택', details: '원호 이동 및 드릴 사이클에 대해 XY 평면을 선택합니다.' },
  { code: 'G18', description: 'XZ 평면 선택', details: '원호 이동 및 드릴 사이클에 대해 XZ 평면을 선택합니다.' },
  { code: 'G19', description: 'YZ 평면 선택', details: '원호 이동 및 드릴 사이클에 대해 YZ 평면을 선택합니다.' },
  { code: 'G20', description: '인치 단위 설정', details: '좌표 값을 인치 단위로 해석합니다.' },
  { code: 'G21', description: '밀리미터 단위 설정', details: '좌표 값을 밀리미터 단위로 해석합니다.' },
  { code: 'G28', description: '원점 복귀', details: '기계 원점으로 이동합니다. 중간 지점을 지정할 수 있습니다.' },
  { code: 'G90', description: '절대 좌표계', details: '모든 좌표를 절대 좌표로 해석합니다.' },
  { code: 'G91', description: '상대 좌표계', details: '모든 좌표를 현재 위치에서의 상대 좌표로 해석합니다.' },
  { code: 'G92', description: '좌표계 오프셋 설정', details: '현재 위치에 대한 새로운 좌표값을 설정합니다.' },
  
  // M 코드
  { code: 'M0', description: '프로그램 정지', details: '프로그램 실행을 일시 중지하고 사용자 입력을 기다립니다.' },
  { code: 'M00', description: '프로그램 정지', details: 'M0와 동일합니다. 프로그램 실행을 일시 중지합니다.' },
  { code: 'M1', description: '선택적 정지', details: '선택적 정지 스위치가 켜져 있을 때만 프로그램을 일시 중지합니다.' },
  { code: 'M01', description: '선택적 정지', details: 'M1과 동일합니다. 선택적 정지 기능입니다.' },
  { code: 'M2', description: '프로그램 종료', details: '프로그램 실행을 종료하고 초기 상태로 돌아갑니다.' },
  { code: 'M02', description: '프로그램 종료', details: 'M2와 동일합니다. 프로그램 실행을 종료합니다.' },
  { code: 'M3', description: '스핀들 시계 방향 회전', details: '스핀들을 시계 방향으로 회전시킵니다. S 값으로 속도를 지정합니다.' },
  { code: 'M03', description: '스핀들 시계 방향 회전', details: 'M3와 동일합니다. 스핀들을 시계 방향으로 회전시킵니다.' },
  { code: 'M4', description: '스핀들 반시계 방향 회전', details: '스핀들을 반시계 방향으로 회전시킵니다. S 값으로 속도를 지정합니다.' },
  { code: 'M04', description: '스핀들 반시계 방향 회전', details: 'M4와 동일합니다. 스핀들을 반시계 방향으로 회전시킵니다.' },
  { code: 'M5', description: '스핀들 정지', details: '스핀들 회전을 정지합니다.' },
  { code: 'M05', description: '스핀들 정지', details: 'M5와 동일합니다. 스핀들 회전을 정지합니다.' },
  { code: 'M6', description: '공구 교체', details: '지정된 공구로 교체합니다. T 값으로 공구 번호를 지정합니다.' },
  { code: 'M06', description: '공구 교체', details: 'M6과 동일합니다. 지정된 공구로 교체합니다.' },
  { code: 'M8', description: '냉각수 켜기', details: '냉각수 공급을 시작합니다.' },
  { code: 'M08', description: '냉각수 켜기', details: 'M8과 동일합니다. 냉각수 공급을 시작합니다.' },
  { code: 'M9', description: '냉각수 끄기', details: '냉각수 공급을 중지합니다.' },
  { code: 'M09', description: '냉각수 끄기', details: 'M9와 동일합니다. 냉각수 공급을 중지합니다.' },
  { code: 'M30', description: '프로그램 종료 및 리셋', details: '프로그램을 종료하고 처음으로 되돌아갑니다.' },
  
  // 좌표 및 파라미터
  { code: 'X', description: 'X축 좌표', details: 'X축 방향의 이동 거리 또는 위치를 지정합니다.' },
  { code: 'Y', description: 'Y축 좌표', details: 'Y축 방향의 이동 거리 또는 위치를 지정합니다.' },
  { code: 'Z', description: 'Z축 좌표', details: 'Z축 방향의 이동 거리 또는 위치를 지정합니다.' },
  { code: 'I', description: 'X축 원호 중심 오프셋', details: '원호 이동에서 현재 위치에서 원호 중심까지의 X축 방향 거리입니다.' },
  { code: 'J', description: 'Y축 원호 중심 오프셋', details: '원호 이동에서 현재 위치에서 원호 중심까지의 Y축 방향 거리입니다.' },
  { code: 'K', description: 'Z축 원호 중심 오프셋', details: '원호 이동에서 현재 위치에서 원호 중심까지의 Z축 방향 거리입니다.' },
  { code: 'F', description: '이송 속도', details: '공구가 이동하는 속도를 지정합니다. 단위는 mm/min 또는 inch/min입니다.' },
  { code: 'S', description: '스핀들 속도', details: '스핀들의 회전 속도를 지정합니다. 단위는 RPM(분당 회전수)입니다.' },
  { code: 'P', description: '시간 파라미터', details: '일시 정지 시간(G4)이나 반복 횟수 등을 지정합니다.' },
  { code: 'R', description: '반경 또는 높이', details: '원호 이동에서 반경을 지정하거나, 사이클에서 높이를 지정합니다.' },
  { code: 'T', description: '공구 번호', details: '사용할 공구의 번호를 지정합니다.' },
];

// 코드로 G코드 정의 찾기
export const findGCodeDefinition = (code: string): GCodeDefinition | undefined => {
  return gcodeDefinitions.find(def => 
    def.code.toLowerCase() === code.toLowerCase() || 
    (code.length > 1 && def.code.toLowerCase() === code.substring(0, 1).toLowerCase())
  );
}; 