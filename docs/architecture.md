# Arquitectura — Nuestra Medicina Personal

> Documento base de arquitectura y contexto para implementar la aplicación con asistencia de IA (Codex, Claude u otros agentes).
>
> **Estado:** propuesta inicial / fuente de verdad arquitectónica  
> **Objetivo:** mantener una solución simple, económica, segura y fácil de evolucionar, evitando sobrearquitectura.

---

## 1. Resumen ejecutivo

La aplicación será **Nuestra Medicina Personal**, una tienda y espacio digital de contenidos propios orientado inicialmente a la venta de eBooks, no un SaaS ni un marketplace multi-vendedor.

El sitio combinará comercio electrónico, contenido editorial y una identidad visual artística centrada en escritura, reflexión, naturaleza, meditación y herramientas personales.

El objetivo inicial es soportar un volumen muy pequeño:

- Aproximadamente **5 visitas por día**.
- Un catálogo inicial/máximo esperado de alrededor de **5 eBooks**.
- Un único propietario/administrador.
- Compradores autenticados mediante Google.
- Pago mediante Mercado Pago.
- Descarga protegida de los eBooks comprados.
- Administración completa del catálogo y del contenido visual del sitio.
- Dashboard de ventas y libros publicados.
- CMS/Page Builder para editar la home y las páginas individuales de cada libro sin modificar código.

La arquitectura debe priorizar:

1. Bajo costo mensual.
2. Bajo consumo de RAM/CPU.
3. Simplicidad operacional.
4. Seguridad en autenticación, pagos y descargas.
5. Código mantenible.
6. Posibilidad de crecer sin rehacer el sistema.
7. Buena compatibilidad con desarrollo asistido por IA.

---

## 1.1 Identidad del producto y dirección visual

### Nombre

```text
NUESTRA MEDICINA PERSONAL
```

El nombre debe tratarse como una parte central de la identidad del producto y no como un placeholder técnico.

### Propósito editorial

El sitio está orientado a contenidos de:

- escritura personal;
- escritura terapéutica;
- educación;
- reflexión;
- meditación;
- herramientas de desarrollo y exploración personal.

La audiencia principal incluye:

- docentes;
- público general;
- personas interesadas en escritura, introspección y bienestar personal.

### Contenidos iniciales

#### Escritura

1. **El poder de tu historia**
2. **La escritura terapéutica entra a la escuela**

#### Otras líneas temáticas

- Meditaciones.
- Caja de herramientas personales.

La arquitectura visual y de contenido no debe quedar hardcodeada exclusivamente para estos títulos. El CMS debe permitir incorporar futuros libros, colecciones y líneas temáticas sin modificar el frontend.

### Taxonomía inicial recomendada

```text
Escritura
Educación
Meditaciones
Herramientas personales
Reflexión
```

Para el MVP, `Book` puede continuar siendo la entidad comercial principal.

Si en el futuro "Meditaciones" incluye audios, videos, descargables u otros productos digitales que no sean libros, evaluar mediante ADR si corresponde evolucionar el modelo de `Book` hacia un concepto más general de `DigitalProduct`.

No generalizar el dominio preventivamente sin una necesidad real.

---

## 1.2 Dirección artística

La web debe sentirse:

- cálida;
- humana;
- contemplativa;
- natural;
- creativa;
- artística;
- cuidada editorialmente;
- profesional sin verse corporativa;
- emocional sin resultar recargada.

### Paleta conceptual

Priorizar:

- azules cálidos/profundos;
- azul cielo;
- tonos de amanecer;
- crema;
- arena;
- tierra;
- dorados suaves;
- blancos cálidos.

Evitar:

- estética clínica;
- verdes hospitalarios;
- interfaces SaaS genéricas;
- exceso de gris;
- colores excesivamente saturados;
- apariencia de plantilla de e-commerce convencional.

Los colores definitivos deberán establecerse mediante design tokens antes de implementar las pantallas completas.

### Imágenes y atmósfera

La página inicial debe contemplar una presentación visual rica, potencialmente mediante una galería, hero editorial o secuencia de imágenes.

Referencias temáticas iniciales:

1. Naturaleza.
2. Un sol saliendo / amanecer.
3. Cielo y estrellas.
4. Una mujer joven sentada sobre el césped en un prado.
5. Un hombre comiendo con un gesto de agradecimiento o bendición.
6. Un niño observando con asombro a los animales.

Estas imágenes representan conceptos, no assets definitivos.

La selección final debe mantener:

- coherencia fotográfica;
- iluminación cálida;
- composición natural;
- sensación de contemplación;
- diversidad;
- autenticidad;
- espacio visual suficiente para integrar copy cuando sea necesario.

### Estilo de composición

Se permiten composiciones editoriales más expresivas que una tienda tradicional:

- imágenes amplias;
- galerías;
- composiciones asimétricas controladas;
- superposición moderada de texto e imagen;
- bloques de cita;
- pausas visuales;
- fondos suaves;
- secciones de ancho completo;
- fotografías con fuerte protagonismo;
- tipografía editorial;
- transiciones discretas.

No sacrificar:

- legibilidad;
- accesibilidad;
- responsive;
- velocidad de carga;
- claridad de los CTA de compra.

---

## 1.3 Página de inicio — intención inicial

La home debe poder construirse enteramente desde el Page Builder.

Una composición inicial posible:

```text
Hero / presentación
        ↓
Galería visual de naturaleza y vida
        ↓
Manifiesto / introducción a Nuestra Medicina Personal
        ↓
Libros destacados
        ↓
El poder de tu historia
        ↓
La escritura terapéutica entra a la escuela
        ↓
Meditaciones
        ↓
Caja de herramientas personales
        ↓
Sobre el proyecto / autora o autor
        ↓
CTA / novedades
        ↓
Footer
```

Esta estructura es una referencia de diseño y no debe hardcodearse.

El administrador debe poder:

- reordenar secciones;
- reemplazar imágenes;
- modificar textos;
- ocultar bloques;
- cambiar fondos;
- cambiar composición;
- destacar un libro diferente;
- crear nuevas secciones.

---

## 1.4 Consideración sobre el término "medicina"

El nombre **Nuestra Medicina Personal** puede ser interpretado por algunos visitantes como relacionado con salud o tratamiento.

Si los contenidos son de escritura, reflexión, educación y bienestar, la comunicación debe evitar promesas médicas no justificadas.

Cuando corresponda, contemplar copy o disclaimer que aclare que los contenidos:

- son educativos/reflexivos;
- no sustituyen diagnóstico profesional;
- no sustituyen tratamiento médico o psicológico.

El texto legal definitivo dependerá del contenido real publicado y de las jurisdicciones donde se comercialice.

---

# 2. Stack tecnológico elegido

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | React + Vite | SPA ligera, build estático, ecosistema amplio |
| Backend | Go | Binario pequeño, excelente performance y bajo consumo |
| Base de datos | PostgreSQL | Base relacional robusta y fácil de evolucionar |
| Proxy / Web Server | Nginx | HTTPS, archivos estáticos, reverse proxy y descargas protegidas |
| Autenticación | Google OpenID Connect | Evita almacenar y gestionar contraseñas |
| Pagos | Mercado Pago Checkout Pro | Simplifica el flujo de pago y reduce superficie sensible |
| Email de aplicación | Gmail API + Google Workspace | HTTPS, dominio propio y autenticación OAuth server-to-server |
| Deploy | Docker Compose | Todo en un único servidor |
| Archivos | Disco local del VPS | Suficiente para pocos eBooks e imágenes |
| CI/CD | GitHub Actions | Build/test fuera del VPS y despliegue automatizado |
| Infraestructura | Netcup VPS 500 G12 | 2 vCore, 4 GB DDR5 ECC y 128 GB NVMe |
| SSL | Let's Encrypt | Certificados HTTPS gratuitos |

---

# 3. Arquitectura de infraestructura

La aplicación completa vivirá inicialmente en **un único Netcup VPS 500 G12**.

