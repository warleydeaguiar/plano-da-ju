'use client'

import { useState } from 'react'

const green = '#34C759'
const red   = '#FF3B30'

export default function SyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult]   = useState<string | null>(null)

  async function sync() {
    setSyncing(true)
    setResult(null)
    try {
      const res  = await fetch('/api/grupos/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.detail)
      setResult(`✓ ${data.synced}/${data.total} grupos sincronizados`)
      // Recarrega a página após 1s para mostrar os novos contadores
      setTimeout(() => window.location.reload(), 1000)
    } catch (err: any) {
      setResult('✗ ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {result && (
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: result.startsWith('✓') ? green : red,
        }}>{result}</span>
      )}
      <button
        onClick={sync}
        disabled={syncing}
        style={{
          background: '#F5F5F7', color: '#2D1B2E', border: 'none',
          cursor: syncing ? 'default' : 'pointer',
          padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
          opacity: syncing ? 0.6 : 1,
        }}
      >
        {syncing ? '⏳ Sincronizando…' : '🔄 Sincronizar'}
      </button>
    </div>
  )
}
