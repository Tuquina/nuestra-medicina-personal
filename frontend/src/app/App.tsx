import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../public-store/pages/LoginPage/LoginPage';
import { NotFoundPage } from '../public-store/pages/NotFoundPage/NotFoundPage';

/**
 * Top-level route table.
 *
 * Only `/login` is implemented so far. `/` redirects there until the Home
 * page (architecture.md §1.3) is built — replace with a real `HomePage`
 * route at that point. Everything else (Términos, Privacidad, Catálogo,
 * Biblioteca, Checkout, Admin…) falls through to the 404 placeholder.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
