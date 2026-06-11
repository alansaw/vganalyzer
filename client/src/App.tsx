import { NavLink, Route, Routes } from 'react-router-dom';
import { AuthGate, useAuth } from './auth';
import { PortfolioPage } from './pages/Portfolio';
import { PositionDetailPage } from './pages/PositionDetail';
import { RecommendationsPage } from './pages/Recommendations';
import { GradesPage } from './pages/Grades';
import { MethodologyPage } from './pages/Methodology';

function AppShell() {
  const { auth, logout } = useAuth();
  return (
    <div className="app">
      <nav className="topnav">
        <div className="brand">
          <span className="logo">VG</span>
          <div>
            <strong>VG Analyzer</strong>
            <span className="tagline">Value Growth Analyzer</span>
          </div>
        </div>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Portfolio
          </NavLink>
          <NavLink to="/recommendations" className={({ isActive }) => (isActive ? 'active' : '')}>
            Recommendations
          </NavLink>
          <NavLink to="/grades" className={({ isActive }) => (isActive ? 'active' : '')}>
            Grades
          </NavLink>
          <NavLink to="/methodology" className={({ isActive }) => (isActive ? 'active' : '')}>
            Methodology
          </NavLink>
          {auth.authEnabled && (
            <div className="auth-controls">
              <span className={`role-chip ${auth.role}`}>{auth.role}</span>
              <button type="button" className="btn ghost" onClick={logout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<PortfolioPage />} />
          <Route path="/positions/:ticker" element={<PositionDetailPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/grades" element={<GradesPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}
