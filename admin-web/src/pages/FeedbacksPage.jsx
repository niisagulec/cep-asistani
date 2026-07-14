import { AlertTriangle, ArrowDownUp, Plus, Search, Tags, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConfidenceBadge, PriorityBadge, StatusBadge } from '../components/Badges'
import { apiClient } from '../lib/apiClient'
import { getErrorMessage } from '../lib/errorMessages'

const prioritySortLabels = {
  newest: 'Gönderim sırası',
  lowToHigh: 'Düşükten yükseğe',
  highToLow: 'Yüksekten düşüğe',
}

const statusOptions = [
  { value: 'NEW', label: 'Açık' },
  { value: 'IN_REVIEW', label: 'Devam ediyor' },
  { value: 'RESOLVED', label: 'Çözüldü' },
]

const listScopes = [
  { value: 'all', label: 'Tüm kayıtlar' },
  { value: 'mine', label: 'Benim gönderdiklerim' },
]

const dateRangeOptions = [
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Bu hafta' },
  { value: 'month', label: 'Bu ay' },
  { value: 'all', label: 'Tümü' },
]

const priorityFilterOptions = [
  { value: '', label: 'Tüm öncelikler' },
  { value: 'critical', label: 'Kritik' },
  { value: 'high', label: 'Yüksek' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Düşük' },
]

const confidenceFilterOptions = [
  { value: '', label: 'Tüm güvenler' },
  { value: 'high', label: 'Yüksek güven' },
  { value: 'medium', label: 'Orta güven' },
  { value: 'low', label: 'Düşük güven' },
]

const FEEDBACK_MESSAGE_MAX_LENGTH = 1000

function getDateRangeParams(dateRange) {
  if (dateRange === 'all') {
    return { limit: 500 }
  }

  const now = new Date()
  const startDate = new Date(now)

  if (dateRange === 'today') {
    startDate.setHours(0, 0, 0, 0)
  }

  if (dateRange === 'week') {
    startDate.setDate(now.getDate() - 7)
  }

  if (dateRange === 'month') {
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
  }

  return {
    date_from: startDate.toISOString(),
    date_to: now.toISOString(),
    limit: 100,
  }
}

function formatDateTime(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function mapFeedback(feedback) {
  return {
    id: feedback.id,
    categoryId: feedback.category_id,
    categoryName: feedback.category_name,
    nlpDetail: feedback.nlp_detail ?? '-',
    message: feedback.message,
    predictionConfidence: feedback.prediction_confidence ?? 0,
    totalPriorityScore: feedback.total_priority_score,
    status: feedback.status,
    adminNote: feedback.admin_note ?? '',
    reviewedBy: feedback.reviewed_by,
    reviewedAt: formatDateTime(feedback.reviewed_at),
    isAnonymous: feedback.is_anonymous,
    senderName: feedback.sender_name,
    senderDepartment: feedback.sender_department,
    senderPosition: feedback.sender_position,
    createdAt: formatDateTime(feedback.created_at),
  }
}

export default function FeedbacksPage() {
  const [feedbackList, setFeedbackList] = useState([])
  const [categories, setCategories] = useState([])
  const [listScope, setListScope] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [anonymousFilter, setAnonymousFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [confidenceFilter, setConfidenceFilter] = useState('')
  const [dateRangeFilter, setDateRangeFilter] = useState('month')
  const [prioritySort, setPrioritySort] = useState('newest')
  const [statusSort, setStatusSort] = useState('newest')
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [isCreateFeedbackOpen, setIsCreateFeedbackOpen] = useState(false)
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false)
  const [isCategoryListOpen, setIsCategoryListOpen] = useState(false)
  const [feedbackForm, setFeedbackForm] = useState({
    category_id: '',
    message: '',
    is_anonymous: false,
  })
  const [feedbackAnalysis, setFeedbackAnalysis] = useState(null)
  const [feedbackFormError, setFeedbackFormError] = useState('')
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  })
  const [draftStatus, setDraftStatus] = useState('NEW')
  const [draftAdminNote, setDraftAdminNote] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const fetchFeedbacks = useCallback(async (filters = {}, scope = listScope) => {
    try {
      setIsLoading(true)
      const params = {}

      if (filters.status) params.status = filters.status
      if (filters.categoryId) params.category_id = filters.categoryId
      if (filters.isAnonymous !== '') params.is_anonymous = filters.isAnonymous
      Object.assign(params, getDateRangeParams(filters.dateRange ?? dateRangeFilter))

      const response =
        scope === 'mine'
          ? await apiClient.get('/feedbacks/mine')
          : await apiClient.get('/admin/feedbacks', { params })

      setFeedbackList(response.data.map(mapFeedback))
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Geribildirim listesi alınamadı.'))
    } finally {
      setIsLoading(false)
    }
  }, [dateRangeFilter, listScope])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.get('/admin/feedback-categories')
      setCategories(response.data)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Kategoriler alınamadı.'))
    }
  }, [])

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFeedbacks({
      status: statusFilter,
      categoryId: categoryFilter,
      isAnonymous: anonymousFilter,
      dateRange: dateRangeFilter,
    })
  }, [statusFilter, categoryFilter, anonymousFilter, dateRangeFilter, listScope, fetchFeedbacks])

  function resetFeedbackForm() {
    setFeedbackForm({ category_id: '', message: '', is_anonymous: false })
    setFeedbackAnalysis(null)
    setFeedbackFormError('')
  }

  async function submitFeedback(categoryId = Number(feedbackForm.category_id)) {
    await apiClient.post('/feedbacks', {
      category_id: categoryId,
      message: feedbackForm.message,
      is_anonymous: feedbackForm.is_anonymous,
    })
    setListScope('mine')
    setIsCreateFeedbackOpen(false)
    resetFeedbackForm()
    await fetchFeedbacks({}, 'mine')
    setSuccessMessage('Geribildirim oluşturuldu.')
  }

  async function createFeedback() {
    setFeedbackFormError('')
    setSuccessMessage('')
    setFeedbackAnalysis(null)
    setIsSubmittingFeedback(true)

    try {
      const analysisResponse = await apiClient.post('/feedbacks/analyze', {
        category_id: Number(feedbackForm.category_id),
        message: feedbackForm.message,
      })
      const analysis = analysisResponse.data

      if (analysis.action === 'WARN_OR_REJECT') {
        setFeedbackAnalysis(analysis)
        setFeedbackFormError(analysis.user_message || 'Bu mesaj geribildirim olarak görünmüyor.')
        return
      }

      if (
        analysis.action === 'SUGGEST_CATEGORY_CHANGE' ||
        analysis.action === 'ACCEPT_WITH_MANUAL_REVIEW'
      ) {
        setFeedbackAnalysis(analysis)
        return
      }

      await submitFeedback()
    } catch (error) {
      setFeedbackFormError(getErrorMessage(error, 'Geribildirim oluşturulamadı.'))
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  async function confirmAnalyzedFeedback(useSuggestedCategory = false) {
    setFeedbackFormError('')
    setSuccessMessage('')
    setIsSubmittingFeedback(true)

    try {
      let categoryId = Number(feedbackForm.category_id)

      if (useSuggestedCategory && feedbackAnalysis?.suggested_category_name) {
        const suggestedCategory = categories.find(
          (category) => category.name === feedbackAnalysis.suggested_category_name,
        )
        if (suggestedCategory) {
          categoryId = suggestedCategory.id
        }
      }

      await submitFeedback(categoryId)
    } catch (error) {
      setFeedbackFormError(getErrorMessage(error, 'Geribildirim oluşturulamadı.'))
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  async function createCategory() {
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await apiClient.post('/admin/feedback-categories', {
        name: categoryForm.name,
        description: categoryForm.description || null,
      })
      setIsCreateCategoryOpen(false)
      setCategoryForm({ name: '', description: '' })
      await fetchCategories()
      setSuccessMessage('Kategori oluşturuldu.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Kategori oluşturulamadı.'))
    }
  }

  async function toggleCategoryStatus(category) {
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await apiClient.patch(`/admin/feedback-categories/${category.id}`, {
        is_active: !category.is_active,
      })
      await fetchCategories()
      setSuccessMessage(
        category.is_active
          ? 'Kategori pasife alındı. Yeni geribildirimlerde seçilemeyecek.'
          : 'Kategori aktife alındı.',
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Kategori durumu güncellenemedi.'))
    }
  }

  function resetFilters() {
    setSearchQuery('')
    setCategoryFilter('')
    setStatusFilter('')
    setAnonymousFilter('')
    setPriorityFilter('')
    setConfidenceFilter('')
    setDateRangeFilter('month')
    setPrioritySort('newest')
    setStatusSort('newest')
  }

  const sortedFeedbacks = useMemo(() => {
    const filteredList = feedbackList.filter((feedback) => {
      if (categoryFilter && String(feedback.categoryId) !== String(categoryFilter)) {
        return false
      }

      if (statusFilter && feedback.status !== statusFilter) {
        return false
      }

      if (anonymousFilter !== '' && String(feedback.isAnonymous) !== anonymousFilter) {
        return false
      }

      if (priorityFilter === 'critical' && feedback.totalPriorityScore < 10) {
        return false
      }

      if (
        priorityFilter === 'high' &&
        (feedback.totalPriorityScore < 7 || feedback.totalPriorityScore >= 10)
      ) {
        return false
      }

      if (
        priorityFilter === 'normal' &&
        (feedback.totalPriorityScore < 4 || feedback.totalPriorityScore >= 7)
      ) {
        return false
      }

      if (priorityFilter === 'low' && feedback.totalPriorityScore >= 4) {
        return false
      }

      if (confidenceFilter === 'high' && feedback.predictionConfidence < 0.75) {
        return false
      }

      if (
        confidenceFilter === 'medium' &&
        (feedback.predictionConfidence < 0.45 || feedback.predictionConfidence >= 0.75)
      ) {
        return false
      }

      if (confidenceFilter === 'low' && feedback.predictionConfidence >= 0.45) {
        return false
      }

      const searchableText = [
        feedback.message,
        feedback.categoryName,
        feedback.nlpDetail,
        feedback.status,
        feedback.senderName,
        feedback.senderDepartment,
        feedback.senderPosition,
        feedback.isAnonymous ? 'anonim' : 'açık',
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR')

      return searchableText.includes(searchQuery.toLocaleLowerCase('tr-TR'))
    })

    const sortedList = [...filteredList]

    if (statusSort === 'statusAsc') {
      return sortedList.sort((first, second) => first.status.localeCompare(second.status, 'tr'))
    }

    if (statusSort === 'statusDesc') {
      return sortedList.sort((first, second) => second.status.localeCompare(first.status, 'tr'))
    }

    if (prioritySort === 'lowToHigh') {
      return sortedList.sort((first, second) => first.totalPriorityScore - second.totalPriorityScore)
    }

    if (prioritySort === 'highToLow') {
      return sortedList.sort((first, second) => second.totalPriorityScore - first.totalPriorityScore)
    }

    return sortedList
  }, [
    anonymousFilter,
    categoryFilter,
    confidenceFilter,
    feedbackList,
    priorityFilter,
    prioritySort,
    searchQuery,
    statusFilter,
    statusSort,
  ])

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

      setFeedbackList((currentList) =>
        currentList.map((feedback) =>
          feedback.id === updatedFeedback.id ? updatedFeedback : feedback,
        ),
      )
      setSelectedFeedback(updatedFeedback)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Geribildirim güncellenemedi.'))
    }
  }

  function changePrioritySort() {
    setStatusSort('newest')
    setPrioritySort((currentValue) => {
      if (currentValue === 'newest') return 'lowToHigh'
      if (currentValue === 'lowToHigh') return 'highToLow'
      return 'newest'
    })
  }

  function changeStatusSort() {
    setPrioritySort('newest')
    setStatusSort((currentValue) => {
      if (currentValue === 'newest') return 'statusAsc'
      if (currentValue === 'statusAsc') return 'statusDesc'
      return 'newest'
    })
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Geribildirimler
        </p>
        <h2 className="page-title mt-2 text-3xl font-bold">Geri bildirim takip listesi</h2>
        <p className="muted-text mt-2 max-w-2xl">
          Detay, güven skoru, durum ve öncelik etiketi burada birlikte görünecek.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <button
          className="rounded-3xl border border-blue-100 bg-blue-600 p-6 text-left text-white shadow-sm transition hover:bg-blue-700 dark:border-blue-900/30 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
          onClick={() => {
            setFeedbackAnalysis(null)
            setFeedbackFormError('')
            setIsCreateFeedbackOpen(true)
          }}
          type="button"
        >
          <Plus size={24} />
          <p className="mt-4 text-lg font-bold">Geribildirim ekle</p>
          <p className="mt-1 text-sm text-blue-100 dark:text-slate-400">Admin test veya manuel kayıt oluşturabilir.</p>
        </button>

        <button
          className="panel-card rounded-3xl p-6 text-left transition hover:border-blue-200"
          onClick={() => setIsCreateCategoryOpen(true)}
          type="button"
        >
          <Tags size={24} className="text-blue-600" />
          <p className="page-title mt-4 text-lg font-bold">Kategori ekle</p>
          <p className="muted-text mt-1 text-sm">Yeni ana kategori tanımla.</p>
        </button>

        <button
          className="panel-card rounded-3xl p-6 text-left transition hover:border-blue-200"
          onClick={() => setIsCategoryListOpen(true)}
          type="button"
        >
          <Tags size={24} className="text-blue-600" />
          <p className="page-title mt-4 text-lg font-bold">Kategorileri listele</p>
          <p className="muted-text mt-1 text-sm">Aktif/pasif kategori yönetimi.</p>
        </button>
      </section>

      <section className="panel-card rounded-3xl">
        <div className="flex min-w-0 flex-col gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="page-title text-lg font-bold">
              {listScope === 'mine' ? 'Benim gönderdiklerim' : 'Tüm geribildirimler'}
            </h3>
            <p className="muted-text mt-1 text-sm">
              {isLoading
                ? 'Geribildirimler yükleniyor...'
                : listScope === 'mine'
                  ? 'Giriş yapan kullanıcının gönderileri listeleniyor.'
                  : 'Tüm çalışanlardan gelen geribildirimler listeleniyor.'}
            </p>
          </div>

          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="soft-input flex min-w-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm text-slate-400 sm:col-span-2">
              <Search size={17} />
              <input
                className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Mesaj, detay, gönderen veya pozisyon ara"
                value={searchQuery}
              />
            </div>

            <select
              className="soft-input rounded-2xl px-4 py-3 text-sm outline-none"
              onChange={(event) => setDateRangeFilter(event.target.value)}
              value={dateRangeFilter}
            >
              {dateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="soft-input rounded-2xl px-4 py-3 text-sm outline-none"
              onChange={(event) => setCategoryFilter(event.target.value)}
              value={categoryFilter}
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              className="soft-input rounded-2xl px-4 py-3 text-sm outline-none"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="">Tüm durumlar</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="soft-input rounded-2xl px-4 py-3 text-sm outline-none"
              onChange={(event) => setPriorityFilter(event.target.value)}
              value={priorityFilter}
            >
              {priorityFilterOptions.map((option) => (
                <option key={option.value || 'all-priorities'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="soft-input rounded-2xl px-4 py-3 text-sm outline-none"
              onChange={(event) => setConfidenceFilter(event.target.value)}
              value={confidenceFilter}
            >
              {confidenceFilterOptions.map((option) => (
                <option key={option.value || 'all-confidences'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="soft-input rounded-2xl px-4 py-3 text-sm outline-none"
              onChange={(event) => setAnonymousFilter(event.target.value)}
              value={anonymousFilter}
            >
              <option value="">Tüm gönderimler</option>
              <option value="false">Açık gönderim</option>
              <option value="true">Anonim</option>
            </select>

            <button
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={resetFilters}
              type="button"
            >
              Temizle
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
            {listScopes.map((scope) => (
              <button
                key={scope.value}
                className={[
                  'rounded-xl px-4 py-2 text-sm font-bold transition',
                  listScope === scope.value
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-950 dark:text-blue-300'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setListScope(scope.value)}
                type="button"
              >
                {scope.label}
              </button>
            ))}
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
          <table className="w-full min-w-245 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Mesaj</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Detay</th>
                <th className="px-6 py-4">Güven</th>
                <th className="px-6 py-4">
                  <span className="inline-flex items-center gap-2">
                    Durum
                    <button
                      className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                      onClick={changeStatusSort}
                      type="button"
                      title="Duruma göre sırala"
                    >
                      <ArrowDownUp size={14} />
                    </button>
                  </span>
                </th>
                <th className="px-6 py-4">
                  <span className="inline-flex items-center gap-2">
                    Öncelik
                    <button
                      className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                      onClick={changePrioritySort}
                      type="button"
                      title={`Öncelik sırala: ${prioritySortLabels[prioritySort]}`}
                    >
                      <ArrowDownUp size={14} />
                    </button>
                  </span>
                </th>
                <th className="px-6 py-4">Gönderen</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {sortedFeedbacks.map((feedback) => (
                <tr
                  key={feedback.id}
                  className="cursor-pointer align-top transition hover:bg-blue-50/50 dark:hover:bg-slate-800"
                  onClick={() => openFeedbackDetail(feedback)}
                  title="Geribildirim detayını aç"
                >
                  <td className="max-w-md px-6 py-5 text-slate-800 dark:text-slate-200">{feedback.message}</td>
                  <td className="px-6 py-5 font-semibold text-slate-700 dark:text-slate-200">{feedback.categoryName}</td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{feedback.nlpDetail}</td>
                  <td className="px-6 py-5">
                    <ConfidenceBadge value={feedback.predictionConfidence} />
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge status={feedback.status} />
                  </td>
                  <td className="px-6 py-5">
                    <PriorityBadge score={feedback.totalPriorityScore} />
                  </td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-300">
                    {feedback.isAnonymous ? 'Anonim' : feedback.senderName}
                  </td>
                </tr>
              ))}
              {!isLoading && sortedFeedbacks.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-slate-500" colSpan={7}>
                    Seçili filtrelere uygun geribildirim bulunamadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedFeedback ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-5 py-8 backdrop-blur-sm">
          <aside className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
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
                  Gönderen: {selectedFeedback.isAnonymous ? 'Anonim' : selectedFeedback.senderName} ·{' '}
                  {selectedFeedback.createdAt}
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

              <section className="grid gap-5 lg:grid-cols-2">
                <div className="panel-card rounded-3xl p-5">
                  <h4 className="page-title text-lg font-bold">Durum güncelle</h4>
                  <p className="muted-text mt-1 text-sm">
                    Çalışan bu durumu kendi gönderilerim ekranında takip edecek.
                  </p>

                  <div className="mt-4 grid gap-2">
                    {statusOptions.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <input
                          checked={draftStatus === option.value}
                          className="h-4 w-4 accent-blue-600"
                          name="feedback-status"
                          onChange={() => setDraftStatus(option.value)}
                          type="radio"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="panel-card rounded-3xl p-5">
                  <h4 className="page-title text-lg font-bold">İnceleme bilgisi</h4>
                  <div className="mt-4 space-y-3 text-sm">
                    <p className="text-slate-600 dark:text-slate-300">
                      İnceleyen:{' '}
                      <span className="font-semibold">{selectedFeedback.reviewedBy ?? 'Henüz yok'}</span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      İnceleme tarihi:{' '}
                      <span className="font-semibold">{selectedFeedback.reviewedAt ?? 'Henüz yok'}</span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      Öncelik puanı:{' '}
                      <span className="font-semibold">{selectedFeedback.totalPriorityScore}</span>
                    </p>
                  </div>
                </div>
              </section>

              <section className="panel-card rounded-3xl p-5">
                <label className="space-y-2">
                  <span className="page-title block text-lg font-bold">Admin notu</span>
                  <textarea
                    className="soft-input min-h-32 w-full resize-none rounded-2xl px-4 py-3 outline-none transition"
                    onChange={(event) => setDraftAdminNote(event.target.value)}
                    placeholder="Bu geribildirimle ilgili işlem notu ekle..."
                    value={draftAdminNote}
                  />
                </label>
              </section>

              <div className="flex flex-wrap justify-end gap-3">
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
                  Değişiklikleri Kaydet
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {isCreateFeedbackOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-5 py-8 backdrop-blur-sm">
          <aside className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="page-title text-2xl font-bold">Geribildirim ekle</h3>
                <p className="muted-text mt-1 text-sm">Admin kendi hesabıyla geribildirim oluşturabilir.</p>
              </div>
              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => {
                  setIsCreateFeedbackOpen(false)
                  setFeedbackAnalysis(null)
                  setFeedbackFormError('')
                }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {feedbackFormError ? (
                <div className="rounded-3xl bg-red-50 px-5 py-4 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300">
                  {feedbackFormError}
                </div>
              ) : null}

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kategori</span>
                <select
                  className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                  onChange={(event) => {
                    setFeedbackAnalysis(null)
                    setFeedbackFormError('')
                    setFeedbackForm((form) => ({ ...form, category_id: event.target.value }))
                  }}
                  value={feedbackForm.category_id}
                >
                  <option value="">Kategori seç</option>
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mesaj</span>
                <div className="relative">
                  <textarea
                    className="soft-input min-h-36 w-full resize-none rounded-2xl px-4 py-3 pb-10 outline-none transition"
                    maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
                    onChange={(event) => {
                      setFeedbackAnalysis(null)
                      setFeedbackFormError('')
                      setFeedbackForm((form) => ({ ...form, message: event.target.value }))
                    }}
                    value={feedbackForm.message}
                  />
                  <span
                    className={`pointer-events-none absolute bottom-3 right-4 rounded-full px-2 py-1 text-xs font-semibold ${
                      feedbackForm.message.length > FEEDBACK_MESSAGE_MAX_LENGTH * 0.9
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {feedbackForm.message.length} / {FEEDBACK_MESSAGE_MAX_LENGTH}
                  </span>
                </div>
              </label>

              {feedbackAnalysis && feedbackAnalysis.action !== 'WARN_OR_REJECT' ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 shrink-0" size={20} />
                    <div className="space-y-2">
                      <p className="text-sm font-bold">
                        {feedbackAnalysis.action === 'SUGGEST_CATEGORY_CHANGE'
                          ? 'Kategori önerisi'
                          : feedbackAnalysis.action === 'WARN_OR_REJECT'
                            ? 'Mesaj uyarısı'
                            : 'Mesaj kontrolü önerisi'}
                      </p>
                      <p className="text-sm">
                        {feedbackAnalysis.user_message || feedbackAnalysis.relevance_reason}
                      </p>
                      {feedbackAnalysis.suggested_category_name ? (
                        <p className="text-sm">
                          Önerilen kategori:{' '}
                          <span className="font-bold">{feedbackAnalysis.suggested_category_name}</span>
                        </p>
                      ) : null}
                      {feedbackAnalysis.suggested_detail ? (
                        <p className="text-sm">
                          Önerilen detay:{' '}
                          <span className="font-bold">{feedbackAnalysis.suggested_detail}</span>
                          {feedbackAnalysis.detail_confidence !== null &&
                          feedbackAnalysis.detail_confidence !== undefined
                            ? ` · Güven: %${Math.round(feedbackAnalysis.detail_confidence * 100)}`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <input
                  checked={feedbackForm.is_anonymous}
                  className="h-4 w-4 accent-blue-600"
                  onChange={(event) =>
                    setFeedbackForm((form) => ({ ...form, is_anonymous: event.target.checked }))
                  }
                  type="checkbox"
                />
                Anonim gönder
              </label>

              <div className="flex justify-end gap-3">
                <button
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    setIsCreateFeedbackOpen(false)
                    setFeedbackAnalysis(null)
                    setFeedbackFormError('')
                  }}
                  type="button"
                >
                  Vazgeç
                </button>
                {feedbackAnalysis?.action === 'SUGGEST_CATEGORY_CHANGE' ? (
                  <>
                    <button
                      className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-400"
                      disabled={isSubmittingFeedback}
                      onClick={() => confirmAnalyzedFeedback(false)}
                      type="button"
                    >
                      Yine de gönder
                    </button>
                    <button
                      className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      disabled={isSubmittingFeedback}
                      onClick={() => confirmAnalyzedFeedback(true)}
                      type="button"
                    >
                      Önerilen kategoriyle gönder
                    </button>
                  </>
                ) : feedbackAnalysis?.action === 'ACCEPT_WITH_MANUAL_REVIEW' ? (
                  <button
                    className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={isSubmittingFeedback}
                    onClick={() => confirmAnalyzedFeedback(false)}
                    type="button"
                  >
                    Yine de gönder
                  </button>
                ) : (
                  <button
                    className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={isSubmittingFeedback}
                    onClick={createFeedback}
                    type="button"
                  >
                    {isSubmittingFeedback ? 'Analiz ediliyor...' : 'Gönder'}
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {isCreateCategoryOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-5 py-8 backdrop-blur-sm">
          <aside className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="page-title text-2xl font-bold">Kategori ekle</h3>
                <p className="muted-text mt-1 text-sm">Yeni ana geribildirim kategorisi oluştur.</p>
              </div>
              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setIsCreateCategoryOpen(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kategori adı</span>
                <input
                  className="soft-input w-full rounded-2xl px-4 py-3 outline-none transition"
                  onChange={(event) => setCategoryForm((form) => ({ ...form, name: event.target.value }))}
                  value={categoryForm.name}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Açıklama</span>
                <textarea
                  className="soft-input min-h-28 w-full resize-none rounded-2xl px-4 py-3 outline-none transition"
                  onChange={(event) =>
                    setCategoryForm((form) => ({ ...form, description: event.target.value }))
                  }
                  value={categoryForm.description}
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => setIsCreateCategoryOpen(false)}
                  type="button"
                >
                  Vazgeç
                </button>
                <button
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  onClick={createCategory}
                  type="button"
                >
                  Kategoriyi Oluştur
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {isCategoryListOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-5 py-8 backdrop-blur-sm">
          <aside className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 dark:border-slate-800">
              <div>
                <h3 className="page-title text-2xl font-bold">Kategoriler</h3>
                <p className="muted-text mt-1 text-sm">
                  Kategorileri aktife veya pasife alabilirsin. Pasif kategoriler yeni gönderimde görünmez.
                </p>
              </div>
              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setIsCategoryListOpen(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {categories.map((category) => (
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" key={category.id}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="page-title font-bold">{category.name}</p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            category.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {category.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </div>
                      <p className="muted-text mt-1 text-sm">{category.description ?? 'Açıklama yok'}</p>
                    </div>

                    <button
                      className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                        category.is_active
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200'
                      }`}
                      onClick={() => toggleCategoryStatus(category)}
                      type="button"
                    >
                      {category.is_active ? 'Pasife al' : 'Aktife al'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 p-4 text-right dark:border-slate-800">
              <button
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                onClick={() => setIsCategoryListOpen(false)}
                type="button"
              >
                Kapat
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
