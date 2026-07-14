import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BusFront,
  CalendarCheck,
  Home,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Settings,
  Utensils,
  UsersRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { apiClient } from '../lib/apiClient'
import { clearAuthSession, getAuthUser } from '../lib/authStorage'
import logoImage from '../assets/logo.png'

const links = [
  { to: '/', label: 'Genel Bakış', icon: Home },
  { to: '/employees', label: 'Çalışan Yönetimi', icon: UsersRound },
  { to: '/attendance', label: 'İzin & Devam', icon: CalendarCheck },
  { to: '/cafeteria', label: 'Yemekhane Yönetimi', icon: Utensils },
  { to: '/shuttles', label: 'Servis Yönetimi', icon: BusFront },
  { to: '/feedbacks', label: 'Geribildirimler', icon: MessageSquareText },
]

export default function Layout() {
  const location = useLocation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [currentProfile, setCurrentProfile] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    async function fetchCurrentProfile() {
      const authUser = getAuthUser()
      const authUserId = authUser?.userId ?? authUser?.user_id ?? authUser?.id

      if (!authUserId) {
        setCurrentProfile(null)
        return
      }

      try {
        const response = await apiClient.get('/admin/users')
        const matchedUser = response.data.find((user) => String(user.id) === String(authUserId))
        setCurrentProfile(matchedUser ?? null)
      } catch {
        setCurrentProfile(null)
      }
    }

    fetchCurrentProfile()
  }, [location.pathname])

  const profileName = currentProfile?.first_name
    ? `${currentProfile.first_name} ${currentProfile.last_name}`
    : 'Admin Kullanıcı'
  const profileSubtitle = currentProfile
    ? `${currentProfile.position ?? 'Pozisyon yok'} · ${currentProfile.role}`
    : 'Admin'
  const profileInitials = currentProfile?.first_name
    ? `${currentProfile.first_name[0]}${currentProfile.last_name?.[0] ?? ''}`.toUpperCase()
    : 'AD'

  function closeMobileSidebar() {
    setIsMobileSidebarOpen(false)
  }

  return (
    <div className="min-h-screen overflow-x-hidden transition-colors">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm dark:border-[#1E293B] dark:bg-[#111622] lg:hidden">
        <button
          className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={() => setIsMobileSidebarOpen(true)}
          type="button"
          title="Menüyü aç"
        >
          <Menu size={24} />
        </button>

        <div className="flex items-center gap-2 text-center">
          <img src={logoImage} alt="Logo" className="h-7 w-7 rounded-md object-contain" />
          <div className="text-left">
            <p className="text-sm font-bold text-slate-950 dark:text-white leading-tight">Cep Asistanı</p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Admin Panel</p>
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {profileInitials}
        </div>
      </header>

      {isMobileSidebarOpen ? (
        <button
          aria-label="Menüyü kapat"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={closeMobileSidebar}
          type="button"
        />
      ) : null}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 overflow-hidden transition-all duration-300 sidebar-custom',
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          isSidebarCollapsed ? 'w-24' : 'w-80',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center gap-4 sidebar-header-custom px-6">
            <button
              className="rounded-xl p-2 text-slate-300 transition hover:bg-[#3A4F63] hover:text-white"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  closeMobileSidebar()
                  return
                }

                setIsSidebarCollapsed((currentValue) => !currentValue)
              }}
              type="button"
              title={isSidebarCollapsed ? 'Menüyü aç' : 'Menüyü kapat'}
            >
              <Menu size={24} />
            </button>

            <div className={clsx('flex items-center gap-3 min-w-0', isSidebarCollapsed && 'sr-only')}>
              <img src={logoImage} alt="Logo" className="h-9 w-9 rounded-lg object-contain" />
              <div>
                <p className="truncate text-xl font-bold tracking-tight">Cep Asistanı</p>
                <p className="text-xs font-medium text-slate-400">Admin Panel</p>
              </div>
            </div>
          </div>

          <nav className="border-y border-[#37474F]/40">
            {links.map((link) => {
              const Icon = link.icon

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={closeMobileSidebar}
                  className={({ isActive }) =>
                    clsx(
                      'group relative flex h-14 items-center gap-3 border-b border-[#37474F]/40 px-5 text-sm font-semibold transition last:border-b-0',
                      isSidebarCollapsed && 'justify-center',
                      isActive ? 'sidebar-link-active-custom' : 'sidebar-link-custom',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={21}
                        className={clsx(
                          'shrink-0',
                          isActive ? 'text-white' : 'text-[#90A4AE]',
                        )}
                      />
                      <span className={clsx('truncate', isSidebarCollapsed && 'sr-only')}>{link.label}</span>
                      {isActive ? (
                        <span className="absolute right-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-l-full bg-blue-500" />
                      ) : null}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-auto border-t border-[#37474F]/40">
            <div
              className={clsx(
                'flex items-center gap-2 border-b border-[#37474F]/40 px-4 py-2.5',
                isSidebarCollapsed && 'justify-center px-0',
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {profileInitials}
              </div>
              <div className={clsx('min-w-0', isSidebarCollapsed && 'sr-only')}>
                <p className="truncate text-xs font-bold text-white">{profileName}</p>
                <p className="truncate text-[11px] text-slate-400">{profileSubtitle}</p>
              </div>
            </div>

            <NavLink
              to="/settings"
              onClick={closeMobileSidebar}
              className={({ isActive }) =>
                clsx(
                  'flex h-9 w-full items-center gap-2 px-4 text-xs font-semibold transition',
                  isSidebarCollapsed && 'justify-center',
                  isActive
                    ? 'sidebar-link-active-custom'
                    : 'sidebar-link-custom',
                )
              }
            >
              <Settings size={16} />
              <span className={clsx(isSidebarCollapsed && 'sr-only')}>Hesap Ayarları</span>
            </NavLink>

            <button
              className={clsx(
                'flex h-9 w-full items-center justify-between px-4 text-xs font-semibold transition sidebar-link-custom',
                isSidebarCollapsed && 'justify-center',
              )}
              onClick={() => setIsDarkMode((currentValue) => !currentValue)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Moon size={16} className="shrink-0" />
                <span className={clsx('truncate text-xs', isSidebarCollapsed && 'sr-only')}>Koyu Mod</span>
              </span>
              <span
                className={clsx(
                  'h-4 w-7 shrink-0 rounded-full p-0.5 transition',
                  isSidebarCollapsed && 'sr-only',
                  isDarkMode ? 'bg-blue-600' : 'bg-[#3A4F63]',
                )}
              >
                <span
                  className={clsx(
                    'block h-3 w-3 rounded-full bg-white shadow-sm transition',
                    isDarkMode && 'translate-x-3',
                  )}
                />
              </span>
            </button>

            <NavLink
              to="/login"
              onClick={() => {
                closeMobileSidebar()
                clearAuthSession()
              }}
              className={clsx(
                'flex h-9 w-full items-center gap-2 px-4 text-xs font-semibold text-red-400 transition hover:bg-red-950/20',
                isSidebarCollapsed && 'justify-center',
              )}
            >
              <LogOut size={16} />
              <span className={clsx(isSidebarCollapsed && 'sr-only')}>Çıkış Yap</span>
            </NavLink>
          </div>
        </div>
      </aside>

      <main className={clsx('min-w-0 transition-all', isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-80')}>
        <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-5 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
