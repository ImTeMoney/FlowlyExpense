import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ExpenseProvider } from './context/ExpenseContext';
import { LanguageProvider } from './context/LanguageContext';
import AppLayout from './components/Layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import GrowPage from './pages/GrowPage';

// ── Full-app Error Boundary ───────────────────────────────────────────────────
// Catches any render error anywhere in the tree and shows a recovery screen
// instead of a blank white page.  Because we're outside the context providers
// when this fires we read theme directly from localStorage.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(e: Error) {
    return { error: e };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const isDark = (localStorage.getItem('theme') ?? 'dark') !== 'light';
    const bg   = isDark ? '#0B0B1A' : '#F0F4FF';
    const card = isDark ? '#141428' : '#FFFFFF';
    const text = isDark ? '#E2E8F0' : '#1E293B';
    const muted = isDark ? '#64748B' : '#94A3B8';
    const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';

    return (
      <div style={{ minHeight: '100dvh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: text, marginBottom: 8 }}>
            האפליקציה נתקלה בשגיאה
          </div>
          <div style={{ fontSize: 13, color: muted, marginBottom: 20, lineHeight: 1.5 }}>
            לא נמחקו נתונים. לחץ על "טען מחדש" כדי לחזור לאפליקציה.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ width: '100%', padding: '12px 0', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}
          >
            טען מחדש
          </button>
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: muted, cursor: 'pointer', userSelect: 'none' }}>
              פרטי שגיאה
            </summary>
            <pre style={{ fontSize: 10, color: muted, textAlign: 'left', marginTop: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {this.state.error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ExpenseProvider>
          <Router>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/grow" element={<GrowPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </Router>
        </ExpenseProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
