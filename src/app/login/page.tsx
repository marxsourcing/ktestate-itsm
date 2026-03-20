import { LoginForm } from './components/login-form'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <div className="flex flex-1 min-h-screen">
      {/* Left: Background Image Panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <Image
          src="/img/login-bg.png"
          alt="KT Smart City"
          fill
          className="object-cover"
          priority
          quality={90}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black/50" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <Link href="/">
              <Image
                src="/img/ktestate_logo.png"
                alt="KT Estate Logo"
                width={160}
                height={45}
                className="object-contain brightness-0 invert"
                priority
              />
            </Link>
          </div>
          <div className="mb-16">
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              AI 기반<br />
              IT 서비스 관리의<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-500">
                새로운 기준
              </span>
            </h2>
            <p className="mt-4 text-lg text-white/70 max-w-md leading-relaxed">
              KT Estate ITSM으로 더 빠르고 스마트한<br />
              IT 서비스 경험을 시작하세요.
            </p>
          </div>
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} KT Estate. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right: Login Form Panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8 bg-gray-50 lg:w-[45%]">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
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
    </div>
  )
}
