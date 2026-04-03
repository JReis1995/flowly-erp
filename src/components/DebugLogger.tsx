'use client'

// DEBUG FILE - APAGAR DEPOIS DE RESOLVIDO
// Localização: src/components/DebugLogger.tsx

import { useEffect, useState } from 'react'

export function DebugLogger() {
  const [logs, setLogs] = useState<string[]>([])
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [show, setShow] = useState(true)

  useEffect(() => {
    const newLogs: string[] = []
    
    // Check environment variables
    newLogs.push(`🔍 DEBUG - ${new Date().toISOString()}`)
    newLogs.push(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Presente' : '❌ Ausente'}`)
    newLogs.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Presente' : '❌ Ausente'}`)
    newLogs.push(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Presente' : '❌ Ausente'}`)
    newLogs.push(`STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Presente' : '❌ Ausente'}`)
    
    setLogs(newLogs)
    
    setEnvVars({
      NODE_ENV: process.env.NODE_ENV || 'unknown',
      VERCEL_ENV: process.env.VERCEL_ENV || 'unknown',
      VERCEL_URL: process.env.VERCEL_URL || 'unknown',
    })

    // Log to console
    console.log('[DEBUG] Environment check:', newLogs)
  }, [])

  if (!show) return null

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        width: '400px',
        maxHeight: '300px',
        overflow: 'auto',
        background: '#020617',
        color: '#10B981',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 9999,
        border: '2px solid #06B6D4',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <strong style={{ color: '#06B6D4' }}>🔧 DEBUG LOGGER</strong>
        <button 
          onClick={() => setShow(false)}
          style={{ 
            background: '#ef4444', 
            color: 'white', 
            border: 'none', 
            padding: '2px 8px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ marginBottom: '10px', color: '#fbbf24' }}>
        <strong>Environment:</strong>
        {Object.entries(envVars).map(([key, value]) => (
          <div key={key} style={{ marginLeft: '10px' }}>
            {key}: {value}
          </div>
        ))}
      </div>
      
      <div>
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>
            {log}
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '10px', fontSize: '10px', color: '#64748b' }}>
        📁 Ficheiro: src/components/DebugLogger.tsx
      </div>
    </div>
  )
}
