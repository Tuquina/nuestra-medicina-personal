import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../shared/auth/AuthContext';
import { RequireAuth } from '../shared/auth/RequireAuth';
import { RequireAdmin } from '../shared/auth/RequireAdmin';
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
import { LibroFormPage } from '../admin/pages/LibroFormPage/LibroFormPage';
import { VentasPage } from '../admin/pages/VentasPage/VentasPage';
import { ClientesPage } from '../admin/pages/ClientesPage/ClientesPage';
import { MultimediaPage } from '../admin/pages/MultimediaPage/MultimediaPage';
import { ConfiguracionPage } from '../admin/pages/ConfiguracionPage/ConfiguracionPage';
import { PageBuilderPage } from '../admin/pages/PageBuilderPage/PageBuilderPage';
import { MeditacionesEditorPage } from '../admin/pages/CollectionPageEditor/MeditacionesEditorPage';
import { HerramientasEditorPage } from '../admin/pages/CollectionPageEditor/HerramientasEditorPage';
import { SobreElProyectoPage } from '../admin/pages/SobreElProyectoPage/SobreElProyectoPage';
import { CuponesPage } from '../admin/pages/CuponesPage/CuponesPage';
import { ResenasPage } from '../admin/pages/ResenasPage/ResenasPage';
import { AnaliticaPage } from '../admin/pages/AnaliticaPage/AnaliticaPage';
import { TerminosEditorPage } from '../admin/pages/LegalDocEditorPage/TerminosEditorPage';
import { PrivacidadEditorPage } from '../admin/pages/LegalDocEditorPage/PrivacidadEditorPage';
import { ContactoEditorPage } from '../admin/pages/AyudaEditorPages/ContactoEditorPage';
import { SoporteEditorPage } from '../admin/pages/AyudaEditorPages/SoporteEditorPage';
import { FaqEditorPage } from '../admin/pages/AyudaEditorPages/FaqEditorPage';
import { LoginPage } from '../public-store/pages/LoginPage/LoginPage';
import { TerminosPage } from '../public-store/pages/TerminosPage/TerminosPage';
import { PrivacidadPage } from '../public-store/pages/PrivacidadPage/PrivacidadPage';
import { ContactoPage } from '../public-store/pages/ContactoPage/ContactoPage';
import { SoportePage } from '../public-store/pages/SoportePage/SoportePage';
import { PreguntasFrecuentesPage } from '../public-store/pages/PreguntasFrecuentesPage/PreguntasFrecuentesPage';
import { NotFoundPage } from '../public-store/pages/NotFoundPage/NotFoundPage';

/**
 * Top-level route table. See docs/frontend-plan.md for what's implemented
 * vs. still pending, and the order new routes should land in.
 *
 * `/cuenta`, `/biblioteca` and every `/admin/*` route are nested under
 * `RequireAuth`/`RequireAdmin` (see `shared/auth`), which redirect to
 * `/login` (or show a plain "no autorizado" message) when
 * `GET /api/v1/auth/me` says there's no session / not an admin. That's a
 * UX nicety only — the real security boundary is the backend's
 * `requireAdmin`/`requireUser` middleware validating the session cookie
 * on every request (architecture.md §21).
 */
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/libros" element={<CatalogoPage />} />
        <Route path="/libros/:slug" element={<BookLandingPage />} />
        <Route path="/meditaciones" element={<MeditacionesPage />} />
        <Route path="/herramientas" element={<HerramientasPage />} />
        <Route path="/checkout/:slug" element={<CheckoutPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/cuenta" element={<MiCuentaPage />} />
          <Route path="/biblioteca" element={<BibliotecaPage />} />
        </Route>

        <Route path="/admin" element={<RequireAdmin />}>
          <Route index element={<DashboardPage />} />
          <Route path="libros" element={<LibrosListPage />} />
          <Route path="libros/nuevo" element={<LibroFormPage />} />
          <Route path="libros/:slug/editar" element={<LibroFormPage />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="multimedia" element={<MultimediaPage />} />
          <Route path="configuracion" element={<ConfiguracionPage />} />
          <Route path="paginas" element={<PageBuilderPage />} />
          <Route path="paginas/meditaciones" element={<MeditacionesEditorPage />} />
          <Route path="paginas/herramientas" element={<HerramientasEditorPage />} />
          <Route path="sobre-el-proyecto" element={<SobreElProyectoPage />} />
          <Route path="cupones" element={<CuponesPage />} />
          <Route path="resenas" element={<ResenasPage />} />
          <Route path="analitica" element={<AnaliticaPage />} />
          <Route path="legal/terminos" element={<TerminosEditorPage />} />
          <Route path="legal/privacidad" element={<PrivacidadEditorPage />} />
          <Route path="ayuda/contacto" element={<ContactoEditorPage />} />
          <Route path="ayuda/soporte" element={<SoporteEditorPage />} />
          <Route path="ayuda/preguntas-frecuentes" element={<FaqEditorPage />} />
        </Route>

        <Route path="/login" element={<LoginPage />} />
        <Route path="/terminos" element={<TerminosPage />} />
        <Route path="/privacidad" element={<PrivacidadPage />} />
        <Route path="/contacto" element={<ContactoPage />} />
        <Route path="/soporte" element={<SoportePage />} />
        <Route path="/preguntas-frecuentes" element={<PreguntasFrecuentesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
