import { CalendarDays, Plus, Search, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { apiClient } from '../lib/apiClient'
import { getAuthUser } from '../lib/authStorage'
import { getErrorMessage } from '../lib/errorMessages'

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('tr-TR').format(new Date(value))
}

function mapEmployee(employee) {
  return {
    id: employee.id,
    userId: employee.user_id,
    personnelNo: employee.personnel_no,
    firstName: employee.first_name,
    lastName: employee.last_name,
    name: `${employee.first_name} ${employee.last_name}`,
    email: employee.email,
    department: employee.department ?? '-',
    position: employee.position ?? '-',
    phone: employee.phone ?? '-',
    role: employee.role,
    isActive: employee.is_active,
    mustChangePassword: employee.must_change_password,
    createdAt: formatDate(employee.created_at),
  }
}

function mapUserAccountToEmployee(user) {
  return mapEmployee({
    id: user.employee_id,
    user_id: user.id,
    email: user.email,
    role: user.role,
    personnel_no: user.personnel_no,
    first_name: user.first_name,
    last_name: user.last_name,
    department: user.department,
    position: user.position,
    phone: user.phone,
    is_active: user.is_active,
    must_change_password: user.must_change_password,
    created_at: user.created_at,
  })
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [employeeForm, setEmployeeForm] = useState(null)
  const [createForm, setCreateForm] = useState({
    role: 'EMPLOYEE',
    email: '',
    password: '',
    personnel_no: '',
    first_name: '',
    last_name: '',
    department: '',
    position: '',
    phone: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [createErrorMessage, setCreateErrorMessage] = useState('')
  const authUser = getAuthUser()

  useEffect(() => {
    fetchEmployees()
  }, [])

  async function fetchEmployees() {
    try {
      const response = await apiClient.get('/admin/users')
      setEmployees(response.data.filter((user) => user.employee_id).map(mapUserAccountToEmployee))
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Çalışan listesi alınamadı.'))
    } finally {
      setIsLoading(false)
    }
  }

  const filteredEmployees = employees.filter((employee) => {
    const searchableText = [
      employee.name,
      employee.email,
      employee.department,
      employee.position,
      employee.personnelNo,
    ]
      .join(' ')
      .toLocaleLowerCase('tr-TR')

    return searchableText.includes(searchQuery.toLocaleLowerCase('tr-TR'))
  })

  function openEmployeeDetail(employee) {
    setSelectedEmployee(employee)
    setEmployeeForm({
      email: employee.email,
      personnel_no: employee.personnelNo,
      first_name: employee.firstName,
      last_name: employee.lastName,
      department: employee.department === '-' ? '' : employee.department,
      position: employee.position === '-' ? '' : employee.position,
      phone: employee.phone === '-' ? '' : employee.phone,
    })
  }

  async function saveEmployeeUpdates() {
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await apiClient.patch(`/admin/employees/${selectedEmployee.id}`, employeeForm)
      const updatedEmployee = mapEmployee(response.data)
      setEmployees((currentEmployees) =>
        currentEmployees.map((employee) =>
          employee.id === updatedEmployee.id ? updatedEmployee : employee,
        ),
      )
      setSelectedEmployee(updatedEmployee)
      setSuccessMessage('Çalışan bilgileri güncellendi.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Çalışan bilgileri güncellenemedi.'))
    }
  }

  async function toggleEmployeeActiveStatus() {
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await apiClient.patch(`/admin/users/${selectedEmployee.userId}/active-status`, {
        is_active: !selectedEmployee.isActive,
      })
      const updatedEmployee = mapUserAccountToEmployee(response.data)
      setEmployees((currentEmployees) =>
        currentEmployees.map((employee) =>
          employee.id === updatedEmployee.id ? updatedEmployee : employee,
        ),
      )
      setSelectedEmployee(updatedEmployee)
      setSuccessMessage('Aktiflik durumu güncellendi.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Aktiflik durumu güncellenemedi.'))
    }
  }

  async function createEmployee() {
    setCreateErrorMessage('')
    setSuccessMessage('')

    const endpoint = createForm.role === 'ADMIN' ? '/admin/admins' : '/admin/employees'
    const payload = {
      email: createForm.email,
      password: createForm.password,
      personnel_no: createForm.personnel_no,
      first_name: createForm.first_name,
      last_name: createForm.last_name,
      department: createForm.department || null,
      position: createForm.position || null,
      phone: createForm.phone || null,
    }

    try {
      await apiClient.post(endpoint, payload)
      setIsCreateModalOpen(false)
      setCreateForm({
        role: 'EMPLOYEE',
        email: '',
        password: '',
        personnel_no: '',
        first_name: '',
        last_name: '',
        department: '',
        position: '',
        phone: '',
      })
      await fetchEmployees()
      setSuccessMessage('Yeni kullanıcı oluşturuldu.')
    } catch (error) {
      setCreateErrorMessage(getErrorMessage(error, 'Kullanıcı oluşturulamadı.'))
    }
  }

  async function updateEmployeeRole(nextRole) {
    if (!selectedEmployee || selectedEmployee.role === nextRole) return

    const nextRoleLabel = nextRole === 'ADMIN' ? 'Admin' : 'Çalışan'
    const confirmed = window.confirm(
      `${selectedEmployee.name} kullanıcısının sistem yetkisi "${nextRoleLabel}" olarak değiştirilecek. Onaylıyor musun?`,
    )
    if (!confirmed) return

    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await apiClient.patch(`/admin/users/${selectedEmployee.userId}/role`, {
        role: nextRole,
      })
      const updatedEmployee = mapUserAccountToEmployee(response.data)

      setEmployees((currentEmployees) =>
        currentEmployees.map((employee) =>
          employee.id === updatedEmployee.id ? updatedEmployee : employee,
        ),
      )
      setSelectedEmployee(updatedEmployee)
      setSuccessMessage('Kullanıcı rolü güncellendi.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Kullanıcı rolü güncellenemedi.'))
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Çalışan Yönetimi
        </p>
        <h2 className="page-title mt-2 text-3xl font-bold">Çalışan listesi</h2>
        <p className="muted-text mt-2 max-w-2xl">
          Admin burada çalışanları listeleyecek, filtreleyecek, yeni çalışan ekleyecek ve kişi
          detayına giderek bilgileri güncelleyecek.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <button
          className="rounded-3xl border border-blue-100 bg-blue-600 p-6 text-left text-white shadow-sm transition hover:bg-blue-700"
          onClick={() => {
            setCreateErrorMessage('')
            setIsCreateModalOpen(true)
          }}
          type="button"
        >
          <Plus size={24} />
          <p className="mt-4 text-lg font-bold">Çalışan ekle</p>
          <p className="mt-1 text-sm text-blue-100">Yeni çalışan veya admin hesabı oluştur.</p>
        </button>

        <button className="panel-card rounded-3xl p-6 text-left transition hover:border-blue-200">
          <p className="page-title text-lg font-bold">Departmanlar</p>
          <p className="muted-text mt-1 text-sm">İleride departman tanımları buradan yönetilir.</p>
        </button>

        <button className="panel-card rounded-3xl p-6 text-left transition hover:border-blue-200">
          <p className="page-title text-lg font-bold">Pozisyonlar</p>
          <p className="muted-text mt-1 text-sm">İleride pozisyon/unvan listesi buradan yönetilir.</p>
        </button>
      </section>

      <section className="panel-card rounded-3xl">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="page-title text-lg font-bold">Tüm çalışanlar</h3>
            <p className="muted-text mt-1 text-sm">
              {isLoading ? 'Çalışanlar yükleniyor...' : 'Kişi detayına gitmek için satıra tıklanacak.'}
            </p>
          </div>

          <div className="soft-input flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-slate-400">
            <Search size={17} />
            <input
              className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ad, personel no, departman veya pozisyon ara"
              value={searchQuery}
            />
          </div>
        </div>

        {errorMessage ? (
          <div className="mx-6 mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mx-6 mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-230 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Ad Soyad</th>
                <th className="px-6 py-4">Personel No</th>
                <th className="px-6 py-4">E-posta</th>
                <th className="px-6 py-4">Departman</th>
                <th className="px-6 py-4">Pozisyon</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4">Kayıt Tarihi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((employee) => (
                <tr
                  key={employee.id}
                  className="cursor-pointer transition hover:bg-blue-50/50 dark:hover:bg-slate-800"
                  onClick={() => openEmployeeDetail(employee)}
                  title="Çalışan detayını aç"
                >
                  <td className="px-6 py-5 font-semibold text-slate-900 dark:text-slate-100">{employee.name}</td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{employee.personnelNo}</td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{employee.email}</td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{employee.department}</td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{employee.position}</td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">
                    {employee.role === 'ADMIN' ? 'Admin' : 'Çalışan'}
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={clsx(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        employee.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {employee.isActive ? 'AKTİF' : 'PASİF'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{employee.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEmployee ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-5 py-8 backdrop-blur-sm">
          <aside className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="page-title text-2xl font-bold">{selectedEmployee.name}</h3>
                  <span
                    className={clsx(
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      selectedEmployee.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {selectedEmployee.isActive ? 'AKTİF' : 'PASİF'}
                  </span>
                </div>
                  <p className="muted-text mt-1 text-sm">
                  {selectedEmployee.personnelNo} · {selectedEmployee.department} · {selectedEmployee.position}
                </p>
              </div>

              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setSelectedEmployee(null)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                  <p className="muted-text text-xs font-semibold uppercase tracking-wide">Kalan izin</p>
                  <p className="page-title mt-2 text-3xl font-bold">-</p>
                  <p className="muted-text mt-1 text-xs">Henüz veri yok</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                  <p className="muted-text text-xs font-semibold uppercase tracking-wide">Son giriş</p>
                  <p className="page-title mt-2 text-3xl font-bold">-</p>
                  <p className="muted-text mt-1 text-xs">Henüz veri yok</p>
                </div>
              </section>

              <section className="panel-card rounded-3xl p-5">
                <h4 className="page-title text-lg font-bold">Kişisel ve iş bilgileri</h4>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[
                    ['personnel_no', 'Personel No'],
                    ['first_name', 'Ad'],
                    ['last_name', 'Soyad'],
                    ['email', 'E-posta'],
                    ['department', 'Departman'],
                    ['position', 'Pozisyon'],
                    ['phone', 'Telefon'],
                  ].map(([field, label]) => (
                    <label className="space-y-2" key={field}>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                      <input
                        className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                        onChange={(event) =>
                          setEmployeeForm((currentForm) => ({
                            ...currentForm,
                            [field]: event.target.value,
                          }))
                        }
                        value={employeeForm?.[field] ?? ''}
                      />
                    </label>
                  ))}
                  <p className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <ShieldCheck size={17} className="text-slate-400" />
                    {selectedEmployee.role === 'ADMIN' ? 'Admin yetkili' : 'Çalışan'}
                  </p>
                  <p className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <CalendarDays size={17} className="text-slate-400" />
                    Kayıt tarihi: {selectedEmployee.createdAt}
                  </p>
                </div>
              </section>

              <section className="panel-card rounded-3xl p-5">
                <h4 className="page-title text-lg font-bold">Sistem yetkisi</h4>
                <p className="muted-text mt-1 text-sm">
                  Departman kişinin çalıştığı birimi, sistem yetkisi ise paneldeki erişim seviyesini belirler.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1.4fr] sm:items-center">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rol</span>
                    <select
                      className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={selectedEmployee.userId === authUser?.userId}
                      onChange={(event) => updateEmployeeRole(event.target.value)}
                      value={selectedEmployee.role}
                    >
                      <option value="EMPLOYEE">Çalışan</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>

                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {selectedEmployee.userId === authUser?.userId
                      ? 'Kendi admin yetkini bu ekrandan değiştiremezsin.'
                      : 'Rol değişimi kullanıcıya verilen sistem yetkisini değiştirir. Admin rolü çalışanları ve geribildirimleri yönetebilir.'}
                  </div>
                </div>
              </section>

              <section className="panel-card rounded-3xl p-5">
                <h4 className="page-title text-lg font-bold">İzin & devam özeti</h4>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                    <p className="muted-text">Bekleyen izin talebi</p>
                    <p className="page-title mt-1 text-xl font-bold">-</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                    <p className="muted-text">Eksik devam kaydı</p>
                    <p className="page-title mt-1 text-xl font-bold">-</p>
                  </div>
                </div>
                <p className="muted-text mt-4 text-sm">
                  Bu alanlar izin ve devam endpointleri hazırlandığında gerçek verilerle
                  doldurulacak.
                </p>
              </section>

              <div className="flex flex-wrap justify-end gap-3">
                <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  Şifre Sıfırla
                </button>
                <button
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={toggleEmployeeActiveStatus}
                  type="button"
                >
                  {selectedEmployee.isActive ? 'Pasife Al' : 'Aktif Et'}
                </button>
                <button
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  onClick={saveEmployeeUpdates}
                  type="button"
                >
                  Bilgileri Kaydet
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-5 py-8 backdrop-blur-sm">
          <aside className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
              <div>
                <h3 className="page-title text-2xl font-bold">Yeni kullanıcı ekle</h3>
                <p className="muted-text mt-1 text-sm">Çalışan veya admin hesabı oluştur.</p>
              </div>
              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => {
                  setCreateErrorMessage('')
                  setIsCreateModalOpen(false)
                }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {createErrorMessage ? (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {createErrorMessage}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rol</span>
                  <select
                    className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                    onChange={(event) => setCreateForm((form) => ({ ...form, role: event.target.value }))}
                    value={createForm.role}
                  >
                    <option value="EMPLOYEE">Çalışan</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                {createForm.role === 'ADMIN' ? (
                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 sm:col-span-2">
                    Bu kullanıcı admin yetkisine sahip olacak. Çalışanları, geribildirimleri ve
                    yönetim ekranlarını kullanabilir.
                  </div>
                ) : null}
                {[
                  ['personnel_no', 'Personel No'],
                  ['first_name', 'Ad'],
                  ['last_name', 'Soyad'],
                  ['email', 'E-posta'],
                  ['password', 'Geçici Şifre'],
                  ['department', 'Departman'],
                  ['position', 'Pozisyon'],
                  ['phone', 'Telefon'],
                ].map(([field, label]) => (
                  <label className="space-y-2" key={field}>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                    <input
                      className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                      onChange={(event) =>
                        setCreateForm((form) => ({ ...form, [field]: event.target.value }))
                      }
                      type={field === 'password' ? 'password' : 'text'}
                      value={createForm[field]}
                    />
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    setCreateErrorMessage('')
                    setIsCreateModalOpen(false)
                  }}
                  type="button"
                >
                  Vazgeç
                </button>
                <button
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  onClick={createEmployee}
                  type="button"
                >
                  Kullanıcı Oluştur
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
