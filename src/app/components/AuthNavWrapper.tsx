"use client"

import { useEffect, useState } from "react"
import MainNav from "./MainNav"
import supabase from "@/app/lib/supabase"

export default function AuthNavWrapper() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setIsAuthenticated(!!session)
      } catch (error) {
        console.error('Error checking auth status:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(!!session)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Don't render anything while loading to prevent flash of content
  if (isLoading) {
    return null
  }

  // Only render nav when authenticated
  return isAuthenticated ? <MainNav /> : null
} 