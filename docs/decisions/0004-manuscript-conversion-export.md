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
| Leer DOCX | *(ninguna — biblioteca estándar)* | — | Un `.docx` es un zip con XML adentro; `word/document.xml` se lee directo con `archive/zip` + `encoding/xml` (`manuscripts/importer.go`). Se evaluaron dos librerías: `fumiama/go-docx` es **AGPL-3.0** (inaceptable para un backend de red propietario) y `gomutex/godocx` (MIT) es de escritura, no expone lectura de texto/formato de runs por su API pública. Escribir el parser propio — acotado a lo que ya produce el editor (párrafos, encabezados, negrita/itálica) — evita ambos problemas y no agrega ninguna dependencia nueva. |
| Extraer texto de PDF | `github.com/ledongthuc/pdf` | BSD-3-Clause | La opción estándar en el ecosistema Go para esto; `GetPlainText()` es suficiente porque un PDF no tiene estructura de párrafo real — cualquier herramienta a este costo da un resultado aproximado. |
| Generar EPUB | `github.com/go-shiori/go-epub` | MIT | Fork activamente mantenido y recomendado de `bmaupin/go-epub`, que está archivado. `AddSection()` acepta HTML de capítulo directamente, sin transformación intermedia. |
| Generar PDF | `github.com/gpdf-dev/gpdf` | MIT | Cero dependencias, mantenido con releases frecuentes. Su sistema de grillas (`AutoRow`/`Text`) hace word-wrap y pagina automáticamente — necesario para texto fluido de un libro, a diferencia de las alternativas de bajo nivel (`gofpdf`/`go-pdf/fpdf`, ambas archivadas en 2021 y 2025 respectivamente). Para interpretar el HTML de cada capítulo se reutiliza `golang.org/x/net/html` (ya una dependencia transitiva de `go-epub`) en vez de sumar un parser propio. |

Alcance de esta iteración:

- **Importación** (`.txt`/`.docx`/`.pdf`): reconstruye párrafos, encabezados (H1-H3) y
  negrita/itálica cuando el formato de origen los tiene (DOCX). La detección de
  encabezados es una heurística sobre el ID de estilo del párrafo (`Heading1`/`Heading2`/
  `Heading3`, los nombres que Word y LibreOffice usan por defecto) — un documento con
  estilos de título renombrados no se detecta como encabezado, sólo como párrafo normal.
  Un PDF importado se reconstruye como párrafos de texto plano, sin formato — es una
  limitación del formato fuente, no de la implementación. Cada archivo importado produce
  **un solo capítulo**, igual que hoy con `.txt`; dividir el resultado en varios capítulos
  sigue siendo una acción manual del editor ("Agregar capítulo"). No hay detección
  automática de capítulos (saltos de página, estilos de título) en esta iteración.
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

## Addendum (2026-08-21): fuente embebida, secciones no numeradas, imágenes

Tres correcciones/extensiones sobre el mismo par de librerías — sin ningún
dependencia nueva, así que no ameritan un ADR aparte:

- **El PDF generado tenía las letras acentuadas rotas** (`é`/`í` salían como
  `Ø`/`Æ`, entre otros). Causa: `ExportPDF` llamaba a `gpdf.NewDocument()` sin
  registrar ninguna fuente TrueType, así que `gpdf` caía a su fuente core
  "Helvetica" — ese camino escribe el texto como bytes WinAnsi pero nunca
  declara `/Encoding /WinAnsiEncoding` en el diccionario de la fuente, con lo
  cual el visor de PDF los interpreta con el *StandardEncoding* implícito de
  Helvetica en su lugar, que no coincide. Se resolvió embebiendo PT Serif
  (Google Fonts, OFL — una de las pocas familias que todavía distribuye
  instancias estáticas Bold/Italic/BoldItalic de verdad, no sólo variable) vía
  `gpdf.WithFont`/`WithDefaultFont`; con una fuente registrada, `gpdf` codifica
  el texto contra el cmap propio de la fuente en vez de pasar por ese camino.
  Ver `backend/internal/application/manuscripts/fonts.go`.
- **No todo capítulo es "un capítulo"**: `Chapter` ahora tiene `Kind`
  (`COVER`/`DEDICATION`/`PROLOGUE`/`INTRODUCTION`/`CHAPTER`/`EPILOGUE`/
  `ACKNOWLEDGMENTS`/`APPENDIX`/`CUSTOM`) y `TitleMode` (`AUTO`/`CUSTOM`), y
  `ExportPDF`/`ExportEPUB` ya no fuerzan un heading "Capítulo" cuando `Title`
  viene vacío — una sección sin título simplemente no tiene heading. `Kind`
  sólo cambia el renderizado en un caso (`COVER` se dibuja como portada,
  grande y centrada, en vez del heading chico de cualquier otro tipo); el
  resto de la clasificación vive enteramente en el editor (numeración,
  ícono/etiqueta en la lista de secciones) — el backend sólo persiste ambos
  campos tal cual, sin validarlos contra el enum.
