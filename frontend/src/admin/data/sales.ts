/**
 * Mock sales/orders data shared by Admin Dashboard and Admin Ventas.
 *
 * Stands in for a join across `orders` + `order_items` + `payments`
 * (architecture.md §25–26) — kept as one flat record per sale here
 * since nothing in the admin UI needs the normalized shape yet. `amount`
 * is derived from the referenced book's current price rather than
 * stored separately, since this is mock data (a real order would store
 * its own historical price per architecture.md §38, not look it up live).
 */
import { BOOKS } from '../../public-store/data/books';

export type SaleStatus = 'Aprobado' | 'Pendiente' | 'Rechazado' | 'Reembolsado';

export interface Sale {
  id: string;
  dateISO: string;
  client: string;
  email: string;
  bookSlug: string;
  status: SaleStatus;
  mpId: string;
}

export const SALES: Sale[] = [
  { id: '1042', dateISO: '2026-08-17', client: 'María A.', email: 'maria.a@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Aprobado', mpId: 'MP-88213041' },
  { id: '1041', dateISO: '2026-08-15', client: 'Jorge L.', email: 'jorge.l@example.com', bookSlug: 'la-escritura-terapeutica-entra-a-la-escuela', status: 'Pendiente', mpId: 'MP-88198832' },
  { id: '1040', dateISO: '2026-08-10', client: 'Carla P.', email: 'carla.p@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Aprobado', mpId: 'MP-88150221' },
  { id: '1039', dateISO: '2026-08-03', client: 'Nicolás F.', email: 'nicolas.f@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Rechazado', mpId: 'MP-88090110' },
  { id: '1038', dateISO: '2026-07-28', client: 'Sofía R.', email: 'sofia.r@example.com', bookSlug: 'la-escritura-terapeutica-entra-a-la-escuela', status: 'Reembolsado', mpId: 'MP-87994456' },
  { id: '1037', dateISO: '2026-07-20', client: 'Diego M.', email: 'diego.m@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Aprobado', mpId: 'MP-87950032' },
  { id: '1036', dateISO: '2026-07-12', client: 'Valentina G.', email: 'valentina.g@example.com', bookSlug: 'la-escritura-terapeutica-entra-a-la-escuela', status: 'Aprobado', mpId: 'MP-87882217' },
  { id: '1035', dateISO: '2026-06-30', client: 'Pablo S.', email: 'pablo.s@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Aprobado', mpId: 'MP-87790144' },
  { id: '1034', dateISO: '2026-06-15', client: 'Lucía T.', email: 'lucia.t@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Aprobado', mpId: 'MP-87688901' },
  { id: '1033', dateISO: '2026-05-20', client: 'Martín R.', email: 'martin.r@example.com', bookSlug: 'la-escritura-terapeutica-entra-a-la-escuela', status: 'Aprobado', mpId: 'MP-87511230' },
  { id: '1032', dateISO: '2026-04-10', client: 'Ana B.', email: 'ana.b@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Aprobado', mpId: 'MP-87290087' },
  { id: '1031', dateISO: '2026-03-05', client: 'Federico N.', email: 'federico.n@example.com', bookSlug: 'la-escritura-terapeutica-entra-a-la-escuela', status: 'Aprobado', mpId: 'MP-87102254' },
  { id: '1030', dateISO: '2026-02-18', client: 'Camila O.', email: 'camila.o@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Aprobado', mpId: 'MP-86933312' },
  { id: '1029', dateISO: '2026-01-22', client: 'Julián P.', email: 'julian.p@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Aprobado', mpId: 'MP-86750098' },
  { id: '1028', dateISO: '2025-11-10', client: 'Rocío D.', email: 'rocio.d@example.com', bookSlug: 'la-escritura-terapeutica-entra-a-la-escuela', status: 'Aprobado', mpId: 'MP-86201175' },
  { id: '1027', dateISO: '2025-08-02', client: 'Tomás V.', email: 'tomas.v@example.com', bookSlug: 'el-poder-de-tu-historia', status: 'Aprobado', mpId: 'MP-85602240' },
];

export function saleBook(sale: Sale) {
  return BOOKS.find((book) => book.slug === sale.bookSlug);
}