```text
                        INTERNET
                           │
                           ▼
                    ┌───────────────┐
                    │     NGINX     │
                    │ HTTPS / Proxy │
                    │ React static  │
                    └───────┬───────┘
                            │
                       /api/*
                            │
                            ▼
                    ┌───────────────┐
                    │     GO API    │
                    │               │
                    │ Auth          │
                    │ Books         │
                    │ Orders        │
                    │ Payments      │
                    │ CMS           │
                    │ Media         │
                    │ Dashboard     │
                    │ Email         │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  PostgreSQL   │
                    └───────────────┘

                    Disco local host
                    ├── eBooks
                    ├── portadas
                    ├── imágenes CMS
                    └── backups locales temporales
```

## Docker Compose

Servicios de runtime:

```text
docker-compose.yml

services
├── nginx
│   ├── sirve el build de React
│   ├── HTTPS / reverse proxy
│   └── entrega archivos protegidos mediante X-Accel-Redirect
│
├── api
│   └── backend Go
│
└── postgres
    └── PostgreSQL + volumen persistente
```

El frontend **no necesita un proceso Node.js en producción**.

React/Vite se compila previamente:

```text
React source
    ↓
npm run build
    ↓
dist/
    ↓
Nginx
```

---

# 4. Recursos del servidor

Servidor previsto:

```text
Netcup VPS 500 G12

2 vCore x86
4 GB DDR5 RAM ECC
128 GB NVMe
```

Para el tráfico previsto es ampliamente suficiente.

Los recursos permiten márgenes conservadores sin cambiar la arquitectura de
monolito modular ni justificar servicios adicionales.

## Reglas de operación

- No compilar normalmente en el VPS.
- Compilar frontend/backend e imágenes Docker en CI/CD.
- Mantener PostgreSQL con límites conservadores.
- Limitar el pool de conexiones de Go.
- Configurar 1–2 GB de swap como red de seguridad.
- No exponer PostgreSQL a Internet.

Configuración PostgreSQL orientativa:

```ini
shared_buffers = 128MB
work_mem = 4MB
maintenance_work_mem = 64MB
max_connections = 20
```

Pool de Go orientativo:

```text
MaxOpenConnections = 5
MaxIdleConnections = 2
```

Estos valores son un punto de partida y deberán ajustarse según métricas reales.

---

# 5. Alcance funcional

## 5.1 Web pública

Rutas conceptuales:

```text
/
├── Home
│
├── /libros
│   └── Catálogo
│
├── /libros/{slug}
│   └── Landing individual de cada libro
│
├── /login
│
├── /biblioteca
│   └── eBooks comprados por el usuario
│
└── /checkout/*
```

Características:

- Home completamente editable desde el CMS.
- Catálogo de libros.
- Página individual configurable para cada libro.
- Login con Google.
- Compra mediante Mercado Pago.
- Biblioteca personal.
- Descarga protegida.
- Diseño responsive.
- SEO configurable.
- Imágenes optimizadas.

---

# 6. Backoffice / Panel administrativo

Ruta:

```text
/admin
```

Debe estar protegida por autenticación y autorización de administrador.

Navegación propuesta:

```text
ADMIN

├── Dashboard
│
├── Libros
│   ├── Lista
│   └── Crear libro
│
├── Páginas
│   ├── Home
│   └── Páginas de libros
│
├── Ventas
│
├── Clientes
│
├── Multimedia
│
└── Configuración
```

Extensiones futuras posibles:

```text
Cupones
Reviews
Analytics
Emails
SEO avanzado
Newsletter
```

---

# 7. Dashboard

Debe mostrar como mínimo:

- Ventas totales.
- Ventas del mes.
- Ingresos totales.
- Ingresos del mes.
- Últimas ventas.
- Cantidad de libros publicados.
- Cantidad de libros en borrador.
- Cantidad de compradores.
- Evolución de ventas por período.

Ejemplo conceptual:

```text
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Ventas         │ │ Ingresos       │ │ Libros         │
│      38        │ │   $154.000     │ │      5         │
└────────────────┘ └────────────────┘ └────────────────┘
```

A esta escala, PostgreSQL puede resolver las métricas directamente mediante consultas agregadas.

No se requieren herramientas analíticas adicionales.

---

# 8. Gestión de libros

Cada libro debe tener dos grupos conceptuales de información.

## 8.1 Información comercial

Campos sugeridos:

```text
id
slug
title
subtitle
author
short_description
price
currency
isbn
publication_date
format
file_size
cover_media_id
ebook_file_path
status
created_at
updated_at
published_at
```

Estados sugeridos:

```text
DRAFT
PUBLISHED
ARCHIVED
```

## 8.2 Landing page del libro

Cada libro tendrá una página visual independiente administrada por el CMS/Page Builder.

Ejemplo:

```text
/libros/el-reino-perdido
```

Puede contener:

```text
Hero
Sinopsis
Texto + imagen
Galería
Personajes
Características
Testimonios
FAQ
Botón de compra
CTA final
```

Cada libro puede utilizar una composición distinta.

---

# 9. CMS / Page Builder

El sistema debe permitir editar visualmente:

- La página principal.
- La página de cada libro.
- Secciones.
- Textos.
- Imágenes.
- Columnas.
- Espaciado.
- Alineaciones.
- Fondos.
- CTAs.
- Componentes de venta.

La idea es aproximarse conceptualmente a:

- WordPress Gutenberg.
- Shopify Sections.
- Notion.
- Un Webflow simplificado.

No se pretende crear un Webflow completo.

La prioridad es ofrecer suficiente libertad visual manteniendo un sistema controlado, estable y fácil de mantener.

---

# 10. Modelo del editor basado en bloques

Una página será una secuencia ordenada de bloques/secciones.

Ejemplo:

```text
Página: El Reino Perdido

[ HERO ]

[ TEXTO + IMAGEN ]

[ 3 COLUMNAS ]

[ GALERÍA ]

[ FAQ ]

[ CTA ]

[ COMPRAR ]
```

Acciones necesarias:

- Agregar bloque.
- Editar.
- Duplicar.
- Eliminar.
- Ocultar/mostrar.
- Reordenar.
- Drag & drop.
- Copiar/pegar bloque.
- Guardar borrador.
- Preview.
- Publicar.

---

# 11. Tipos de bloques iniciales

## Contenido

```text
Heading
RichText
Text
Image
Image + Text
Gallery
Video
Quote
Divider
Spacer
```

## Layout

```text
Section
1 Column
2 Columns
3 Columns
4 Columns
Container
```

## Marketing

```text
Hero
CTA
Features
Benefits
Testimonials
FAQ
Banner
Author Bio
```

## E-commerce

```text
Book Cover
Book Price
Buy Button
Book Metadata
Book Description
Preview / Sample
Related Books
```

La colección de bloques debe poder crecer mediante nuevas implementaciones sin romper páginas existentes.

---

# 12. Configuración visual de bloques

Cada bloque puede tener opciones controladas.

Ejemplo:

```text
Section Settings

Background
Width
Alignment

Padding Top
Padding Bottom

Visibility
Desktop / Tablet / Mobile
```

Preferir opciones predefinidas frente a permitir CSS arbitrario.

Ejemplo:

```text
Section width:
- normal
- wide
- full

Spacing:
- none
- small
- medium
- large
- extra-large
```

Esto ayuda a:

- mantener consistencia visual;
- evitar páginas rotas;
- simplificar el editor;
- facilitar el desarrollo asistido por IA;
- mantener diseños responsive.

---

# 13. Persistencia del Page Builder

La información transaccional debe mantenerse normalizada en PostgreSQL.

El layout del CMS puede utilizar `JSONB`.

Tabla conceptual:

```text
pages
──────────────────────────────
id
type
book_id
slug
title
status
content JSONB
created_at
updated_at
published_at
```

Ejemplo conceptual de `content`:

