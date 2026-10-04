import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/Button'
import { Input } from '../../components/Field'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/' },
    })
    if (error) {
      setError(friendly(error.message))
      setState('error')
    } else {
      setState('sent')
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg p-6 shadow-sm">
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wide text-text-faint">Evergreen Branding Co.</div>
          <h1 className="text-lg font-semibold mt-1">Presence Tracker</h1>
        </div>
        {state === 'sent' ? (
          <div className="text-sm">
            <p className="font-medium">Check your email.</p>
            <p className="text-text-muted mt-1">
              We sent a sign-in link to <span className="font-medium text-text">{email}</span>. It expires in an hour.
            </p>
            <button className="mt-4 text-sm underline text-text-muted" onClick={() => setState('idle')}>
              Use a different address
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs text-text-muted">Work email</span>
              <Input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@evergreenbranding.co"
              />
            </label>
            {error && <p className="text-sm text-negative">{error}</p>}
            <Button type="submit" disabled={state === 'sending'} className="w-full">
              {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
            <p className="text-xs text-text-faint">Access is by invitation. Ask an agency admin if you need an account.</p>
          </form>
        )}
      </div>
    </div>
  )
}

function friendly(msg: string): string {
  if (/not been invited/i.test(msg)) return 'That email address has not been invited.'
  if (/signups not allowed/i.test(msg)) return 'That email address has not been invited.'
  if (/rate limit/i.test(msg)) return 'Too many sign-in emails were sent recently. Try again in a little while.'
  return msg
}
