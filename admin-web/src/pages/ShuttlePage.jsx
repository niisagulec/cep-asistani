import {
  BusFront,
  Clock3,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '../lib/apiClient'
import { getErrorMessage } from '../lib/errorMessages'

const emptyRouteForm = {
  id: null,
  name: '',
  evening_departure_time: '',
  driver_name: '',
  driver_phone: '',
  is_active: true,
  stops: [{ name: '', morning_time: '', morning_order: 1 }],
}

function normalizeTime(value) {
  if (!value) return ''
  return value.slice(0, 5)
}

function buildRouteForm(route) {
  return {
    id: route.id,
    name: route.name ?? '',
    evening_departure_time: normalizeTime(route.evening_departure_time),
    driver_name: route.driver_name ?? '',
    driver_phone: route.driver_phone ?? '',
    is_active: route.is_active,
    stops:
      route.stops?.length > 0
        ? [...route.stops]
            .sort((first, second) => first.morning_order - second.morning_order)
            .map((stop, index) => ({
              id: stop.id,
              name: stop.name ?? '',
              morning_time: normalizeTime(stop.morning_time),
              morning_order: index + 1,
            }))
        : [{ name: '', morning_time: '', morning_order: 1 }],
  }
}

function buildRoutePayload(routeForm) {
  return {
    name: routeForm.name.trim(),
    evening_departure_time: routeForm.evening_departure_time,
    driver_name: routeForm.driver_name.trim() || null,
    driver_phone: routeForm.driver_phone.trim() || null,
    is_active: routeForm.is_active,
    stops: routeForm.stops
      .filter((stop) => stop.name.trim() && stop.morning_time)
      .map((stop, index) => ({
        name: stop.name.trim(),
        morning_time: stop.morning_time,
        morning_order: index + 1,
      })),
  }
}

export default function ShuttlePage() {
  const [routes, setRoutes] = useState([])
  const [routeForm, setRouteForm] = useState(emptyRouteForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const activeRouteCount = useMemo(
    () => routes.filter((route) => route.is_active).length,
    [routes],
  )

  const fetchRoutes = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.get('/admin/shuttle-routes')
      setRoutes(response.data)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Servis rotaları alınamadı.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRoutes()
  }, [fetchRoutes])

  function resetForm() {
    setRouteForm(emptyRouteForm)
    setErrorMessage('')
    setSuccessMessage('')
  }

  function updateRouteField(field, value) {
    setRouteForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateStop(stopIndex, field, value) {
    setRouteForm((currentForm) => ({
      ...currentForm,
      stops: currentForm.stops.map((stop, currentStopIndex) =>
        currentStopIndex === stopIndex ? { ...stop, [field]: value } : stop,
      ),
    }))
  }

  function addStop() {
    setRouteForm((currentForm) => ({
      ...currentForm,
      stops: [
        ...currentForm.stops,
        {
          name: '',
          morning_time: '',
          morning_order: currentForm.stops.length + 1,
        },
      ],
    }))
  }

  function removeStop(stopIndex) {
    setRouteForm((currentForm) => {
      const nextStops = currentForm.stops.filter((_, currentStopIndex) => currentStopIndex !== stopIndex)

      return {
        ...currentForm,
        stops:
          nextStops.length > 0
            ? nextStops.map((stop, index) => ({ ...stop, morning_order: index + 1 }))
            : [{ name: '', morning_time: '', morning_order: 1 }],
      }
    })
  }

  async function saveRoute(event) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const payload = buildRoutePayload(routeForm)

    if (!payload.name || !payload.evening_departure_time) {
      setErrorMessage('Rota adı ve akşam kalkış saati zorunludur.')
      return
    }

    try {
      setIsSubmitting(true)

      if (routeForm.id) {
        await apiClient.patch(`/admin/shuttle-routes/${routeForm.id}`, payload)
        setSuccessMessage('Servis rotası güncellendi.')
      } else {
        await apiClient.post('/admin/shuttle-routes', payload)
        setSuccessMessage('Servis rotası oluşturuldu.')
      }

      await fetchRoutes()
      setRouteForm(emptyRouteForm)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Servis rotası kaydedilemedi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleRouteStatus(route) {
    try {
      setErrorMessage('')
      setSuccessMessage('')
      await apiClient.patch(`/admin/shuttle-routes/${route.id}`, {
        is_active: !route.is_active,
      })
      await fetchRoutes()
      setSuccessMessage(route.is_active ? 'Servis rotası pasife alındı.' : 'Servis rotası aktifleştirildi.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Servis rota durumu güncellenemedi.'))
    }
  }

  async function deleteRoute(route) {
    const isConfirmed = window.confirm(`${route.name} rotasını silmek istediğine emin misin?`)
    if (!isConfirmed) return

    try {
      setErrorMessage('')
      setSuccessMessage('')
      await apiClient.delete(`/admin/shuttle-routes/${route.id}`)
      await fetchRoutes()
      if (routeForm.id === route.id) {
        setRouteForm(emptyRouteForm)
      }
      setSuccessMessage('Servis rotası silindi.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Servis rotası silinemedi.'))
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Servis Yönetimi
        </p>
        <h2 className="page-title mt-2 text-3xl font-bold">Servis rota ve durak planlama</h2>
        <p className="muted-text mt-2 max-w-3xl">
          Sabah güzergâhındaki durak saatlerini ve akşam tek kalkış saatini buradan yönetebilirsin.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel-card rounded-3xl p-5">
          <p className="muted-text text-sm font-semibold">Toplam rota</p>
          <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{routes.length}</p>
        </div>
        <div className="panel-card rounded-3xl p-5">
          <p className="muted-text text-sm font-semibold">Aktif rota</p>
          <p className="mt-3 text-3xl font-bold text-emerald-600">{activeRouteCount}</p>
        </div>
        <div className="panel-card rounded-3xl p-5">
          <p className="muted-text text-sm font-semibold">Toplam durak</p>
          <p className="mt-3 text-3xl font-bold text-blue-600">
            {routes.reduce((total, route) => total + (route.stops?.length ?? 0), 0)}
          </p>
        </div>
      </section>

      <form className="panel-card rounded-3xl p-6" onSubmit={saveRoute}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                <BusFront size={22} />
              </span>
              <div>
                <h3 className="page-title text-xl font-bold">
                  {routeForm.id ? 'Servis rotasını düzenle' : 'Yeni servis rotası'}
                </h3>
                <p className="muted-text mt-1 text-sm">
                  Rota bilgilerini gir, durakları sabah geçiş sırasına göre ekle.
                </p>
              </div>
            </div>
          </div>

          {routeForm.id ? (
            <button
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={resetForm}
              type="button"
            >
              Yeni rota formuna dön
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Rota adı
            </span>
            <input
              className="soft-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
              onChange={(event) => updateRouteField('name', event.target.value)}
              placeholder="Örn: 15-A Güzergâhı"
              value={routeForm.name}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Akşam kalkış saati
            </span>
            <input
              className="soft-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
              onChange={(event) => updateRouteField('evening_departure_time', event.target.value)}
              type="time"
              value={routeForm.evening_departure_time}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Şoför adı
            </span>
            <input
              className="soft-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
              onChange={(event) => updateRouteField('driver_name', event.target.value)}
              placeholder="Opsiyonel"
              value={routeForm.driver_name}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Şoför telefonu
            </span>
            <input
              className="soft-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
              onChange={(event) => updateRouteField('driver_phone', event.target.value)}
              inputMode="numeric"
              maxLength={11}
              placeholder="05551234567"
              type="tel"
              value={routeForm.driver_phone}
            />
          </label>
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
          <input
            checked={routeForm.is_active}
            className="h-5 w-5 rounded border-slate-300 text-blue-600"
            onChange={(event) => updateRouteField('is_active', event.target.checked)}
            type="checkbox"
          />
          Bu rota aktif olsun
        </label>

        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="page-title text-lg font-bold">Sabah durakları</h4>
              <p className="muted-text mt-1 text-sm">Duraklar ekrandaki sıraya göre kaydedilir.</p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
              onClick={addStop}
              type="button"
            >
              <Plus size={17} />
              Durak ekle
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {routeForm.stops.map((stop, stopIndex) => (
              <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/60 md:grid-cols-[80px_1fr_180px_44px]" key={`${stop.id ?? 'new'}-${stopIndex}`}>
                <div className="flex items-center text-sm font-bold text-slate-500">
                  #{stopIndex + 1}
                </div>
                <input
                  className="soft-input rounded-2xl px-4 py-3 text-sm outline-none transition"
                  onChange={(event) => updateStop(stopIndex, 'name', event.target.value)}
                  placeholder="Durak adı"
                  value={stop.name}
                />
                <input
                  className="soft-input rounded-2xl px-4 py-3 text-sm outline-none transition"
                  onChange={(event) => updateStop(stopIndex, 'morning_time', event.target.value)}
                  type="time"
                  value={stop.morning_time}
                />
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => removeStop(stopIndex)}
                  title="Durağı kaldır"
                  type="button"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-end gap-3">
          {errorMessage ? (
            <div className="w-full rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/60 dark:text-red-200">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="w-full rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/60 dark:text-emerald-200">
              {successMessage}
            </div>
          ) : null}

          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isSubmitting}
            type="submit"
          >
            <Save size={18} />
            {isSubmitting ? 'Kaydediliyor...' : routeForm.id ? 'Rotayı güncelle' : 'Rotayı kaydet'}
          </button>
        </div>
      </form>

      <section className="panel-card rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="page-title text-xl font-bold">Kayıtlı servis rotaları</h3>
            <p className="muted-text mt-1 text-sm">
              Rotaları düzenleyebilir, pasife alabilir veya silebilirsin.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Servis rotaları yükleniyor...
          </div>
        ) : routes.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Henüz servis rotası eklenmedi.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {routes.map((route) => (
              <article className="rounded-3xl border border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/60" key={route.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold text-slate-950 dark:text-white">{route.name}</h4>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          route.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {route.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={16} className="text-blue-500" />
                        Akşam kalkış: {normalizeTime(route.evening_departure_time)}
                      </span>
                      {route.driver_name ? (
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound size={16} className="text-blue-500" />
                          {route.driver_name}
                        </span>
                      ) : null}
                      {route.driver_phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone size={16} className="text-blue-500" />
                          {route.driver_phone}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-white hover:text-blue-600 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => {
                        setRouteForm(buildRouteForm(route))
                        setErrorMessage('')
                        setSuccessMessage('')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      title="Düzenle"
                      type="button"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => toggleRouteStatus(route)}
                      type="button"
                    >
                      {route.is_active ? 'Pasife al' : 'Aktifleştir'}
                    </button>
                    <button
                      className="rounded-2xl border border-red-100 p-2 text-red-500 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
                      onClick={() => deleteRoute(route)}
                      title="Sil"
                      type="button"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {route.stops?.length > 0 ? (
                    [...route.stops]
                      .sort((first, second) => first.morning_order - second.morning_order)
                      .map((stop) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm dark:bg-slate-950/50"
                          key={stop.id}
                        >
                          <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                            <MapPin size={16} className="shrink-0 text-blue-500" />
                            <span className="truncate">{stop.name}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                            {normalizeTime(stop.morning_time)}
                          </span>
                        </div>
                      ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      Bu rotaya henüz sabah durağı eklenmedi.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
