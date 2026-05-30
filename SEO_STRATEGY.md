# 📈 Deyanira Makeup Beauty — Estrategia CEO de posicionamiento

> **Objetivo a 90 días**: TOP 3 en Google.pe para "salón de belleza Surco", "maquillaje profesional Lima", "uñas Surco" y aparecer en el Map Pack local para búsquedas con intención geográfica en Lima Metropolitana.

---

## 🎯 1. Diagnóstico del mercado

| Competencia (Lima) | Fortaleza | Debilidad |
|---|---|---|
| Cinnamon, Marco Aldany, Montalvo | Brand recognition, ubicación | Precios altos, agenda lenta, sin online booking real |
| Salones independientes Instagram | Estética, cercanía | No tienen web/SEO real, dependen 100% de IG |
| Marketplaces (Treatwell etc.) | UX de búsqueda | Sin presencia fuerte en Perú |

**Nuestra ventaja competitiva (la web ya la habilita)**:
1. ✅ Reserva online 24/7 con disponibilidad en tiempo real (no la tienen los locales)
2. ✅ Servicio a domicilio en Lima (caro de operar para los grandes)
3. ✅ Tienda integrada con check-out propio (Culqi + Yape)
4. ✅ Stack técnico moderno (Lighthouse 90+ alcanzable) → ranking Google

---

## 🔑 2. Investigación de palabras clave (Lima)

### Tier 1 — Money keywords (alta intención + volumen)
| Keyword | Vol. mensual* | Dificultad | URL objetivo |
|---|---|---|---|
| `salon de belleza lima` | ~3.6k | Media | `/` |
| `salon de belleza surco` | ~720 | Baja | `/` |
| `maquillaje profesional lima` | ~1.9k | Media | `/servicios?category=maquillaje` |
| `maquillaje de novia lima` | ~880 | Media | `/servicios/maquillaje-novia` (crear) |
| `uñas acrilicas lima` | ~2.4k | Media | `/servicios?category=unas` |
| `manicure semipermanente lima` | ~590 | Baja | `/servicios/manicure-semipermanente` (crear) |
| `extension de pestañas lima` | ~880 | Media | `/servicios/extension-pestanas` (crear) |
| `peluqueria surco` | ~480 | Baja | `/` |

\* aproximado, validar con Google Keyword Planner o SEMrush.

### Tier 2 — Long-tail (rankear rápido)
- `cuánto cuesta un maquillaje de novia en lima` → artículo blog
- `mejores salones de belleza en surco` → home + reseñas
- `salon de uñas cerca de mí surco` → home (local SEO carga esto)
- `maquillaje a domicilio lima precio` → landing `/servicios/maquillaje-a-domicilio`
- `cómo elegir maquillaje de novia` → artículo blog

### Tier 3 — Branded / defensivas
- `deyanira makeup beauty` → home
- `deyanira salon` → home

### Tier 4 — Producto (tienda)
- `comprar [marca] lima` → `/tienda/[slug]`

---

## 🛠️ 3. Acciones técnicas — YA APLICADAS ✅

| Item | Estado |
|---|---|
| Sitemap dinámico con servicios/productos/blog | ✅ `app/sitemap.ts` |
| Robots.txt con block de scrapers AI | ✅ `app/robots.ts` |
| PWA manifest (instalable) | ✅ `app/manifest.ts` |
| Open Graph image dinámico (Edge) | ✅ `app/opengraph-image.tsx` |
| Schema.org BeautySalon + FAQ + Org + WebSite | ✅ `lib/jsonld.ts` |
| Metadata canónica + hreflang `es-PE` | ✅ `lib/seo.ts` |
| `geo.region`, `ICBM` meta tags | ✅ root layout |
| Headers de seguridad + HSTS + CSP | ✅ `next.config.js` |
| Preconnect a Cloudinary y fonts | ✅ root layout |
| Build estricto (no ignoreBuildErrors) | ✅ |
| Imágenes AVIF/WebP, lazy load Next/Image | ✅ existente |
| URL semánticas (slug-based) | ✅ existente |

## 🛠️ 4. Acciones técnicas — PENDIENTES (próximos sprints)

### Sprint 1 (semana 1-2) — Schema en páginas profundas
- [ ] **`app/(public)/servicios/[slug]/page.tsx`**: inyectar `serviceLd(...)` + breadcrumbs.
- [ ] **`app/(public)/tienda/[slug]/page.tsx`**: inyectar `productLd(...)` + breadcrumbs.
- [ ] **`app/(public)/blog/[slug]/page.tsx`**: inyectar `articleLd(...)` + breadcrumbs.
- [ ] **`app/(public)/galeria/page.tsx`**: inyectar `ImageGallery` schema con `caption`.
- [ ] **`app/(public)/contacto/page.tsx`**: inyectar `LocalBusiness` completo + FAQ.

