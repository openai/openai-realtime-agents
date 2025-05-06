"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/app/lib/supabase"

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // This will set the session from the URL fragment if present
        await supabase.auth.getSession()
      } catch (error) {
        console.error("Error completing magic link sign-in", error)
      } finally {
        // Always redirect to home or login depending on auth state
        const {
          data: { session },
        } = await supabase.auth.getSession()
        router.replace(session ? "/" : "/login")
      }
    }

    handleAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  )
} 