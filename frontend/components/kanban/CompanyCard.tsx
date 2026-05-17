"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Building2, ExternalLink } from "lucide-react"
import clsx from "clsx"
import type { Company, CompanyEvent } from "@/types"
import { PRIORITY_COLORS, PRIORITY_LABELS, EVENT_TYPE_LABELS } from "@/types"
import CountdownBadge from "@/components/CountdownBadge"

type Props = {
  company: Company
  nearestEvent?: CompanyEvent
  isDragging?: boolean
  onClick?: () => void
  compact?: boolean
  showCountdown?: boolean
}

const PRIORITY_DOT: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-400",
  3: "bg-yellow-400",
  4: "bg-green-400",
  5: "bg-slate-300",
}

export default function CompanyCard({
  company,
  nearestEvent,
  isDragging = false,
  onClick,
  compact = false,
  showCountdown = true,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging: activeDragging } = useDraggable({
    id: company.id,
  })

  const style = isDragging
    ? undefined
    : { transform: CSS.Translate.toString(transform) }

  return (
    <div
      ref={isDragging ? undefined : setNodeRef}
      style={style}
      {...(isDragging ? {} : { ...attributes, ...listeners })}
      onClick={onClick}
      className={clsx(
        "group relative select-none border bg-white transition-all",
        compact ? "px-2.5 py-1.5" : "p-3",
        activeDragging ? "opacity-0" : "opacity-100",
        isDragging
          ? "rotate-1 shadow-2xl border-indigo-300 cursor-grabbing"
          : "cursor-grab hover:shadow-md hover:border-indigo-300 active:cursor-grabbing"
      )}
    >
      {/* 優先度インジケーター */}
      <span
        className={clsx("absolute left-0 rounded-r-full", PRIORITY_DOT[company.priority],
          compact ? "top-2 bottom-2 w-0.5" : "top-3 bottom-3 w-1"
        )}
      />

      {compact ? (
        /* コンパクト表示：企業名 + 残り日数のみ */
        <div className="pl-2 flex items-center justify-between gap-1">
          <p className="truncate text-xs font-semibold text-slate-800">{company.name}</p>
          {showCountdown && nearestEvent && (
            <CountdownBadge
              scheduledAt={nearestEvent.scheduled_at}
              label={EVENT_TYPE_LABELS[nearestEvent.type]}
              compact
            />
          )}
        </div>
      ) : (
        /* 通常表示 */
        <div className="pl-2">
          <div className="flex items-start justify-between gap-1">
            <p className="truncate text-sm font-semibold text-slate-800 leading-tight">{company.name}</p>
            {company.url && (
              <a
                href={company.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {company.industry && (
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Building2 size={10} />
              <span className="truncate">{company.industry}</span>
            </div>
          )}

          <div className={clsx("mt-1 text-xs font-medium", PRIORITY_COLORS[company.priority])}>
            志望度: {PRIORITY_LABELS[company.priority]}
          </div>

          {showCountdown && nearestEvent && (
            <div className="mt-2">
              <CountdownBadge
                scheduledAt={nearestEvent.scheduled_at}
                label={EVENT_TYPE_LABELS[nearestEvent.type]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
