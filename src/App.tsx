import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { pageView } from './services/analytics';
import { ExpenseProvider } from './context/ExpenseContext';
import { LanguageProvider, useLang } from './context/LanguageContext';
import AppLayout from './components/Layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import Onboarding, { hasSeenOnboarding, markOnboardingDone } from './components/Onboarding';
import PWAInstallModal from './components/PWAInstallModal';
import { useInstallPrompt } from './hooks/useInstallPrompt';

const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage  = lazy(() => import('./pages/SettingsPage'));
const GrowPage      = lazy(() => import('./pages/GrowPage'));

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

function RouteTracker() {
  const { pathname } = useLocation();
  useEffect(() => { pageView(pathname); }, [pathname]);
  return null;
}

// ── App ───────────────────────────────────────────────────────────────────────

function PWAModalWrapper({ children }: { children: React.ReactNode }) {
  const { canPrompt, isIOSSafari, isStandalone } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(
    () => !!sessionStorage.getItem('pwa_prompt_dismissed')
  );

  const showPWAModal = !isStandalone && (canPrompt || isIOSSafari) && !dismissed;

  function dismissPWAModal() {
    sessionStorage.setItem('pwa_prompt_dismissed', '1');
    setDismissed(true);
  }

  return (
    <>
      {showPWAModal && <PWAInstallModal onDismiss={dismissPWAModal} />}
      {children}
    </>
  );
}

function LangSync() {
  const { lang } = useLang();
  useEffect(() => {
    document.documentElement.lang = lang === 'he' ? 'he' : 'en';
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);
  return null;
}

function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());

  useEffect(() => {
    const handler = () => setShowOnboarding(true);
    window.addEventListener('finio-show-onboarding', handler);
    return () => window.removeEventListener('finio-show-onboarding', handler);
  }, []);

  function handleOnboardingDone() {
    markOnboardingDone();
    setShowOnboarding(false);
  }

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <LangSync />
        <ExpenseProvider>
          <Router>
            <RouteTracker />
            <PWAModalWrapper>
              {showOnboarding && <Onboarding onDone={handleOnboardingDone} />}
              <AppLayout>
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/grow" element={<GrowPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </PWAModalWrapper>
          </Router>
        </ExpenseProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