```json
{
  "schemaVersion": 1,
  "sections": [
    {
      "id": "hero-01",
      "type": "hero",
      "props": {
        "title": "El Reino Perdido",
        "subtitle": "Una aventura...",
        "imageId": "media-123"
      }
    },
    {
      "id": "columns-01",
      "type": "columns",
      "props": {
        "columns": 2
      },
      "children": []
    }
  ]
}
```

## Regla importante

No almacenar toda la aplicación como JSON.

Usar JSONB exclusivamente para datos inherentemente flexibles:

- layout;
- configuraciones visuales;
- props de bloques.

Mantener relaciones críticas en tablas normales:

- usuarios;
- libros;
- pedidos;
- items;
- pagos;
- archivos;
- ventas.

---

# 14. Versionado de páginas

Recomendado.

Permite:

```text
Page
├── Version 1
├── Version 2
├── Version 3
└── Version 4 ← publicada
```

Tabla conceptual:

```text
page_versions
────────────────────────────
id
page_id
version_number
content JSONB
created_by
created_at
```

Funcionalidades:

- Historial de versiones.
- Restaurar una versión anterior.
- Preview de una versión.
- Mantener un borrador separado de la versión publicada.

---

# 15. Workflow editorial

Estados:

```text
DRAFT
PUBLISHED
```

Flujo:

```text
Editar
   ↓
Guardar borrador
   ↓
Preview
   ↓
Publicar
```

La web pública nunca debe mostrar cambios no publicados.

---

# 16. Biblioteca multimedia

Ruta:

```text
/admin/media
```

Funciones:

- Subir imágenes.
- Ver biblioteca.
- Buscar.
- Reutilizar imágenes.
- Eliminar elementos no utilizados.
- Ver dimensiones y peso.
- Seleccionar imagen desde el Page Builder.

Tabla conceptual:

```text
media
────────────────────
id
filename
original_filename
storage_path
mime_type
size_bytes
width
height
created_at
updated_at
```

---

# 17. Almacenamiento de archivos

Directorio sugerido:

```text
/srv/ebook-store/

├── postgres/
│   └── data/
│
├── ebooks/
│   ├── <uuid>.epub
│   └── <uuid>.pdf
│
├── media/
│   ├── 2026/
│   │   └── 08/
│   │       ├── <uuid>.webp
│   │       └── ...
│   └── ...
│
└── backups/
```

Los archivos físicos no deben almacenarse como `bytea` en PostgreSQL.

PostgreSQL guarda solamente metadata y rutas.

---

# 18. Procesamiento de imágenes

Al subir una imagen grande:

```text
original.jpg
4000x3000
8 MB
```

se recomienda generar variantes optimizadas:

```text
original.webp
400.webp
800.webp
1200.webp
```

Frontend:

- `<picture>`.
- `srcset`.
- lazy loading.
- tamaños apropiados.

Validaciones:

- MIME real.
- extensión.
- peso máximo.
- dimensiones máximas.
- evitar nombres proporcionados directamente por usuario como nombre físico.
- generar UUID para almacenamiento.

---

# 19. Autenticación

## Google OpenID Connect

No se implementará login tradicional con contraseña en el MVP.

Flujo:

```text
Usuario
   ↓
Continuar con Google
   ↓
Google
   ↓
Callback backend
   ↓
Validación identidad
   ↓
Crear / recuperar usuario
   ↓
Crear sesión
```

Tabla conceptual:

```text
users
─────────────────────
id
google_subject
email
display_name
picture_url
created_at
last_login_at
```

Usar `google_subject` como identificador externo estable.

No utilizar el email como identificador de identidad principal.

---

# 20. Sesiones

Preferencia:

```text
Cookie de sesión
HttpOnly
Secure
SameSite
```

No usar JWT solamente porque sea popular.

Para una aplicación monolítica web, una sesión tradicional ofrece simplicidad y control.

La implementación puede utilizar:

- session id opaco almacenado server-side;
- tabla de sesiones;
- expiración;
- revocación.

---

# 21. Autorización administrativa

Toda ruta:

```text
/api/admin/*
```

debe validar permisos en backend.

Nunca confiar en ocultar componentes del frontend.

MVP posible:

```text
ADMIN_GOOGLE_SUB=<google_subject>
```

O tabla:

```text
admins
────────────
user_id
```

Preferir tabla si se espera incorporar otro administrador en el futuro.

---

# 22. Mercado Pago

Integración propuesta:

```text
Mercado Pago Checkout Pro
```

Razones:

- reduce complejidad;
- la información sensible del medio de pago se procesa en Mercado Pago;
- implementación adecuada para una tienda pequeña.

---

# 23. Flujo de compra

```text
Usuario
  ↓
Comprar libro
  ↓
POST /api/orders
  ↓
Crear Order
  ↓
Crear Preference en Mercado Pago
  ↓
Redireccionar a Mercado Pago
  ↓
Usuario paga
```

El redirect de éxito NO debe considerarse prueba suficiente del pago.

---

# 24. Confirmación de pagos

Flujo correcto:

```text
Mercado Pago
     │
     │ Webhook
     ▼
POST /api/webhooks/mercadopago
     │
     ▼
Validar autenticidad
     │
     ▼
Consultar/verificar pago
     │
     ▼
Comparar order / amount / currency
     │
     ▼
status == approved
     │
     ▼
Order = PAID
```

Validaciones mínimas:

```text
payment.status == approved
external_reference == order.id
payment.amount == order.total
payment.currency == order.currency
```

El webhook debe ser **idempotente**.

Mercado Pago puede reenviar eventos.

---

# 25. Modelo de datos inicial

Entidades principales:

```text
USERS
BOOKS
PAGES
PAGE_VERSIONS
MEDIA
ORDERS
ORDER_ITEMS
PAYMENTS
SESSIONS
```

Relaciones simplificadas:

```text
USERS
  │
  ├──── SESSIONS
  │
  └──── ORDERS
          │
          ├──── PAYMENTS
          │
          └──── ORDER_ITEMS
                    │
                    ▼
                  BOOKS
                    │
                    └──── PAGES
                            │
                            └──── PAGE_VERSIONS

MEDIA
  ↑
  ├── BOOKS
  └── PAGES (referencias dentro del JSON)
```

---

# 26. Orders y Payments deben ser entidades separadas

No modelar:

```text
Order = Payment
```

Una orden representa la intención de compra.

Un pago representa una operación del proveedor.

Esto permite:

- reintentos;
- pagos pendientes;
- pagos rechazados;
- cambios de estado;
- nuevos providers futuros;
- auditoría.

Ejemplo:

```text
orders
────────────────
id
user_id
status
total
currency
created_at
paid_at

payments
────────────────
id
order_id
provider
provider_payment_id
status
amount
currency
raw_status
created_at
updated_at
```

---

# 27. Biblioteca del comprador

Endpoint conceptual:

```text
GET /api/me/books
```

Devuelve únicamente libros asociados a órdenes válidamente pagadas.

Regla conceptual:

```text
user
 ↓
orders
 ↓
status = PAID
 ↓
order_items
 ↓
books
```

---

# 28. Descarga protegida de eBooks

Los eBooks nunca deben exponerse directamente mediante una URL pública.

Incorrecto:

```text
https://site.com/ebooks/my-book.epub
```

Correcto:

```text
GET /api/books/{id}/download
```

Backend valida:

```text
usuario autenticado
+
libro existente
+
compra asociada
+
orden PAID
```

Luego:

```text
Go
 │
 │ X-Accel-Redirect
 ▼
Nginx
 │
 ▼
archivo eBook
```

Ventajas:

- Go no necesita cargar el archivo en RAM.
- Nginx puede hacer streaming eficientemente.
- El path real permanece privado.
- La autorización queda centralizada en backend.

---

# 29. SEO

Cada página debe permitir configurar:

```text
meta_title
meta_description
slug
open_graph_image
canonical_url
robots
```

Para cada libro:

```text
/libros/{slug}
```

Debe existir metadata específica.

## Consideración importante

