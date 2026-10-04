import { PageHeader, EmptyState } from '../components/ui'

export function ComingSoon({ title, phase, body }: { title: string; phase: number; body: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title={`Coming in Phase ${phase}`} body={body} />
    </>
  )
}
