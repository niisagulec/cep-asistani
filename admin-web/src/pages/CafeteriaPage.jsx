import { CalendarDays, Save, Utensils } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '../lib/apiClient'
import { getErrorMessage } from '../lib/errorMessages'
import { formatMenuDate, formatShortDate, menuItemTypeLabels, menuItemTypes, toInputDate, parseLocalDate } from '../lib/menuUtils'

const defaultMenuItems = menuItemTypes
  .filter((itemType) => itemType.value !== 'OTHER')
  .map((itemType, index) => ({
    item_type: itemType.value,
    name: '',
    display_order: index + 1,
  }))

function getMonday(value = new Date()) {
  const date = parseLocalDate(value) || new Date()
  const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1
  date.setDate(date.getDate() - dayIndex)
  return toInputDate(date)
}

function addDays(value, dayCount) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + dayCount)
  return toInputDate(date)
}

function createEmptyDayForm(menuDate) {
  return {
    menu_date: menuDate,
    total_calories: '',
    note: '',
    items: defaultMenuItems.map((item) => ({ ...item })),
  }
}

function mapDailyMenu(menu) {
  return {
    id: menu.id,
    menuDate: menu.menu_date,
    totalCalories: menu.total_calories ?? '',
    note: menu.note ?? '',
    items: [...menu.items].sort(
      (first, second) => first.display_order - second.display_order || first.id - second.id,
    ),
  }
}

function mapMenuPlan(plan) {
  return {
    id: plan.id,
    title: plan.title,
    startDate: plan.start_date,
    endDate: plan.end_date,
    dailyMenus: [...plan.daily_menus].map(mapDailyMenu).sort((first, second) =>
      first.menuDate.localeCompare(second.menuDate),
    ),
  }
}

function buildWeekForms(weekStart, weeklyMenus) {
  return Array.from({ length: 5 }, (_, dayIndex) => {
    const menuDate = addDays(weekStart, dayIndex)
    const existingMenu = weeklyMenus.find((menu) => menu.menuDate === menuDate)

    if (!existingMenu) {
      return createEmptyDayForm(menuDate)
    }

    return {
      menu_date: menuDate,
      total_calories: existingMenu.totalCalories ?? '',
      note: existingMenu.note,
      items: defaultMenuItems.map((defaultItem) => {
        const matchedItem = existingMenu.items.find(
          (item) => item.item_type === defaultItem.item_type,
        )

        return {
          item_type: defaultItem.item_type,
          name: matchedItem?.name ?? '',
          display_order: defaultItem.display_order,
        }
      }),
    }
  })
}

function buildDailyMenuPayload(dayForm) {
  return {
    menu_date: dayForm.menu_date,
    total_calories: dayForm.total_calories ? Number(dayForm.total_calories) : null,
    note: dayForm.note?.trim() || null,
    items: dayForm.items
      .filter((item) => item.name.trim())
      .map((item, index) => ({
        item_type: item.item_type,
        name: item.name.trim(),
        display_order: index + 1,
      })),
  }
}

function hasAnyMenuInfo(dayForm) {
  return (
    dayForm.items.some((item) => item.name.trim()) ||
    Boolean(dayForm.note?.trim()) ||
    Boolean(dayForm.total_calories)
  )
}

function normalizeDailyMenuForCompare(menu) {
  return JSON.stringify({
    total_calories: menu.total_calories ? Number(menu.total_calories) : null,
    note: menu.note?.trim() || null,
    items: menu.items.map((item) => ({
      item_type: item.item_type,
      name: item.name.trim(),
    })),
  })
}

