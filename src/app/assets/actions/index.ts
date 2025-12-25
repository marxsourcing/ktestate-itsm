'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createAsset(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const type = formData.get('type') as string
  const status = formData.get('status') as string
  const serial_number = formData.get('serial_number') as string

  const { error } = await supabase.from('assets').insert({
    name,
    type,
    status,
    serial_number,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/assets')
  return { success: true }
}

