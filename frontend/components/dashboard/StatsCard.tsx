type Props = {
  label: string
  value: number
  sub?: string
  color: string
}

const colorMap: Record<string, string> = {
  "text-blue-600":   "border-t-blue-500   bg-blue-50",
  "text-green-600":  "border-t-green-500  bg-green-50",
  "text-orange-500": "border-t-orange-500 bg-orange-50",
  "text-purple-600": "border-t-purple-500 bg-purple-50",
}

export default function StatsCard({ label, value, sub, color }: Props) {
  const accent = colorMap[color] ?? "border-t-indigo-500 bg-indigo-50"
  return (
    <div className={`border border-slate-200 border-t-4 p-5 ${accent}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
