"use client"

import { useDroppable } from "@dnd-kit/core"
import { Plus } from "lucide-react"
import clsx from "clsx"
import type { Company, CompanyEvent, Status } from "@/types"
import CompanyCard from "./CompanyCard"

type Props = {
  status: Status
  companies: Company[]
  upcomingEvents: CompanyEvent[]
  onAddCard: (statusId: string) => void
  onCardClick: (company: Company) => void
  compactCards?: boolean
}

export default function KanbanColumn({
  status,
  companies,
  upcomingEvents,
  onAddCard,
  onCardClick,
  compactCards = false,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })

  // 各企業の直近イベントを company_id でマップ
  const nearestEventMap = upcomingEvents.reduce<Record<string, CompanyEvent>>((acc, ev) => {
    if (!acc[ev.company_id]) acc[ev.company_id] = ev
    return acc
  }, {})

  return (
    <div className="flex w-[85vw] max-w-80 shrink-0 snap-start flex-col border border-slate-200 bg-slate-50 sm:w-72">
      {/* カラムヘッダー */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2.5"
        style={{ borderTop: `3px solid ${status.color}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2"
            style={{ background: status.color }}
          />
          <span className="text-sm font-bold text-slate-800">{status.name}</span>
          <span className="bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-500">
            {companies.length}
          </span>
        </div>
        <button
          onClick={() => onAddCard(status.id)}
          className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="企業を追加"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* カード一覧 */}
      <div
        ref={setNodeRef}
        className={clsx(
          "flex min-h-[140px] flex-1 flex-col gap-2 p-2 transition-colors",
          isOver ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200" : "bg-slate-50"
        )}
      >
        {companies.length === 0 && (
          <div className="flex min-h-[96px] items-center justify-center border border-dashed border-slate-300 bg-white px-3 text-center text-xs text-slate-400">
            {isOver ? "ここにドロップして移動" : "カードがありません"}
          </div>
        )}
        {companies.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            nearestEvent={nearestEventMap[company.id]}
            onClick={() => onCardClick(company)}
            compact={compactCards}
          />
        ))}
      </div>
    </div>
  )
}
