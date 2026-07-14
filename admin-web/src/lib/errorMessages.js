const ERROR_TRANSLATIONS = {
  'Invalid email or password': 'E-posta veya şifre hatalı.',
  'User account is inactive': 'Bu kullanıcı hesabı pasif durumda.',
  'Invalid or expired token': 'Oturum süresi dolmuş veya geçersiz. Lütfen tekrar giriş yapın.',
  'Invalid token subject': 'Oturum bilgisi geçersiz. Lütfen tekrar giriş yapın.',
  'User not found': 'Kullanıcı bulunamadı.',
  'Password change required': 'Devam etmek için önce şifrenizi değiştirmeniz gerekiyor.',
  'Admin permission required': 'Bu işlem için admin yetkisi gerekiyor.',
  'Current password is incorrect': 'Mevcut şifre hatalı.',
  'New password must be different from current password': 'Yeni şifre mevcut şifreden farklı olmalı.',
  'Password changed successfully': 'Şifre başarıyla güncellendi.',
  'Email already exists': 'Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.',
  'Email is already in use': 'Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.',
  'Personnel number already exists': 'Bu personel numarasıyla kayıtlı bir çalışan zaten var.',
  'Personnel number is already in use': 'Bu personel numarasıyla kayıtlı bir çalışan zaten var.',
  'Employee not found': 'Çalışan bulunamadı.',
  'User not found for employee': 'Çalışana bağlı kullanıcı hesabı bulunamadı.',
  'Cannot change own role': 'Kendi rolünüzü değiştiremezsiniz.',
  'You cannot change your own role': 'Kendi rolünüzü değiştiremezsiniz.',
  'Cannot deactivate own account': 'Kendi hesabınızı pasif hâle getiremezsiniz.',
  'At least one active admin must remain': 'Sistemde en az bir aktif admin kalmalı.',
  'Role must be ADMIN or EMPLOYEE': 'Rol sadece Admin veya Çalışan olabilir.',
  'Invalid role': 'Rol sadece Admin veya Çalışan olabilir.',
  'Feedback category already exists': 'Bu geribildirim kategorisi zaten mevcut.',
  'Feedback category not found': 'Geribildirim kategorisi bulunamadı.',
  'Active feedback category not found': 'Aktif geribildirim kategorisi bulunamadı.',
  'Only users with an employee profile can send feedback':
    'Yalnızca çalışan profili olan kullanıcılar geribildirim gönderebilir.',
  'Only users with an employee profile can view feedback':
    'Yalnızca çalışan profili olan kullanıcılar geribildirimlerini görüntüleyebilir.',
  'Feedback not found': 'Geribildirim bulunamadı.',
  'Invalid feedback status': 'Geçersiz geribildirim durumu.',
  'Feedback contains forbidden content': 'Geribildirim yasaklı/uygunsuz ifade içeriyor.',
  'Invalid menu item type': 'Geçersiz yemek türü.',
  'Menu plan not found': 'Menü planı bulunamadı.',
  'Daily menu date must be inside menu plan date range':
    'Günlük menü tarihi, menü planının tarih aralığı içinde olmalı.',
  'Daily menu already exists for this date': 'Bu tarih için günlük menü zaten oluşturulmuş.',
  'Daily menu not found': 'Günlük menü bulunamadı.',
  'Daily menu must include at least one item': 'Günlük menüde en az bir yemek bulunmalı.',
  'Menu item not found': 'Yemek kaydı bulunamadı.',
  'Menu item deleted successfully': 'Yemek kaydı başarıyla silindi.',
  'End date cannot be earlier than start date': 'Bitiş tarihi başlangıç tarihinden önce olamaz.',
  'Invalid attendance correction status': 'Geçersiz devam düzeltme durumu.',
  'Attendance correction request not found': 'Devam düzeltme talebi bulunamadı.',
  'Employee profile not found': 'Çalışan profili bulunamadı.',
  'Invalid leave type': 'Geçersiz izin türü.',
  'Invalid leave status': 'Geçersiz izin durumu.',
  'Leave request not found': 'İzin talebi bulunamadı.',
  'Leave request overlaps with an existing leave request':
    'Bu tarih aralığında bekleyen veya onaylanmış başka bir izin talebi var.',
  'Shift name is already in use': 'Bu vardiya adı zaten kullanılıyor.',
  'Shift not found': 'Vardiya bulunamadı.',
  'Inactive shift cannot be assigned': 'Pasif durumdaki vardiya çalışana atanamaz.',
  'Total days must be greater than 0': 'İzin gün sayısı 0’dan büyük olmalı.',
  'Route name is required': 'Rota adı zorunludur.',
  'Driver phone number must be 11 digits and start with 0':
    'Şoför telefonu 0 ile başlayan 11 haneli bir numara olmalı.',
  'Stop name is required': 'Durak adı zorunludur.',
  'Stop orders must be unique for the route': 'Durak sıraları aynı rota içinde benzersiz olmalı.',
  'Shuttle route not found': 'Servis rotası bulunamadı.',
  'Shuttle stop not found': 'Servis durağı bulunamadı.',
  'Stop order already exists for this route': 'Bu rota için aynı durak sırası zaten mevcut.',
  'Shuttle route deleted successfully': 'Servis rotası başarıyla silindi.',
  'Shuttle stop deleted successfully': 'Servis durağı başarıyla silindi.',
}

