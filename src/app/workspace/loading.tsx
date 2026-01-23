import { Skeleton } from '@/components/ui/skeleton'

export default function WorkspaceLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left Panel - Request List */}
      <div className="w-[360px] border-r bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-32 mb-2" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        {/* List Items */}
        <div className="flex-1 p-2 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-3 border rounded-lg">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2 mb-2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center Panel - Request Detail */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>

      {/* Right Panel - Similar Cases / AI Chat */}
      <div className="w-[400px] border-l bg-white">
        <div className="p-4 border-b">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="p-4">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}