React + Vite SPA puede ser suficiente para el MVP.

Si el SEO orgánico se convierte en una prioridad fuerte, evaluar en una etapa posterior:

- prerendering;
- SSR;
- SSG;
- migración de la web pública a Next.js u otro framework adecuado.

El panel admin puede continuar como SPA.

No migrar de tecnología sin una necesidad medible.

---

# 30. Diseño frontend

El frontend debe separar:

```text
Public Store
Admin Backoffice
Shared UI
```

Estructura conceptual:

```text
src/
├── app/
├── public-store/
├── admin/
├── features/
├── entities/
├── shared/
└── design-system/
```

No es obligatorio usar exactamente esta estructura; lo importante es mantener límites claros.

---

# 31. Design System

Como el frontend podría diseñarse con Claude Design, conviene definir un sistema visual antes de implementar pantallas completas.

Definir:

- typography;
- spacing;
- colors;
- border radius;
- shadows;
- buttons;
- inputs;
- cards;
- dialogs;
- tables;
- alerts;
- breakpoints;
- page width;
- section spacing.

Usar variables/tokens centralizados.

Evitar valores hardcodeados dispersos.

El Page Builder debe utilizar el mismo Design System que la web pública.

---

# 32. Principios UX para el Page Builder

El editor debe ser potente pero acotado.

Prioridades:

1. Fácil de entender.
2. Imposible o difícil de romper visualmente.
3. Preview fiel.
4. Drag & drop.
5. Undo/redo si el alcance lo permite.
6. Autosave opcional.
7. Componentes reutilizables.
8. Responsive sin requerir CSS manual.
9. Buen feedback de guardado/publicación.
10. Evitar configuraciones técnicas innecesarias para el usuario.

---

# 33. Backend — arquitectura interna

Propuesta ligera inspirada en Clean Architecture:

```text
/internal

├── domain
│   ├── book
│   ├── order
│   ├── payment
│   ├── page
│   ├── media
│   ├── email
│   └── user
│
├── application
│   ├── books
│   ├── orders
│   ├── payments
│   ├── pages
│   ├── media
│   ├── email
│   └── dashboard
│
├── infrastructure
│   ├── postgres
│   ├── storage
│   ├── google
│   ├── gmail
│   └── mercadopago
│
└── interfaces
    └── http
```

## Regla

Aplicar Clean Architecture pragmáticamente.

No generar abstracciones innecesarias únicamente para cumplir patrones.

Prioridades:

- separación de responsabilidades;
- dependencias claras;
- código testeable;
- interfaces en boundaries relevantes;
- dominio independiente de HTTP/DB cuando aporte valor;
- evitar boilerplate excesivo.

---

# 34. API

API REST JSON.

Prefijo sugerido:

```text
/api/v1
```

Ejemplos:

## Público

```text
GET  /api/v1/books
GET  /api/v1/books/{slug}
GET  /api/v1/pages/home
```

## Auth

```text
GET  /api/v1/auth/google
GET  /api/v1/auth/google/callback
POST /api/v1/auth/logout
GET  /api/v1/me
```

## Usuario

```text
GET  /api/v1/me/books
GET  /api/v1/books/{id}/download
```

## Compra

```text
POST /api/v1/orders
GET  /api/v1/orders/{id}
POST /api/v1/webhooks/mercadopago
```

## Admin libros

```text
GET    /api/v1/admin/books
POST   /api/v1/admin/books
GET    /api/v1/admin/books/{id}
PUT    /api/v1/admin/books/{id}
DELETE /api/v1/admin/books/{id}
```

## Admin CMS

```text
GET  /api/v1/admin/pages/{id}
PUT  /api/v1/admin/pages/{id}/draft
POST /api/v1/admin/pages/{id}/publish
GET  /api/v1/admin/pages/{id}/versions
POST /api/v1/admin/pages/{id}/versions/{versionId}/restore
```

## Admin media

```text
GET    /api/v1/admin/media
POST   /api/v1/admin/media
DELETE /api/v1/admin/media/{id}
```

## Dashboard

```text
GET /api/v1/admin/dashboard
GET /api/v1/admin/sales
GET /api/v1/admin/customers
```

Estos endpoints son orientativos y pueden ajustarse durante el diseño de contratos.

---

# 35. Contratos API

Para facilitar trabajo con IA:

- definir DTOs explícitos;
- evitar respuestas dinámicas innecesarias;
- mantener contratos estables;
- generar/documentar OpenAPI;
- versionar breaking changes;
- definir errores uniformes.

Formato conceptual de error:

```json
{
  "error": {
    "code": "BOOK_NOT_FOUND",
    "message": "Book not found",
    "details": null
  }
}
```

No devolver errores internos de PostgreSQL al cliente.

---

# 36. Migraciones de base de datos

Toda modificación del esquema debe realizarse mediante migraciones.

No modificar producción manualmente.

Carpeta sugerida:

```text
/migrations

001_initial_schema.up.sql
001_initial_schema.down.sql
002_add_page_versions.up.sql
002_add_page_versions.down.sql
```

Preferir SQL explícito y revisable.

---

# 37. Índices iniciales

Evaluar como mínimo:

```text
users.google_subject UNIQUE
users.email

books.slug UNIQUE
books.status

orders.user_id
orders.status
orders.created_at

order_items.order_id
order_items.book_id

payments.order_id
payments.provider_payment_id UNIQUE

pages.slug
pages.book_id
pages.status

page_versions.page_id
page_versions.version_number
```

No agregar índices preventivamente sin entender las consultas.

---

# 38. Dinero

Nunca utilizar `float` para representar precios.

Opciones:

```text
amount_minor_units BIGINT
```

Ejemplo:

```text
ARS 12.500
→ 12500
```

o `NUMERIC` con escala explícita.

Preferir minor units cuando el dominio lo permita.

Toda orden debe almacenar el precio histórico del item.

No depender del precio actual del libro después de crear una orden.

---

# 39. Seguridad

Medidas mínimas:

- HTTPS obligatorio.
- Cookies HttpOnly/Secure.
- CSRF según estrategia de sesión.
- SameSite adecuado.
- Rate limiting en endpoints sensibles.
- Validación estricta de uploads.
- Validar MIME real.
- UUID para nombres físicos.
- SQL parametrizado.
- Sanitización/render seguro de rich text.
- Content Security Policy.
- Headers de seguridad.
- No exponer PostgreSQL.
- Secrets fuera del repositorio.
- Webhooks idempotentes.
- Validar firma/origen de webhooks.
- Autorización siempre en backend.
- Logs sin tokens/secrets.

---

# 40. Rich text y XSS

El Page Builder puede contener rich text.

Nunca renderizar HTML arbitrario confiando en el administrador.

Preferir:

- estructura JSON del editor;
- conjunto limitado de elementos;
- sanitización estricta;
- renderer propio/controlado.

Ejemplo permitido:

```text
paragraph
heading
bold
italic
link
list
```

Evitar aceptar scripts, event handlers o HTML arbitrario.

---

# 41. Configuración / variables de entorno

Ejemplo conceptual:

```env
APP_ENV=production
APP_BASE_URL=https://example.com

DATABASE_URL=postgres://...

SESSION_SECRET=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URL=...

MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_WEBHOOK_SECRET=...

# Email de aplicación mediante Gmail API / Google Workspace.
GOOGLE_MAIL_SENDER=ventas@tudominio.com
GOOGLE_MAIL_CREDENTIALS_PATH=/run/secrets/google-mail-credentials
SUPPORT_EMAIL=soporte@tudominio.com

ADMIN_GOOGLE_SUB=...

EBOOK_STORAGE_PATH=/data/ebooks
MEDIA_STORAGE_PATH=/data/media
```

Nunca commitear `.env` real.

Mantener `.env.example`.

---

# 42. Observabilidad

Para esta escala no se necesita un stack complejo.

Mínimo:

- logs estructurados JSON;
- request id;
- timestamp;
- level;
- endpoint;
- status code;
- duration;
- user id cuando corresponda;
- order id/payment id en procesos de pago.

