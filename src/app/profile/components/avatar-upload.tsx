'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { uploadAvatar, deleteAvatar } from '../actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AvatarUploadProps {
  currentAvatarUrl: string | null
  userName: string
}

export function AvatarUpload({ currentAvatarUrl, userName }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = (userName || '?')[0].toUpperCase()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    const formData = new FormData()
    formData.append('avatar', file)

    const result = await uploadAvatar(formData)

    if (result.error) {
      alert(result.error)
    } else if (result.url) {
      setAvatarUrl(result.url + '?t=' + Date.now()) // Cache bust
    }

    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!confirm('프로필 이미지를 삭제하시겠습니까?')) return

    setIsUploading(true)
    const result = await deleteAvatar()

    if (result.error) {
      alert(result.error)
    } else {
      setAvatarUrl(null)
    }

    setIsUploading(false)
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="relative group focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 rounded-full"
            disabled={isUploading}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={userName}
                width={96}
                height={96}
                className="size-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="size-24 rounded-full bg-gradient-to-br from-primary/80 to-primary text-3xl font-bold text-white flex items-center justify-center border-4 border-white shadow-lg">
                {initials}
              </div>
            )}
            
            {/* Overlay */}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="size-6 text-white animate-spin" />
              ) : (
                <Camera className="size-6 text-white" />
              )}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Camera className="size-4 mr-2" />
            사진 변경
          </DropdownMenuItem>
          {avatarUrl && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="size-4 mr-2" />
              사진 삭제
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

