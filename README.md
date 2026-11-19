# Casa Hospedaje H&L

Sitio público y panel: habitaciones, reservas, calendario, cotizador, pagos, egresos, solicitudes, usuarios e importación del sistema anterior.

Astro 7 SSR con `@astrojs/cloudflare`, React 19, Tailwind 4, Astro Actions y Drizzle sobre D1. Worker: **casa-hl**. Sesiones en KV `SESSION`, aprovisionado automáticamente por el adapter al desplegar. Imágenes optimizadas durante el build (`imageService: 'compile'`), sin Cloudflare Images.

## Desarrollo local

Requiere Node 24 y las dependencias del lockfile. En PowerShell usa `npm.cmd` si la política bloquea `npm.ps1`. Los scripts invocan binarios con `node node_modules/...` para soportar la ruta con `&`.

1. Copia `.env.example` a `.env` y define `ADMIN_PASSWORD`. No hay contraseña predeterminada.
2. Opcionalmente copia `.dev.vars.example` a `.dev.vars` para overrides locales del Worker.
3. Ejecuta:

```powershell
npm.cmd run db:migrate:local
npm.cmd run db:seed:local
npm.cmd run dev
```

Sitio: `http://localhost:4321`; acceso: `/admin/login`. Astro ejecuta el backend en workerd, con D1/KV locales persistidos en `.wrangler/state`. Wrangler comparte ese almacenamiento. `data/casa-hl.db` se conserva y ya no se usa en runtime.

`.env` sirve para Node (seed y URL del build); `.dev.vars` para bindings locales del Worker. No pongas credenciales iniciales en `vars` de Wrangler. El runtime accede a D1 mediante `import { env } from 'cloudflare:workers'`. Los datos públicos en `src/config/site.ts` no dependen de variables de entorno.

`PUBLIC_SITE_URL` en el entorno del build configura `site`, sitemap y metadatos; por defecto es `https://casa-hl.chefsitturchey.workers.dev`. Mantén el mismo valor en `wrangler.jsonc` si cambias el dominio. Cambiar solo una variable del Worker no regenera el sitemap.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Astro con workerd y bindings locales |
| `npm run check` | Comprobación de tipos |
| `npm test` | Dominio, PBKDF2 y batches con D1/Miniflare aislado |
| `npm run build` | Check y build de producción |
| `npm run preview` | Wrangler dev del último build, puerto 8787 |
| `npm run deploy` | Build y despliegue |
| `npm run db:generate` | Genera migraciones SQLite en `drizzle/` |
| `npm run db:migrate:local` / `db:migrate:remote` | Aplica migraciones a D1 local/remoto |
| `npm run db:seed:sql` | Genera `data/seed.sql` |
| `npm run db:seed:local` / `db:seed:remote` | Genera y aplica el seed |

`node scripts/seed-sql.ts` también funciona con `ADMIN_PASSWORD` en el entorno. El seed usa `ADMIN_USERNAME` (por defecto `admin`) y `ADMIN_NAME`, crea cinco habitaciones de ejemplo y no sobrescribe usuarios ni habitaciones existentes. `data/seed.sql` contiene el hash del administrador y está ignorado junto a los datos locales.

Contraseñas: `pbkdf2$100000$saltB64$hashB64`, PBKDF2-SHA256 WebCrypto, sal aleatoria de 16 bytes y comparación de longitud fija. Los hashes `scrypt` anteriores no permiten iniciar sesión; repetir el seed no cambia la contraseña de un usuario existente.

## Despliegue en Cloudflare

Estos pasos remotos los ejecuta el operador cuando vaya a publicar:

1. Autentica Wrangler y crea D1: `node node_modules/wrangler/bin/wrangler.js d1 create casa-hl`.
2. Sustituye `database_id: "PENDIENTE"` en `wrangler.jsonc` por el UUID real. El placeholder permite pruebas locales, pero no es válido en producción.
3. Configura la URL de build si usas otro dominio y una contraseña inicial propia en `.env` o el entorno.
4. Ejecuta `npm run db:migrate:remote`, `npm run db:seed:remote` y `npm run deploy`.

El adapter transforma `@astrojs/cloudflare/entrypoints/server`, configura assets y agrega KV `SESSION` al build. Wrangler descubre la configuración generada mediante `.wrangler/deploy/config.json`; por eso preview y deploy no fuerzan `--config wrangler.jsonc`. Ejecuta build antes del primer preview.

La configuración usa Workers, D1 y KV sin servicios de pago adicionales. Las cuotas y el consumo de CPU del plan gratuito deben comprobarse en la cuenta real: las pruebas locales no miden CPU de producción. El limitador de intentos vive en memoria **por isolate**: no se comparte ni garantiza un límite global, y se reinicia al reciclar el isolate.

## Integridad de reservas

Las cinco transacciones interactivas se sustituyeron por lecturas/validaciones previas y escrituras en un único `db.batch`, con rollback completo ante errores. El alta incluye reserva, adelanto y conversión de solicitud; la importación incluye habitaciones, reservas, pagos y egresos.

`0001_d1_guards.sql` añade triggers que comprueban dentro de la escritura: solapamientos de reservas no canceladas (incluidas finalizadas), sobrepagos, pagos en reservas canceladas, reducción del total por debajo de lo pagado e ingresos anticipados. Los intervalos son `[entrada, salida)`: las estadías contiguas están permitidas. La numeración se calcula en SQL al insertar. La importación comprueba cruces entre reservas del propio lote; un conflicto concurrente aborta el batch completo.

Aplica ambas migraciones antes de usar la aplicación. `--> statement-breakpoint` es un comentario SQL válido para Wrangler. Los triggers son una migración manual registrada en los metadatos de Drizzle; consérvalos al agregar futuras migraciones. Una importación muy grande puede exceder límites de D1 y rechazarse completa; no se divide porque perdería atomicidad.

## Respaldo

El panel conserva la exportación JSON en Ajustes. Para respaldar D1 con SQL:

```powershell
node node_modules/wrangler/bin/wrangler.js d1 export casa-hl --local --output data/backup-local.sql
node node_modules/wrangler/bin/wrangler.js d1 export casa-hl --remote --output data/backup-produccion.sql
```

Guarda copias fuera del equipo y protege su acceso. La base anterior y `_backups/casa-hl-20261011-pre-cloudflare.tgz` no se modifican ni se importan automáticamente. El seed contiene solo datos iniciales, no migra datos operativos anteriores.

## Personalización

- Datos del negocio: `src/config/site.ts`.
- Servicios, precios y catálogos: `src/lib/domain/catalog.ts`.
- Fotos: `src/assets/images/` y catálogo de imágenes.
- Textos públicos: `src/pages/index.astro`.
- Importación del HTML anterior: Ajustes → Traer datos del sistema anterior.

Si el sandbox bloquea archivos de Wrangler fuera del proyecto, define estas variables antes de los comandos locales:

```powershell
$env:WRANGLER_LOG_PATH = '.wrangler/logs'
$env:XDG_CONFIG_HOME = Join-Path (Get-Location) '.wrangler/config'
$env:WRANGLER_SEND_METRICS = 'false'
```

En este sandbox, `db:generate` encuentra `uv_os_get_passwd returned ENOMEM` dentro de la dependencia tsx de drizzle-kit. Ejecuta la generación fuera del sandbox si aparece ese error. La aplicación de las migraciones existentes mediante Wrangler funciona independientemente de ese comando.

Fotografías de Unsplash; reemplázalas por fotografías del hospedaje cuando estén disponibles.
