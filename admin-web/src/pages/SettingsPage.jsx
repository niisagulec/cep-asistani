import { KeyRound, Mail, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiClient } from '../lib/apiClient'
import { getAuthUser } from '../lib/authStorage'
import { getErrorMessage } from '../lib/errorMessages'

export default function SettingsPage() {
  const [currentProfile, setCurrentProfile] = useState(null)
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    async function fetchProfile() {
      const authUser = getAuthUser()
      if (!authUser?.userId) return

      try {
        const response = await apiClient.get('/admin/users')
        const matchedUser = response.data.find((user) => user.id === authUser.userId)

        if (matchedUser) {
          setCurrentProfile(matchedUser)
          setProfileForm({
            first_name: matchedUser.first_name ?? '',
            last_name: matchedUser.last_name ?? '',
            email: matchedUser.email ?? '',
            phone: matchedUser.phone ?? '',
          })
        }
      } catch (error) {
        setErrorMessage(getErrorMessage(error, 'Profil bilgileri alınamadı.'))
      }
    }

    fetchProfile()
  }, [])

  async function saveProfile() {
    setErrorMessage('')
    setSuccessMessage('')

    if (!currentProfile?.employee_id) {
      setErrorMessage('Profil güncellemek için çalışan kaydı bulunamadı.')
      return
    }

    try {
      await apiClient.patch(`/admin/employees/${currentProfile.employee_id}`, {
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        email: profileForm.email,
        phone: profileForm.phone || null,
      })
      setSuccessMessage('Profil bilgileri güncellendi.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Profil bilgileri güncellenemedi.'))
    }
  }

  async function changePassword() {
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await apiClient.patch('/auth/change-password', passwordForm)
      setPasswordForm({
        current_password: '',
        new_password: '',
      })
      setSuccessMessage('Şifre güncellendi.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Şifre güncellenemedi.'))
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Hesap Ayarları
        </p>
        <h2 className="page-title mt-2 text-3xl font-bold">Profil ve güvenlik</h2>
        <p className="muted-text mt-2 max-w-2xl">
          Giriş yapan admin burada kendi profil bilgisini, e-posta bilgisini, şifresini ve tema
          tercihini yönetebilir.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="panel-card rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <UserRound size={22} />
            </div>
            <div>
              <h3 className="page-title text-lg font-bold">Profil bilgileri</h3>
              <p className="muted-text text-sm">Ad soyad ve iletişim bilgileri.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ad</span>
              <input
                className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                onChange={(event) =>
                  setProfileForm((form) => ({ ...form, first_name: event.target.value }))
                }
                value={profileForm.first_name}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Soyad</span>
              <input
                className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                onChange={(event) =>
                  setProfileForm((form) => ({ ...form, last_name: event.target.value }))
                }
                value={profileForm.last_name}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">E-posta</span>
              <div className="soft-input flex items-center gap-2 rounded-2xl px-4 py-3">
                <Mail size={18} className="text-slate-400" />
                <input
                  className="w-full bg-transparent outline-none"
                  onChange={(event) =>
                    setProfileForm((form) => ({ ...form, email: event.target.value }))
                  }
                  value={profileForm.email}
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Telefon</span>
              <input
                className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                onChange={(event) =>
                  setProfileForm((form) => ({ ...form, phone: event.target.value }))
                }
                placeholder="05XXXXXXXXX"
                value={profileForm.phone}
              />
            </label>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Pozisyon/departman kendi hesabından değiştirilemez:{' '}
              <span className="font-semibold">
                {currentProfile?.position ?? '-'} · {currentProfile?.department ?? '-'}
              </span>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              onClick={saveProfile}
              type="button"
            >
              Profil Bilgilerini Kaydet
            </button>
          </div>
        </article>

        <article className="panel-card rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <KeyRound size={22} />
            </div>
            <div>
              <h3 className="page-title text-lg font-bold">Şifre güncelleme</h3>
              <p className="muted-text text-sm">Admin kendi şifresini buradan değiştirebilir.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mevcut şifre</span>
              <input
                type="password"
                className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                onChange={(event) =>
                  setPasswordForm((form) => ({ ...form, current_password: event.target.value }))
                }
                placeholder="••••••••"
                value={passwordForm.current_password}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Yeni şifre</span>
              <input
                type="password"
                className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                onChange={(event) =>
                  setPasswordForm((form) => ({ ...form, new_password: event.target.value }))
                }
                placeholder="Abc123!"
                value={passwordForm.new_password}
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              onClick={changePassword}
              type="button"
            >
              Şifreyi Güncelle
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}
