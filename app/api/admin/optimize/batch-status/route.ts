/**
 * API: Status du batch en cours
 * GET /api/admin/optimize/batch-status
 */

import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'

const BATCH_DIR = '/tmp/leon_batch'

export async function GET() {
  try {
    // Compter les fichiers sources copiés
    let sourceCount = 0
    let outputCount = 0
    
    try {
      const sources = await fs.readdir(`${BATCH_DIR}/sources`)
      sourceCount = sources.filter(f => !f.startsWith('.')).length
    } catch {}
    
    try {
      const outputs = await fs.readdir(`${BATCH_DIR}/outputs`)
      outputCount = outputs.filter(f => !f.startsWith('.')).length
    } catch {}
    
    return NextResponse.json({
      sourcesCopied: sourceCount,
      outputsEncoded: outputCount
    })
    
  } catch (error) {
    return NextResponse.json({ 
      sourcesCopied: 0,
      outputsEncoded: 0
    })
  }
}


