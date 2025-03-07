// G코드 정의 및 설명
export interface GCodeDefinition {
  code: string;
  description: string;
  details?: string;
  brand?: string; // 브랜드별 코드 구분 (두산, 위아, 스맥 등)
}

// G코드 정의 목록
export const gcodeDefinitions: GCodeDefinition[] = [
  // G 코드
  { code: 'G0', description: '급속 이동', details: '최대 속도로 이동' },
  { code: 'G00', description: '급속 이동', details: '최대 속도로 이동' },
  { code: 'G1', description: '선형 이동', details: '지정 이송 속도(F)로 이동' },
  { code: 'G01', description: '선형 이동', details: '지정 이송 속도(F)로 이동' },
  { code: 'G2', description: '시계방향 원호', details: 'I,J,K 또는 R 값 필요' },
  { code: 'G02', description: '시계방향 원호', details: 'I,J,K 또는 R 값 필요' },
  { code: 'G3', description: '반시계방향 원호', details: 'I,J,K 또는 R 값 필요' },
  { code: 'G03', description: '반시계방향 원호', details: 'I,J,K 또는 R 값 필요' },
  { code: 'G4', description: '일시 정지', details: 'P 값으로 시간 지정' },
  { code: 'G04', description: '일시 정지', details: 'P 값으로 시간 지정' },
  { code: 'G17', description: 'XY 평면 선택', details: '원호 이동 및 드릴 사이클용' },
  { code: 'G18', description: 'XZ 평면 선택', details: '원호 이동 및 드릴 사이클용' },
  { code: 'G19', description: 'YZ 평면 선택', details: '원호 이동 및 드릴 사이클용' },
  { code: 'G20', description: '인치 단위', details: '좌표값을 인치로 해석' },
  { code: 'G21', description: '밀리미터 단위', details: '좌표값을 mm로 해석' },
  { code: 'G28', description: '원점 복귀', details: '기계 원점으로 이동' },
  { code: 'G54', description: '작업좌표계 1', details: '프리셋 작업좌표계 1 선택' },
  { code: 'G55', description: '작업좌표계 2', details: '프리셋 작업좌표계 2 선택' },
  { code: 'G56', description: '작업좌표계 3', details: '프리셋 작업좌표계 3 선택' },
  { code: 'G57', description: '작업좌표계 4', details: '프리셋 작업좌표계 4 선택' },
  { code: 'G58', description: '작업좌표계 5', details: '프리셋 작업좌표계 5 선택' },
  { code: 'G59', description: '작업좌표계 6', details: '프리셋 작업좌표계 6 선택' },
  { code: 'G90', description: '절대 좌표계', details: '좌표를 절대값으로 해석' },
  { code: 'G91', description: '상대 좌표계', details: '좌표를 상대값으로 해석' },
  { code: 'G92', description: '좌표계 오프셋', details: '현재 위치에 새 좌표값 설정' },
  
  // 공통 M 코드
  { code: 'M0', description: '프로그램 정지', details: '사용자 입력 대기' },
  { code: 'M00', description: '프로그램 정지', details: '사용자 입력 대기' },
  { code: 'M1', description: '선택적 정지', details: '선택적 정지 스위치 활성화 시 정지' },
  { code: 'M01', description: '선택적 정지', details: '선택적 정지 스위치 활성화 시 정지' },
  { code: 'M2', description: '프로그램 종료', details: '프로그램 종료 및 초기화' },
  { code: 'M02', description: '프로그램 종료', details: '프로그램 종료 및 초기화' },
  { code: 'M3', description: '스핀들 CW 회전', details: 'S 값으로 RPM 지정' },
  { code: 'M03', description: '스핀들 CW 회전', details: 'S 값으로 RPM 지정' },
  { code: 'M4', description: '스핀들 CCW 회전', details: 'S 값으로 RPM 지정' },
  { code: 'M04', description: '스핀들 CCW 회전', details: 'S 값으로 RPM 지정' },
  { code: 'M5', description: '스핀들 정지', details: '스핀들 회전 정지' },
  { code: 'M05', description: '스핀들 정지', details: '스핀들 회전 정지' },
  { code: 'M6', description: '공구 교체', details: 'T 값으로 공구 번호 지정' },
  { code: 'M06', description: '공구 교체', details: 'T 값으로 공구 번호 지정' },
  { code: 'M8', description: '냉각수 켜기', details: '냉각수 공급 시작' },
  { code: 'M08', description: '냉각수 켜기', details: '냉각수 공급 시작' },
  { code: 'M9', description: '냉각수 끄기', details: '냉각수 공급 중지' },
  { code: 'M09', description: '냉각수 끄기', details: '냉각수 공급 중지' },
  { code: 'M30', description: '프로그램 종료', details: '프로그램 종료 및 처음으로 복귀' },
  
  // 두산(DOOSAN) 전용 M 코드
  { code: 'M12', description: '척 클램프', details: '워크 클램핑', brand: 'DOOSAN' },
  { code: 'M13', description: '척 언클램프', details: '워크 언클램핑', brand: 'DOOSAN' },
  { code: 'M14', description: '테일스톡 전진', details: '테일스톡 전진', brand: 'DOOSAN' },
  { code: 'M15', description: '테일스톡 후진', details: '테일스톡 후진', brand: 'DOOSAN' },
  { code: 'M20', description: '서브 스핀들 모드', details: '서브 스핀들 제어 모드', brand: 'DOOSAN' },
  { code: 'M21', description: '메인 스핀들 모드', details: '메인 스핀들 제어 모드', brand: 'DOOSAN' },
  { code: 'M22', description: '서브 스핀들 클램프', details: '서브 스핀들 클램프', brand: 'DOOSAN' },
  { code: 'M23', description: '서브 스핀들 언클램프', details: '서브 스핀들 언클램프', brand: 'DOOSAN' },
  { code: 'M24', description: '서브 스핀들 C축 모드', details: '서브 스핀들 C축 모드', brand: 'DOOSAN' },
  { code: 'M25', description: '서브 스핀들 회전 모드', details: '서브 스핀들 회전 모드', brand: 'DOOSAN' },
  
  // 위아(HYUNDAI-WIA) 전용 M 코드
  { code: 'M10', description: '척 클램프', details: '척 클램프 작동', brand: 'WIA' },
  { code: 'M11', description: '척 언클램프', details: '척 언클램프 작동', brand: 'WIA' },
  { code: 'M17', description: 'C축 클램프', details: 'C축 클램프 작동', brand: 'WIA' },
  { code: 'M18', description: 'C축 언클램프', details: 'C축 언클램프 작동', brand: 'WIA' },
  { code: 'M19', description: '스핀들 방향 제어', details: '스핀들 방향 제어', brand: 'WIA' },
  { code: 'M41', description: '저속 기어 선택', details: '스핀들 저속 기어 선택', brand: 'WIA' },
  { code: 'M42', description: '고속 기어 선택', details: '스핀들 고속 기어 선택', brand: 'WIA' },
  { code: 'M51', description: '공구 측정 모드 ON', details: '공구 측정 모드 활성화', brand: 'WIA' },
  { code: 'M52', description: '공구 측정 모드 OFF', details: '공구 측정 모드 비활성화', brand: 'WIA' },
  
  // 스맥(SMEC) 전용 M 코드
  { code: 'M16', description: '공구 길이 측정', details: '공구 길이 자동 측정', brand: 'SMEC' },
  { code: 'M28', description: '공구 파손 감지 ON', details: '공구 파손 감지 활성화', brand: 'SMEC' },
  { code: 'M29', description: '공구 파손 감지 OFF', details: '공구 파손 감지 비활성화', brand: 'SMEC' },
  { code: 'M31', description: '칩 컨베이어 ON', details: '칩 컨베이어 작동', brand: 'SMEC' },
  { code: 'M33', description: '칩 컨베이어 OFF', details: '칩 컨베이어 정지', brand: 'SMEC' },
  { code: 'M48', description: '이송 속도 오버라이드 ON', details: '이송 속도 오버라이드 활성화', brand: 'SMEC' },
  { code: 'M49', description: '이송 속도 오버라이드 OFF', details: '이송 속도 오버라이드 비활성화', brand: 'SMEC' },
  
  // 좌표 및 파라미터
  { code: 'X', description: 'X축 좌표', details: 'X축 이동 거리/위치' },
  { code: 'Y', description: 'Y축 좌표', details: 'Y축 이동 거리/위치' },
  { code: 'Z', description: 'Z축 좌표', details: 'Z축 이동 거리/위치' },
  { code: 'I', description: 'X축 원호 중심', details: 'X축 원호 중심 오프셋' },
  { code: 'J', description: 'Y축 원호 중심', details: 'Y축 원호 중심 오프셋' },
  { code: 'K', description: 'Z축 원호 중심', details: 'Z축 원호 중심 오프셋' },
  { code: 'F', description: '이송 속도', details: '이동 속도(mm/min)' },
  { code: 'S', description: '스핀들 속도', details: '회전 속도(RPM)' },
  { code: 'P', description: '시간/반복 파라미터', details: '정지 시간/반복 횟수' },
  { code: 'R', description: '반경/높이', details: '원호 반경/사이클 높이' },
  { code: 'T', description: '공구 번호', details: '사용할 공구 번호' },
];

