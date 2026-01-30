/**
 * API Admin: Upload de jaquette personnalisée
 * POST /api/admin/upload-poster
 * Body: FormData avec { file: File, mediaId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/api-auth'

// Forcer le rendu dynamique (évite le prerendering statique)
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Vérification admin OBLIGATOIRE
  const { user, error: authError } = await requireAdmin(request)
  if (authError || !user) {
    return authErrorResponse(authError || 'Accès refusé', 403)
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const mediaId = formData.get('mediaId') as string
    
    if (!file) {
      return NextResponse.json(
        { error: 'Fichier manquant' },
        { status: 400 }
      )
    }
    
    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID manquant' },
        { status: 400 }
      )
    }
    
    // Valider le type de fichier
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Type de fichier invalide. Utilisez JPG, PNG ou WebP.' },
        { status: 400 }
      )
    }
    
    // Valider la taille (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux. Maximum 10MB.' },
        { status: 400 }
      )
    }
    
    // Générer un nom de fichier unique
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `${mediaId}-${timestamp}.${extension}`
    
    // Convertir le File en ArrayBuffer puis en Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Upload vers Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('custom-posters')
      .upload(filename, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true
      })
    
    if (uploadError) {
      console.error('Erreur upload Supabase Storage:', uploadError)
      return NextResponse.json(
        { error: `Erreur upload: ${uploadError.message}` },
        { status: 500 }
      )
    }
    
    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from('custom-posters')
      .getPublicUrl(filename)
    
    const publicUrl = urlData.publicUrl
    
    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      message: 'Jaquette uploadée avec succès'
    })
    
  } catch (error) {
    console.error('Erreur upload poster:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'upload' },
      { status: 500 }
    )
  }
}