Health checks:

```text
GET /health/live
GET /health/ready
```

Docker healthchecks.

Nginx access/error logs con rotación.

---

# 43. Métricas útiles

Inicialmente puede bastar con métricas internas/dashboard:

- ventas;
- ingresos;
- visitas opcional;
- conversión opcional;
- errores de pago;
- descargas.

No introducir Prometheus/Grafana salvo que exista una necesidad real.

---

# 44. Backups

Este es uno de los puntos más importantes porque toda la infraestructura vive inicialmente en un único VPS.

Nunca depender exclusivamente de backups almacenados dentro del mismo servidor.

## PostgreSQL

```text
pg_dump diario
    ↓
copia fuera del VPS
```

## Archivos

Respaldar:

```text
ebooks/
media/
```

fuera del servidor.

## Opciones

- Snapshots del VPS como complemento, nunca como único backup.
- Storage externo compatible con S3.
- S3-compatible storage.
- Otro servidor/storage externo.

El backup debe ser restaurable.

Realizar pruebas de restauración periódicas.

---

# 45. CI/CD

Pipeline recomendado:

```text
GitHub
   ↓
Push / PR
   ↓
GitHub Actions
   ├── lint frontend
   ├── tests frontend
   ├── lint backend
   ├── tests backend
   ├── build React
   ├── build Go
   └── build Docker images
          ↓
    Container Registry
          ↓
      Netcup VPS
          ↓
docker compose pull
docker compose up -d
```

Evitar compilar en el VPS; publicar imágenes construidas por CI.

---

# 46. Deploy

Idealmente:

1. Pull de nuevas imágenes.
2. Ejecutar migraciones.
3. Levantar servicios.
4. Health check.
5. Mantener versión anterior disponible para rollback.

Para una primera versión se puede usar una estrategia simple, siempre que exista rollback.

---

# 47. Repositorio

Monorepo recomendado por simplicidad:

```text
/
├── frontend/
│
├── backend/
│
├── migrations/
│
├── deploy/
│   ├── docker-compose.yml
│   └── nginx/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── decisions/
│
├── .github/
│   └── workflows/
│
├── .env.example
├── README.md
└── Makefile
```

Ventajas para agentes de IA:

- contexto en un único repositorio;
- contratos fáciles de encontrar;
- cambios coordinados frontend/backend;
- CI centralizado;
- documentación junto al código.

---

# 48. Architecture Decision Records (ADR)

Mantener decisiones importantes documentadas.

Ejemplo:

```text
docs/decisions/

0001-use-go-backend.md
0002-use-postgresql.md
0003-use-google-oidc.md
0004-use-mercadopago-checkout-pro.md
0005-use-jsonb-page-builder.md
0006-local-file-storage-first.md
0007-email-delivery-strategy.md
```

Cada ADR:

```text
Context
Decision
Consequences
Alternatives considered
```

Esto es especialmente útil cuando Codex/Claude trabajan sobre el proyecto.

---

# 49. Reglas para desarrollo asistido por IA

El repositorio debe incluir instrucciones explícitas para agentes.

Archivo recomendado:

```text
AGENTS.md
```

o equivalente compatible con las herramientas utilizadas.

Contenido sugerido:

```text
- Leer docs/architecture.md antes de modificar arquitectura.
- No cambiar el stack sin justificarlo.
- No agregar dependencias sin necesidad.
- No introducir microservicios.
- No introducir Redis/Kafka/queues salvo requisito real.
- Mantener backward compatibility del Page Builder.
- Toda modificación DB requiere migration.
- Todo endpoint admin requiere autorización server-side.
- Nunca exponer ebooks directamente.
- Los webhooks de pagos deben ser idempotentes.
- No usar float para dinero.
- Mantener tests de reglas críticas.
- Actualizar documentación si cambia un contrato.
- Mantener la identidad visual de Nuestra Medicina Personal en cualquier frontend generado.
- No implementar servidor SMTP propio en el VPS.
- El módulo de dominio no debe depender directamente de Gmail; usar EmailSender.
```

---

# 50. Contexto que la IA debe conocer siempre

Resumen corto para agentes:

```text
Esta aplicación es Nuestra Medicina Personal: una tienda personal de eBooks y contenidos editoriales centrados en escritura, educación, reflexión, meditación y herramientas personales.

Identidad:
- cálida
- artística
- humana
- contemplativa
- naturaleza
- azules + tonos cálidos

Audiencia:
- docentes
- público general

NO es SaaS.
NO es marketplace.
NO es multi-tenant.
NO está diseñada inicialmente para alto tráfico.

Escala inicial:
- ~5 visitas/día
- ~5 libros
- 1 administrador

Priorizar:
1. simplicidad
2. seguridad
3. mantenibilidad
4. bajo costo
5. performance razonable

Evitar sobrearquitectura.
```

---

# 51. Convenciones de código

## Backend Go

- `gofmt`.
- `go vet`.
- funciones pequeñas y cohesionadas;
- nombres explícitos;
- errores con contexto;
- evitar globals;
- context propagation;
- cancellation/timeouts;
- SQL parametrizado;
- transacciones explícitas;
- interfaces donde exista un boundary real;
- documentación pública cuando corresponda;
- tests para lógica crítica.

## Frontend

- TypeScript recomendado.
- ESLint.
- Prettier.
- componentes pequeños;
- separar server state de UI state;
- tipos compartidos/generados desde OpenAPI si resulta conveniente;
- no mezclar lógica de negocio compleja en componentes visuales;
- accessibility;
- responsive;
- performance;
- lazy loading cuando aporte valor.

---

# 52. Testing

Priorizar pruebas donde existe riesgo.

## Backend

Tests esenciales:

- autorización de descarga;
- creación de órdenes;
- actualización de estados;
- idempotencia de webhook;
- validación de pago;
- permisos admin;
- publicación/borrador;
- restauración de versiones.

## Integración

- PostgreSQL real mediante container de test cuando convenga.
- migraciones.
- repository queries.
- Mercado Pago mediante adapters/mocks.

## Frontend

Tests prioritarios:

- Page Builder.
- formulario de libro.
- flujo admin crítico.
- render de bloques.
- permisos/rutas protegidas.

No buscar cobertura del 100%.

---

# 53. Page Builder — compatibilidad futura

Cada bloque debe tener un contrato versionable.

Ejemplo:

```json
{
  "id": "hero-01",
  "type": "hero",
  "version": 1,
  "props": {}
}
```

El renderer nunca debe asumir que todas las páginas fueron creadas con la última versión.

Si un bloque cambia de estructura:

- mantener compatibilidad;
- migrar el JSON;
- o implementar un mapper/upgrader.

Nunca romper contenido publicado existente.

---

# 54. Bloques reutilizables

Futuro opcional:

```text
Reusable Sections
```

Ejemplo:

```text
"Sobre el autor"
"Newsletter"
"Footer CTA"
```

Permitir reutilizar una sección en varias páginas.

No es necesario para MVP.

---

# 55. Preview

La vista previa debe mostrar exactamente el renderer público.

Evitar construir un renderer diferente para admin y producción.

Ideal:

```text
PageSchema
    ↓
Shared Page Renderer
    ├── Admin Preview
    └── Public Website
```

Esto reduce inconsistencias y facilita el mantenimiento.

---

# 56. Publicación

Una posible estrategia:

```text
pages
- draft_content JSONB
- published_content JSONB
```

o:

```text
page_versions
+
pages.published_version_id
+
pages.draft_version_id
```

La segunda ofrece versionado más limpio.

Preferencia arquitectónica:

```text
pages
├── current_draft_version_id
└── published_version_id
```

y contenido almacenado en `page_versions`.

---

# 57. Performance

No optimizar prematuramente.

Sin embargo:

