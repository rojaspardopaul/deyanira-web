'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function RegistroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/mi-cuenta';

  const [form, setForm]         = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [accepted, setAccepted]   = useState(false);
  const [marketing, setMarketing] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleGoogle() {
    if (!accepted) { setError('Debes aceptar los Términos y Condiciones y la Política de Privacidad.'); return; }
    setGoogleLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) {
      setError('Error al continuar con Google');
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden'); return; }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (!accepted) { setError('Debes aceptar los Términos y Condiciones y la Política de Privacidad.'); return; }
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name, acceptsMarketing: marketing, termsAcceptedAt: new Date().toISOString() } },
    });
    if (signUpError) {
      setError(
        signUpError.message.includes('already registered')
          ? 'Este email ya está registrado. ¿Quieres iniciar sesión?'
          : 'Error al crear la cuenta. Intenta de nuevo.'
      );
      setLoading(false);
      return;
    }

    if (signUpData.session?.access_token) {
      // Email confirmation is OFF — user is immediately logged in
      fetch(`${API_URL}/api/customers/me`, {
        headers: { Authorization: `Bearer ${signUpData.session.access_token}` },
      }).catch(() => {});
      router.push(redirect);
      router.refresh();
    } else {
      // Email confirmation is ON — show "check your email" message
      setEmailSent(true);
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">¡Revisa tu email!</h1>
            <p className="text-gray-500 text-sm mb-2">
              Hemos enviado un enlace de confirmación a:
            </p>
            <p className="font-semibold text-gray-800 mb-5">{form.email}</p>
            <p className="text-gray-400 text-xs">
              Haz clic en el enlace del email para activar tu cuenta. Si no lo ves, revisa la carpeta de spam.
            </p>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <Link href="/login" className="text-primary-600 hover:underline text-sm font-medium">
                Ya validé mi cuenta → Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-7">
            <h1 className="text-2xl font-display font-bold text-gray-900">Crear cuenta</h1>
            <p className="text-gray-500 text-sm mt-1">Reserva citas y gestiona tus pedidos</p>
          </div>

          {/* Google */}
          <button type="button" onClick={handleGoogle} disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 mb-5">
            <GoogleIcon />
            {googleLoading ? 'Redirigiendo...' : 'Registrarse con Google'}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">o con email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
              <input type="text" required placeholder="¿Cómo te llamas?"
                value={form.name} onChange={set('name')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required placeholder="tu@email.com"
                value={form.email} onChange={set('email')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} required placeholder="Mínimo 6 caracteres"
                  value={form.password} onChange={set('password')}
                  className="w-full px-4 py-2.5 pr-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
              <div className="relative">
                <input type={showConf ? 'text' : 'password'} required placeholder="Repite tu contraseña"
                  value={form.confirm} onChange={set('confirm')}
                  className="w-full px-4 py-2.5 pr-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <button type="button" onClick={() => setShowConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showConf ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.confirm && form.password !== form.confirm && (
                <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0" />
                <span className="text-xs text-gray-600 leading-relaxed">
                  He leído y acepto los{' '}
                  <Link href="/terminos-y-condiciones" target="_blank" className="text-primary-600 hover:underline font-medium">Términos y Condiciones</Link>
                  {' '}y la{' '}
                  <Link href="/politica-de-privacidad" target="_blank" className="text-primary-600 hover:underline font-medium">Política de Privacidad</Link>.
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0" />
                <span className="text-xs text-gray-600 leading-relaxed">
                  Quiero recibir novedades y promociones por correo o WhatsApp (opcional).
                </span>
              </label>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
                {error.includes('ya está registrado') && (
                  <Link href={`/login?redirect=${encodeURIComponent(redirect)}`}
                    className="block mt-1 font-semibold underline">
                    Ir a iniciar sesión →
                  </Link>
                )}
              </div>
            )}

            <button type="submit" disabled={loading || !accepted}
              className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.35)' }}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href={`/login${redirect !== '/mi-cuenta' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
              className="text-primary-600 hover:underline font-medium">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <RegistroContent />
    </Suspense>
  );
}
