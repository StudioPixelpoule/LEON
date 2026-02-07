'use client'

import { useState, useCallback, memo, createContext, useContext } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { Toast, ToastType } from '@/types/admin'
import styles from '@/app/admin/admin.module.css'

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  
  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(7)
    setToasts(prev => [...prev, { id, type, title, message }])
    
    // Auto-remove après 4s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 250)
    }, 4000)
    
    return id
  }, [])
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 250)
  }, [])
  
  return { toasts, addToast, removeToast }
}

const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case 'success': return <CheckCircle size={18} />
    case 'error': return <XCircle size={18} />
    case 'warning': return <AlertTriangle size={18} />
    default: return <Info size={18} />
  }
}

export const ToastContainer = memo(function ToastContainer({ 
  toasts, 
  removeToast 
}: { 
  toasts: Toast[]
  removeToast: (id: string) => void 
}) {
  if (toasts.length === 0) return null
  
  return (
    <div className={styles.toastContainer}>
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`${styles.toast} ${styles[toast.type]} ${toast.leaving ? styles.leaving : ''}`}
        >
          <div className={styles.toastIcon}>
            <ToastIcon type={toast.type} />
          </div>
          <div className={styles.toastContent}>
            <p className={styles.toastTitle}>{toast.title}</p>
            {toast.message && <p className={styles.toastMessage}>{toast.message}</p>}
          </div>
          <button className={styles.toastClose} onClick={() => removeToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
})

// Context pour partager le toast entre composants
export const ToastContext = createContext<{
  addToast: (type: ToastType, title: string, message?: string) => string
} | null>(null)

export const useAdminToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useAdminToast must be used within AdminPageV2')
  return ctx
}