- índices adecuados;
- compresión HTTP;
- imágenes WebP/AVIF cuando convenga;
- browser caching;
- cache headers para assets con hash;
- Nginx para estáticos;
- X-Accel-Redirect para eBooks;
- consultas paginadas;
- evitar N+1;
- límites de upload;
- pool DB pequeño.

Para el tráfico previsto, la arquitectura tendrá amplio margen.

---

# 58. Cache

No introducir Redis inicialmente.

Se puede usar:

- browser cache;
- Nginx cache headers;
- memoria local de Go para configuraciones pequeñas si fuera necesario.

Solo incorporar un cache distribuido si aparece una necesidad real.

---

# 59. Email

El sistema necesita correo para:

- confirmación de compra;
- recibos;
- aviso de pago aprobado;
- aviso de pago pendiente o rechazado cuando corresponda;
- acceso a la biblioteca;
- soporte;
- avisos de nuevos libros;
- comunicaciones editoriales;
- newsletter opcional.

---

## 59.1 Dominio propio

La aplicación tendrá un dominio propio.

Ejemplo conceptual:

```text
nuestramedicinapersonal.com
```

Direcciones sugeridas:

```text
soporte@nuestramedicinapersonal.com
ventas@nuestramedicinapersonal.com
novedades@nuestramedicinapersonal.com
contacto@nuestramedicinapersonal.com
```

No todas necesitan ser mailboxes independientes.

Se puede trabajar con:

- un único mailbox humano;
- aliases;
- remitentes automáticos diferenciados.

Ejemplo:

```text
soporte@...   → mailbox humano
contacto@...  → alias del mismo mailbox
ventas@...    → remitente de emails transaccionales
novedades@... → remitente de comunicaciones editoriales
```

---

## 59.2 SMTP directo desde el VPS

No diseñar la solución alrededor de un servidor SMTP propio alojado en el mismo VPS.

Además de la restricción de infraestructura, operar un MTA propio implicaría administrar:

- reputación IP;
- reverse DNS;
- SPF;
- DKIM;
- DMARC;
- rebotes;
- complaints;
- listas de bloqueo;
- warming;
- colas;
- reintentos;
- seguridad anti-spam.

Para la escala de esta aplicación no se justifica.

### Regla arquitectónica

```text
NO montar Postfix/Exim/Mailcow/etc. dentro del VPS del MVP.
```

---

## 59.3 Uso de `smtp.gmail.com`

Técnicamente Go puede utilizar un cliente SMTP para conectarse a Gmail.

Sin embargo, esta estrategia no es la recomendada para el despliegue actual porque:

1. Gmail API permite autenticación OAuth server-to-server con permisos mínimos.
2. Las App Passwords agregan un secreto de larga duración innecesario.
3. Google Workspace permite que el remitente sea una identidad del dominio comercial.
4. La aplicación no necesita operar conexiones SMTP ni un MTA propio.

Por estas razones, no utilizar como arquitectura principal:

```text
Go
  ↓ SMTP 465/587
smtp.gmail.com
```

---

## 59.4 Opción Google recomendada: Gmail API

Si se desea mantener Google como proveedor de correo, preferir:

```text
Backend Go
    ↓ HTTPS :443
Gmail API
    ↓
Google
    ↓
Destinatario
```

Ventaja importante:

```text
Gmail API usa HTTPS
```

por lo que no depende de la política de puertos SMTP del proveedor del VPS.

La aplicación construye el mensaje MIME y utiliza la API de Gmail para enviarlo.

### Integración Go

Implementar un adapter:

```text
EmailSender
```

Ejemplo conceptual:

```go
type EmailSender interface {
    Send(ctx context.Context, message Message) error
}
```

Implementación inicial:

```text
GmailAPIEmailSender
```

El domain/application layer no debe depender directamente de Google.

Esto permite reemplazar Gmail en el futuro por:

```text
Resend
Amazon SES
Brevo
MailerSend
otro provider
```

sin modificar las reglas de negocio.

---

## 59.5 Gmail API + dominio propio

Si se quiere enviar profesionalmente como:

```text
ventas@nuestramedicinapersonal.com
```

la opción Google natural es utilizar **Google Workspace** con el dominio propio.

Esto aporta:

- mailbox profesional;
- dominio personalizado;
- Gmail;
- Gmail API;
- administración de la cuenta.

Debe considerarse que Google Workspace es un servicio pago.

Por lo tanto, la decisión final debe comparar:

```text
Google Workspace + Gmail API
```

contra:

```text
proveedor transaccional con free tier
+
mailbox económico/gratuito
```

La elección debe basarse en:

- costo;
- preferencia por Gmail;
- simplicidad operacional;
- volumen real;
- necesidad de soporte humano.

---

## 59.6 Cuenta Gmail gratuita

Una cuenta Gmail gratuita puede utilizar Gmail API para volúmenes pequeños.

Sin embargo, el remitente principal sería una identidad Gmail y no constituye por sí sola una solución profesional completa para:

```text
@dominio-propio.com
```

Por lo tanto:

```text
Gmail gratuito + Gmail API
```

puede ser útil para desarrollo/pruebas, pero no es la opción preferida para producción si se exige identidad de dominio propia.

---

## 59.7 Emails transaccionales

Eventos iniciales:

```text
purchase.confirmed
payment.approved
payment.pending
payment.failed
ebook.available
purchase.refunded
```

Ejemplo de flujo:

```text
Mercado Pago webhook
        ↓
Backend valida pago
        ↓
Order = PAID
        ↓
Evento de aplicación
        ↓
EmailSender
        ↓
Gmail API
        ↓
Confirmación
```

El email nunca debe decidir el estado de una compra.

Primero se persiste correctamente la transacción.

Después se intenta enviar la notificación.

---

## 59.8 Fallos de email

Una falla de Gmail no debe revertir una compra aprobada.

Incorrecto:

```text
Pago aprobado
    ↓
Falla email
    ↓
Rollback de la compra
```

Correcto:

```text
Pago aprobado
    ↓
Persistir Order = PAID
    ↓
Intentar email
    ↓
si falla:
    registrar error
    reintentar
```

Para el MVP, los reintentos pueden implementarse de forma sencilla sin introducir Kafka/RabbitMQ.

Opciones:

- tabla `email_jobs`;
- worker liviano dentro del backend;
- cron interno/controlado;
- reintentos con backoff.

No agregar infraestructura de mensajería distribuida para este volumen.

---

## 59.9 Tabla conceptual de emails pendientes

Si se requiere confiabilidad:

```text
email_jobs
──────────────────────────
id
type
recipient
payload JSONB
status
attempts
next_attempt_at
last_error
created_at
sent_at
```

Estados posibles:

```text
PENDING
PROCESSING
SENT
FAILED
```

Índice recomendado:

```text
(status, next_attempt_at)
```

El worker debe procesar pocos registros por lote.

---

## 59.10 Templates

Los templates deben estar versionados y separados de la lógica de negocio.

Ejemplo:

```text
/templates/email/

purchase-confirmed.html
payment-failed.html
new-book.html
```

Idealmente:

```text
HTML
+
plain text fallback
```

Todo template debe:

- ser responsive;
- funcionar sin JavaScript;
- usar estilos compatibles con clientes de correo;
- incluir nombre de la marca;
- contener links absolutos;
- evitar imágenes excesivamente pesadas.

---

## 59.11 Identidad visual del email

Los emails deben mantener la identidad de **Nuestra Medicina Personal**:

- tonos cálidos;
- azules;
- fotografías/ilustraciones solo cuando aporten valor;
- diseño editorial;
- mucho espacio;
- legibilidad;
- tono humano y contemplativo.

Los emails transaccionales deben priorizar claridad sobre expresión artística.

Ejemplo:

```text
NUESTRA MEDICINA PERSONAL

Tu compra fue confirmada

El poder de tu historia

[ Ir a mi biblioteca ]

Gracias por acompañarnos.
```

---

## 59.12 Soporte humano

El sistema debe publicar una dirección:

```text
soporte@nuestramedicinapersonal.com
```

