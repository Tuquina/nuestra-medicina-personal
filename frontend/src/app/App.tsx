import { Route, Routes } from 'react-router-dom';
import { HomePage } from '../public-store/pages/HomePage/HomePage';
import { CatalogoPage } from '../public-store/pages/CatalogoPage/CatalogoPage';
import { BookLandingPage } from '../public-store/pages/BookLandingPage/BookLandingPage';
import { MeditacionesPage } from '../public-store/pages/MeditacionesPage/MeditacionesPage';
import { HerramientasPage } from '../public-store/pages/HerramientasPage/HerramientasPage';
import { MiCuentaPage } from '../public-store/pages/MiCuentaPage/MiCuentaPage';
import { BibliotecaPage } from '../public-store/pages/BibliotecaPage/BibliotecaPage';
import { CheckoutPage } from '../public-store/pages/CheckoutPage/CheckoutPage';
import { DashboardPage } from '../admin/pages/DashboardPage/DashboardPage';
import { LibrosListPage } from '../admin/pages/LibrosListPage/LibrosListPage';
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
      <Route path="/libros" element={<CatalogoPage />} />
      <Route path="/libros/:slug" element={<BookLandingPage />} />
      <Route path="/meditaciones" element={<MeditacionesPage />} />
      <Route path="/herramientas" element={<HerramientasPage />} />
      <Route path="/cuenta" element={<MiCuentaPage />} />
      <Route path="/biblioteca" element={<BibliotecaPage />} />
      <Route path="/checkout/:slug" element={<CheckoutPage />} />
      <Route path="/admin" element={<DashboardPage />} />
      <Route path="/admin/libros" element={<LibrosListPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
