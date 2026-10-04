import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-accent text-accent-contrast hover:opacity-90',
        variant === 'secondary' && 'bg-surface border border-border-strong hover:bg-surface-muted',
        variant === 'ghost' && 'hover:bg-surface-muted text-text-muted',
        variant === 'danger' && 'bg-negative-soft text-negative hover:opacity-90',
        className,
      )}
    />
  )
}
