import clsx from 'clsx'

const statusMap = {
  NEW: 'AÇIK',
  IN_REVIEW: 'DEVAM EDİYOR',
  RESOLVED: 'ÇÖZÜLDÜ',
}

export function StatusBadge({ status }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
        status === 'NEW' && 'bg-amber-100 text-amber-700',
        status === 'IN_REVIEW' && 'bg-indigo-100 text-indigo-700',
        status === 'RESOLVED' && 'bg-emerald-100 text-emerald-700',
      )}
    >
      {statusMap[status] ?? status}
    </span>
  )
}

export function PriorityBadge({ score }) {
  const label =
    score >= 10 ? 'KRİTİK' : score >= 7 ? 'ACİL' : score >= 5 ? 'YÜKSEK' : 'NORMAL'

  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
        score >= 10 && 'bg-red-100 text-red-700',
        score >= 7 && score < 10 && 'bg-orange-100 text-orange-700',
        score >= 5 && score < 7 && 'bg-amber-100 text-amber-700',
        score < 5 && 'bg-sky-100 text-sky-700',
      )}
    >
      {label}
    </span>
  )
}

export function ConfidenceBadge({ value }) {
  const label = value < 0.55 ? 'DÜŞÜK' : value < 0.8 ? 'ORTA' : 'YÜKSEK'

  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
        value < 0.55 && 'bg-rose-100 text-rose-700',
        value >= 0.55 && value < 0.8 && 'bg-yellow-100 text-yellow-700',
        value >= 0.8 && 'bg-emerald-100 text-emerald-700',
      )}
    >
      %{Math.round(value * 100)} · {label}
    </span>
  )
}
