import { useState } from 'react'
import { Check, KeyRound, Lock, Mail, Shield, User } from 'lucide-react'
import { AuthFooterLink } from '@/components/auth/AuthFooterLink'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/chrome/PageBanner'
import { AuthLayout } from '@/layouts/AuthLayout'

import { useBootstrapSetup } from '@/pages/bootstrap/useBootstrapSetup'

export default function Bootstrap() {
  const { status, loadError, error, submitting, retry, submit } = useBootstrapSetup()
  const [adminSecret, setAdminSecret] = useState('')
  const [workspaceName, setWorkspaceName] = useState('My workspace')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit(adminSecret, { name, email, password, workspace_name: workspaceName })
  }

  if (status === 'checking') {
    return (
      <AuthLayout
        variant="split"
        eyebrow="One-time setup"
        title="Create your workspace"
        description="Checking whether this deployment still needs first-time setup."
      >
        <p className="auth-slip-note">Checking deployment status…</p>
      </AuthLayout>
    )
  }

  if (loadError) {
    return (
      <AuthLayout
        variant="split"
        eyebrow="One-time setup"
        title="Setup unavailable"
        description="The setup check failed. Retry, or sign in if this deployment is already configured."
      >
        <div className="auth-slip-form">
          <div className="auth-form-status">
            <PageBanner variant="error" title="Setup check failed" description={loadError} />
          </div>
          <button type="button" onClick={retry} className="sm-btn sm-btn-primary sm-btn-block">
            Try again
          </button>
          <div className="auth-slip-note">
            <AuthFooterLink prompt="Already set up?" linkLabel="Sign in" to="/login" />
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      variant="split"
      eyebrow="One-time setup"
      title="Create your workspace"
      description="Create the first account and tenant workspace for this deployment."
      sidePanel={
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="font-display text-xl font-medium tracking-tight text-ink">
              Delivery console
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-strong">
              Create your workspace, then add an endpoint and send your first webhook.
            </p>
          </div>

          <ul className="space-y-3 text-sm">
            {(
              [
                'Add your receiver endpoint',
                'Send a test event',
                'Inspect delivery results',
                'Open Admin separately when needed',
              ] as const
            ).map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-none border border-border bg-surface p-4 text-sm leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Bootstrap secret</p>
            <p className="mt-1">
              Use <code className="text-xs">ADMIN_BOOTSTRAP_SECRET</code> from your deployment
              environment. It is sent once with this request and is not stored in the browser.
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <AuthFooterLink prompt="Already set up?" linkLabel="Sign in" to="/login" />
          </div>
        </div>
      }
    >
      <form className="auth-slip-form" onSubmit={handleSubmit}>
        {error ? (
          <div className="auth-form-status">
            <PageBanner variant="error" title="Setup failed" description={error} />
          </div>
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-strong">
            Verify deployment
          </h2>
          <AuthFormField
            id="admin-secret"
            label="Admin bootstrap secret"
            type="password"
            icon={Shield}
            autoComplete="off"
            value={adminSecret}
            onChange={setAdminSecret}
            required
          />
        </section>

        <hr className="border-border/60" />

        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-strong">
            Your account
          </h2>
          <AuthFormField
            id="workspace-name"
            label="Workspace name"
            icon={User}
            value={workspaceName}
            onChange={setWorkspaceName}
            required
          />
          <AuthFormField
            id="name"
            label="Full name"
            icon={User}
            autoComplete="name"
            value={name}
            onChange={setName}
            required
          />
          <AuthFormField
            id="email"
            label="Email"
            type="email"
            icon={Mail}
            autoComplete="email"
            value={email}
            onChange={setEmail}
            required
          />
          <AuthFormField
            id="password"
            label="Password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={password}
            onChange={setPassword}
            hint="At least 12 characters, at most 128 UTF-8 bytes."
            required
          />
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="sm-btn sm-btn-primary sm-btn-block inline-flex items-center justify-center gap-2"
        >
          <KeyRound className="size-4" aria-hidden="true" />
          {submitting ? 'Creating workspace…' : 'Create account and workspace'}
        </button>
      </form>
    </AuthLayout>
  )
}
