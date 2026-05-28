import { NextResponse } from "next/server"
import { auth } from "@/auth"
import Anthropic from "@anthropic-ai/sdk"

const BOX_LABEL_NAME = "Syukatu-ES-BOX"

type GmailLabel = { id: string; name: string }
type GmailLabelList = { labels?: GmailLabel[] }
type GmailMessageList = { messages?: { id: string }[] }
type GmailMessageDetail = {
  id: string
  snippet?: string
  payload?: {
    headers?: { name?: string; value?: string }[]
    body?: { data?: string }
    parts?: GmailPart[]
    mimeType?: string
  }
}
type GmailPart = {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

export type ExtractedEvent = {
  message_id: string
  subject: string
  sender: string
  company_name: string
  event_type:
    | "es_deadline"
    | "interview_1st"
    | "interview_2nd"
    | "interview_final"
    | "briefing"
    | "offer"
    | "other"
  title: string
  scheduled_at: string
  notes: string | null
  mypage_url: string | null
  login_id: string | null
  confidence: "high" | "medium" | "low"
  raw_snippet: string
}

export type MailPreviewOut = {
  items: ExtractedEvent[]
  count: number
  label_found: boolean
  label_id?: string
  error_detail?: string
}

async function gmailFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  })
  const text = await res.text().catch(() => "")
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${text.slice(0, 300)}`)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Gmail APIレスポンスのJSON解析失敗 (status ${res.status}): ${text.slice(0, 300)}`)
  }
}

function headerVal(
  headers: { name?: string; value?: string }[] | undefined,
  name: string
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
}

function decodeBase64(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
  } catch {
    return ""
  }
}

function extractBody(payload: GmailMessageDetail["payload"]): string {
  if (!payload) return ""

  function walk(parts: GmailPart[]): string {
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64(part.body.data)
      if (part.parts) {
        const found = walk(part.parts)
        if (found) return found
      }
    }
    return ""
  }

  if (payload.body?.data) return decodeBase64(payload.body.data)
  if (payload.parts) return walk(payload.parts)
  return ""
}

async function extractWithClaude(
  emails: { message_id: string; subject: string; sender: string; body: string; snippet: string }[]
): Promise<ExtractedEvent[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const emailsText = emails
    .map(
      (e, i) =>
        `=== メール ${i + 1} (message_id: ${e.message_id}) ===\n件名: ${e.subject}\n送信者: ${e.sender}\n本文:\n${e.body.slice(0, 2000)}`
    )
    .join("\n\n")

  const today = new Date().toISOString().slice(0, 10)

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `以下は就活関連のメール一覧です。各メールから就活イベント情報を抽出してください。
今日の日付: ${today}

抽出するフィールド:
- message_id: メールのID（必ず元のIDをそのまま使用）
- company_name: 企業名（メールから推定。不明なら送信者ドメインを使用）
- event_type: "es_deadline"(ES締切) / "interview_1st"(一次面接) / "interview_2nd"(二次面接) / "interview_final"(最終面接) / "briefing"(説明会) / "offer"(内定) / "other"(その他)
- title: イベントのタイトル（20文字以内）
- scheduled_at: ISO 8601形式の日時（例: 2026-05-10T14:00:00）。時刻不明なら23:59:00
- notes: メモ（重要な情報があれば。なければnull）
- mypage_url: 企業マイページのURL（メール本文中に記載があれば。なければnull）
- login_id: ログインID（メールアドレス・学籍番号など。記載があれば。なければnull）
- confidence: "high"(日時明記) / "medium"(日時推定) / "low"(不明確)

日時が全く読み取れないメールはスキップしてください。
出力はJSON配列のみ（説明文不要）:
[{"message_id":"...","company_name":"...","event_type":"...","title":"...","scheduled_at":"...","notes":null,"mypage_url":null,"login_id":null,"confidence":"..."}]

メール一覧:
${emailsText}`,
      },
    ],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0]) as {
    message_id: string
    company_name: string
    event_type: ExtractedEvent["event_type"]
    title: string
    scheduled_at: string
    notes: string | null
    mypage_url: string | null
    login_id: string | null
    confidence: ExtractedEvent["confidence"]
  }[]

  return parsed.map((item) => {
    const orig = emails.find((e) => e.message_id === item.message_id)
    return {
      ...item,
      subject: orig?.subject ?? "",
      sender: orig?.sender ?? "",
      raw_snippet: orig?.snippet ?? "",
    }
  })
}