export default function CafeteriaPage() {
  const [weekStart, setWeekStart] = useState(getMonday())
  const [weeklyMenus, setWeeklyMenus] = useState([])
  const [menuPlans, setMenuPlans] = useState([])
  const [weekForms, setWeekForms] = useState(() => buildWeekForms(getMonday(), []))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart])

  const selectedWeekMenuPlan = useMemo(
    () => {
      if (!weekStart || weekStart.length !== 10) return null
      return menuPlans.find(
        (menuPlan) => menuPlan.startDate <= weekStart && menuPlan.endDate >= weekStart,
      )
    },
    [menuPlans, weekStart],
  )

  const fetchWeeklyMenus = useCallback(async (dateFrom = weekStart) => {
    if (!dateFrom || dateFrom.length !== 10) return
    try {
      setIsLoading(true)
      const response = await apiClient.get('/menus/week', {
        params: { date_from: dateFrom },
      })
      setWeeklyMenus(response.data.map(mapDailyMenu))
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Haftalık menü alınamadı.'))
    } finally {
      setIsLoading(false)
    }
  }, [weekStart])

  const fetchMenuPlans = useCallback(async () => {
    try {
      const response = await apiClient.get('/admin/menu-plans')
      setMenuPlans(response.data.map(mapMenuPlan))
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Menü planları alınamadı.'))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWeeklyMenus()
  }, [fetchWeeklyMenus])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMenuPlans()
  }, [fetchMenuPlans])

  useEffect(() => {
    if (weekStart && weekStart.length === 10) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeekForms(buildWeekForms(weekStart, weeklyMenus))
    }
  }, [weekStart, weeklyMenus])

  function changeWeek(value) {
    if (!value) {
      setWeekStart('')
      return
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (match) {
      setWeekStart(getMonday(value))
    } else {
      setWeekStart(value)
    }
    setSuccessMessage('')
    setErrorMessage('')
  }

  function updateMenuItem(dayIndex, itemType, value) {
    setWeekForms((currentForms) =>
      currentForms.map((dayForm, currentDayIndex) =>
        currentDayIndex === dayIndex
          ? {
              ...dayForm,
              items: dayForm.items.map((item) =>
                item.item_type === itemType ? { ...item, name: value } : item,
              ),
            }
          : dayForm,
      ),
    )
  }

  function updateNote(dayIndex, value) {
    setWeekForms((currentForms) =>
      currentForms.map((dayForm, currentDayIndex) =>
        currentDayIndex === dayIndex ? { ...dayForm, note: value } : dayForm,
      ),
    )
  }

  function updateTotalCalories(dayIndex, value) {
    setWeekForms((currentForms) =>
      currentForms.map((dayForm, currentDayIndex) =>
        currentDayIndex === dayIndex ? { ...dayForm, total_calories: value } : dayForm,
      ),
    )
  }

  async function saveWeeklyMenus(event) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setIsSubmitting(true)

    const filledMenus = weekForms
      .filter(hasAnyMenuInfo)
      .map(buildDailyMenuPayload)

    if (filledMenus.length === 0) {
      setErrorMessage('Kaydetmek için en az bir güne yemek, not veya kalori bilgisi girilmeli.')
      setIsSubmitting(false)
      return
    }

    const changedMenus = filledMenus.filter((dailyMenu) => {
      const existingMenu = weeklyMenus.find((menu) => menu.menuDate === dailyMenu.menu_date)

      if (!existingMenu) {
        return true
      }

      const existingMenuPayload = {
        total_calories: existingMenu.totalCalories ? Number(existingMenu.totalCalories) : null,
        note: existingMenu.note || null,
        items: defaultMenuItems
          .map((defaultItem) => {
            const matchedItem = existingMenu.items.find(
              (item) => item.item_type === defaultItem.item_type,
            )

            return matchedItem
              ? {
                  item_type: defaultItem.item_type,
                  name: matchedItem.name,
                }
              : null
          })
          .filter(Boolean),
      }

      return (
        normalizeDailyMenuForCompare(dailyMenu) !==
        normalizeDailyMenuForCompare(existingMenuPayload)
      )
    })

    if (changedMenus.length === 0) {
      setSuccessMessage('Kaydedilecek yeni değişiklik yok.')
      setIsSubmitting(false)
      return
    }

    try {
      for (const dailyMenu of changedMenus) {
        await apiClient.post('/admin/daily-menu', dailyMenu)
      }
      await fetchWeeklyMenus(weekStart)
      await fetchMenuPlans()
      setSuccessMessage(`${changedMenus.length} günlük menü kaydedildi.`)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Haftalık menü kaydedilemedi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Yemekhane Yönetimi
        </p>
        <h2 className="page-title mt-2 text-3xl font-bold">Haftalık menü planlama</h2>
      </section>

      <section className="panel-card rounded-3xl p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
              <Utensils size={22} />
            </div>
            <div>
              <h3 className="page-title text-lg font-bold">Hafta seçimi</h3>
              <p className="muted-text mt-1 text-sm">
                {formatShortDate(weekStart)} - {formatShortDate(weekEnd)} tarihleri arası düzenleniyor.
              </p>
            </div>
          </div>

          <div className="w-full lg:max-w-xs">
            <div className="soft-input flex items-center gap-2 rounded-2xl px-4 py-3">
              <CalendarDays size={18} className="text-slate-400" />
              <input
                className="w-full bg-transparent outline-none"
                onChange={(event) => changeWeek(event.target.value)}
                onClick={(event) => event.currentTarget.showPicker?.()}
                type="date"
                value={weekStart}
              />
            </div>
          </div>
        </div>
      </section>

      {selectedWeekMenuPlan ? (
        <section className="panel-card rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
                Mevcut Haftalık Menü
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {selectedWeekMenuPlan.dailyMenus.length} gün kayıtlı
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 5 }, (_, dayIndex) => {
              const menuDate = addDays(selectedWeekMenuPlan.startDate, dayIndex)
              const dailyMenu = selectedWeekMenuPlan.dailyMenus.find(
                (menu) => menu.menuDate === menuDate,
              )

              return (
                <div
                  className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
                  key={menuDate}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatMenuDate(menuDate)}
                    </p>
                    {dailyMenu?.totalCalories ? (
                      <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700 dark:bg-orange-950/40 dark:text-orange-200">
                        {dailyMenu.totalCalories} kcal
                      </span>
                    ) : null}
                  </div>

                  {dailyMenu ? (
                    <div className="mt-3 space-y-2">
                      {dailyMenu.items.length > 0 ? (
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {dailyMenu.items.map((item) => (
                            <li className="flex gap-2" key={item.id}>
                              <span className="font-semibold text-slate-400">
                                {menuItemTypeLabels[item.item_type] ?? item.item_type}:
                              </span>
                              <span>{item.name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Yemek kalemi girilmedi.
                        </p>
                      )}

                      {dailyMenu.note ? (
                        <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {dailyMenu.note}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      Bu gün için kayıt yok.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="panel-card rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
              Mevcut Haftalık Menü
            </p>
          </div>
          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Seçilen haftaya ait kayıtlı menü bulunmamaktadır. Aşağıdaki formdan menü planlayabilirsiniz.
          </div>
        </section>
      )}

      <form className="space-y-5" onSubmit={saveWeeklyMenus}>
        <section className="grid gap-5 xl:grid-cols-2">
          {weekForms.map((dayForm, dayIndex) => (
            <article className="panel-card rounded-3xl p-6" key={dayForm.menu_date}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="page-title text-lg font-bold">{formatMenuDate(dayForm.menu_date)}</h3>
                  <p className="muted-text mt-1 text-sm">
                    {weeklyMenus.some((menu) => menu.menuDate === dayForm.menu_date)
                      ? 'Bu gün için kayıt var, kaydedince güncellenir.'
                      : 'Bu gün için henüz menü girilmedi.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {dayForm.items.map((item) => (
                  <label className="space-y-1.5" key={item.item_type}>
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {menuItemTypeLabels[item.item_type] ?? item.item_type}
                    </span>
                    <input
                      className="soft-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                      onChange={(event) => updateMenuItem(dayIndex, item.item_type, event.target.value)}
                      placeholder={`${menuItemTypeLabels[item.item_type] ?? 'Yemek'} gir`}
                      value={item.name}
                    />
                  </label>
                ))}
              </div>

              <label className="mt-4 block max-w-xs space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Toplam kalori
                </span>
                <input
                  className="soft-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                  min="0"
                  onChange={(event) => updateTotalCalories(dayIndex, event.target.value)}
                  placeholder="Örn: 1170"
                  type="number"
                  value={dayForm.total_calories}
                />
              </label>

              <label className="mt-4 block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Not
                </span>
                <textarea
                  className="soft-input min-h-20 w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                  onChange={(event) => updateNote(dayIndex, event.target.value)}
                  placeholder="Örn: Menüde değişiklik olabilir."
                  value={dayForm.note}
                />
              </label>
            </article>
          ))}
        </section>

        <div className="sticky bottom-4 z-10 flex flex-col items-end gap-3">
          {errorMessage ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 shadow-lg shadow-red-900/5 dark:border-red-900/40 dark:bg-red-950/60 dark:text-red-200">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg shadow-emerald-900/5 dark:border-emerald-900/40 dark:bg-emerald-950/60 dark:text-emerald-200">
              {successMessage}
            </div>
          ) : null}

          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isSubmitting || isLoading}
            type="submit"
          >
            <Save size={18} />
            {isSubmitting ? 'Hafta kaydediliyor...' : 'Haftalık Menüyü Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
