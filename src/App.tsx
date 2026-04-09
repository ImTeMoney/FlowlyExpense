import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ExpenseProvider } from './context/ExpenseContext';
import { LanguageProvider } from './context/LanguageContext';
import AppLayout from './components/Layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';

function App() {
  return (
    <LanguageProvider>
      <ExpenseProvider>
        <Router>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </Router>
      </ExpenseProvider>
    </LanguageProvider>
  );
}

export default App;