export async function GET() {
  const session = await auth()
  const accessToken = session?.googleAccessToken
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Googleの再ログインが必要です（googleAccessToken未取得）" },
      { status: 400 }
    )
  }

  let labelListError: string | null = null
  const labelList = await gmailFetch<GmailLabelList>("labels", accessToken).catch((e) => {
    labelListError = e instanceof Error ? e.message : String(e)
    return null
  })
  const label = labelList?.labels?.find(
    (l) => l.name.toLowerCase() === BOX_LABEL_NAME.toLowerCase()
  )

  // ラベルがなければ自動作成
  let labelCreateError: string | null = null
  const createdLabel = label ? null : await gmailFetch<GmailLabel>("labels", accessToken, {
    method: "POST",
    body: JSON.stringify({
      name: BOX_LABEL_NAME,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  }).catch((e) => {
    labelCreateError = e instanceof Error ? e.message : String(e)
    return null
  })
  const resolvedLabel = label ?? createdLabel

  if (!resolvedLabel) {
    const errorDetail = labelListError ?? labelCreateError ?? "ラベルの取得・作成に失敗しました"
    return NextResponse.json<MailPreviewOut>({ items: [], count: 0, label_found: false, label_id: undefined, error_detail: errorDetail })
  }

  const msgList = await gmailFetch<GmailMessageList>(
    `messages?labelIds=${encodeURIComponent(resolvedLabel.id)}&maxResults=20`,
    accessToken
  ).catch(() => ({ messages: [] as { id: string }[] }))

  const messages = msgList.messages ?? []
  if (messages.length === 0) {
    return NextResponse.json<MailPreviewOut>({ items: [], count: 0, label_found: true })
  }

  const emailDetails = await Promise.all(
    messages.map(async (msg) => {
      try {
        const detail = await gmailFetch<GmailMessageDetail>(
          `messages/${msg.id}?format=full`,
          accessToken
        )
        const headers = detail.payload?.headers ?? []
        return {
          message_id: detail.id,
          subject: headerVal(headers, "Subject"),
          sender: headerVal(headers, "From"),
          body: extractBody(detail.payload),
          snippet: detail.snippet ?? "",
        }
      } catch {
        return null
      }
    })
  )

  const validEmails = emailDetails.filter(Boolean) as NonNullable<(typeof emailDetails)[0]>[]
  if (validEmails.length === 0) {
    return NextResponse.json<MailPreviewOut>({ items: [], count: 0, label_found: true })
  }

  try {
    const items = await extractWithClaude(validEmails)
    items.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    return NextResponse.json<MailPreviewOut>({ items, count: items.length, label_found: true, label_id: resolvedLabel.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claude API エラー"
    return NextResponse.json({ detail: msg }, { status: 502 })
  }
}

// 取り込み済みメールから Syukatu-ES-BOX ラベルを外す
export async function POST(request: Request) {
  const session = await auth()
  const accessToken = session?.googleAccessToken
  if (!accessToken) {
    return NextResponse.json({ detail: "認証エラー" }, { status: 401 })
  }

  const { message_ids, label_id } = (await request.json()) as {
    message_ids: string[]
    label_id: string
  }

  const results = await Promise.allSettled(
    message_ids.map((id) =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ removeLabelIds: [label_id] }),
      })
    )
  )

  const failed = results.filter((r) => r.status === "rejected").length
  return NextResponse.json({ removed: message_ids.length - failed, failed })
}
