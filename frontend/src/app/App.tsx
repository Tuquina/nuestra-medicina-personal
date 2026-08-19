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
      <Route path="/admin/libros/nuevo" element={<LibroFormPage />} />
      <Route path="/admin/libros/:slug/editar" element={<LibroFormPage />} />
      <Route path="/admin/ventas" element={<VentasPage />} />
      <Route path="/admin/clientes" element={<ClientesPage />} />
      <Route path="/admin/multimedia" element={<MultimediaPage />} />
      <Route path="/admin/configuracion" element={<ConfiguracionPage />} />
      <Route path="/admin/paginas" element={<PageBuilderPage />} />
      <Route path="/admin/paginas/meditaciones" element={<MeditacionesEditorPage />} />
      <Route path="/admin/paginas/herramientas" element={<HerramientasEditorPage />} />
      <Route path="/admin/sobre-el-proyecto" element={<SobreElProyectoPage />} />
      <Route path="/admin/cupones" element={<CuponesPage />} />
      <Route path="/admin/resenas" element={<ResenasPage />} />
      <Route path="/admin/analitica" element={<AnaliticaPage />} />
      <Route path="/admin/legal/terminos" element={<TerminosEditorPage />} />
      <Route path="/admin/legal/privacidad" element={<PrivacidadEditorPage />} />
      <Route path="/admin/ayuda/contacto" element={<ContactoEditorPage />} />
      <Route path="/admin/ayuda/soporte" element={<SoporteEditorPage />} />
      <Route path="/admin/ayuda/preguntas-frecuentes" element={<FaqEditorPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/terminos" element={<TerminosPage />} />
      <Route path="/privacidad" element={<PrivacidadPage />} />
      <Route path="/contacto" element={<ContactoPage />} />
      <Route path="/soporte" element={<SoportePage />} />
      <Route path="/preguntas-frecuentes" element={<PreguntasFrecuentesPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
