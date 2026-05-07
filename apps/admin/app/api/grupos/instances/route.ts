import { NextResponse } from 'next/server'
import { fetchAllInstances } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'

/** GET /api/grupos/instances — lista todas as instâncias Evolution */
export async function GET() {
  const instances = await fetchAllInstances()
  return NextResponse.json(instances)
}
