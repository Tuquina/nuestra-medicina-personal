# ADR 0004: conversión de DOCX/PDF y generación de EPUB/PDF para el manuscrito

## Context

El editor de manuscrito (`admin/pages/LibroFormPage/ManuscritoTab.tsx`) persiste capítulos
de verdad desde la rama anterior, pero la conversión de archivos subidos (DOCX/PDF) y la
generación de EPUB/PDF quedaron deliberadamente sin implementar: son una capacidad nueva
que exige elegir dependencias — un cambio de stack, según la regla de `AGENTS.md` que pide
un ADR antes de tocar código.

El VPS de producción (Netcup VPS 500 G12, 2 vCore, 4 GB RAM) ya corre Postgres, la API Go y
Nginx en el mismo host. El backend se compila hoy como un binario estático
(`CGO_ENABLED=0`) sobre `alpine:3.22`, sin ningún runtime adicional. Cualquier solución que
dependa de un binario externo (LibreOffice headless, `wkhtmltopdf`, Chromium sin cabeza)
significa instalar y correr un proceso pesado adicional en un host que ya está ajustado —
desproporcionado para una funcionalidad usada esporádicamente por un solo administrador
sobre un catálogo de ~5 libros.

## Decision

Toda la conversión/generación se hace **en el propio proceso Go, con librerías puras**
(sin CGO, sin binarios externos, sin servicios nuevos):

| Uso | Librería | Licencia | Motivo |
|---|---|---|---|
| Leer DOCX | `github.com/gomutex/godocx` | MIT | Lee y escribe DOCX en Go puro; `OpenDocument()` parsea un archivo existente. Se descarta `fumiama/go-docx` (más popular) por ser **AGPL-3.0** — inaceptable para un backend de red propietario que lo usaría directamente en el mismo proceso. |
| Extraer texto de PDF | `github.com/ledongthuc/pdf` | BSD-3-Clause | La opción estándar en el ecosistema Go para esto; `GetPlainText()` es suficiente porque un PDF no tiene estructura de párrafo real — cualquier herramienta a este costo da un resultado aproximado. |
| Generar EPUB | `github.com/go-shiori/go-epub` | MIT | Fork activamente mantenido y recomendado de `bmaupin/go-epub`, que está archivado. `AddSection()` acepta HTML de capítulo directamente, sin transformación intermedia. |
| Generar PDF | `github.com/gpdf-dev/gpdf` | MIT | Cero dependencias, mantenido con releases frecuentes. Su sistema de grillas (`AutoRow`/`Text`) hace word-wrap y pagina automáticamente — necesario para texto fluido de un libro, a diferencia de las alternativas de bajo nivel (`gofpdf`/`go-pdf/fpdf`, ambas archivadas en 2021 y 2025 respectivamente). |

Alcance de esta iteración:

- **Importación** (`.txt`/`.docx`/`.pdf`): reconstruye párrafos, encabezados (H1-H3) y
  negrita/itálica cuando el formato de origen los tiene (DOCX). Un PDF importado se
  reconstruye como párrafos de texto plano, sin formato — es una limitación del formato
  fuente, no de la implementación. Cada archivo importado produce **un solo capítulo**,
  igual que hoy con `.txt`; dividir el resultado en varios capítulos sigue siendo una acción
  manual del editor ("Agregar capítulo"). No hay detección automática de capítulos
  (saltos de página, estilos de título) en esta iteración.
- **Exportación** (EPUB/PDF): el archivo generado se **descarga en el navegador**, nunca se
  adjunta automáticamente como el ebook vendible del libro. El administrador lo revisa y,
  si le sirve, lo sube él mismo por la pestaña "Archivo y portada" (flujo ya existente,
  sin cambios) — evita que una generación se convierta en el archivo publicado sin que
  nadie la haya visto antes.
- El PDF generado soporta el mismo subconjunto de HTML que el propio editor produce
  (`p`, `h1-h3`, `blockquote`, `b`, `i`, `u`, `ul`/`li`) — no HTML arbitrario, ni tablas ni
  imágenes embebidas en el cuerpo del capítulo.
- Toda subida se valida por extensión **y** firma de bytes antes de parsear (`PK\x03\x04`
  para DOCX, `%PDF-` para PDF), mismo criterio que ya usa la carga de eBooks
  (`library.validateEbook`) — nunca se confía solo en el nombre del archivo.

## Consequences

- Cuatro dependencias nuevas en `go.mod`, todas Go puro, sin CGO, compatibles con el build
  estático actual (`CGO_ENABLED=0` sobre Alpine) — no cambia la imagen Docker ni agrega
  procesos.
- La fidelidad de importación de PDF es limitada por naturaleza del formato; no vale la
  pena invertir en una herramienta de reconstrucción de layout más sofisticada para un
  catálogo de ~5 libros.
- Si más adelante se necesita conversión de más formatos, detección automática de
  capítulos, o generación de PDF con maquetación tipográfica más avanzada (control de
  huérfanas/viudas, ligaduras, etc.), es una decisión nueva y proporcionalmente mayor
  (probablemente sí justificaría herramientas externas) — no la resuelve este ADR.