El mailbox humano puede estar alojado en Google Workspace si se elige la estrategia Google.

El módulo de soporte no necesita formar parte del backend en el MVP.

Los usuarios simplemente escriben por email.

Futuro opcional:

- formulario de contacto;
- tickets;
- historial de soporte;
- integración con Help Desk.

No implementar inicialmente sin necesidad.

---

## 59.13 Emails de marketing

Separar conceptualmente:

```text
TRANSACTIONAL
```

de:

```text
MARKETING
```

Marketing incluye:

- lanzamiento de un nuevo libro;
- novedades;
- meditaciones;
- contenido editorial;
- promociones.

Guardar consentimiento explícito.

Tabla conceptual:

```text
marketing_subscriptions
────────────────────────
id
user_id NULL
email
status
subscribed_at
unsubscribed_at
source
```

El sistema debe permitir cancelar suscripción.

No asumir que comprar un libro equivale automáticamente a aceptar comunicaciones promocionales.

---

## 59.14 DNS y entregabilidad

Con dominio propio, configurar correctamente:

```text
MX
SPF
DKIM
DMARC
```

Objetivos:

- autorizar proveedores legítimos;
- firmar mensajes;
- disminuir spoofing;
- mejorar entregabilidad.

La configuración exacta depende del proveedor final de correo.

Nunca inventar registros DNS: utilizar los valores que entregue el proveedor seleccionado.

---

## 59.15 Abstracción recomendada

Dominio/Application:

```text
EmailSender
```

Infrastructure:

```text
GmailAPIEmailSender
```

Futuras implementaciones:

```text
ResendEmailSender
SesEmailSender
BrevoEmailSender
```

Esto mantiene la aplicación desacoplada del proveedor.

---

## 59.16 Decisión de arquitectura actual

### Recomendado si se quiere Gmail + dominio propio

```text
Google Workspace
+
Gmail API
+
service account con delegación de dominio
+
dominio propio
```

### No recomendado

```text
SMTP directo desde VPS
```

```text
servidor SMTP propio en Netcup
```

```text
smtp.gmail.com desde el VPS como dependencia principal
```

### Motivo

La Gmail API opera sobre HTTPS, permite alcance mínimo `gmail.send` y evita
acoplar la aplicación a SMTP. El service account impersonará exclusivamente
el mailbox remitente configurado mediante delegación de dominio de Workspace.

### Decisión confirmada

Google Workspace + Gmail API es el proveedor inicial de email transaccional.
Mantener `EmailSender` como boundary para conservar reemplazabilidad.
# 60. Analítica

Opcional.

Para una web de muy poco tráfico se puede comenzar sin herramienta específica.

Futuro:

- analytics privacy-friendly;
- Google Analytics;
- eventos propios.

Eventos útiles:

```text
book_view
buy_clicked
checkout_started
payment_approved
ebook_downloaded
```

No convertir analytics en dependencia crítica de compra.

---

# 61. Accesibilidad

La web pública debe contemplar:

- HTML semántico;
- navegación por teclado;
- contrastes;
- `alt` en imágenes;
- labels;
- focus visible;
- modales accesibles;
- ARIA solamente cuando sea necesario.

El Page Builder debería solicitar `alt` para imágenes.

---

# 62. Responsive

Todos los bloques deben tener comportamiento responsive definido.

No permitir que cada página invente arbitrariamente su propio comportamiento.

Ejemplo:

```text
3 columnas desktop
↓
2 columnas tablet
↓
1 columna mobile
```

El renderer debe garantizar layouts válidos.

---

# 63. Errores y recuperación

UX:

- mensajes claros;
- retry donde corresponda;
- no perder edición ante errores;
- confirmar operaciones destructivas;
- loading states;
- empty states.

Backend:

- códigos de error estables;
- logs detallados internamente;
- respuestas seguras externamente.

---

# 64. Auditoría

MVP mínimo:

- `created_at`;
- `updated_at`;
- `created_by` cuando aporte valor.

Especialmente en:

- libros;
- páginas;
- publicaciones;
- media.

Una tabla de auditoría completa puede agregarse después si se necesita.

---

# 65. Soft delete

No aplicar indiscriminadamente.

Usar estados cuando el dominio lo justifique.

Ejemplo:

```text
books.status = ARCHIVED
```

No permitir eliminar físicamente un libro vendido sin considerar referencias históricas.

Orders/payments nunca deben perder integridad histórica.

---

# 66. Eliminación de media

Antes de eliminar un archivo:

- comprobar referencias;
- evitar romper páginas publicadas;
- preferir marcarlo como no disponible si existe una referencia activa;
- permitir limpieza posterior de archivos huérfanos.

---

# 67. Manejo de eBooks

Formatos previstos:

```text
PDF
EPUB
```

Reglas:

- validar extensión + MIME;
- limitar tamaño;
- nombre físico UUID;
- metadata en DB;
- ruta fuera del public root;
- descarga únicamente autorizada;
- Content-Disposition apropiado.

No intentar implementar DRM propio en MVP.

---

# 68. Seguridad de archivos

Nginx no debe exponer:

```text
/srv/ebook-store/ebooks
```

como directorio público.

El usuario solo conoce endpoints lógicos.

Ejemplo:

```text
/api/v1/books/{id}/download
```

Nunca rutas físicas.

---

# 69. Evolución de almacenamiento

Inicial:

```text
Netcup VPS
├── app
├── PostgreSQL
├── ebooks
└── media
```

Cuando sea necesario:

```text
Netcup VPS
├── app
└── PostgreSQL

Object Storage
├── ebooks
└── media
```

Diseñar un puerto:

```text
Storage
```

para que filesystem local y object storage sean implementaciones intercambiables.

Evitar acoplar todo el dominio a paths locales.

---

# 70. Evolución de infraestructura

## Etapa 1

```text
1 Netcup VPS
Docker Compose
Todo junto
```

## Etapa 2

Si archivos crecen:

```text
Netcup VPS
+
Object Storage
```

## Etapa 3

Si la DB necesita aislamiento:

```text
Netcup VPS
+
Managed PostgreSQL
+
Object Storage
```

## Etapa 4

Solo si tráfico real lo justifica:

```text
Load Balancer
+
multiple API instances
+
Managed DB
```

No construir para Etapa 4 desde el día uno.

---

# 71. Fuera de alcance inicial

No implementar sin requisito explícito:

- multi-tenant;
- múltiples vendedores;
- marketplace;
- microservicios;
- Kubernetes;
- Kafka;
- Redis;
- Elasticsearch;
- CQRS completo;
- Event Sourcing;
- custom payment gateway;
- sistema propio de contraseña;
- DRM complejo;
- recomendaciones ML;
- chat;
- sistema social;
- afiliados;
- multi-moneda compleja;
- impuestos internacionales automáticos.
- servidor SMTP/MTA propio dentro del VPS.

---

# 72. MVP recomendado

## Fase 1 — Core técnico

- Monorepo.
- Docker Compose.
- Go API.
- PostgreSQL.
- React/Vite.
- Nginx.
- migraciones.
- CI básico.
- health checks.

## Fase 2 — Auth + catálogo

- Google Login.
- usuario/admin.
- CRUD libros.
- portadas.
- upload eBook.
- catálogo público.
- página básica de libro.

## Fase 3 — Compra

- Orders.
- Order Items.
- Mercado Pago.
- webhook.
- Payments.
- biblioteca.
- descarga protegida.

## Fase 4 — CMS

- Pages.
- Page Versions.
- bloques iniciales.
- renderer.
- drag & drop.
- draft.
- preview.
- publish.

## Fase 5 — Backoffice

- Dashboard.
- ventas.
- clientes.
- media library.
- configuraciones.

## Fase 6 — Calidad

- SEO.
- image optimization.
- backups.
- security headers.
- rate limits.
- observabilidad.
- integración de email de producción.
- SPF/DKIM/DMARC.
- templates transaccionales.
- E2E principales.

---

# 73. Orden recomendado de implementación con IA

