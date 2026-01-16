'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createServiceRequest } from '@/app/requests/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CategoryLv1 {
  id: string
  name: string
}

interface CategoryLv2 {
  id: string
  name: string
  category_lv1_id: string
}

interface RequestFormProps {
  systems: { id: string, name: string }[]
}

export function RequestForm({ systems }: RequestFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [categoriesLv1, setCategoriesLv1] = useState<CategoryLv1[]>([])
  const [categoriesLv2, setCategoriesLv2] = useState<CategoryLv2[]>([])
  const [filteredLv2, setFilteredLv2] = useState<CategoryLv2[]>([])
  const [selectedLv1, setSelectedLv1] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    async function loadCategories() {
      const supabase = createClient()
      const [{ data: lv1 }, { data: lv2 }] = await Promise.all([
        supabase.from('request_categories_lv1').select('id, name').order('name'),
        supabase.from('request_categories_lv2').select('id, name, category_lv1_id').order('name'),
      ])
      setCategoriesLv1(lv1 || [])
      setCategoriesLv2(lv2 || [])
    }
    loadCategories()
  }, [])

  useEffect(() => {
    if (selectedLv1) {
      setFilteredLv2(categoriesLv2.filter(c => c.category_lv1_id === selectedLv1))
    } else {
      setFilteredLv2([])
    }
  }, [selectedLv1, categoriesLv2])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)

    const formData = new FormData(event.currentTarget)
    const result = await createServiceRequest(formData)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('서비스 요청이 등록되었습니다.')
      router.push('/requests')
    }
    
    setIsPending(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" placeholder="요청 내용을 간략히 입력해주세요" required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category_lv1_id">SR 구분</Label>
          <Select name="category_lv1_id" value={selectedLv1} onValueChange={setSelectedLv1}>
            <SelectTrigger>
              <SelectValue placeholder="SR 구분 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">선택 안함</SelectItem>
              {categoriesLv1.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category_lv2_id">SR 상세 구분</Label>
          <Select name="category_lv2_id" disabled={!selectedLv1 || selectedLv1 === 'none'}>
            <SelectTrigger>
              <SelectValue placeholder="SR 상세 구분 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">선택 안함</SelectItem>
              {filteredLv2.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="priority">우선순위</Label>
        <Select name="priority" defaultValue="medium">
          <SelectTrigger>
            <SelectValue placeholder="우선순위 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">낮음</SelectItem>
            <SelectItem value="medium">보통</SelectItem>
            <SelectItem value="high">높음</SelectItem>
            <SelectItem value="urgent">긴급</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="system_id">관련 시스템 (선택)</Label>
        <Select name="system_id">
          <SelectTrigger>
            <SelectValue placeholder="시스템 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">해당 없음</SelectItem>
            {systems.map((system) => (
              <SelectItem key={system.id} value={system.id}>
                {system.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">상세 내용</Label>
        <Textarea 
          id="description" 
          name="description" 
          placeholder="요청 사항을 상세히 기술해주세요." 
          className="min-h-[200px]"
          required 
        />
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '등록 중...' : '요청하기'}
        </Button>
      </div>
    </form>
  )
}

