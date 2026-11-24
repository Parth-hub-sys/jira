import { useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Check, CircleDashed, CircleDot, Eye, EyeOff, LayoutGrid, LockKeyhole, Mail } from 'lucide-react'
import './sign-in.css'

type SignInPageProps = {
  onSignIn(email: string, password: string): Promise<void>
  themeControl: ReactNode
  brand: ReactNode
  restoreError: string
}

const previewCards = [
  { status: 'Pending', title: 'Review launch checklist', tone: 'amber', Icon: CircleDashed },
  { status: 'In progress', title: 'Refine onboarding', tone: 'jade', Icon: CircleDot },
  { status: 'Done', title: 'Publish design tokens', tone: 'clay', Icon: Check },
] as const

function WorkspaceIllustration() {
  return (
    <div className="sign-in-art" aria-hidden="true">
      <div className="sign-in-art-orbit" />
      <div className="sign-in-art-orbit sign-in-art-orbit-inner" />
      <div className="sign-in-art-glint" />
      <div className="sign-in-preview">
        <div className="sign-in-preview-heading">
          <div className="sign-in-preview-icon"><LayoutGrid size={19} strokeWidth={1.8} /></div>
          <div>
            <span>Project board</span>
            <strong>Product delivery</strong>
          </div>
        </div>
        <div className="sign-in-preview-cards">
          {previewCards.map(({ status, title, tone, Icon }) => (
            <div key={tone} className={`sign-in-preview-card sign-in-preview-${tone}`}>
              <span><Icon size={15} strokeWidth={1.9} />{status}</span>
              <strong>{title}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SignInPage({ onSignIn, themeControl, brand, restoreError }: SignInPageProps) {
  const emailId = useId()
  const passwordId = useId()
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const fields = new FormData(event.currentTarget)
    setError('')
    setPending(true)
    try {
      await onSignIn(String(fields.get('email')).trim(), String(fields.get('password')))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="sign-in-page">
      <header className="sign-in-header">
        {brand}
        {themeControl}
      </header>
      <main className="sign-in-layout">
        <section className="sign-in-panel" aria-labelledby="sign-in-title">
          <div className="sign-in-panel-inner">
            <h1 id="sign-in-title">Sign in</h1>
            <p className="sign-in-intro">Use your work account to open your Fluxtech workspace.</p>

            <form className="sign-in-form" onSubmit={submit} aria-busy={pending}>
              <div className="sign-in-field">
                <label htmlFor={emailId}>Work email</label>
                <div className="sign-in-input">
                  <Mail size={18} strokeWidth={1.7} aria-hidden="true" />
                  <input
                    id={emailId}
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@company.com"
                    required
                  />
                </div>
              </div>

              <div className="sign-in-field">
                <label htmlFor={passwordId}>Password</label>
                <div className="sign-in-input">
                  <LockKeyhole size={18} strokeWidth={1.7} aria-hidden="true" />
                  <input
                    id={passwordId}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="sign-in-reveal"
                    onClick={() => setShowPassword(visible => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-controls={passwordId}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {(error || restoreError) && <p className="sign-in-error" role="alert">{error || restoreError}</p>}
              <button className="sign-in-submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </section>
        <WorkspaceIllustration />
      </main>
    </div>
  )
}