Cuando se utilice Codex/Claude:

```text
1. Architecture / contracts
2. Database schema + migrations
3. Backend domain/application
4. API contracts
5. Auth
6. Admin books
7. Public catalog
8. Payments
9. Downloads
10. Email delivery
11. CMS schema
12. Shared Page Renderer
13. Page Builder
14. Dashboard
15. Polish / SEO / observability
```

Evitar pedir a la IA:

> “Construye toda la app completa.”

Preferir tareas pequeñas y verificables.

Ejemplo:

```text
Implementa el módulo Book del backend siguiendo docs/architecture.md.

Alcance:
- migration
- repository
- application service
- REST endpoints admin
- tests
- OpenAPI

No modifiques autenticación, pagos ni CMS.
```

---

# 74. Workflow recomendado con Codex / Claude

Para cada tarea:

1. Pedir al agente que lea:
   - `README.md`
   - `AGENTS.md`
   - `docs/architecture.md`
   - ADRs relevantes.

2. Pedir un breve plan.

3. Solicitar implementación limitada a un módulo.

4. Ejecutar tests/lint.

5. Revisar diff.

6. Actualizar documentación si cambió un contrato.

7. Commit pequeño y descriptivo.

Esto reduce cambios accidentales de arquitectura.

---

# 75. Reglas para Claude Design / frontend generado por IA

Cuando se use una herramienta orientada a diseño:

Contexto obligatorio de marca:

```text
Nombre: Nuestra Medicina Personal

Estética:
- cálida
- azul + tonos de amanecer/naturaleza
- creativa
- artística
- contemplativa
- editorial

Temas:
- El poder de tu historia
- La escritura terapéutica entra a la escuela
- Meditaciones
- Caja de herramientas personales

Audiencia:
- docentes
- público general

Imaginario visual:
- naturaleza
- amanecer
- estrellas
- prados
- contemplación
- gratitud
- vínculo con animales
```

Proporcionar:

- objetivo de la marca;
- audiencia;
- Design System;
- componentes existentes;
- rutas;
- schema del Page Builder;
- responsive rules;
- API mock/OpenAPI;
- estados loading/error/empty;
- restricciones de accesibilidad.

Solicitar primero:

```text
Design tokens
↓
Shared components
↓
Page templates
↓
Public store
↓
Admin
↓
Page Builder
```

Evitar generar pantallas aisladas sin un sistema visual compartido.

---

# 76. Fuente de verdad

Orden de prioridad recomendado:

```text
1. docs/architecture.md
2. ADRs
3. OpenAPI
4. Database migrations
5. AGENTS.md
6. Código
```

Si documentación y código divergen, corregir la inconsistencia inmediatamente.

---

# 77. Definition of Done

Una funcionalidad se considera terminada cuando:

- cumple el requisito;
- código formateado/linted;
- tests relevantes pasan;
- migración incluida si corresponde;
- autorización validada;
- errores manejados;
- documentación/API actualizada;
- responsive comprobado si tiene UI;
- no introduce secrets;
- no rompe contenido publicado;
- deploy puede realizarse con CI/CD.

---

# 78. Principios arquitectónicos finales

## Keep it simple

Esta aplicación está diseñada para muy poco tráfico.

La arquitectura debe reflejarlo.

## Monolito primero

Un backend Go modular es preferible a múltiples servicios.

## PostgreSQL como fuente de verdad

Los datos importantes viven en PostgreSQL.

## Filesystem para blobs

eBooks e imágenes viven inicialmente fuera de la DB.

## Nginx para estáticos y descargas

No hacer pasar archivos grandes innecesariamente por Go.

## Backend autoritativo

El frontend nunca decide permisos, pagos o propiedad de libros.

## CMS basado en schema

El contenido visual es data estructurada y versionada, no HTML arbitrario.

## Versionar antes de romper

Page Builder, API y DB deben poder evolucionar.

## Seguridad en los boundaries

Especial atención a:

- Google;
- Mercado Pago;
- uploads;
- downloads;
- sesiones;
- admin.

## Medir antes de escalar

No aumentar infraestructura sin métricas o necesidad real.

---

# 79. Resumen final

```text
                     EBOOK STORE
                         │
       ┌─────────────────┴──────────────────┐
       │                                    │
       ▼                                    ▼
 PUBLIC WEBSITE                         ADMIN PANEL
 React + Vite                          React + Vite
       │                                    │
       ├─ Home                              ├─ Dashboard
       ├─ Catálogo                          ├─ Ventas
       ├─ Página libro                      ├─ Libros
       ├─ Login Google                      ├─ Page Builder
       ├─ Checkout                          ├─ Multimedia
       └─ Biblioteca                        └─ Configuración
       │                                    │
       └─────────────────┬──────────────────┘
                         │
                         ▼
                       GO API
                         │
        ┌────────────────┼─────────────────────┐
        │                │                     │
        ▼                ▼                     ▼
    PostgreSQL       Local Storage       External APIs
        │                │                     │
        │                ├─ ebooks             ├─ Google OIDC
        │                ├─ covers             ├─ Mercado Pago
        │                │                     └─ Gmail API / Workspace
        │                └─ media
        │
        ├─ users
        ├─ sessions
        ├─ books
        ├─ pages
        ├─ page_versions
        ├─ media
        ├─ orders
        ├─ order_items
        └─ payments
```

Infraestructura inicial:

```text
Netcup VPS 500 G12
2 vCore / 4 GB RAM / 128 GB NVMe

Docker Compose
├── nginx
├── api-go
└── postgres

Host storage
├── ebooks
├── media
└── temporary-backups

External backup
└── DB + media + ebooks
```

La solución busca ser **simple, profesional, económica, segura y suficientemente flexible para construir una tienda visualmente atractiva de eBooks sin convertir el proyecto en una plataforma innecesariamente compleja**.

---

# 80. Instrucción corta para agentes de IA

Puede utilizarse este bloque como contexto inicial en tareas:

```text
Antes de implementar cualquier cambio, lee docs/architecture.md y los ADRs relacionados.

Este proyecto es una tienda personal de eBooks de muy bajo tráfico, no un SaaS ni marketplace.

Stack:
- React + Vite + TypeScript
- Go
- PostgreSQL
- Nginx
- Docker Compose
- Google OIDC
- Mercado Pago Checkout Pro
- almacenamiento local inicialmente
- dominio propio
- email desacoplado mediante EmailSender
- Gmail API + Google Workspace como opción Google recomendada

Identidad del producto:
- Nombre: Nuestra Medicina Personal
- Visual: artístico, cálido, contemplativo, naturaleza, azules y tonos cálidos
- Audiencia: docentes y público general

Prioriza clean code, seguridad, simplicidad, mantenibilidad y performance razonable.

No agregues infraestructura, frameworks, dependencias o patrones arquitectónicos sin una necesidad concreta.

No cambies contratos, esquema de Page Builder o modelo de datos sin migración/compatibilidad y actualización de documentación.

Toda lógica de autorización, pagos y descargas debe validarse server-side.
```

---

# 81. Referencias técnicas externas a verificar antes de producción

Estas decisiones dependen de servicios externos cuyas políticas pueden cambiar.

Antes del deploy productivo verificar documentación oficial vigente de:

- Netcup: recursos, snapshots, red y condiciones del VPS contratado.
- Google Workspace: planes y soporte de dominio propio.
- Gmail API: autenticación, scopes y método `users.messages.send`.
- Google: políticas y límites de envío.
- Mercado Pago: Checkout Pro y webhooks.

Estado considerado al redactar esta versión:

```text
Netcup VPS 500 G12:
- 2 vCore x86, 4 GB DDR5 ECC y 128 GB NVMe.
- snapshots Copy-On-Write y tráfico incluido según la ficha comercial.

Google:
- Gmail API permite envío mediante HTTPS.
- Google Workspace ofrece email con dominio personalizado.
```

No hardcodear límites comerciales o cuotas en lógica de negocio.
