/**
 * Mock customer directory. The Clientes mockup treats this as its own
 * dataset rather than deriving it live from sales (its 5 records are the
 * full-name counterparts of the first 5 abbreviated `client` names in
 * `sales.ts` — e.g. "María A." here is "María Álvarez") — kept that way
 * rather than computing it from SALES, since that's what the source
 * does and a real `users`/customer directory wouldn't be sales-derived
 * either (architecture.md §19: users come from Google sign-in, orders
 * reference them).
 */
export interface Customer {
  id: number;
  name: string;
  email: string;
  bookSlugs: string[];
  lastPurchaseISO: string;
}

export const CUSTOMERS: Customer[] = [
  {
    id: 1,
    name: 'María Álvarez',
    email: 'maria.a@example.com',
    bookSlugs: ['el-poder-de-tu-historia'],
    lastPurchaseISO: '2026-08-14',
  },
  {
    id: 2,
    name: 'Jorge Luna',
    email: 'jorge.l@example.com',
    bookSlugs: ['la-escritura-terapeutica-entra-a-la-escuela'],
    lastPurchaseISO: '2026-08-10',
  },
  {
    id: 3,
    name: 'Carla Pereyra',
    email: 'carla.p@example.com',
    bookSlugs: ['el-poder-de-tu-historia'],
    lastPurchaseISO: '2026-08-03',
  },
  {
    id: 4,
    name: 'Nicolás Ferreyra',
    email: 'nicolas.f@example.com',
    bookSlugs: ['el-poder-de-tu-historia', 'la-escritura-terapeutica-entra-a-la-escuela'],
    lastPurchaseISO: '2026-07-28',
  },
  {
    id: 5,
    name: 'Sofía Rivas',
    email: 'sofia.r@example.com',
    bookSlugs: ['la-escritura-terapeutica-entra-a-la-escuela'],
    lastPurchaseISO: '2026-07-20',
  },
];
