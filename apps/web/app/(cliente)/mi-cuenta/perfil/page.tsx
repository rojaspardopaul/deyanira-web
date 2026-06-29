'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, User, Phone, Lock, Eye, EyeOff, Check, AlertCircle, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { LIMA_DISTRICTS } from '@/lib/districts';

type Status = { type: 'success' | 'error'; msg: string } | null;

export default function PerfilPage() {
  const router = useRouter();

  // User data
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress]     = useState('');
  const [district, setDistrict]   = useState('');
  const [reference, setReference] = useState('');
  const [isGoogle, setIsGoogle] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);

  // Profile save state
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<Status>(null);

  // Password state
  const [newPass, setNewPass]     = useState('');
  const [confPass, setConfPass]   = useState('');
  const [showNew, setShowNew]     = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passStatus, setPassStatus] = useState<Status>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login?redirect=/mi-cuenta/perfil'); return; }

      const u = data.user;
      const derivedName = u.user_metadata?.name || u.user_metadata?.full_name || u.email?.split('@')[0] || '';
      setEmail(u.email || '');
      setIsGoogle(u.app_metadata?.provider === 'google' || u.identities?.[0]?.provider === 'google');

      const tk = (await supabase.auth.getSession()).data.session?.access_token || '';
      setToken(tk);

      if (tk) {
        try {
          const customer = await api.customers.me(tk);
          setName(customer.name || derivedName);
          setPhone(customer.phone || '');
          setAddress(customer.address || '');
          setDistrict(customer.district || '');
          setReference(customer.reference || '');
        } catch {
          setName(derivedName);
        }
      }
      setLoading(false);
    });
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setProfileStatus({ type: 'error', msg: 'El nombre es obligatorio' }); return; }
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      await api.customers.updateMe({
        name: name.trim(),
        phone: phone || undefined,
        address: address.trim() || null,
        district: district || null,
        reference: reference.trim() || null,
      }, token);
      setProfileStatus({ type: 'success', msg: 'Perfil actualizado correctamente' });
    } catch {
      setProfileStatus({ type: 'error', msg: 'Error al guardar los cambios' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassStatus(null);
    if (newPass.length < 6) { setPassStatus({ type: 'error', msg: 'La contraseña debe tener al menos 6 caracteres' }); return; }
    if (newPass !== confPass) { setPassStatus({ type: 'error', msg: 'Las contraseñas no coinciden' }); return; }

    setSavingPass(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) {
      setPassStatus({ type: 'error', msg: 'Error al cambiar la contraseña. Intenta de nuevo.' });
    } else {
      setPassStatus({ type: 'success', msg: 'Contraseña actualizada correctamente' });
      setNewPass('');
      setConfPass('');
    }
    setSavingPass(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-24 md:pb-10">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/mi-cuenta" className="p-2 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold text-xl text-gray-900">Mi perfil</h1>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-xl shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)' }}>
            {name.charAt(0).toUpperCase() || <User className="w-7 h-7" />}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{name}</p>
            <p className="text-sm text-gray-500">{email}</p>
            {isGoogle && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5">
                Cuenta Google
              </span>
            )}
          </div>
        </div>

        {/* Profile form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4 text-primary-500" /> Datos personales
            </h2>
          </div>
          <form onSubmit={handleSaveProfile} className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="Tu nombre"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Teléfono
              </label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="987654321"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Dirección
              </label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                placeholder="Av. / Calle, número"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <p className="text-xs text-gray-400 mt-1">La usaremos para autocompletar tus envíos y reservas a domicilio.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distrito</label>
              <select value={district} onChange={e => setDistrict(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Selecciona tu distrito</option>
                {LIMA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referencia <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                placeholder="Piso, interior, color de fachada…"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} disabled
                className="w-full px-4 py-2.5 border border-gray-100 bg-gray-50 rounded-xl text-sm text-gray-400 cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar desde aquí.</p>
            </div>

            {profileStatus && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${
                profileStatus.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}>
                {profileStatus.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {profileStatus.msg}
              </div>
            )}

            <button type="submit" disabled={savingProfile}
              className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full text-sm transition-all disabled:opacity-50"
              style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.25)' }}>
              {savingProfile ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        {/* Password section */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary-500" /> Cambiar contraseña
            </h2>
          </div>

          {isGoogle ? (
            <div className="px-5 py-5">
              <p className="text-sm text-gray-500">
                Tu cuenta está vinculada con Google. No puedes cambiar la contraseña aquí — gestiona tu contraseña desde tu cuenta de Google.
              </p>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} value={newPass}
                    onChange={e => setNewPass(e.target.value)} required
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-2.5 pr-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showNew ? 'Ocultar' : 'Mostrar'}>
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                <div className="relative">
                  <input type={showConf ? 'text' : 'password'} value={confPass}
                    onChange={e => setConfPass(e.target.value)} required
                    placeholder="Repite la contraseña"
                    className="w-full px-4 py-2.5 pr-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <button type="button" onClick={() => setShowConf(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showConf ? 'Ocultar' : 'Mostrar'}>
                    {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confPass && newPass !== confPass && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>

              {passStatus && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${
                  passStatus.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                  {passStatus.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {passStatus.msg}
                </div>
              )}

              <button type="submit" disabled={savingPass}
                className="w-full py-3 border-2 border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white font-bold rounded-full text-sm transition-all disabled:opacity-50">
                {savingPass ? 'Actualizando...' : 'Cambiar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
