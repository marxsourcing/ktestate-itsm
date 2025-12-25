import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './components/profile-form'
import { AvatarUpload } from './components/avatar-upload'
import { User, Mail, Building2, Phone, Calendar, Shield } from 'lucide-react'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const roleLabels: Record<string, string> = {
    admin: '관리자',
    manager: '담당자',
    requester: '요청자',
  }
  const roleLabel = roleLabels[profile.role as string] || '사용자'

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container max-w-4xl py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">내 프로필</h1>
          <p className="text-gray-500 mt-1">계정 정보를 확인하고 수정할 수 있습니다.</p>
        </div>

        <div className="grid gap-6">
          {/* Profile Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Cover gradient */}
            <div className="h-24 kt-gradient" />
            
            {/* Avatar & Basic Info */}
            <div className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="-mt-12">
                  <AvatarUpload 
                    currentAvatarUrl={profile.avatar_url} 
                    userName={profile.full_name || profile.email}
                  />
                </div>
                <div className="flex-1 pt-3">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {profile.full_name || '이름 미설정'}
                  </h2>
                  <p className="text-gray-500 text-sm">{profile.email}</p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  <Shield className="size-4 mr-1.5" />
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoCard 
              icon={<Mail className="size-5" />}
              label="이메일"
              value={profile.email}
            />
            <InfoCard 
              icon={<Building2 className="size-5" />}
              label="부서"
              value={profile.department || '미설정'}
            />
            <InfoCard 
              icon={<Phone className="size-5" />}
              label="연락처"
              value={profile.phone || '미설정'}
            />
            <InfoCard 
              icon={<Calendar className="size-5" />}
              label="가입일"
              value={new Date(profile.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
          </div>

          {/* Edit Form */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <User className="size-5 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900">정보 수정</h3>
            </div>
            <ProfileForm profile={profile} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode
  label: string
  value: string 
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
      <div className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  )
}

