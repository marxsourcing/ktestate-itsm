'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createSystem(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const status = formData.get('status') as string

  const { error } = await supabase.from('systems').insert({
    name,
    description,
    status,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/systems')
  return { success: true }
}

