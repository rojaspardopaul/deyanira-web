# Deyanira Makeup Beauty — Guía para Claude

## Visión general

Aplicación web para **Deyanira Makeup Beauty**, salón de belleza profesional en Lima, Perú.
Monorepo npm workspaces con frontend Next.js 14 y backend Express.js.

## Arquitectura

```
deyanira-web/
├── apps/
│   ├── web/          # Next.js 14 — puerto 3000
│   └── api/          # Express.js — puerto 3001
├── packages/
│   └── types/        # Tipos TypeScript compartidos
└── prisma/           # Schema raíz (legacy) — usar apps/api/prisma/
```

## Comandos esenciales

```bash
# Desarrollo (ambos simultáneamente)
npm run dev                    # web + api en paralelo

# Individual
npm run dev:web                # Solo Next.js (puerto 3000)
npm run dev:api                # Solo Express (puerto 3001)

# Base de datos (Prisma)
npm run db:generate            # Generar cliente Prisma
npm run db:push                # Sincronizar schema con Supabase
npm run db:studio              # Abrir Prisma Studio
npm run db:migrate             # Crear migración

# Build
npm run build                  # Build de ambas apps
```

## Stack tecnológico

### Frontend — `apps/web`
- **Next.js 14** con App Router, TypeScript, Tailwind CSS v3
- **Supabase Auth** (`@supabase/ssr`) para clientes
- **API client**: `apps/web/lib/api.ts` — wrapper tipado sobre `fetch`
- Puerto: **3000**

### Backend — `apps/api`
- **Express.js** con CommonJS (no ESM)
- **Prisma ORM** + **PostgreSQL** vía Supabase
- **JWT** personalizado para el panel admin (`ADMIN_JWT_SECRET`)
- Puerto: **3001**

### Servicios externos
| Servicio | Uso |
|---|---|
| Supabase | Base de datos (PostgreSQL) + Auth de clientes |
| Cloudinary | Almacenamiento de imágenes |
| Culqi | Pagos online (moneda PEN, Perú) |
| Resend | Envío de emails transaccionales |
| WhatsApp Business | Notificaciones a clientes |

## Variables de entorno

`.env` en la raíz del monorepo. Ver `.env.example` para todas las variables.

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | PostgreSQL pooled (Prisma) |
| `DIRECT_URL` | PostgreSQL direct (migraciones) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Backend solo |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend |
| `ADMIN_JWT_SECRET` | JWT panel de administración |
| `NEXT_PUBLIC_API_URL` | URL del backend (default: `http://localhost:3001`) |
| `CLOUDINARY_*` | Credenciales Cloudinary |
| `CULQI_*` | Llaves de pago |
| `RESEND_API_KEY` | Emails |

## Estructura del frontend (`apps/web`)

### Route Groups (App Router)
```
app/
├── (public)/          # Rutas públicas
│   ├── servicios/     # Catálogo de servicios
│   ├── tienda/        # Tienda de productos + [slug]/
│   ├── reservar/      # Booking wizard
│   ├── carrito/       # Carrito de compras
│   ├── checkout/      # Proceso de pago
│   ├── galeria/       # Galería de fotos
│   ├── nosotros/      # Página "Sobre nosotros"
│   └── contacto/      # Formulario de contacto
├── (auth)/
│   ├── login/         # Login de clientes (Supabase Auth)
│   └── registro/      # Registro de clientes
├── (cliente)/
│   └── mi-cuenta/     # Área privada del cliente
├── (admin)/
│   └── admin/
│       ├── page.tsx   # Dashboard
│       ├── login/     # Login admin (JWT)
│       ├── citas/     # Gestión de citas
│       ├── clientes/  # Gestión de clientes
│       ├── servicios/ # CRUD servicios
│       ├── productos/ # CRUD productos
│       ├── pedidos/   # Pedidos de tienda
│       ├── estilistas/# Gestión de personal
│       ├── horarios/  # Horarios de trabajo
│       ├── galeria/   # Gestión de galería
│       ├── contabilidad/ # Ingresos y gastos
│       └── configuracion/ # Configuración general
└── page.tsx           # Home
```

### Componentes clave
```
components/
├── layout/            # Header, Footer, BottomNav
├── home/              # HeroCarousel y secciones del home
├── booking/           # BookingWizard (wizard multi-step de reservas)
├── tienda/            # Componentes de tienda/productos
├── gallery/           # Galería de fotos
├── shop/              # Carrito/checkout
└── ui/                # Componentes UI reutilizables
    └── datetime/      # DateTimePicker unificado (ver sección dedicada)
```

