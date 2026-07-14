import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { apiClient } from '../lib/apiClient'
import { getAuthUser, updateAuthUser } from '../lib/authStorage'
import { getErrorMessage } from '../lib/errorMessages'

export default function PasswordRequiredPage() {
  const navigate = useNavigate()
  const authUser = getAuthUser()
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
  })
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false)
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!authUser?.mustChangePassword) {
    return <Navigate replace to="/" />
  }

  async function changePassword(event) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await apiClient.patch('/auth/change-password', form)
      updateAuthUser({ mustChangePassword: false })
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Şifre güncellenemedi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 dark:bg-slate-950">
      <section className="w-full max-w-xl rounded-4xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-10">
        <div className="flex items-start gap-4">
          <div className="rounded-3xl bg-blue-50 p-4 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <ShieldCheck size={30} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              Güvenlik adımı
            </p>
            <h1 className="page-title mt-2 text-3xl font-bold">Şifreni yenilemen gerekiyor</h1>
            <p className="muted-text mt-3">
              Bu hesap geçici şifreyle oluşturuldu. Admin paneline devam edebilmek için önce
              kendine yeni bir şifre belirle.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Yeni şifre en az 7 karakter olmalı; büyük harf, küçük harf, rakam ve sembol içermeli.
          Örnek format: <span className="font-bold">Abc123!</span>
        </div>

        <form className="mt-8 space-y-5" onSubmit={changePassword}>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Mevcut geçici şifre
            </span>
            <div className="soft-input flex items-center gap-2 rounded-2xl px-4 py-3">
              <LockKeyhole size={18} className="text-slate-400" />
              <input
                className="w-full bg-transparent outline-none"
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    current_password: event.target.value,
                  }))
                }
                placeholder="Geçici şifren"
                required
                type={isCurrentPasswordVisible ? 'text' : 'password'}
                value={form.current_password}
              />
              <button
                className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                onClick={() => setIsCurrentPasswordVisible((currentValue) => !currentValue)}
                title={isCurrentPasswordVisible ? 'Şifreyi gizle' : 'Şifreyi göster'}
                type="button"
              >
                {isCurrentPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Yeni şifre
            </span>
            <div className="soft-input flex items-center gap-2 rounded-2xl px-4 py-3">
              <KeyRound size={18} className="text-slate-400" />
              <input
                className="w-full bg-transparent outline-none"
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    new_password: event.target.value,
                  }))
                }
                placeholder="Abc123!"
                required
                type={isNewPasswordVisible ? 'text' : 'password'}
                value={form.new_password}
              />
              <button
                className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                onClick={() => setIsNewPasswordVisible((currentValue) => !currentValue)}
                title={isNewPasswordVisible ? 'Şifreyi gizle' : 'Şifreyi göster'}
                type="button"
              >
                {isNewPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {errorMessage ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Şifre güncelleniyor...' : 'Şifremi Güncelle ve Devam Et'}
          </button>
        </form>
      </section>
    </main>
  )
}
