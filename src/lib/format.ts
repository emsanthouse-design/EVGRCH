import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import type { MetricRow } from './models'

export function formatDate(iso: string | null | undefined, pattern = 'MMM d, yyyy'): string {
  if (!iso) return ''
  return format(parseISO(iso), pattern)
}

export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = parseISO(iso)
  const days = differenceInCalendarDays(new Date(), d)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 60) return `${days}d ago`
  return formatDistanceToNowStrict(d, { addSuffix: true })
}

export function formatValue(
  metric: Pick<MetricRow, 'value_type' | 'unit'>,
  v: { value_num: number | null; value_bool: boolean | null; value_text: string | null; value_date: string | null },
): string {
  switch (metric.value_type) {
    case 'boolean':
      return v.value_bool == null ? '' : v.value_bool ? 'Yes' : 'No'
    case 'text':
      return v.value_text ?? ''
    case 'date':
      return v.value_date ? format(parseISO(v.value_date), 'MMM d, yyyy') : ''
    case 'percent':
      return v.value_num == null ? '' : `${Math.round(Number(v.value_num))}%`
    case 'score':
      return v.value_num == null ? '' : `${Math.round(Number(v.value_num))}`
    case 'integer':
      return v.value_num == null ? '' : Number(v.value_num).toLocaleString()
    case 'number':
    default:
      return v.value_num == null ? '' : trimNumber(Number(v.value_num))
  }
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1)
}

export function formatDelta(metric: Pick<MetricRow, 'value_type'>, delta: number | null): string {
  if (delta == null || delta === 0) return ''
  const sign = delta > 0 ? '+' : '−'
  const abs = Math.abs(delta)
  const body = metric.value_type === 'number' ? trimNumber(abs) : Math.round(abs).toLocaleString()
  return `${sign}${body}${metric.value_type === 'percent' ? '%' : ''}`
}
