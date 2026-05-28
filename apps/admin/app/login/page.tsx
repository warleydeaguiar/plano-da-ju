'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

function LoginInner() {
  const router = useRouter()
  const search = useSearchParams()
  const redirectTo = search.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authErr) throw authErr
      // Só permite role=admin. Outra coisa = logout imediato.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const role = (data.user?.app_metadata as any)?.role
      if (role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error('Acesso restrito a administradores.')
      }
      router.push(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'E-mail ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '13px 15px', fontSize: 14, border: '1.5px solid #EDE6F2',
    borderRadius: 12, background: '#fff', color: '#2D1B2E', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F9FAFB',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: '-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: '#fff', borderRadius: 18,
        padding: '32px 28px', boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: -0.4 }}>
            Plano da <em style={{ color: '#BE185D', fontStyle: 'italic' }}>Ju</em>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C9A877', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 3 }}>
            Painel Admin
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>Email</label>
            <input style={input} type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value.toLowerCase())} placeholder="seu@email.com" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>Senha</label>
            <input style={input} type="password" required autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !email || !password} style={{
            marginTop: 4, padding: '12px 18px', borderRadius: 12, border: 'none',
            background: '#BE185D', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'default' : 'pointer', opacity: (!email || !password) ? 0.5 : 1,
            fontFamily: 'inherit',
          }}>
            {loading ? '⏳ Entrando…' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
          Acesso restrito. Só administradores conseguem entrar.
        </div>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