### Selección de fecha/hora — `DateTimePicker`

**Componente único para TODA selección de fecha/hora** en la app. Vive en
`apps/web/components/ui/datetime/`. **No usar `<input type="date|time">` nativos
ni crear nuevos calendarios** — siempre usar este componente.

```tsx
import DateTimePicker from '@/components/ui/datetime';
```

#### Modos (`mode`)
| Modo | `value` | `onChange` devuelve |
|---|---|---|
| `date` | `string \| null` (`'YYYY-MM-DD'`) | `'YYYY-MM-DD'` |
| `time` | `string \| null` (`'HH:mm'`) | `'HH:mm'` |
| `datetime` | `{ date, startTime, endTime? } \| null` | `{ date, startTime, endTime? }` |
| `range` | `{ startDate, endDate } \| null` | `{ startDate, endDate }` (estilo aerolínea, un calendario) |

#### Props comunes
- `theme`: `'light'` (admin, default) · `'dark'` (wizard público / fondos glass).
- `variant`: `'popover'` (default; abre al click, **hoja full-screen en móvil**) · `'inline'` (calendario embebido).
- `minDate` / `maxDate` / `disabledDates` (`'YYYY-MM-DD'`).
- `label`, `error` (validación inline, p. ej. mostrar el mensaje de un 409), `disabled`, `className`, `locale` (default `'es-PE'`).
- **Hora libre** (`time`/`datetime` sin slots): `minuteStep` (default 5), `minTime`, `maxTime`, `disabledTimeRanges?: {start,end}[]`.
- **Hora por slots** (`datetime`): `availableSlots={[{start,end}]}` + `slotsLoading`. Si se pasa `availableSlots`, el selector de horas muestra esos slots (reservas = 30 min del backend) en vez de generar opciones libres.
- **`hourFormat`**: `'12h'` (default, muestra `a.m./p.m.`) o `'24h'`. El valor siempre se guarda en 24h `'HH:mm'`.

#### Selector de hora (estilo librería)
La selección de hora (`time`/`datetime`) muestra un **campo segmentado editable** `[Hora] [Min] [a.m./p.m.]` (`TimeField`) con **auto-avance** (al completar la hora el foco salta a minutos; sin segundos) y un **icono de reloj** al lado que **despliega la rueda** (`TimeWheel`: columnas Hora | Min | a.m./p.m. con valor resaltado). Lo que se escribe se **valida al instante** contra la disponibilidad ya calculada, mostrando el motivo y un texto con los horarios que SÍ se pueden. El modo `time` se renderiza siempre inline (el campo ES el control). Los horarios **no disponibles se muestran en gris y no son seleccionables** en la rueda:
- Modo slots: la grilla va del primer al último slot; los huecos sin disponibilidad quedan en gris.
- Modo libre: fuera de `minTime/maxTime` o dentro de `disabledTimeRanges` → gris.
El popover **no se cierra** al elegir la hora (el usuario ajusta hora/min/meridiano y cierra con Esc / fuera / "Aplicar" en móvil).

#### Reglas clave
- **Formatos = contrato backend**: fecha `'YYYY-MM-DD'`, hora `'HH:mm'` (24h). El componente nunca expone objetos `Date`.
- **Slots de reserva = 30 min**, los genera el backend (`apps/api/src/lib/booking/availability.js`). El `minuteStep` de 5 es solo para campos de hora libre (horarios de staff, bloqueos, configuración).
- **Zona horaria America/Lima**: para construir un `Date` desde una fecha date-only se usa el padding `'T12:00:00'` (helpers en `datetime/utils.ts`). Nunca parsear `'YYYY-MM-DD'` sin ese padding.
- En `mode="datetime"` libre, cambiar la fecha **conserva** la hora; en modo slots **resetea** la hora (los slots dependen de la fecha).

#### Estructura interna
- `DateTimePicker.tsx` — orquestador (modo/variant/theme/trigger/popover).
- `MonthGrid.tsx` — grilla mensual (date + range). `WeekStrip.tsx` — tira semanal.
- `TimeList.tsx` — control de hora: orquesta campo + reloj + rueda, calcula candidatos/`disabled` y valida. `TimeField.tsx` — campo segmentado editable (Hora/Min/a.m.-p.m.) con auto-avance. `TimeWheel.tsx` — rueda visual de columnas. `Popover.tsx` — popover desktop + hoja móvil.
- `utils.ts` — helpers puros de fecha/hora. `theme.ts` — tokens claro/oscuro. `types.ts` — tipos.