const FIELD_LABELS = {
  email: 'E-posta',
  password: 'Şifre',
  current_password: 'Mevcut şifre',
  new_password: 'Yeni şifre',
  personnel_no: 'Personel numarası',
  first_name: 'Ad',
  last_name: 'Soyad',
  department: 'Departman',
  position: 'Pozisyon',
  phone: 'Telefon',
  category_id: 'Kategori',
  message: 'Mesaj',
  is_anonymous: 'Anonim gönderim',
  role: 'Rol',
  status: 'Durum',
  leave_type: 'İzin türü',
  start_date: 'Başlangıç tarihi',
  end_date: 'Bitiş tarihi',
  total_days: 'Toplam gün',
  reason: 'Açıklama',
  review_note: 'İnceleme notu',
  requested_event_type: 'Talep edilen işlem',
  requested_time: 'Talep edilen saat',
  name: 'Ad',
  start_time: 'Başlangıç saati',
  end_time: 'Bitiş saati',
  description: 'Açıklama',
  shift_id: 'Vardiya',
  admin_note: 'Admin notu',
}

const VALIDATION_TRANSLATIONS = [
  {
    includes: 'value is not a valid email address',
    message: 'geçerli bir e-posta adresi olmalı.',
  },
  {
    includes: 'Field required',
    message: 'zorunlu bir alandır.',
  },
  {
    includes: 'Input should be a valid string',
    message: 'metin formatında olmalı.',
  },
  {
    includes: 'Input should be a valid integer',
    message: 'sayısal bir değer olmalı.',
  },
  {
    includes: 'Password must be at least 7 characters long',
    message: 'en az 7 karakter olmalı.',
  },
  {
    includes: 'Password must contain at least one uppercase letter',
    message: 'en az bir büyük harf içermeli.',
  },
  {
    includes: 'Password must contain at least one lowercase letter',
    message: 'en az bir küçük harf içermeli.',
  },
  {
    includes: 'Password must contain at least one number',
    message: 'en az bir rakam içermeli.',
  },
  {
    includes: 'Password must contain at least one special character',
    message: 'en az bir özel karakter içermeli.',
  },
  {
    includes: 'Phone number must be 11 digits and start with 0',
    message: '11 haneli olmalı ve 0 ile başlamalı.',
  },
]

function translateText(message) {
  if (!message) return null

  if (typeof message !== 'string') {
    return null
  }

  if (ERROR_TRANSLATIONS[message]) {
    return ERROR_TRANSLATIONS[message]
  }

  const matchedValidation = VALIDATION_TRANSLATIONS.find((translation) =>
    message.includes(translation.includes),
  )

  return matchedValidation?.message ?? message
}

function getFieldLabel(location = []) {
  const fieldName = location[location.length - 1]
  return FIELD_LABELS[fieldName] ?? fieldName ?? 'Alan'
}

function translateValidationErrors(detail) {
  return detail
    .map((error) => {
      const fieldLabel = getFieldLabel(error.loc)
      const translatedMessage = translateText(error.msg)
      return `${fieldLabel}: ${translatedMessage}`
    })
    .join(' ')
}

export function getErrorMessage(error, fallbackMessage = 'İşlem sırasında bir hata oluştu.') {
  const detail = error?.response?.data?.detail
  const statusCode = error?.response?.status

  if (Array.isArray(detail)) {
    return translateValidationErrors(detail)
  }

  if (typeof detail === 'string') {
    return translateText(detail) ?? fallbackMessage
  }

  if (statusCode === 401) {
    return 'Oturum süresi dolmuş olabilir. Lütfen tekrar giriş yapın.'
  }

  if (statusCode === 403) {
    return 'Bu işlem için yetkiniz bulunmuyor.'
  }

  if (statusCode === 404) {
    return 'İstenen kayıt bulunamadı.'
  }

  return fallbackMessage
}
