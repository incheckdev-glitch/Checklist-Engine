import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setWorking(true)
    setMessage('')
    try {
      const result = mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
      if (result.error) throw result.error
      if (mode === 'sign-up' && !result.data.session) {
        setMessage('Account created. Check your email if confirmation is enabled.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setWorking(false)
    }
  }

  if (!isSupabaseConfigured) return <>{children}</>
  if (loading) return <div className="center-screen"><LoaderCircle className="spin" /> Loading secure workspace…</div>
  if (session) return <>{children}</>

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-logo"><Sparkles size={22} /> InCheck 360</div>
        <div className="auth-icon"><LockKeyhole size={30} /></div>
        <h1>AI Checklist Engine</h1>
        <p>Sign in to create, generate, version, and publish operational checklists.</p>
        <form onSubmit={submit}>
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
          <label>Password<input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
          <button className="primary wide" disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : null}{mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
        </form>
        {message ? <div className="form-message">{message}</div> : null}
        <button className="link-button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
          {mode === 'sign-in' ? 'Create a new account' : 'Return to sign in'}
        </button>
      </section>
    </main>
  )
}
