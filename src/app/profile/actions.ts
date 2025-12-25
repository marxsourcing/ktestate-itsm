'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'requester' | 'manager' | 'admin'
  department: string | null
  phone: string | null
  avatar_url: string | null
  notification_settings: NotificationSettings
  created_at: string
  updated_at: string
}

export interface NotificationSettings {
  request_created: boolean
  request_assigned: boolean
  status_changed: boolean
  comment_added: boolean
  request_completed: boolean
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const fullName = formData.get('full_name') as string
  const department = formData.get('department') as string
  const phone = formData.get('phone') as string

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName || null,
      department: department || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Error updating profile:', error)
    return { error: '프로필 업데이트에 실패했습니다.' }
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { success: '프로필이 업데이트되었습니다.' }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  
  const currentPassword = formData.get('current_password') as string
  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (newPassword !== confirmPassword) {
    return { error: '새 비밀번호가 일치하지 않습니다.' }
  }

  if (newPassword.length < 6) {
    return { error: '비밀번호는 최소 6자 이상이어야 합니다.' }
  }

  // 현재 비밀번호 확인을 위해 재로그인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return { error: '사용자 정보를 찾을 수 없습니다.' }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (signInError) {
    return { error: '현재 비밀번호가 올바르지 않습니다.' }
  }

  // 비밀번호 업데이트
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    console.error('Error updating password:', error)
    return { error: '비밀번호 변경에 실패했습니다.' }
  }

  return { success: '비밀번호가 변경되었습니다.' }
}

export async function updateNotificationSettings(settings: NotificationSettings) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      notification_settings: settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Error updating notification settings:', error)
    return { error: '알림 설정 업데이트에 실패했습니다.' }
  }

  revalidatePath('/profile/notifications')
  return { success: '알림 설정이 저장되었습니다.' }
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) {
    return { error: '파일을 선택해주세요.' }
  }

  // 파일 타입 검증
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: '지원하지 않는 이미지 형식입니다. (JPG, PNG, GIF, WebP만 가능)' }
  }

  // 파일 크기 검증 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { error: '파일 크기는 5MB 이하여야 합니다.' }
  }

  const fileExt = file.name.split('.').pop()
  const filePath = `${user.id}/avatar.${fileExt}`

  // 기존 아바타 삭제
  await supabase.storage.from('avatars').remove([filePath])

  // 새 아바타 업로드
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    console.error('Error uploading avatar:', uploadError)
    return { error: '아바타 업로드에 실패했습니다.' }
  }

  // 공개 URL 가져오기
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  // 프로필에 URL 저장
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('Error updating avatar URL:', updateError)
    return { error: '프로필 업데이트에 실패했습니다.' }
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { success: '프로필 이미지가 업데이트되었습니다.', url: publicUrl }
}

export async function deleteAvatar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 프로필에서 현재 아바타 URL 가져오기
  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.avatar_url) {
    // Storage에서 파일 삭제
    const filePath = profile.avatar_url.split('/avatars/')[1]
    if (filePath) {
      await supabase.storage.from('avatars').remove([filePath])
    }
  }

  // 프로필에서 URL 제거
  const { error } = await supabase
    .from('profiles')
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Error deleting avatar:', error)
    return { error: '아바타 삭제에 실패했습니다.' }
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { success: '프로필 이미지가 삭제되었습니다.' }
}

