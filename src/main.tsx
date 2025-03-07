import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './App.css';
import AppProvider from './contexts/AppContext';

// 전역 오류 핸들러 설정
window.addEventListener('error', (event) => {
  console.error('전역 오류 발생:', event.error);
});

// 오류 경계 컴포넌트
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary 오류 발생:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          color: 'red', 
          backgroundColor: '#1e1e1e', 
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h2>앱 초기화 중 오류가 발생했습니다</h2>
          <p>{this.state.error?.message || '알 수 없는 오류'}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              marginTop: '20px',
              cursor: 'pointer'
            }}
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

try {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <AppProvider>
          <App />
        </AppProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
} catch (error) {
  console.error('앱 렌더링 오류:', error);
  
  // 오류 발생 시 기본 오류 UI 렌더링
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; background-color: #1e1e1e; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h2>앱 렌더링 중 오류가 발생했습니다</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <button 
          onclick="window.location.reload()" 
          style="padding: 8px 16px; background-color: #333; color: white; border: none; border-radius: 4px; margin-top: 20px; cursor: pointer;"
        >
          새로고침
        </button>
      </div>
    `;
  }
}