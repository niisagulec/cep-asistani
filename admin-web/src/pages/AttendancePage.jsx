import {
  BriefcaseBusiness,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Download,
  QrCode,
  RefreshCw,
  Save,
  Search,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { apiClient } from '../lib/apiClient'
import { getErrorMessage } from '../lib/errorMessages'

const tabs = [
  { id: 'qr', label: 'İş Yeri QR Kodu', icon: QrCode },
  { id: 'records', label: 'Giriş/Çıkış Kayıtları', icon: Clock3 },
  { id: 'corrections', label: 'Düzeltme Talepleri', icon: FileCheck2 },
  { id: 'leaves', label: 'İzin Talepleri', icon: CalendarCheck },
  { id: 'shifts', label: 'Vardiya Planı', icon: BriefcaseBusiness },
]

const leaveTypeLabels = {
  ANNUAL: 'Yıllık izin',
  HEALTH: 'Sağlık / rapor',
  EXCUSE: 'Mazeret izni',
  UNPAID: 'Ücretsiz izin',
}

const statusLabels = {
  PENDING: 'Beklemede',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
}

const eventTypeLabels = {
  CHECK_IN: 'Giriş',
  CHECK_OUT: 'Çıkış',
}

const emptyShiftForm = {
  id: null,
  name: '',
  start_time: '08:00',
  end_time: '17:00',
  description: '',
  is_active: true,
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('tr-TR').format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function normalizeTime(value) {
  if (!value) return ''
  return value.slice(0, 5)
}

function toInputDate(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function moveDate(value, dayCount) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + dayCount)
  return toInputDate(date)
}

function statusBadgeClass(status) {
  if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700'
  if (status === 'REJECTED') return 'bg-rose-100 text-rose-700'
  return 'bg-amber-100 text-amber-700'
}

function buildShiftPayload(form) {
  return {
    name: form.name.trim(),
    start_time: form.start_time,
    end_time: form.end_time,
    description: form.description.trim() || null,
    is_active: form.is_active,
  }
}

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState('records')
  const [selectedRecordDate, setSelectedRecordDate] = useState(toInputDate())
  const [records, setRecords] = useState([])
  const [recordMeta, setRecordMeta] = useState({ total_employees: 0, matched_employees: 0, total_records: 0, open_employees: 0, checked_out_employees: 0, page: 1, page_size: 25 })
  const [recordSearch, setRecordSearch] = useState('')
  const [recordPage, setRecordPage] = useState(1)
  const [attendanceQr, setAttendanceQr] = useState(null)
  const [corrections, setCorrections] = useState([])
  const [leaves, setLeaves] = useState([])
  const [shifts, setShifts] = useState([])
  const [users, setUsers] = useState([])
  const [reviewNotes, setReviewNotes] = useState({})
  const [selectedLeave, setSelectedLeave] = useState(null)
  const [shiftForm, setShiftForm] = useState(emptyShiftForm)
  const [assignmentForm, setAssignmentForm] = useState({ employee_id: '', shift_id: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isRecordsLoading, setIsRecordsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const employees = useMemo(
    () => users.filter((user) => user.employee_id),
    [users],
  )

  const pendingCorrectionCount = useMemo(
    () => corrections.filter((correction) => correction.status === 'PENDING').length,
    [corrections],
  )

  const pendingLeaveCount = useMemo(
    () => leaves.filter((leave) => leave.status === 'PENDING').length,
    [leaves],
  )

  const fetchAttendanceData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage('')

      const [correctionsResponse, leavesResponse, shiftsResponse, usersResponse, qrResponse] =
        await Promise.all([
          apiClient.get('/admin/attendance-corrections'),
          apiClient.get('/admin/leaves'),
          apiClient.get('/admin/shifts'),
          apiClient.get('/admin/users'),
          apiClient.get('/admin/attendance-qr'),
        ])

      setCorrections(correctionsResponse.data)
      setLeaves(leavesResponse.data)
      setShifts(shiftsResponse.data)
      setUsers(usersResponse.data)
      setAttendanceQr(qrResponse.data)
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          'İzin ve devam verileri alınamadı. Veritabanı tabloları oluşturulmuş mu kontrol et.',
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchDailyRecords = useCallback(async () => {
    try {
      setIsRecordsLoading(true)
      const response = await apiClient.get('/admin/attendance-daily-summary', {
        params: {
          date: selectedRecordDate,
          search: recordSearch.trim() || undefined,
          page: recordPage,
          page_size: 25,
        },
      })
      setRecords(response.data.items)
      setRecordMeta(response.data)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Giriş/çıkış özeti alınamadı.'))
    } finally {
      setIsRecordsLoading(false)
    }
  }, [recordPage, recordSearch, selectedRecordDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAttendanceData()
  }, [fetchAttendanceData])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDailyRecords()
  }, [fetchDailyRecords])

  function setReviewNote(key, value) {
    setReviewNotes((currentNotes) => ({
      ...currentNotes,
      [key]: value,
    }))
  }

  async function reviewCorrection(correctionId, nextStatus) {
    try {
      setIsSubmitting(true)
      await apiClient.patch(`/admin/attendance-corrections/${correctionId}`, {
        status: nextStatus,
        review_note: reviewNotes[`correction-${correctionId}`] || null,
      })
      setSuccessMessage('Düzeltme talebi güncellendi.')
      await Promise.all([fetchAttendanceData(), fetchDailyRecords()])
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Düzeltme talebi güncellenemedi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function reviewLeave(leaveId, nextStatus) {
    try {
      setIsSubmitting(true)
      await apiClient.patch(`/admin/leaves/${leaveId}`, {
        status: nextStatus,
        review_note: reviewNotes[`leave-${leaveId}`] || null,
      })
      setSuccessMessage('İzin talebi güncellendi.')
      setSelectedLeave(null)
      await fetchAttendanceData()
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'İzin talebi güncellenemedi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function editShift(shift) {
    setShiftForm({
      id: shift.id,
      name: shift.name ?? '',
      start_time: normalizeTime(shift.start_time),
      end_time: normalizeTime(shift.end_time),
      description: shift.description ?? '',
      is_active: shift.is_active,
    })
    setActiveTab('shifts')
    setSuccessMessage('')
    setErrorMessage('')
  }

  function resetShiftForm() {
    setShiftForm(emptyShiftForm)
    setErrorMessage('')
    setSuccessMessage('')
  }

  async function submitShift(event) {
    event.preventDefault()

    try {
      setIsSubmitting(true)
      const payload = buildShiftPayload(shiftForm)

      if (shiftForm.id) {
        await apiClient.patch(`/admin/shifts/${shiftForm.id}`, payload)
        setSuccessMessage('Vardiya güncellendi.')
      } else {
        await apiClient.post('/admin/shifts', payload)
        setSuccessMessage('Vardiya oluşturuldu.')
      }

      resetShiftForm()
      await fetchAttendanceData()
      return true
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Vardiya kaydedilemedi.'))
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function assignShift(event) {
    event.preventDefault()

    if (!assignmentForm.employee_id) {
      setErrorMessage('Vardiya atamak için çalışan seçmelisin.')
      return
    }

    try {
      setIsSubmitting(true)
      await apiClient.patch(`/admin/employees/${assignmentForm.employee_id}/shift`, {
        shift_id: assignmentForm.shift_id ? Number(assignmentForm.shift_id) : null,
      })
      setSuccessMessage('Çalışanın vardiyası güncellendi.')
      await fetchAttendanceData()
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Çalışana vardiya atanamadı.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function downloadAttendanceQr() {
    const canvas = document.getElementById('attendance-qr-canvas')
    if (!canvas) return

    const link = document.createElement('a')
    link.download = 'cep-asistani-giris-qr.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          İzin & Devam
        </p>
        <h2 className="page-title mt-2 text-3xl font-bold">İzin ve devam yönetimi</h2>
        <p className="muted-text mt-2 max-w-3xl">
          Giriş/çıkış kayıtları, düzeltme talepleri, izin onayları ve vardiya planı bu
          ekrandan yönetilir.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-3xl bg-red-50 px-6 py-4 text-base font-semibold text-red-600">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-3xl bg-emerald-50 px-6 py-4 text-base font-semibold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-4">
        <SummaryCard title="Bugün kayıtlı" value={recordMeta.total_employees} description="Çalışan" />
        <SummaryCard title="İş yerinde" value={recordMeta.open_employees} description="Aktif çalışan" />
        <SummaryCard title="Düzeltme" value={pendingCorrectionCount} description="Bekleyen talep" />
        <SummaryCard title="İzin" value={pendingLeaveCount} description="Bekleyen talep" />
      </section>

      <section className="panel-card rounded-3xl p-3">
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => {
              fetchAttendanceData()
              fetchDailyRecords()
            }}
            className="ml-auto flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            Yenile
          </button>
        </div>
      </section>

      {isLoading || (activeTab === 'records' && isRecordsLoading) ? (
        <section className="panel-card rounded-3xl p-8 text-slate-500">Veriler yükleniyor...</section>
      ) : null}

      {!isLoading && activeTab === 'qr' ? (
        <AttendanceQrPanel attendanceQr={attendanceQr} onDownload={downloadAttendanceQr} />
      ) : null}

      {!isLoading && !isRecordsLoading && activeTab === 'records' ? (
        <RecordsTable
          records={records}
          recordMeta={recordMeta}
          searchValue={recordSearch}
          selectedDate={selectedRecordDate}
          onPageChange={setRecordPage}
          onSearchChange={(value) => {
            setRecordSearch(value)
            setRecordPage(1)
          }}
          onSelectedDateChange={(value) => {
            setSelectedRecordDate(value)
            setRecordPage(1)
          }}
        />
      ) : null}

      {!isLoading && activeTab === 'corrections' ? (
        <CorrectionsTable
          corrections={corrections}
          isSubmitting={isSubmitting}
          reviewNotes={reviewNotes}
          onNoteChange={setReviewNote}
          onReview={reviewCorrection}
        />
      ) : null}

      {!isLoading && activeTab === 'leaves' ? (
        <LeavesTable
          leaves={leaves}
          isSubmitting={isSubmitting}
          onOpenDetail={setSelectedLeave}
        />
      ) : null}

      {!isLoading && activeTab === 'shifts' ? (
        <ShiftsPanel
          shifts={shifts}
          employees={employees}
          shiftForm={shiftForm}
          assignmentForm={assignmentForm}
          isSubmitting={isSubmitting}
          onShiftFormChange={setShiftForm}
          onAssignmentChange={setAssignmentForm}
          onSubmitShift={submitShift}
          onAssignShift={assignShift}
          onEditShift={editShift}
          onResetShiftForm={resetShiftForm}
        />
      ) : null}

      {selectedLeave ? (
        <LeaveDetailModal
          leave={selectedLeave}
          isSubmitting={isSubmitting}
          noteValue={reviewNotes[`leave-${selectedLeave.id}`] ?? selectedLeave.review_note ?? ''}
          onNoteChange={(value) => setReviewNote(`leave-${selectedLeave.id}`, value)}
          onClose={() => setSelectedLeave(null)}
          onApprove={() => reviewLeave(selectedLeave.id, 'APPROVED')}
          onReject={() => reviewLeave(selectedLeave.id, 'REJECTED')}
        />
      ) : null}
    </div>
  )
}

function AttendanceQrPanel({ attendanceQr, onDownload }) {
  if (!attendanceQr) {
    return <EmptyState message="QR kodu alınamadı." />
  }

  return (
    <section className="panel-card rounded-3xl p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
            İş yeri girişi
          </p>
          <h3 className="page-title mt-3 text-2xl font-bold">{attendanceQr.workplace}</h3>
          <p className="muted-text mt-3 max-w-xl leading-7">
            Bu QR kodunu indirip iş yeri girişine as. Çalışanlar mobil uygulamadan
            okuttuğunda sistem son hareketlerine göre giriş veya çıkış kaydı oluşturur.
          </p>
          <button
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            onClick={onDownload}
            type="button"
          >
            <Download size={18} />
            PNG olarak indir
          </button>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <QRCodeCanvas
            bgColor="#ffffff"
            fgColor="#0f172a"
            id="attendance-qr-canvas"
            includeMargin
            level="H"
            size={280}
            value={attendanceQr.qr_token}
          />
          <p className="mt-3 text-center text-sm font-bold text-slate-700">Cep Asistanı Giriş / Çıkış</p>
        </div>
      </div>
    </section>
  )
}

function SummaryCard({ title, value, description }) {
  return (
    <div className="panel-card rounded-3xl p-6">
      <p className="muted-text text-sm font-semibold">{title}</p>
      <p className="page-title mt-3 text-4xl font-bold">{value}</p>
      <p className="muted-text mt-2 text-sm">{description}</p>
    </div>
  )
}

function EmptyState({ message }) {
  return <div className="rounded-3xl bg-slate-50 p-8 text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">{message}</div>
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} sa ${minutes} dk`
}

function formatTimeOnly(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function RecordsTable({
  records,
  recordMeta,
  searchValue,
  selectedDate,
  onPageChange,
  onSearchChange,
  onSelectedDateChange,
}) {
  const [localSearch, setLocalSearch] = useState(searchValue)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null)
  const totalPages = Math.max(1, Math.ceil(recordMeta.matched_employees / recordMeta.page_size))

  return (
    <section className="panel-card overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="page-title text-lg font-bold">Giriş/çıkış kayıtları</h3>
          <p className="muted-text mt-1 text-sm">Yalnızca seçilen günün PDKS hareketleri gösterilir.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-label="Önceki gün"
            className="soft-input rounded-xl p-3 text-slate-600 transition hover:text-blue-600 dark:text-slate-300"
            onClick={() => onSelectedDateChange(moveDate(selectedDate, -1))}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <input
            className="soft-input rounded-xl px-4 py-3 text-sm font-bold outline-none"
            onChange={(event) => {
              if (event.target.value) onSelectedDateChange(event.target.value)
            }}
            onClick={(event) => event.currentTarget.showPicker?.()}
            type="date"
            value={selectedDate}
          />
          <button
            aria-label="Sonraki gün"
            className="soft-input rounded-xl p-3 text-slate-600 transition hover:text-blue-600 dark:text-slate-300"
            onClick={() => onSelectedDateChange(moveDate(selectedDate, 1))}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
            onClick={() => onSelectedDateChange(toInputDate())}
            type="button"
          >
            Bugün
          </button>
        </div>
      </div>

      <form
        className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-800 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          onSearchChange(localSearch)
        }}
      >
        <input
          className="soft-input min-w-0 flex-1 rounded-xl px-4 py-3 text-sm outline-none"
          onChange={(event) => setLocalSearch(event.target.value)}
          placeholder="Ad, soyad, personel no veya departman ara"
          value={localSearch}
        />
        <button
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          type="submit"
        >
          Ara
        </button>
        {searchValue ? (
          <button
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
            onClick={() => {
              setLocalSearch('')
              onSearchChange('')
            }}
            type="button"
          >
            Temizle
          </button>
        ) : null}
      </form>

      {records.length === 0 ? (
        <EmptyState message={`${formatDate(selectedDate)} tarihinde aramaya uygun giriş/çıkış kaydı yok.`} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Çalışan</th>
                <th className="px-6 py-4">Departman</th>
                <th className="px-6 py-4">İlk giriş</th>
                <th className="px-6 py-4">Son çıkış</th>
                <th className="px-6 py-4">Toplam</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.flatMap((record) => {
                const isExpanded = expandedEmployeeId === record.employee_id
                return [
                  <tr key={`summary-${record.employee_id}`}>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{record.employee_name}</p>
                      <p className="mt-1 text-xs text-slate-500">Personel No: {record.personnel_no}</p>
                    </td>
                    <td className="px-6 py-5 text-slate-600 dark:text-slate-400">{record.department ?? '-'}</td>
                    <td className="px-6 py-5 font-semibold text-emerald-700">{formatTimeOnly(record.first_check_in)}</td>
                    <td className="px-6 py-5 font-semibold text-orange-700">{formatTimeOnly(record.last_check_out)}</td>
                    <td className="px-6 py-5 font-semibold text-slate-800 dark:text-slate-200">{formatMinutes(record.total_minutes)}</td>
                    <td className="px-6 py-5">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${record.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {record.status === 'OPEN' ? 'İş yerinde' : 'Çıkış yaptı'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300"
                        onClick={() => setExpandedEmployeeId(isExpanded ? null : record.employee_id)}
                        type="button"
                      >
                        {isExpanded ? 'Kapat' : `${record.record_count} hareket`}
                      </button>
                    </td>
                  </tr>,
                  isExpanded ? (
                    <tr key={`details-${record.employee_id}`}>
                      <td className="bg-slate-50/70 px-6 py-4 dark:bg-slate-900/40" colSpan={7}>
                        <div className="flex flex-wrap gap-2">
                          {record.records.map((movement) => (
                            <span
                              className={`rounded-xl bg-white px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 ${movement.is_voided ? 'text-slate-400 line-through opacity-70 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}
                              key={movement.id}
                            >
                              {eventTypeLabels[movement.event_type] ?? movement.event_type} · {formatTimeOnly(movement.event_time)}{movement.is_voided ? ' · Düzeltildi' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ]
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="muted-text">
          {recordMeta.matched_employees} çalışan · Sayfa {recordMeta.page}/{totalPages}
        </p>
        <div className="flex gap-2">
          <button
            className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            disabled={recordMeta.page <= 1}
            onClick={() => onPageChange(recordMeta.page - 1)}
            type="button"
          >
            Önceki
          </button>
          <button
            className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            disabled={recordMeta.page >= totalPages}
            onClick={() => onPageChange(recordMeta.page + 1)}
            type="button"
          >
            Sonraki
          </button>
        </div>
      </div>
    </section>
  )
}

function CorrectionsTable({ corrections, isSubmitting, reviewNotes, onNoteChange, onReview }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState(toInputDate())
  const [page, setPage] = useState(1)
  const pageSize = 10

  const filteredCorrections = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return corrections.filter((correction) => {
      const matchesSearch =
        !normalizedSearch ||
        [correction.employee_name, correction.department]
          .filter(Boolean)
          .some((value) => value.toLocaleLowerCase('tr-TR').includes(normalizedSearch))
      const matchesStatus = statusFilter === 'ALL' || correction.status === statusFilter
      const matchesDate = !dateFilter || toInputDate(new Date(correction.requested_time)) === dateFilter

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [corrections, dateFilter, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredCorrections.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleCorrections = filteredCorrections.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  function resetFilters() {
    setSearch('')
    setStatusFilter('ALL')
    setDateFilter('')
    setPage(1)
  }

  return (
    <section className="panel-card overflow-hidden rounded-3xl">
      <TableTitle
        title="Düzeltme talepleri"
        description="Kart okutma unutulduğunda gelen giriş/çıkış düzeltme istekleri."
      />

      <div className="grid gap-3 border-t border-slate-100 px-6 py-5 dark:border-slate-800 md:grid-cols-[minmax(240px,1fr)_200px_190px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Çalışan veya departman ara"
            className="soft-input w-full rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-400"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
          className="soft-input rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400"
        >
          <option value="ALL">Tüm durumlar</option>
          <option value="PENDING">Beklemede</option>
          <option value="APPROVED">Onaylandı</option>
          <option value="REJECTED">Reddedildi</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(event) => {
            setDateFilter(event.target.value)
            setPage(1)
          }}
          onClick={(event) => event.currentTarget.showPicker?.()}
          className="soft-input rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400"
          aria-label="Talep tarihi"
        />
        <button
          type="button"
          onClick={resetFilters}
          disabled={!search && statusFilter === 'ALL' && !dateFilter}
          className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          Temizle
        </button>
      </div>

      {corrections.length === 0 ? (
        <EmptyState message="Henüz düzeltme talebi yok." />
      ) : filteredCorrections.length === 0 ? (
        <EmptyState message="Seçilen filtrelere uygun talep bulunamadı." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Çalışan</th>
                <th className="px-6 py-4">Talep</th>
                <th className="px-6 py-4">Neden</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4">İK notu</th>
                <th className="px-6 py-4">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleCorrections.map((correction) => (
                <tr key={correction.id} className="align-top">
                  <td className="px-6 py-5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{correction.employee_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{correction.department ?? '-'}</p>
                  </td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">
                    <p className="font-semibold">
                      {eventTypeLabels[correction.requested_event_type] ??
                        correction.requested_event_type}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{formatDateTime(correction.requested_time)}</p>
                  </td>
                  <td className="max-w-sm px-6 py-5 text-slate-600 dark:text-slate-300">{correction.reason}</td>
                  <td className="px-6 py-5">
                    <StatusBadge status={correction.status} />
                  </td>
                  <td className="px-6 py-5">
                    <input
                      value={reviewNotes[`correction-${correction.id}`] ?? correction.review_note ?? ''}
                      onChange={(event) =>
                        onNoteChange(`correction-${correction.id}`, event.target.value)
                      }
                      placeholder="İK notu"
                      className="min-w-56 soft-input rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <ReviewButtons
                      disabled={isSubmitting || correction.status !== 'PENDING'}
                      onApprove={() => onReview(correction.id, 'APPROVED')}
                      onReject={() => onReview(correction.id, 'REJECTED')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredCorrections.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="muted-text">
            {filteredCorrections.length} talep · Sayfa {currentPage}/{totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              Önceki
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              Sonraki
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function LeavesTable({ leaves, onOpenDetail }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const filteredLeaves = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return leaves.filter((leave) => {
      const matchesSearch =
        !normalizedSearch ||
        [leave.employee_name, leave.department]
          .filter(Boolean)
          .some((value) => value.toLocaleLowerCase('tr-TR').includes(normalizedSearch))
      const matchesStatus = statusFilter === 'ALL' || leave.status === statusFilter
      const matchesType = typeFilter === 'ALL' || leave.leave_type === typeFilter
      const leaveStartDate = leave.start_date?.slice(0, 10)
      const leaveEndDate = leave.end_date?.slice(0, 10)
      const includesSelectedDate =
        !dateFilter || (leaveStartDate <= dateFilter && leaveEndDate >= dateFilter)

      return matchesSearch && matchesStatus && matchesType && includesSelectedDate
    })
  }, [dateFilter, leaves, search, statusFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleLeaves = filteredLeaves.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  function resetFilters() {
    setSearch('')
    setStatusFilter('ALL')
    setTypeFilter('ALL')
    setDateFilter('')
    setPage(1)
  }

  const hasActiveFilters =
    search ||
    statusFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    dateFilter

  return (
    <section className="panel-card overflow-hidden rounded-3xl">
      <TableTitle title="İzin talepleri" description="Çalışanlardan gelen izin/rapor talepleri." />

      <div className="grid gap-3 border-t border-slate-100 px-6 py-5 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_190px_190px_190px_auto]">
        <label className="relative md:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Çalışan veya departman ara"
            className="soft-input w-full rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-400"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
          className="soft-input rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400"
        >
          <option value="ALL">Tüm durumlar</option>
          <option value="PENDING">Beklemede</option>
          <option value="APPROVED">Onaylandı</option>
          <option value="REJECTED">Reddedildi</option>
        </select>
        <select
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value)
            setPage(1)
          }}
          className="soft-input rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400"
        >
          <option value="ALL">Tüm izin türleri</option>
          {Object.entries(leaveTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="relative">
          <span className="pointer-events-none absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">İzin tarihi</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value)
              setPage(1)
            }}
            onClick={(event) => event.currentTarget.showPicker?.()}
            className="soft-input w-full rounded-2xl px-4 pb-2 pt-5 text-sm outline-none focus:border-blue-400"
          />
        </label>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
          className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          Temizle
        </button>
      </div>

      {leaves.length === 0 ? (
        <EmptyState message="Henüz izin talebi yok." />
      ) : filteredLeaves.length === 0 ? (
        <EmptyState message="Seçilen filtrelere uygun izin talebi bulunamadı." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Çalışan</th>
                <th className="px-6 py-4">İzin türü</th>
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Gün</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleLeaves.map((leave) => (
                <tr key={leave.id} className="align-top">
                  <td className="px-6 py-5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{leave.employee_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{leave.department ?? '-'}</p>
                  </td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">
                    {leaveTypeLabels[leave.leave_type] ?? leave.leave_type}
                  </td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">
                    {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                  </td>
                  <td className="px-6 py-5 font-semibold text-slate-800 dark:text-slate-200">{leave.total_days}</td>
                  <td className="px-6 py-5">
                    <StatusBadge status={leave.status} />
                  </td>
                  <td className="px-6 py-5">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(leave)}
                      className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                    >
                      Detay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredLeaves.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="muted-text">
            {filteredLeaves.length} izin talebi · Sayfa {currentPage}/{totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              Önceki
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              Sonraki
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function LeaveDetailModal({
  leave,
  isSubmitting,
  noteValue,
  onNoteChange,
  onClose,
  onApprove,
  onReject,
}) {
  const isPending = leave.status === 'PENDING'
  const hasEmployeeNote = Boolean(leave.reason?.trim())
  const hasReviewNote = Boolean(leave.review_note?.trim())
  const isHealthLeave = leave.leave_type === 'HEALTH'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-4xl bg-white dark:bg-slate-900 shadow-2xl border dark:border-slate-800">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-7">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              İzin detayı
            </p>
            <h3 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{leave.employee_name}</h3>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {leave.department ?? '-'} · {leave.position ?? 'Pozisyon bilgisi yok'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="İzin detayını kapat"
          >
            <XCircle size={26} />
          </button>
        </div>

        <div className="grid gap-5 p-7 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                İzin bilgisi
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <InfoItem
                  label="İzin türü"
                  value={leaveTypeLabels[leave.leave_type] ?? leave.leave_type}
                />
                <InfoItem label="Durum" value={<StatusBadge status={leave.status} />} />
                <InfoItem label="Başlangıç" value={formatDate(leave.start_date)} />
                <InfoItem label="Bitiş" value={formatDate(leave.end_date)} />
                <InfoItem label="Toplam gün" value={`${leave.total_days} gün`} />
                <InfoItem label="Talep tarihi" value={formatDateTime(leave.created_at)} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 dark:border-slate-800 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Çalışan notu
              </p>
              <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-700 dark:text-slate-300">
                {hasEmployeeNote ? leave.reason : 'Çalışan açıklama girmemiş.'}
              </p>
            </div>

            {isHealthLeave ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-5 text-amber-800 dark:text-amber-200">
                <p className="font-bold">Belge notu</p>
                <p className="mt-2 text-sm leading-6">
                  Sağlık / rapor izinlerinde rapor belgesi istenebilir. Dosya yükleme modülü
                  eklenene kadar belge takibi İK notu üzerinden yapılabilir.
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-100 dark:border-slate-800 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                İK değerlendirmesi
              </p>
              {leave.reviewed_at ? (
                <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 p-4 text-sm text-slate-600 dark:text-slate-400">
                  <p>
                    İnceleyen:{' '}
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {leave.reviewer_name ?? 'Bilinmiyor'}
                    </span>
                  </p>
                  <p className="mt-1">
                    İnceleme tarihi:{' '}
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatDateTime(leave.reviewed_at)}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Bu talep henüz incelenmedi.</p>
              )}

              {isPending ? (
                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-bold text-slate-600 dark:text-slate-400">İK notu</span>
                  <textarea
                     value={noteValue}
                     onChange={(event) => onNoteChange(event.target.value)}
                     placeholder="Onay veya red kararına ait not yazabilirsin."
                     className="min-h-36 w-full soft-input rounded-2xl px-4 py-3 outline-none focus:border-blue-400"
                  />
                </label>
              ) : (
                <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 p-4">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">İK notu</p>
                  <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {hasReviewNote ? leave.review_note : 'İK notu girilmemiş.'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Kapat
              </button>
              {isPending ? (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onReject}
                    className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 dark:bg-rose-950/30 px-5 py-3 font-bold text-rose-700 dark:text-rose-300 disabled:opacity-50"
                  >
                    <XCircle size={18} />
                    Reddet
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onApprove}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} />
                    Onayla
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-200">{value}</div>
    </div>
  )
}

function ShiftsPanel({
  shifts,
  employees,
  shiftForm,
  assignmentForm,
  isSubmitting,
  onShiftFormChange,
  onAssignmentChange,
  onSubmitShift,
  onAssignShift,
  onEditShift,
  onResetShiftForm,
}) {
  const [activeView, setActiveView] = useState('list')
  const [isFormOpen, setIsFormOpen] = useState(false)

  function openNewShiftForm() {
    onResetShiftForm()
    setIsFormOpen(true)
  }

  function openEditShiftForm(shift) {
    onEditShift(shift)
    setIsFormOpen(true)
  }

  function closeShiftForm() {
    onResetShiftForm()
    setIsFormOpen(false)
  }

  async function submitShiftAndClose(event) {
    const wasSaved = await onSubmitShift(event)
    if (wasSaved) setIsFormOpen(false)
  }

  return (
    <section className="space-y-5">
      <div className="panel-card rounded-3xl p-3">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${activeView === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}
            onClick={() => setActiveView('list')}
            type="button"
          >
            Vardiyalar
          </button>
          <button
            className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${activeView === 'assign' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}
            onClick={() => setActiveView('assign')}
            type="button"
          >
            Çalışana vardiya ata
          </button>
        </div>
      </div>

      {activeView === 'list' ? (
        <div className="panel-card overflow-hidden rounded-3xl">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="page-title text-2xl font-bold">Vardiyalar</h3>
              <p className="muted-text mt-1">{shifts.length} çalışma düzeni tanımlı.</p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
              onClick={openNewShiftForm}
              type="button"
            >
              <span className="text-xl leading-none">+</span>
              Yeni vardiya
            </button>
          </div>

          {shifts.length === 0 ? (
            <EmptyState message="Henüz vardiya tanımı yok." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {shifts.map((shift) => (
                <div key={shift.id} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="page-title text-xl font-bold">{shift.name}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${shift.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {shift.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-bold text-blue-600">
                      {normalizeTime(shift.start_time)} – {normalizeTime(shift.end_time)}
                    </p>
                    {shift.description ? <p className="muted-text mt-2 text-sm">{shift.description}</p> : null}
                  </div>
                  <button
                    className="rounded-2xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300"
                    onClick={() => openEditShiftForm(shift)}
                    type="button"
                  >
                    Düzenle
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="panel-card mx-auto w-full max-w-2xl rounded-3xl p-7">
          <h3 className="page-title text-2xl font-bold">Çalışana vardiya ata</h3>
          <p className="muted-text mt-2">Bir çalışan seçip kullanacağı çalışma düzenini belirle.</p>
          <form className="mt-6 space-y-5" onSubmit={onAssignShift}>
            <Select
              label="Çalışan"
              value={assignmentForm.employee_id}
              onChange={(value) =>
                onAssignmentChange((form) => ({ ...form, employee_id: value }))
              }
            >
              <option value="">Çalışan seç</option>
              {employees.map((employee) => (
                <option key={employee.employee_id} value={employee.employee_id}>
                  {employee.first_name} {employee.last_name} · {employee.personnel_no}
                </option>
              ))}
            </Select>

            <Select
              label="Vardiya"
              value={assignmentForm.shift_id}
              onChange={(value) => onAssignmentChange((form) => ({ ...form, shift_id: value }))}
            >
              <option value="">Vardiyasız bırak</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} · {normalizeTime(shift.start_time)}-{normalizeTime(shift.end_time)}
                </option>
              ))}
            </Select>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <UserCheck size={18} />
              Vardiyayı ata
            </button>
          </form>
        </div>
      )}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Vardiya</p>
                <h3 className="page-title mt-2 text-2xl font-bold">{shiftForm.id ? 'Vardiyayı düzenle' : 'Yeni vardiya'}</h3>
              </div>
              <button aria-label="Formu kapat" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={closeShiftForm} type="button">
                <XCircle size={24} />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitShiftAndClose}>
              <Input label="Vardiya adı" value={shiftForm.name} onChange={(value) => onShiftFormChange((form) => ({ ...form, name: value }))} placeholder="Ofis mesaisi" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Başlangıç" type="time" value={shiftForm.start_time} onChange={(value) => onShiftFormChange((form) => ({ ...form, start_time: value }))} />
                <Input label="Bitiş" type="time" value={shiftForm.end_time} onChange={(value) => onShiftFormChange((form) => ({ ...form, end_time: value }))} />
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600 dark:text-slate-400">Açıklama</span>
                <textarea className="min-h-24 w-full soft-input rounded-2xl px-4 py-3 outline-none" onChange={(event) => onShiftFormChange((form) => ({ ...form, description: event.target.value }))} placeholder="Pazartesi-Cuma ofis mesaisi" value={shiftForm.description} />
              </label>
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                <input checked={shiftForm.is_active} className="h-5 w-5 accent-blue-600" onChange={(event) => onShiftFormChange((form) => ({ ...form, is_active: event.target.checked }))} type="checkbox" />
                Aktif olarak kullan
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button className="rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300" onClick={closeShiftForm} type="button">Vazgeç</button>
                <button className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-60" disabled={isSubmitting} type="submit">
                  <Save size={18} /> {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function TableTitle({ title, description }) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 p-6">
      <h3 className="page-title text-2xl font-bold">{title}</h3>
      <p className="muted-text mt-1">{description}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusBadgeClass(status)}`}>
      {statusLabels[status] ?? status}
    </span>
  )
}

function ReviewButtons({ disabled, onApprove, onReject }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onApprove}
        className="inline-flex items-center gap-1 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-40"
      >
        <CheckCircle2 size={16} />
        Onayla
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onReject}
        className="inline-flex items-center gap-1 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40"
      >
        <XCircle size={16} />
        Reddet
      </button>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-400"
      />
    </label>
  )
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-400"
      >
        {children}
      </select>
    </label>
  )
}
