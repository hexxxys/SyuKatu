"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { useStatuses } from "@/hooks/useStatuses"
import { createApi } from "@/lib/api"
import type { ExtractedEvent, MailPreviewOut } from "@/app/api/mail/es-deadlines/route"
import { EVENT_TYPE_LABELS } from "@/types"
import { Mail, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ja } from "date-fns/locale"

const CONFIDENCE_LABEL: Record<ExtractedEvent["confidence"], string> = {
  high: "確実",
  medium: "推定",
  low: "不明確",
}
const CONFIDENCE_COLOR: Record<ExtractedEvent["confidence"], string> = {
  high: "text-green-600 bg-green-50",
  medium: "text-yellow-600 bg-yellow-50",
  low: "text-slate-500 bg-slate-100",
}

export default function MailImportPanel() {
  const { data: session } = useSession()
  const { data: statuses = [] } = useStatuses()
  const queryClient = useQueryClient()

  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MailPreviewOut | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [importDone, setImportDone] = useState<string[]>([])

  const token = (session as { accessToken?: string } | null)?.accessToken ?? ""

  async function handleFetch() {
    setLoading(true)
    setError(null)
    setPreview(null)
    setSelected(new Set())
    setImportDone([])
    try {
      const res = await fetch("/api/mail/es-deadlines")
      const data = (await res.json()) as MailPreviewOut & { detail?: string }
      if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`)
      setPreview(data)
      setSelected(new Set(data.items.map((i) => i.message_id)))

      // 取得した時点でラベルを外す（次回フェッチで重複しない）
      if (data.label_id && data.items.length > 0) {
        await fetch("/api/mail/es-deadlines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_ids: data.items.map((i) => i.message_id),
            label_id: data.label_id,
          }),
        }).catch(() => null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "メール取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!token || selected.size === 0 || !preview) return
    setImporting(true)
    setError(null)

    const api = createApi(token)
    const firstStatus = statuses[0]
    const done: string[] = []

    for (const item of preview.items.filter((i) => selected.has(i.message_id))) {
      try {
        const companies = await api.get<{ id: string; name: string }[]>("/api/companies")
        let company = companies.find(
          (c) => c.name.toLowerCase() === item.company_name.toLowerCase()
        )
        if (!company) {
          company = await api.post<{ id: string; name: string }>("/api/companies", {
            name: item.company_name,
            status_id: firstStatus?.id,
            priority: 3,
            url: item.mypage_url ?? null,
            login_id: item.login_id ?? null,
          })
        } else if (item.mypage_url || item.login_id) {
          // 既存企業に URL / ログインID が未設定なら補完
          const c = company as { id: string; name: string; url?: string | null; login_id?: string | null }
          if (!c.url && item.mypage_url) {
            await api.patch(`/api/companies/${c.id}`, { url: item.mypage_url }).catch(() => null)
          }
          if (!c.login_id && item.login_id) {
            await api.patch(`/api/companies/${c.id}`, { login_id: item.login_id }).catch(() => null)
          }
        }
        await api.post(`/api/companies/${company.id}/events`, {
          type: item.event_type,
          title: item.title,
          scheduled_at: item.scheduled_at,
          notes: item.notes,
        })
        done.push(item.message_id)
      } catch {
        // 個別エラーは無視して次へ
      }
    }



    setImportDone(done)
    setSelected(new Set())
    await queryClient.invalidateQueries({ queryKey: ["companies"] })
    await queryClient.invalidateQueries({ queryKey: ["events"] })
    setImporting(false)
  }

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">メールから取り込む</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            Syukatu-ES-BOX
          </span>
        </div>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
          {loading ? "取得中..." : "メールを取得"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 px-4 py-3 text-xs text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {preview && !preview.label_found && (
        <div className="px-4 py-6 text-center text-sm text-slate-500">
          <p className="font-medium">Gmail ラベルの取得・作成に失敗しました。</p>
          <p className="mt-1 text-xs">一度ログアウトして再ログインすると解決する場合があります。</p>
          {preview.error_detail && (
            <p className="mt-2 rounded bg-red-50 px-3 py-2 text-left text-xs text-red-700 font-mono break-all">
              {preview.error_detail}
            </p>
          )}
        </div>
      )}

      {preview?.label_found && preview.count === 0 && (
        <p className="px-4 py-6 text-center text-sm text-slate-400">
          ラベル内にメールがありません。
        </p>
      )}

      {importDone.length > 0 && (
        <div className="flex items-center gap-2 bg-green-50 px-4 py-3 text-xs text-green-700">
          <CheckCircle2 size={14} />
          {importDone.length} 件をカンバンに追加しました。
        </div>
      )}

      {preview && preview.count > 0 && (
        <>
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {preview.items.map((item) => {
              const checked = selected.has(item.message_id)
              const expanded = expandedId === item.message_id
              const done = importDone.includes(item.message_id)

              return (
                <div key={item.message_id} className={`px-4 py-3 ${done ? "opacity-40" : ""}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked && !done}
                      disabled={done}
                      onChange={() => toggleSelect(item.message_id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {item.company_name}
                        </span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          {EVENT_TYPE_LABELS[item.event_type] ?? item.event_type}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${CONFIDENCE_COLOR[item.confidence]}`}
                        >
                          {CONFIDENCE_LABEL[item.confidence]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{item.title}</p>
                      <p className="mt-0.5 text-xs font-medium text-blue-600">
                        {format(parseISO(item.scheduled_at), "M月d日(E) HH:mm", { locale: ja })}
                      </p>
                      <button
                        onClick={() => setExpandedId(expanded ? null : item.message_id)}
                        className="mt-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                      >
                        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {item.subject || "(件名なし)"}
                      </button>
                      {expanded && (
                        <p className="mt-1 line-clamp-4 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                          {item.raw_snippet}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-xs text-slate-500">{selected.size} 件選択中</span>
            <button
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
            >
              {importing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CheckCircle2 size={12} />
              )}
              {importing ? "追加中..." : `${selected.size} 件をカンバンに追加`}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
