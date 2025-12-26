import { LoginForm } from './components/login-form'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        {/* KT Estate Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Image 
              src="/img/ktestate_logo.png" 
              alt="KT Estate Logo" 
              width={200} 
              height={56}
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