`components/ui/Calendar.tsx` y `components/ui/BookingCalendar.tsx` son **wrappers finos** que delegan en `DateTimePicker` (se conservan por compatibilidad de su API original).

### Cliente API (`apps/web/lib/api.ts`)
Wrapper tipado para todas las llamadas al backend. Incluye:
- `api.services.*` — catálogo de servicios
- `api.staff.*` — personal/estilistas
- `api.appointments.*` — citas (disponibilidad, crear, cancelar)
- `api.products.*` — tienda
- `api.orders.*` — pedidos
- `api.gallery.*` — galería
- `api.settings.*` — configuración del salón
- `api.admin.*` — endpoints admin (requieren token JWT)

## Estructura del backend (`apps/api`)

### Rutas (`apps/api/src/routes/`)
```
routes/
├── public/
│   ├── auth.js          # Login/registro clientes (Supabase)
│   ├── services.js      # Servicios + categorías
│   ├── staff.js         # Personal
│   ├── appointments.js  # Citas + disponibilidad
│   ├── products.js      # Productos + categorías
│   ├── orders.js        # Pedidos
│   ├── payments.js      # Pagos Culqi
│   ├── gallery.js       # Fotos
│   ├── blog.js          # Blog
│   ├── settings.js      # Configuración pública
│   └── promotions.js    # Promociones
└── admin/               # Requieren Bearer JWT de admin
    └── index.js         # Sub-rutas admin completas
```

### Librerías internas (`apps/api/src/lib/`)
- `booking/availability.js` — Algoritmo de disponibilidad de slots
- `notifications/whatsapp.js` — Notificaciones WhatsApp
- `cloudinary.js` — Upload de imágenes

## Modelos de datos (Prisma)

Modelos principales:
- `ServiceCategory` / `Service` — Catálogo de servicios
- `Staff` / `StaffService` / `StaffSchedule` — Personal y horarios
- `Customer` — Clientes (extiende `auth.users` de Supabase)
- `Appointment` — Citas
- `Product` / `ProductCategory` — Tienda
- `Order` / `OrderItem` — Pedidos
- `GalleryPhoto` — Galería
- `BlogPost` — Blog
- `Settings` — Configuración única del salón
- `Admin` — Administradores (auth separada de Supabase)
- `StaffUnavailability` — Bloqueos de disponibilidad
- `Expense` / `OtherIncome` — Contabilidad

Schema: `apps/api/prisma/schema.prisma`

## Autenticación

**Dos sistemas de auth independientes:**

1. **Clientes**: Supabase Auth (`@supabase/ssr`)
   - Middleware en `apps/web/middleware.ts`
   - Protege `/mi-cuenta/*`
   - Tokens manejados por Supabase automáticamente

2. **Admin**: JWT personalizado
   - `POST /api/admin/auth/login` devuelve token JWT
   - Token se almacena en localStorage del navegador
   - Cabecera: `Authorization: Bearer <token>`
   - Rutas admin en `/admin/*` verifican el token en el layout

## Convenciones de código

- **Backend**: CommonJS (`require`/`module.exports`), JavaScript puro
- **Frontend**: TypeScript, ESModules, Next.js App Router
- **Estilos**: Tailwind CSS, `clsx` + `tailwind-merge` para clases condicionales
- **Validación**: Zod en ambos lados
- **Moneda**: PEN (soles peruanos), campo `pricePen` en la BD
- **Idioma del negocio**: Español (UI, mensajes de error, notificaciones)
- **Fecha/hora**: usar siempre `DateTimePicker` (`components/ui/datetime/`), nunca `<input type="date|time">` nativos (ver sección dedicada)

## Consideraciones importantes

- `typescript.ignoreBuildErrors: true` y `eslint.ignoreDuringBuilds: true` en `next.config.js` — no bloquear deploys por errores de tipos
- El admin usa JWT almacenado en localStorage (no cookies), por lo que el middleware de Next.js no lo protege a nivel servidor
- Rate limiting en el backend: 100 req/min global, 10 req/min en pagos
- Imágenes remotas permitidas: `res.cloudinary.com` y `*.supabase.co`
- El slot de disponibilidad de citas considera horarios de staff, citas existentes y bloqueos manuales