- **Imágenes**: el subconjunto de HTML soportado ahora incluye
  `<figure data-wrap="inline|center|left|right|free" style="width:NN%">
  <img src="data:image/png|jpeg;base64,..."></figure>` — exactamente lo que
  inserta el toolbar de imagen del editor. En EPUB, `go-shiori/go-epub` ya
  acepta un data URL directo como fuente de `AddImage`, así que cada imagen
  se reescribe a una entrada real del zip (no queda como blob base64 inline
  en el XHTML). En PDF, `gpdf`'s `ColBuilder.Image` dibuja la imagen como su
  propia fila de ancho completo — su grid de 12 columnas no soporta que el
  texto fluya alrededor de una imagen flotante, así que `left`/`right` sólo
  angostan y alinean la imagen a ese lado (no hay wrap real), y `free`
  (arrastrable en el editor, delante o detrás del texto) cae a centrado: la
  posición absoluta de `gpdf` (`page.Absolute`) pinta siempre por encima de
  todo el contenido en flujo de esa página sin excepción, así que no hay
  forma de lograr "detrás del texto" con la API pública, y una imagen con
  coordenadas fijas en un capítulo que se autopagina a varias páginas físicas
  no tiene una página física inequívoca a la cual anclarse. El editor
  (pantalla) y el EPUB (es sólo CSS) sí soportan las cinco variantes completas.

## Addendum 2 (2026-08-22): fidelidad real del PDF, EPUB con estilos, import de EPUB

El PDF seguía sin parecerse a lo que muestra el editor. La causa no era una
sola: el modelo de render era "un bloque = una línea de texto sin estilo", lo
que descartaba la alineación, todo el formato *dentro* de un párrafo, los
tamaños relativos y el espaciado entre bloques. Se reemplazó por un modelo de
bloques con runs (`manuscripts/htmldoc.go`), sin dependencias nuevas:

- **Formato inline**: se usa `RichText`/`Span` de `gpdf` (que ya estaba
  disponible y no se estaba usando), así una palabra en negrita, itálica,
  subrayada, tachada o de otro color en medio de una oración sobrevive como su
  propio fragmento en vez de aplanarse.
- **Alineación** por bloque (izquierda/centro/derecha/justificado), heredada
  desde un wrapper cuando `execCommand` la aplica ahí. `template` no exporta
  una opción de justificado, pero `template.TextOption` es
  `func(*document.Style)` y es público, así que las opciones que faltaban se
  escriben localmente en vez de forkear la librería.
- **Tipografía física**: el editor dibuja el manuscrito a 17px con
  interlineado 1,85 sobre el papel elegido; CSS define el píxel como 1/96 de
  pulgada fijo, así que esos 17px son 12,75pt reales. Usar esos números en el
  PDF reproduce el mismo corte de línea que el autor ve, y hace que el contador
  de "N hojas" del editor prediga la cantidad real de páginas exportadas.
- **Espaciado**: se replican los márgenes por defecto del navegador para cada
  tipo de bloque (h1 2em/0,67em, h2 1,5em/0,83em, p 1em/1em...) *incluido el
  colapso de márgenes* entre bloques adyacentes, que es lo que hace que un
  encabezado quede a la distancia correcta de su párrafo.
- **Tamaño de página**: `pageSize` ahora se persiste con el manuscrito
  (migración 013) y la exportación lo usa. Antes el PDF salía siempre en A4
  aunque el autor estuviera escribiendo en formato bolsillo.
- **Portada**: si el manuscrito tiene una sección `COVER`, no se genera además
  la portada automática — el libro abría con dos portadas compitiendo.

En EPUB se agregó una hoja de estilos propia (sin ella el lector aplica sus
defaults y se pierden, entre otras cosas, los modos de ajuste de imagen, que
son puro CSS) y se corrigió un bug real de validez: `go-epub` inserta el cuerpo
de cada sección como `innerxml` sin validarlo, así que un `<br>` sin cerrar —de
cualquier salto de línea— producía un EPUB cuyo XHTML no era XML bien formado.
Ahora el cuerpo se re-serializa con los elementos vacíos autocerrados.

Import: se agregó `.epub` (se separa por su propio spine e incrusta las
imágenes del archivo como data URLs), separación automática por encabezados
para los formatos planos, y `?mode=append` para sumar a un manuscrito en curso
en vez de reemplazarlo — importar destruía silenciosamente todo lo ya escrito.
Con esto **todo HTML importado se sanitiza en el servidor**
(`manuscripts/sanitize.go`), y eso no es opcional: el editor carga un capítulo
asignándolo a `innerHTML`, de modo que cualquier `<script>`, `onerror=` o
`javascript:` dentro de un EPUB arbitrario se ejecutaría en el navegador del
administrador. Un `.docx`/`.pdf` era seguro por construcción (su HTML se arma
escapando texto); un `.epub` es XHTML arbitrario de terceros y no lo es. El
editor sanitiza además lo que se pega desde Word/Docs, por la misma razón y
para que un pegado no traiga tipografías fijas que rompan la consistencia del
libro exportado.

Sigue fuera de alcance: números de página en el pie (la API de `gpdf` sólo
permite un pie igual para todas las páginas, y numerar la portada se ve peor
que no numerar), y texto fluyendo alrededor de una imagen flotante en el PDF.