Estimación: **2-3 h** de desarrollo total (ya tienes los helpers `serviceLd`/`productLd`).

### Sprint 2 (semana 2-3) — Landing pages de keywords money
Crear estos slugs como páginas dedicadas con copy optimizado (no son productos, son "servicios estrella"):

```
app/(public)/maquillaje-novia-lima/page.tsx
app/(public)/manicure-semipermanente-surco/page.tsx
app/(public)/extension-pestanas-lima/page.tsx
app/(public)/maquillaje-a-domicilio-lima/page.tsx
app/(public)/salon-de-belleza-surco/page.tsx
```

Cada una con:
- H1 con keyword exacto
- 800-1200 palabras de contenido (no relleno: incluir precios, duración, qué incluye, antes/después)
- 3-5 imágenes con `alt` optimizado
- FAQ específico (3-5 preguntas)
- CTA fuerte a `/reservar?service=<slug>`
- JSON-LD `Service` + `FAQPage` + `BreadcrumbList`

### Sprint 3 (semana 3-4) — Performance / Core Web Vitals
- [ ] Auditar con `npx unlighthouse` o Google PageSpeed Insights
- [ ] Objetivo: **LCP < 2.5s, INP < 200ms, CLS < 0.1**
- [ ] Preload de la primera imagen del hero con `fetchPriority="high"`
- [ ] Mover `framer-motion` a dynamic import donde sea decorativo
- [ ] Tree-shake `lucide-react` con `optimizePackageImports` en `next.config.js`

```js
// next.config.js — agregar:
experimental: {
  optimizePackageImports: ['lucide-react', 'framer-motion'],
}
```

### Sprint 4 (semana 4-5) — Internal linking + arquitectura
- [ ] Cada servicio enlaza a productos relacionados (`/tienda/...`)
- [ ] Cada producto enlaza al servicio donde se usa
- [ ] Blog enlaza a servicios mencionados con `rel="dofollow"` (interno)
- [ ] Footer con sitemap visible (mejora descubrimiento + keywords)
- [ ] Breadcrumb component en todas las páginas profundas

---

## 📍 5. Local SEO — el palanca #1 para un salón

Google "Local Pack" (los 3 negocios con mapa que aparecen arriba) capta el **50% de los clicks** en búsquedas con intención geográfica. Sin esto, no hay tráfico local.

### Acciones obligatorias (1-2 semanas)

1. **Google Business Profile (Google My Business)**
   - [ ] Reclamar/verificar el perfil (por correo postal o video).
   - [ ] Categoría primaria: **Salón de belleza** (Beauty salon).
   - [ ] Categorías secundarias: Salón de uñas, Salón de manicura y pedicura, Maquillador, Spa.
   - [ ] Horarios exactos (mismo formato que en el sitio).
   - [ ] +20 fotos del local y trabajos (mejorar a +100 en 90 días).
   - [ ] Servicios y precios cargados en el panel.
   - [ ] Activar mensajes y reservas (vincular a `/reservar`).
   - [ ] **Pedir reseñas activamente**: meta de 50 reseñas en 90 días, idealmente con foto.
   - [ ] Responder TODAS las reseñas en < 24 h.
   - [ ] Publicar 2 posts/semana (ofertas, novedades).

2. **NAP (Name, Address, Phone) consistente** — la regla de oro local SEO.
   - El nombre, dirección y teléfono **deben ser idénticos** en:
     - Sitio web (`Settings` del admin → Configuración)
     - Google Business Profile
     - Páginas Amarillas
     - Facebook, Instagram bio
     - Yelp (si aplica)
   - Si hay variaciones, Google las trata como negocios distintos → no rankea.

3. **Directorios locales (citations)** — al menos en estos 10:
   - PaginasAmarillas.com.pe
   - PuntoCero.pe
   - Yelp Perú
   - TripAdvisor (Lima Wellness)
   - Lima.gob.pe directorios distritales
   - Surco.gob.pe directorio comercial
   - Facebook Business
   - Foursquare
   - Apple Maps (Apple Business Connect)
   - Bing Places for Business

4. **Schema.org `LocalBusiness` con `geo` + `openingHoursSpecification`** → ya implementado ✅

5. **Backlinks locales**: artículos en blogs de bodas peruanas, revistas digitales limeñas (Sumaq, Mujer Actual, Cosmopolitan PE), influencers.

---

## ✍️ 6. Content marketing — plan editorial 90 días

> Tu blog actualmente no existe como motor de SEO. Cada artículo es una puerta a Google.

### Calendario de publicación (1 artículo/semana, 12 artículos en 90 días)

