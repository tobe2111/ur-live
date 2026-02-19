import { LogOut } from "lucide-react"

export function LogoutButton() {
  return (
    <div className="px-5 py-6">
      <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3.5 text-sm font-medium text-muted-foreground transition-colors active:bg-secondary">
        <LogOut className="h-4 w-4" />
        로그아웃
      </button>
    </div>
  )
}
