import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import { LogOut } from "lucide-react"
import NavLinks from "@/components/NavLinks"

export default async function NavHeader() {
  const session = await auth()
  if (!session) redirect("/")

  return (
    <header className="flex shrink-0 items-center justify-between bg-slate-900 px-6 py-3">
      {/* ロゴ + ナビゲーション */}
      <div className="flex items-center gap-6">
        <span className="text-sm font-black text-white tracking-widest bg-indigo-600 px-2 py-1">就勝つ</span>
        <NavLinks />
      </div>

      {/* ユーザー情報 */}
      <div className="flex items-center gap-3">
        {session.user?.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name ?? ""}
            width={24}
            height={24}
            className="rounded-full ring-2 ring-indigo-400"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center bg-indigo-600 text-xs font-bold text-white">
            {session.user?.name?.[0]}
          </div>
        )}
        <span className="hidden text-sm text-slate-300 sm:block">{session.user?.name}</span>

        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/" })
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <LogOut size={12} />
            ログアウト
          </button>
        </form>
      </div>
    </header>
  )
}
