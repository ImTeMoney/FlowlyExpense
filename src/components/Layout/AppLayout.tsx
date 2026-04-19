import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart2, User, TrendingUp } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import '../../styles/index.css';

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();

  return (
    <div className="app-container">
      <main className="app-main">{children}</main>
      <nav className="bottom-nav" aria-label="Main navigation">
        <button
          className={`nav-tab ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
          aria-label={t.homeLabel}
        >
          <LayoutDashboard />
          {t.homeLabel}
        </button>
        <button
          className={`nav-tab ${location.pathname === '/analytics' ? 'active' : ''}`}
          onClick={() => navigate('/analytics')}
          aria-label={t.analyticsLabel}
        >
          <BarChart2 />
          {t.analyticsLabel}
        </button>
        <button
          className={`nav-tab ${location.pathname === '/grow' ? 'active' : ''}`}
          onClick={() => navigate('/grow')}
          aria-label={t.growLabel}
        >
          <TrendingUp />
          {t.growLabel}
        </button>
        <button
          className={`nav-tab ${location.pathname === '/settings' ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
          aria-label={t.settings}
        >
          <User />
          {t.settings}
        </button>
      </nav>
    </div>
  );
}
