import { Eye, EyeOff, LockKeyhole, Mail, Sun, Moon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../lib/apiClient'
import { setAuthSession } from '../lib/authStorage'
import { getErrorMessage } from '../lib/errorMessages'
import logoImage from '../assets/logo.png'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  function toggleTheme() {
    const nextMode = !isDarkMode
    setIsDarkMode(nextMode)
    if (nextMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', nextMode ? 'dark' : 'light')
  }

  async function handleLogin(event) {
    event.preventDefault()
    setErrorMessage('')
    setInfoMessage('')
    setIsSubmitting(true)

    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      })

      if (response.data.role !== 'ADMIN') {
        setErrorMessage('Bu panel sadece admin kullanıcılar içindir.')
        return
      }

      setAuthSession(response.data)
      navigate(response.data.must_change_password ? '/password-required' : '/')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Giriş yapılırken bir hata oluştu.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-5 py-10 dark:bg-[#080B11]">
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-md transition hover:bg-slate-100 dark:hover:bg-slate-800"
        type="button"
        title={isDarkMode ? 'Açık Moda Geç' : 'Koyu Moda Geç'}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <section className="grid w-full max-w-5xl overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none lg:grid-cols-2">
        <div className="hidden bg-linear-to-br from-blue-600 to-slate-950 p-12 text-white lg:flex flex-col justify-center">
          <img
            src={logoImage}
            alt="Logo"
            className="w-16 h-16 mb-4 rounded-xl object-contain shadow-md"
          />
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-100">
            Cep Asistanı
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">Yönetim Paneline Hoş Geldiniz.</h1>
        </div>

        <div className="p-8 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            Admin Girişi
          </p>
          <h2 className="page-title mt-3 text-3xl font-bold">Hesabına giriş yap</h2>
          <p className="muted-text mt-2 text-sm">
            Admin paneline erişmek için e-posta ve şifreni gir.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">E-posta</span>
              <div className="soft-input flex items-center gap-2 rounded-2xl px-4 py-3">
                <Mail size={18} className="text-slate-400" />
                <input
                  className="w-full bg-transparent outline-none"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@cepasistani.com"
                  type="email"
                  value={email}
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Şifre</span>
              <div className="soft-input flex items-center gap-2 rounded-2xl px-4 py-3">
                <LockKeyhole size={18} className="text-slate-400" />
                <input
                  className="w-full bg-transparent outline-none"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                />
                <button
                  className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                  onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                  type="button"
                  title={isPasswordVisible ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
              onClick={() =>
                setInfoMessage(
                  'Şifrenizi sıfırlamak veya yeni şifre talebinde bulunmak için lütfen Sistem Yöneticisi veya İnsan Kaynakları (İK) departmanı ile iletişime geçin.',
                )
              }
              type="button"
            >
              Şifremi unuttum
            </button>

            {errorMessage ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {errorMessage}
              </p>
            ) : null}

            {infoMessage ? (
              <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                {infoMessage}
              </p>
            ) : null}

            <button
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
