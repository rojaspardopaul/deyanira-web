---
name: deyanira-conventions
description: Reglas de oro y convenciones del proyecto Deyanira Makeup Beauty, derivadas de correcciones reales del dueño. Aplica SIEMPRE al trabajar en este código (admin, calendario, reservas, correos, PDFs, UX/UI). Cubre: confirmación obligatoria antes de aceptar/rechazar/verificar/eliminar, formato de hora 12h en toda la UI, uso del DateTimePicker unificado, tokens centrales del tema de correos, feedback visual e indicadores, y flujo de dev.
---

# Convenciones y reglas de oro — Deyanira

Estas reglas surgieron de correcciones del dueño. Respetarlas SIEMPRE sin que las repita.

## 1. REGLA DE ORO — Confirmar antes de cualquier acción que cambie estado
Cualquier acción de **aceptar / rechazar / verificar / confirmar / cancelar / eliminar / mover / reprogramar / cambiar de estado** DEBE pedir **confirmación previa** (un diálogo "¿Estás seguro?"), porque cualquiera se puede equivocar.
- Vale tanto para la acción "positiva" (aceptar/confirmar) como la "negativa" (rechazar/cancelar). **Ambas** confirman.
- Reusar `components/ui/ConfirmModal.tsx` (o el patrón `pendingAction` del `AptModal`). Nunca ejecutar la mutación directo en el `onClick`.
- El mensaje del diálogo debe decir en claro qué pasará y a quién afecta (y si se avisa al cliente por correo).
- Conservar redes de seguridad extra cuando aplique: toggle desactivado por defecto (arrastre del calendario) + confirmación + undo.

## 2. Hora SIEMPRE en formato 12h (a.m./p.m.)
**Toda** hora visible (admin, cliente, correos, PDFs, tickets) se muestra en **12h con "a.m./p.m."**, nunca en 24h. Los estilistas y clientes no deben confundirse.
- Helpers: `fmtTime12`/`fmtRange12` en `apps/web/lib/time.ts` (cliente/público) y `apps/web/components/calendar/utils/time.ts` (admin); en correos, `fmt12` en `apps/api/src/lib/notifications/email.js`.
- El valor se guarda/transmite siempre en 24h `'HH:mm'` (contrato backend); solo el **display** es 12h.

## 3. Selección de fecha/hora — DateTimePicker unificado, inline y responsivo
- Usar SIEMPRE `components/ui/datetime` (`DateTimePicker`). Nunca `<input type="date|time">` nativo ni calendarios nuevos.
- Para selectores embebidos en una pantalla (no en un popover suelto), usar `variant="inline"` para que el **mes completo** se vea y **no se corte** por falta de espacio abajo.
- **Responsivo**: fecha y hora **apiladas** (una debajo de otra), nunca en una fila estrecha donde se encimen. En móvil deben verse completas.
- Mantener consistencia: si una pantalla ya tiene un selector "principal", los demás selectores de esa pantalla deben verse y comportarse **igual**.

## 4. Correos — tema central, todo configurable en un archivo
- Todo el estilo vive en `apps/api/src/lib/notifications/theme.js`. Cambiar la marca = editar ese archivo y se propaga a todos los correos y al recibo PDF.
- Identidad: fondo **oscuro #211915** (negro cálido), **barra superior dorada única** (no multicolor), acento **dorado** dominante + **rosa** para activo/CTA.
- **Logo real** desde `Settings.logoDarkUrl` (no texto, salvo fallback).
- **Footer sin wordmark** "DEYANIRA"; lleva **íconos sociales** que toman las URLs de **Admin → Configuración → redes** (`instagramUrl/facebookUrl/tiktokUrl`).
- **Imágenes que cargan en cualquier cliente y en modo claro/oscuro**: usar URLs **públicas** (CDN o Cloudinary), NUNCA `localhost` ni `/public` sin deploy. Íconos sociales en versión **a color** (visibles sobre fondos claros u oscuros). Gmail/Outlook **eliminan SVG inline** → usar **PNG/imagen hospedada**.
- HTML de correo **table-based** + estilos inline + fallback de `bgcolor` para Outlook (nada de flex/grid en el HTML final).
- Stepper de estados: nodos con **fondo sólido opaco** para que la línea conectora **nunca cruce** el círculo; la línea va **solo en el hueco** entre nodos. Chips/recuadros con ancho suficiente (no estrechos, sin cortar texto).
- Comprobantes de pago: **incrustar la imagen (clicable) y adjuntarla** (Resend `attachments`) en los correos correspondientes.

## 5. Feedback visual e indicadores
- Las acciones deben **notarse visualmente**: al redimensionar una cita, el bloque se **estira/acorta en vivo** mientras arrastras (no solo al soltar).
- Poner **indicadores** para detectar de un vistazo lo que requiere atención (p. ej. 💳 en citas con comprobante por verificar). Lo importante debe estar **siempre a la mano** (comprobantes visibles desde el calendario, no escondidos en otra pantalla).

## 6. Flujo de reserva / pagos
- El cliente se entera por **correo** (no se depende de WhatsApp como mecanismo); el salón recibe el aviso para revisar y confirmar.
- Una cita con **adelanto** NO se puede confirmar hasta **verificar el pago** (revisar el comprobante). Confirmar el pago confirma la cita.

## 7. Flujo de desarrollo (evitar romper el dev del dueño)
- **No** correr `npm run build` mientras `npm run dev` está activo: sobrescribe `.next` y rompe el dev (errores de MIME, chunks 404, manifest 500). Si pasa: parar dev, `Remove-Item -Recurse -Force apps/web/.next`, y `npm run dev`.
- Para validar sin romper el dev: usar `npx tsc --noEmit` (no toca `.next`) y, si hay que buildear, hacerlo con `SKIP_TS=true SKIP_LINT=true` (hay un error de tipos preexistente en `ServiceModifiersBuilder.tsx`).
- Tras cambios en el **API**, recordar reiniciar `npm run dev:api`.

## 8. Reutilización / centralización
- Centralizar para que un cambio (color, estilo, token, helper) se refleje en todos lados. Preferir editar el token/helper central a tocar muchos archivos.
