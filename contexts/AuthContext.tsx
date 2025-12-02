'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User, Session, SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Créer le client Supabase pour le navigateur (avec fallback pour le SSR/build)
const createClient = (): SupabaseClient | null => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // Si les variables ne sont pas définies (pendant le build), retourner null
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState<SupabaseClient | null>(() => createClient())
  const router = useRouter()

  useEffect(() => {
    // Si pas de client Supabase (build time), ne rien faire
    if (!supabase) {
      setLoading(false)
      return
    }

    // Récupérer la session initiale
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        if (event === 'SIGNED_OUT') {
          router.push('/login')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: 'Client Supabase non disponible' }
    }
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error: error.message }
      }

      router.push('/')
      router.refresh()
      return { error: null }
    } catch (err) {
      return { error: 'Une erreur est survenue' }
    }
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!supabase) {
      return { error: 'Client Supabase non disponible' }
    }
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split('@')[0],
          },
        },
      })

      if (error) {
        return { error: error.message }
      }

      return { error: null }
    } catch (err) {
      return { error: 'Une erreur est survenue' }
    }
  }

  const signOut = async () => {
    if (!supabase) return
    
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