| # | Título | Keyword principal | Volumen est. | Sprint |
|---|---|---|---|---|
| 1 | "Cuánto cuesta un maquillaje de novia en Lima (2026)" | maquillaje de novia lima precio | 720 | 1 |
| 2 | "10 pasos para preparar tu piel antes de tu maquillaje de novia" | preparar piel maquillaje novia | 480 | 1 |
| 3 | "Uñas acrílicas vs semipermanente: cuál te conviene" | uñas acrílicas o semipermanente | 590 | 2 |
| 4 | "Cómo elegir el corte de cabello según tu rostro" | corte de cabello según rostro | 1.6k | 2 |
| 5 | "Diseño de cejas: tipos, técnicas y cuál es la mejor para ti" | tipos de diseño de cejas | 880 | 3 |
| 6 | "Maquillaje para quinceañeras en Lima: guía 2026" | maquillaje para quinceañeras lima | 590 | 3 |
| 7 | "Balayage vs mèches: diferencias y precios en Lima" | balayage o mèches diferencia | 720 | 4 |
| 8 | "Extensión de pestañas: tipos, duración y cuidados" | extensión de pestañas tipos | 590 | 4 |
| 9 | "Maquillaje social para fiestas: tips de las profesionales" | maquillaje social tips | 320 | 5 |
| 10 | "Cómo cuidar tu cabello en verano en Lima" | cuidar cabello verano | 480 | 5 |
| 11 | "Los mejores productos coreanos para skincare en Perú" | productos coreanos skincare Perú | 720 | 6 |
| 12 | "Tendencias de uñas 2026: lo que se viene" | tendencias uñas 2026 | 880 | 6 |

**Estructura de cada artículo (template)**:
- 1.500-2.000 palabras
- H1 con keyword exacto, 1 H1 por página
- H2/H3 con variantes long-tail
- 5-8 imágenes propias (NO stock) con `alt` descriptivo
- FAQ al final (3-5 preguntas) con schema `FAQPage`
- CTA a `/reservar` o `/servicios/...` relevante
- Bio + foto de la autora (E-E-A-T para Google)
- Schema `Article` ya implementado en `lib/jsonld.ts` ✅

---

## 🔗 7. Estrategia de backlinks (90 días)

| Táctica | Objetivo | Coste | Esfuerzo |
|---|---|---|---|
| **Guest posts** en blogs de bodas peruanas (Boda.Pe, Casamientos.pe) | 3-5 links DA 30+ | $0 | Medio |
| **Colaboraciones con influencers** locales (intercambio servicio↔mención + link) | 5-10 menciones IG con tag | Servicio gratis | Alto |
| **Press release** "Salón Deyanira incorpora reserva online" → mediosperuanos.com, mujeractual.com | 2-3 links | $100 | Bajo |
| **Listings de novias**: TheBridge.pe, BodaClick Perú | 2-4 links | $0 | Bajo |
| **HARO**: responder a periodistas que buscan expertos en belleza | 1-2 al mes | $0 | Medio |
| **Partnerships locales**: salones de novias, fotógrafos, wedding planners → link recíproco | 5-10 links | $0 | Alto |

**Métrica clave**: subir el **Domain Authority** (Ahrefs/Moz) de 0 a 20 en 90 días.

---

## 🌐 8. Estrategia de redes sociales (sinergia SEO)

Google sí cuenta señales sociales indirectamente (tráfico → engagement → autoridad).

### Instagram (canal principal)
- Bio: link a `/reservar` con UTM `?utm_source=instagram&utm_medium=bio`
- 3 reels/semana, 1 carrusel educativo/semana
- Stories con "Reserva ya" → swipe-up
- **Hashtags hyper-local**: #salonbellezaSurco #maquillajeLima #unaslima

### TikTok
- 5 videos/semana, formato antes/después + tutoriales 60s
- Bio link a `/reservar`
- Inundar con hashtags locales: #lima #surco #peru

### WhatsApp Business
- Catálogo de servicios cargado
- Mensaje automático con link a `/reservar`
- Lista de difusión (con consentimiento): promos mensuales

### Pinterest (sleeper SEO)
- Subir TODAS las fotos del portafolio
- Cada pin enlaza a `/galeria` o servicio específico
- Pinterest tiene SEO interno + Google indexa pines → tráfico orgánico extra a 6+ meses

---

## 📊 9. Analytics y medición

### Setup obligatorio
- [ ] **Google Analytics 4** ya integrado vía `NEXT_PUBLIC_GA_ID` ✅
- [ ] **Google Search Console** — agregar dominio, validar sitemap, monitorear:
  - Cobertura (errores de indexación)
  - Performance (clicks, impressions, CTR, posición media)
  - Core Web Vitals (LCP/FID/CLS)
  - Mobile usability
