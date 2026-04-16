type Props = {
  used: number
  total: number
  bonus: number
  label?: string
}

export function UsageBar({ used, total, bonus, label }: Props) {
  const planPct = Math.min(100, (used / Math.max(total, 1)) * 100)
  const overPlan = Math.max(0, used - total)
  const bonusRemaining = Math.max(0, bonus - overPlan)

  return (
    <div className="space-y-2">
      {label && <p className="text-sm text-gray-400">{label}</p>}
      <div className="h-3 bg-white/10 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${planPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{used} min used</span>
        <span>{total} min included{bonus > 0 ? ` + ${bonusRemaining} bonus` : ''}</span>
      </div>
    </div>
  )
}
