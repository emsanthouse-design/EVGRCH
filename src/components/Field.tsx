import clsx from 'clsx'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const base =
  'mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-text-faint disabled:bg-surface-muted disabled:text-text-muted'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={clsx(base, className)} />
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={clsx(base, className)} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={clsx(base, 'min-h-20', className)} />
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="text-xs text-text-muted">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-text-faint">{hint}</span>}
    </label>
  )
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={clsx('inline-flex items-center gap-2 text-sm', className)}>
      <input type="checkbox" {...rest} className="h-4 w-4 rounded border-border-strong accent-[var(--color-accent)]" />
      <span>{label}</span>
    </label>
  )
}
