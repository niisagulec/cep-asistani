import { AlertTriangle, MessageSquareText, UserCheck, UsersRound, Utensils, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import StatCard from '../components/StatCard'
import { ConfidenceBadge, PriorityBadge, StatusBadge } from '../components/Badges'
import { apiClient } from '../lib/apiClient'
import { getErrorMessage } from '../lib/errorMessages'
import { formatMenuDate, menuItemTypeLabels } from '../lib/menuUtils'

const chartColors = ['#2563eb', '#7c3aed', '#f97316', '#16a34a', '#dc2626', '#0891b2', '#ca8a04']

const statusOptions = [
  { value: 'NEW', label: 'Açık' },
  { value: 'IN_REVIEW', label: 'Devam ediyor' },
  { value: 'RESOLVED', label: 'Çözüldü' },
]

function mapFeedback(feedback) {
  return {
    id: feedback.id,
    categoryName: feedback.category_name,
    nlpDetail: feedback.nlp_detail ?? '-',
    message: feedback.message,
    predictionConfidence: feedback.prediction_confidence ?? 0,
    totalPriorityScore: feedback.total_priority_score,
    status: feedback.status,
    adminNote: feedback.admin_note ?? '',
    isAnonymous: feedback.is_anonymous,
    senderName: feedback.sender_name,
    createdAt: feedback.created_at,
  }
}

function splitMenuItemNames(value) {
  if (!value) return []

  return value
    .split(',')
    .map((itemName) => itemName.trim())
    .filter(Boolean)
}

export default function DashboardPage() {
  const [employees, setEmployees] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [todayMenu, setTodayMenu] = useState(null)
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [draftStatus, setDraftStatus] = useState('NEW')
  const [draftAdminNote, setDraftAdminNote] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [employeesResponse, feedbacksResponse] = await Promise.all([
          apiClient.get('/admin/employees'),
          apiClient.get('/admin/feedbacks'),
        ])
        setEmployees(employeesResponse.data)
        setFeedbacks(feedbacksResponse.data.map(mapFeedback))

        try {
          const todayMenuResponse = await apiClient.get('/menus/today')
          setTodayMenu(todayMenuResponse.data)
        } catch {
          setTodayMenu(null)
        }
      } catch (error) {
        setErrorMessage(getErrorMessage(error, 'Genel bakış verileri alınamadı.'))
      }
    }

    fetchDashboardData()
  }, [])

  const activeEmployees = employees.filter((employee) => employee.is_active).length
  const criticalFeedbacks = feedbacks.filter((feedback) => feedback.totalPriorityScore >= 10)
  const latestImportantFeedbacks = feedbacks
    .filter((feedback) => feedback.totalPriorityScore >= 5)
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    .slice(0, 3)
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const weeklyFeedbacks = feedbacks.filter((feedback) => new Date(feedback.createdAt) >= oneWeekAgo)
  const weeklyCategoryData = Object.values(
    weeklyFeedbacks.reduce((accumulator, feedback) => {
      const key = feedback.categoryName
      accumulator[key] = accumulator[key] ?? { name: key, value: 0 }
      accumulator[key].value += 1
      return accumulator
    }, {}),
  ).sort((first, second) => second.value - first.value)
  const topWeeklyCategory = weeklyCategoryData[0]
  const topWeeklyCategories = weeklyCategoryData.filter(
    (category) => category.value === topWeeklyCategory?.value,
  )
  const weeklyDetailData = Object.values(
    weeklyFeedbacks.reduce((accumulator, feedback) => {
      const key = feedback.nlpDetail
      accumulator[key] = accumulator[key] ?? { name: key, value: 0 }
      accumulator[key].value += 1
      return accumulator
    }, {}),
  )
    .sort((first, second) => second.value - first.value)
    .slice(0, 5)

  function openFeedbackDetail(feedback) {
    setSelectedFeedback(feedback)
    setDraftStatus(feedback.status)
    setDraftAdminNote(feedback.adminNote ?? '')
  }

  async function saveFeedbackReview() {
    try {
      const response = await apiClient.patch(`/admin/feedbacks/${selectedFeedback.id}`, {
        status: draftStatus,
        admin_note: draftAdminNote,
      })
      const updatedFeedback = mapFeedback(response.data)

      setFeedbacks((currentFeedbacks) =>
        currentFeedbacks.map((feedback) =>
          feedback.id === updatedFeedback.id ? updatedFeedback : feedback,
        ),
      )
      setSelectedFeedback(updatedFeedback)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Geribildirim güncellenemedi.'))
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Genel Bakış
        </p>
        <h2 className="page-title mt-2 text-3xl font-bold">Günün Özeti</h2>
        <p className="muted-text mt-2 max-w-2xl">
          Çalışan yönetimi, gelen geri bildirimler ve öncelik durumu bu
          panelden takip edilecek.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Toplam çalışan"
          value={employees.length}
          description="Kayıtlı çalışan sayısı"
          icon={UsersRound}
        />
        <StatCard
          title="Aktif çalışan"
          value={activeEmployees}
          description="Aktif kullanıcı hesapları"
          icon={UserCheck}
        />
        <StatCard
          title="Geribildirim"
          value={feedbacks.length}
          description="Listelenen geri bildirimler"
          icon={MessageSquareText}
        />
        <StatCard
          title="Kritik"
          value={criticalFeedbacks.length}
          description="Acil inceleme gerektiren kayıtlar"
          icon={AlertTriangle}
        />
      </section>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <section className="panel-card overflow-hidden rounded-3xl">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl bg-blue-50 p-4 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
              <Utensils size={28} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
                Günün Menüsü
              </p>
              <h3 className="page-title mt-2 text-2xl font-bold">
                {todayMenu ? formatMenuDate(todayMenu.menu_date) : 'Bugün için menü girilmedi'}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {todayMenu?.total_calories ? (
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                {todayMenu.total_calories} KCAL
              </div>
            ) : null}

            {todayMenu?.note ? (
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                {todayMenu.note}
              </div>
            ) : null}
          </div>
        </div>

        {todayMenu?.items?.length ? (
          <div className="grid border-t border-slate-100 dark:border-slate-800 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {todayMenu.items
              .sort((first, second) => first.display_order - second.display_order)
              .map((item) => (
                <div className="border-b border-slate-100 px-6 py-5 last:border-b-0 dark:border-slate-800 sm:border-r xl:border-b-0" key={item.id}>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {menuItemTypeLabels[item.item_type] ?? item.item_type}
                  </p>
                  {splitMenuItemNames(item.name).length > 1 ? (
                    <ul className="mt-2 space-y-1 text-base font-bold text-slate-900 dark:text-white">
                      {splitMenuItemNames(item.name).map((itemName) => (
                        <li key={itemName}>{itemName}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">{item.name}</p>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <div className="border-t border-slate-100 px-6 py-8 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Bugünün menüsü henüz eklenmedi. Yemekhane Yönetimi sayfasından günlük menü
            oluşturabilirsin.
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel-card rounded-3xl p-6">
          <div>
            <h3 className="page-title text-lg font-bold">Bu haftanın kategori dağılımı</h3>
            <p className="muted-text mt-1 text-sm">
              Son 7 günde gelen geribildirimlerin kategoriye göre dağılımı.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
            <div className="h-64">
              {weeklyCategoryData.length > 0 ? (
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={weeklyCategoryData}
                      dataKey="value"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={3}
                    >
                      {weeklyCategoryData.map((entry, index) => (
                        <Cell fill={chartColors[index % chartColors.length]} key={entry.name} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-3xl bg-slate-50 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Bu hafta veri yok
                </div>
              )}
            </div>

            <div className="space-y-3">
              {weeklyCategoryData.map((item, index) => (
                <div className="flex items-center justify-between gap-4" key={item.name}>
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {item.name}
                    </span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel-card rounded-3xl p-6">
          <h3 className="page-title text-lg font-bold">Haftalık öne çıkan</h3>
          <p className="muted-text mt-1 text-sm">En çok geribildirim gelen kategori ve detaylar.</p>

          <div className="mt-8 rounded-3xl bg-blue-50 p-6 dark:bg-slate-800">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">
              {topWeeklyCategory ? 'En yoğun kategori' : 'Veri yok'}
            </p>
            <p className="page-title mt-3 text-3xl font-bold">
              {topWeeklyCategories.length > 0
                ? topWeeklyCategories.map((category) => category.name).join(', ')
                : '-'}
            </p>
            <p className="muted-text mt-2 text-sm">
              {topWeeklyCategory
                ? `Her biri ${topWeeklyCategory.value} adet geribildirim aldı.`
                : 'Bu hafta için henüz geribildirim bulunmuyor.'}
            </p>
          </div>

          <div className="mt-5">
            <p className="page-title text-sm font-bold">En çok gelen detaylar</p>
            <div className="mt-3 space-y-2">
              {weeklyDetailData.length > 0 ? (
                weeklyDetailData.map((detail) => (
                  <div className="flex items-center justify-between gap-3" key={detail.name}>
                    <span className="muted-text text-sm">{detail.name}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {detail.value}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted-text text-sm">Detay verisi yok.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="panel-card rounded-3xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <h3 className="page-title text-lg font-bold">Dikkat isteyen son geribildirimler</h3>
          <p className="muted-text mt-1 text-sm">
            Yüksek, acil ve kritik öncelikli en yeni kayıtlar.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {latestImportantFeedbacks.length > 0 ? (
            latestImportantFeedbacks.map((feedback) => (
              <article
                key={feedback.id}
                className="cursor-pointer p-6 transition hover:bg-blue-50/50 dark:hover:bg-slate-800"
                onClick={() => openFeedbackDetail(feedback)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={feedback.status} />
                  <PriorityBadge score={feedback.totalPriorityScore} />
                  <ConfidenceBadge value={feedback.predictionConfidence} />
                </div>

                <p className="muted-text mt-4 text-sm font-semibold">
                  {feedback.categoryName} · {feedback.nlpDetail}
                </p>
                <p className="mt-2 text-slate-800 dark:text-slate-200">{feedback.message}</p>
              </article>
            ))
          ) : (
            <p className="muted-text p-6 text-sm">
              Henüz yüksek öncelikli geribildirim kaydı yok.
            </p>
          )}
        </div>
      </section>

      {selectedFeedback ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-5 py-8 backdrop-blur-sm">
          <aside className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 dark:border-slate-800">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedFeedback.status} />
                  <PriorityBadge score={selectedFeedback.totalPriorityScore} />
                  <ConfidenceBadge value={selectedFeedback.predictionConfidence} />
                </div>
                <h3 className="page-title mt-4 text-2xl font-bold">
                  {selectedFeedback.categoryName} · {selectedFeedback.nlpDetail}
                </h3>
                <p className="muted-text mt-1 text-sm">
                  Gönderen: {selectedFeedback.isAnonymous ? 'Anonim' : selectedFeedback.senderName ?? '-'}
                </p>
              </div>

              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setSelectedFeedback(null)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <section className="panel-card rounded-3xl p-5">
                <h4 className="page-title text-lg font-bold">Geribildirim mesajı</h4>
                <p className="mt-3 leading-7 text-slate-700 dark:text-slate-200">
                  {selectedFeedback.message}
                </p>
              </section>

              <section className="panel-card rounded-3xl p-5">
                <h4 className="page-title text-lg font-bold">Durum güncelle</h4>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {statusOptions.map((option) => (
                    <label
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      key={option.value}
                    >
                      <input
                        checked={draftStatus === option.value}
                        className="h-4 w-4 accent-blue-600"
                        name="dashboard-feedback-status"
                        onChange={() => setDraftStatus(option.value)}
                        type="radio"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </section>

              <section className="panel-card rounded-3xl p-5">
                <label className="space-y-2">
                  <span className="page-title block text-lg font-bold">Admin notu</span>
                  <textarea
                    className="soft-input min-h-28 w-full resize-none rounded-2xl px-4 py-3 outline-none transition"
                    onChange={(event) => setDraftAdminNote(event.target.value)}
                    placeholder="Bu geribildirimle ilgili işlem notu ekle..."
                    value={draftAdminNote}
                  />
                </label>
              </section>

              <div className="flex justify-end gap-3">
                <button
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => setSelectedFeedback(null)}
                  type="button"
                >
                  Vazgeç
                </button>
                <button
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  onClick={saveFeedbackReview}
                  type="button"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
