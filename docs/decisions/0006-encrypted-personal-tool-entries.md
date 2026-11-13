# ADR 0006: lo escrito en las Herramientas se guarda cifrado en la cuenta

## Context

Las tres Herramientas (registro de escritura diaria, preguntas para
reflexionar, ritual de cierre semanal) guardaban todo en el `localStorage` del
navegador. Eso protege la privacidad pero tiene límites claros: se pierde al
cambiar de dispositivo o al borrar los datos del navegador, y no acompaña a la
persona en el tiempo.

Lo que se escribe ahí es de lo más íntimo que maneja el sitio (emociones,
vínculos, cosas que alguien quiere soltar). El requisito es que se guarde en la
cuenta de cada persona y que **sólo esa persona** pueda leerlo: ni la
administradora desde el backoffice, ni quien vea la base de datos o un backup.

Restricciones del proyecto: login sólo con Google (no hay contraseña propia de
la que derivar una clave), un único VPS, sin servicios gestionados de claves
(KMS), y una escala muy chica que no justifica infraestructura nueva.

## Decision

**Cifrado por sobre (envelope encryption) del lado del servidor, con
AES-256-GCM** (biblioteca estándar de Go, sin dependencias nuevas):

1. **Clave maestra (KEK)**: 32 bytes aleatorios en la variable de entorno
   `PERSONAL_DATA_KEY` (base64). Vive en los secrets del Environment de
   GitHub y en el `.env` del VPS que arma el deploy; **nunca** en la base de
   datos ni en los backups. Lleva un número de versión (`kek_version`) para
   poder rotarla más adelante sin migrar el esquema.
2. **Clave de datos por usuario (DEK)**: 32 bytes aleatorios, generados la
   primera vez que la persona guarda algo. Se guarda en `user_data_keys`
   **envuelta** (cifrada) con la KEK, con el id del usuario como dato
   asociado (AAD): una clave envuelta copiada a otro usuario no abre.
3. **Cada entrada** se cifra con la DEK de su dueño. El AAD liga el texto
   cifrado a `usuario + herramienta + tipo + clave`, así una fila no puede
   moverse a otro usuario ni a otra posición sin que el descifrado falle.
4. **Acceso**: sólo existen endpoints `/api/v1/me/tools/...` con la sesión del
   propio usuario. No hay ningún endpoint de administración que lea estas
   entradas. Las respuestas llevan `Cache-Control: no-store` y el contenido
   nunca se registra en logs.
5. **Borrado**: borrar una entrada la elimina; borrar la cuenta elimina todas
   sus entradas **y** su DEK (si quedara alguna copia en un backup viejo, ya
   no hay clave para abrirla).

**Modelo de datos genérico y escalable.** Una sola tabla `tool_entries`
(`user_id`, `tool`, `kind`, `entry_key`, `ciphertext`, fechas) con unicidad
por `(user_id, tool, kind, entry_key)`. Cada herramienta define sus `kind`
(p. ej. `day` en el registro diario, `answer`/`favorites` en preguntas,
`closure`/`draft` en el ritual) en una lista permitida del dominio; sumar una
herramienta nueva no requiere cambiar el esquema. Las lecturas están paginadas
por cursor sobre el índice único, con límites de tamaño por entrada y de
cantidad de entradas por herramienta.

**Sin sesión** las herramientas siguen funcionando en el navegador, como
antes. Al iniciar sesión, si hay registros guardados en ese navegador, se
ofrece pasarlos a la cuenta.

## Consequences

- La administradora no puede ver lo que escriben las personas: no hay
  endpoint, y en la base sólo hay texto cifrado.
- Un volcado de la base o un backup **sin** la clave maestra no revela nada.
- **Límite honesto**: el servidor descifra para responder, así que alguien
  con acceso simultáneo al VPS (la clave maestra) *y* a la base podría leer
  los datos. Un esquema de conocimiento cero (cifrado en el navegador con una
  clave derivada de una frase que sólo conoce la persona) evitaría eso, pero
  implica que olvidar la frase = perder todo lo escrito, y una fricción
  adicional que no encaja con un sitio terapéutico y sencillo. Queda como
  evolución posible: el formato (`format_version`, `kek_version`) lo permite.
- **La clave maestra es crítica**: si se pierde, lo guardado es
  irrecuperable. Debe guardarse también fuera del servidor (gestor de
  contraseñas). Ver `deploy/README.md`.
- Si `PERSONAL_DATA_KEY` no está configurada, el guardado en la cuenta queda
  deshabilitado (la API responde 503) y las herramientas siguen funcionando
  en el navegador: un deploy sin la clave no rompe el sitio.
- Las fechas de las entradas (`entry_key`, `updated_at`) quedan sin cifrar
  para poder ordenar y paginar; revelan cuándo se escribió, no qué.
