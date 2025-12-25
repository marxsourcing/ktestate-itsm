import { LoginForm } from './components/login-form'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        {/* KT Style Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-2xl kt-gradient shadow-lg kt-shadow">
              <span className="text-lg font-bold text-white">KT</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Estate IT</span>
          </Link>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