// 코드로 G코드 정의 찾기
export const findGCodeDefinition = (code: string): GCodeDefinition | undefined => {
  // 정확한 코드 매칭 먼저 시도
  const exactMatch = gcodeDefinitions.find(def => 
    def.code.toLowerCase() === code.toLowerCase()
  );
  
  if (exactMatch) return exactMatch;
  
  // 코드가 한 글자인 경우 (X, Y, Z 등의 좌표)
  if (code.length === 1) {
    return gcodeDefinitions.find(def => 
      def.code.toLowerCase() === code.toLowerCase()
    );
  }
  
  // G 또는 M으로 시작하는 코드 처리
  if (code.length > 1 && (code[0] === 'G' || code[0] === 'g' || code[0] === 'M' || code[0] === 'm')) {
    // 숫자 부분 추출 (G90, M03 등에서 90, 03 부분)
    const numPart = code.substring(1).replace(/^0+/, ''); // 앞의 0 제거 (G01 -> G1)
    
    // G 또는 M 접두사와 숫자 부분 결합
    const normalizedCode = code[0].toUpperCase() + numPart;
    
    return gcodeDefinitions.find(def => {
      // 정규화된 코드와 정의 코드 비교
      const defNumPart = def.code.substring(1).replace(/^0+/, '');
      const normalizedDefCode = def.code[0].toUpperCase() + defNumPart;
      return normalizedDefCode === normalizedCode;
    });
  }
  
  return undefined;
};

// 한 줄의 G코드 문자열에서 개별 코드 추출
export const parseGCodeLine = (line: string): string[] => {
  const codes: string[] = [];
  
  // G코드 및 M코드 추출 (G0, G1, M3 등)
  const codeRegex = /([GM]\d+)/gi;
  let match;
  while ((match = codeRegex.exec(line)) !== null) {
    codes.push(match[1]);
  }
  
  // 좌표 및 파라미터 추출 (X100, Y-20, F200 등)
  const paramRegex = /([XYZIJKFSPRT])-?\d*\.?\d+/gi;
  while ((match = paramRegex.exec(line)) !== null) {
    // 파라미터 코드만 추출 (X100 -> X)
    codes.push(match[1]);
  }
  
  return codes;
}; 