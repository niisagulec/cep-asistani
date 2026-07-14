import axios from 'axios';

import { API_BASE_URL } from '../config/apiConfig';
import { getAccessToken } from './tokenStorage';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const errorMessages = {
  'Invalid email or password': 'E-posta veya şifre hatalı.',
  'User account is inactive': 'Kullanıcı hesabı pasif durumda.',
  'Current password is incorrect': 'Mevcut şifre hatalı.',
  'New password must be different from current password':
    'Yeni şifre mevcut şifreden farklı olmalı.',
  'Only new feedback can be cancelled':
    'Yalnızca henüz incelemeye alınmamış geri bildirimler geri çekilebilir.',
  'Feedback not found': 'Geri bildirim bulunamadı.',
  'Employee profile not found': 'Çalışan profilin bulunamadı.',
  'Invalid attendance QR code': 'Bu QR kodu Cep Asistanı giriş kodu değil.',
  'Attendance QR was scanned too recently':
    'Yeni bir işlem için en az 60 saniye beklemelisin.',
  'Attendance correction time cannot be in the future':
    'Gelecekteki bir saat için düzeltme talebi oluşturamazsın.',
  'Attendance record not found': 'Düzeltilecek mesai kaydı bulunamadı.',
};

export function getApiErrorMessage(error) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string') {
    return errorMessages[detail] || detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return 'Gönderilen bilgiler beklenen formatta değil.';
  }

  if (error?.code === 'ECONNABORTED') {
    return 'Sunucu yanıt vermedi. Lütfen tekrar dene.';
  }

  if (!error?.response) {
    return 'Backend bağlantısı kurulamadı. API adresini kontrol et.';
  }

  return 'İşlem sırasında bir hata oluştu.';
}
