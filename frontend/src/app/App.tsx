import { Route, Routes } from 'react-router-dom';
import { HomePage } from '../public-store/pages/HomePage/HomePage';
import { LoginPage } from '../public-store/pages/LoginPage/LoginPage';
import { NotFoundPage } from '../public-store/pages/NotFoundPage/NotFoundPage';

/**
 * Top-level route table. See docs/frontend-plan.md for what's implemented
 * vs. still pending, and the order new routes should land in.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
