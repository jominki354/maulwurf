# Maulwurf G코드 에디터

Maulwurf는 Tauri 프레임워크를 사용하여 개발된 G코드 에디터입니다. 이 애플리케이션은 CNC 기계, 3D 프린터 등에서 사용되는 G코드 파일을 편집하고 관리하는 데 사용할 수 있습니다.

## 주요 기능

- G코드 파일 열기 및 저장
- 구문 강조 표시
- 사용자 친화적인 인터페이스
- 크로스 플랫폼 지원 (Windows, macOS, Linux)

## 개발 환경 설정

### 필수 요구 사항

- [Node.js](https://nodejs.org/) (v14 이상)
- [Rust](https://www.rust-lang.org/) (최신 버전)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### 설치 및 실행

1. 저장소 클론:
   ```
   git clone https://github.com/yourusername/maulwurf.git
   cd maulwurf
   ```

2. 의존성 설치:
   ```
   npm install
   ```

3. 개발 모드로 실행:
   ```
   npm run tauri dev
   ```

4. 애플리케이션 빌드:
   ```
   npm run tauri build
   ```

## 라이선스

MIT 라이선스에 따라 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 기여

기여는 언제나 환영합니다! 버그 리포트, 기능 요청 또는 코드 기여를 통해 이 프로젝트를 개선하는 데 도움을 주실 수 있습니다. 