- [ ] **Bing Webmaster Tools** — mismo pero para Bing (5% de tráfico extra fácil)
- [ ] **Microsoft Clarity** — heatmaps + session replays GRATIS. Detectar fricciones en checkout/reserva.
- [ ] **Vercel Analytics** o **Plausible** — Web Vitals reales en producción

### KPIs a trackear (dashboard mensual)
| KPI | Baseline (mes 0) | Meta mes 3 | Meta mes 6 |
|---|---|---|---|
| Sesiones orgánicas/mes | TBD | 1.500 | 5.000 |
| Posición media keywords Tier 1 | >50 | <20 | <8 |
| Reseñas Google Business | TBD | 50 | 150 |
| Tasa de reserva online | TBD | 4% | 7% |
| Backlinks (Ahrefs) | TBD | 25 | 80 |
| Core Web Vitals (% good) | TBD | 90% | 98% |

---

## 💰 10. Roadmap 100% ORGÁNICO — presupuesto S/ 0

> Todo este plan se ejecuta **sin pagar publicidad ni servicios**.
> La única "inversión" es **tiempo**: ~3-5 h/semana del dueño + 1 persona del equipo.

| Item | Reemplazo gratuito | Tiempo / sem |
|---|---|---|
| Fotos profesionales | Celular moderno + ventana grande + **Snapseed** o **Lightroom Mobile** (gratis). Tomar fotos cada vez que termina un servicio y la clienta acepta. | 30 min |
| Redactor blog | Tú o alguien del equipo. Usa **ChatGPT/Claude gratis** como editor — no como autor: tú aportas la experiencia real, la IA te ayuda a estructurar. | 1 h |
| Influencer marketing | **Intercambio servicio ↔ contenido**: ofreces maquillaje/uñas gratis a 5-10 micro-influencers locales (5-15k seguidores) a cambio de post + stories + tag. | 1 h |
| Press release | Email directo a redacciones: Cosmopolitan PE, Sumaq, MujerActual, Boda.pe, Casamientos.pe, La República (sección Mujer), El Comercio Bienestar. Pitch personalizado. | 1 h |
| Ahrefs / SEMrush | **Google Search Console** (gratis, oficial Google) + **Google Keyword Planner** + **Ubersuggest** free tier (3 búsquedas/día) + **AnswerThePublic** (gratis) + **Google Trends**. | — |
| Community Manager | **Meta Business Suite** (gratis): programar 1 semana de posts IG/FB en un solo bloque dominical. **CapCut** y **Canva** gratis para edición. | 2 h |
| Email marketing | **Mailchimp** o **Brevo** free tier hasta 500-1000 contactos. Lista construida de clientas reales (con consentimiento). | 30 min |
| Analítica | **Google Analytics 4** ✅ ya integrado. **Microsoft Clarity** gratis para heatmaps. **Vercel Analytics** gratis. | — |
| **TOTAL** | **S/ 0** | **~6 h/sem** |

ROI esperado mes 6: 5.000 sesiones/mes × 5% conversión × S/ 120 ticket = **S/ 30.000/mes adicionales**. Sin haber gastado un sol en ads.

---

## ⚡ 11. Quick wins — implementar ESTA SEMANA

```
□ Reclamar Google Business Profile y subir 30+ fotos
□ Pedir 10 reseñas a clientas actuales (con link directo: g.page/r/...)
□ Verificar dominio en Google Search Console y enviar sitemap.xml
□ Verificar dominio en Bing Webmaster Tools y enviar sitemap.xml
□ Setear NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION en .env de producción
□ Agregar el sitio a Cloudflare (gratis) → CDN + WAF + analítica
□ Lanzar 2 landings de servicios estrella (maquillaje novia + uñas semipermanente)
□ Subir 50 fotos a la galería con `alt` optimizado por keyword
□ Crear el perfil en Pinterest y subir el portafolio (mínimo 30 pins)
□ Tomar primera medición Lighthouse y guardar como baseline
```

---

## 🚀 12. Visión 12 meses

Año 1 — objetivo: **#1 orgánico en "salón de belleza Surco" y top 3 en "maquillaje de novia Lima"**, con:
- 15k+ sesiones orgánicas/mes
- 500+ reseñas Google (rating 4.8+)
- 3 ubicaciones físicas (escalado del modelo)
- Tienda con ticket promedio S/ 150
- Línea propia de productos de belleza (white-label) → mayor margen

El sitio web hardened + arquitectura SEO de esta entrega es el **motor**. La gasolina es la ejecución diaria del plan editorial + GMB + reseñas + backlinks.

---

> **Última recomendación CEO**: contrata un Community Manager part-time (S/ 1.500/mes) que ejecute el calendario IG/TikTok + responda Google Business Profile + recopile reseñas. Sin alguien dedicado a esto, el plan no se ejecuta.
