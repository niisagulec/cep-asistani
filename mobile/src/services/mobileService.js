import { api } from './api';

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();
const pendingRequests = new Map();

function readCache(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.savedAt > CACHE_TTL) {
    return null;
  }
  return entry.data;
}

async function getCached(key, request, force = false) {
  if (!force) {
    const cachedData = readCache(key);
    if (cachedData !== null) return cachedData;
    if (pendingRequests.has(key)) return pendingRequests.get(key);
  }

  const pendingRequest = request()
    .then((data) => {
      cache.set(key, { data, savedAt: Date.now() });
      return data;
    })
    .finally(() => pendingRequests.delete(key));

  pendingRequests.set(key, pendingRequest);
  return pendingRequest;
}

function requestData(path) {
  return api.get(path).then((response) => response.data);
}

export function peekMobileCache(key) {
  return readCache(key);
}

export function clearMobileCache() {
  cache.clear();
  pendingRequests.clear();
}

export function getTodayMenu(force = false) {
  return getCached('todayMenu', () => requestData('/menus/today'), force);
}

export function getWeeklyMenu(dateFrom = null, force = false) {
  const path = dateFrom ? `/menus/week?date_from=${dateFrom}` : '/menus/week';
  const key = dateFrom ? `weeklyMenu_${dateFrom}` : 'weeklyMenu';
  return getCached(key, () => requestData(path), force);
}

export function getShuttleRoutes(force = false) {
  return getCached('shuttleRoutes', () => requestData('/shuttle-routes'), force);
}

export function getFeedbackCategories(force = false) {
  return getCached(
    'feedbackCategories',
    () => requestData('/feedback-categories'),
    force,
  );
}

export function getMyFeedbacks(force = false) {
  return getCached('myFeedbacks', () => requestData('/feedbacks/mine'), force);
}

export async function analyzeFeedback(payload) {
  const response = await api.post('/feedbacks/analyze', payload);
  return response.data;
}

export async function createFeedback(payload) {
  const response = await api.post('/feedbacks', payload);
  cache.delete('myFeedbacks');
  return response.data;
}

export async function cancelFeedback(feedbackId) {
  const response = await api.patch(`/feedbacks/${feedbackId}/cancel`);
  cache.delete('myFeedbacks');
  return response.data;
}

export async function deleteFeedback(feedbackId) {
  const response = await api.delete(`/feedbacks/${feedbackId}`);
  cache.delete('myFeedbacks');
  return response.data;
}

export async function toggleFeedbackAnonymity(feedbackId) {
  const response = await api.patch(`/feedbacks/${feedbackId}/anonymity`);
  cache.delete('myFeedbacks');
  return response.data;
}

export function getMyLeaves(force = false) {
  return getCached('myLeaves', () => requestData('/leaves/me'), force);
}

export async function createLeave(payload) {
  const response = await api.post('/leaves', payload);
  cache.delete('myLeaves');
  return response.data;
}

export function getMyAttendanceCorrections(force = false) {
  return getCached(
    'myAttendanceCorrections',
    () => requestData('/attendance-corrections/me'),
    force,
  );
}

export async function createAttendanceCorrection(payload) {
  const response = await api.post('/attendance-corrections', payload);
  cache.delete('myAttendanceCorrections');
  return response.data;
}

export function getMyAttendanceRecords(force = false) {
  return getCached('myAttendanceRecords', () => requestData('/attendance/me'), force);
}

export async function scanAttendanceQr(qrToken) {
  const response = await api.post('/attendance/scan', { qr_token: qrToken });
  cache.delete('myAttendanceRecords');
  return response.data;
}

export async function changePassword(currentPassword, newPassword) {
  const response = await api.patch('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data;
}

export async function prefetchMobileData() {
  await Promise.allSettled([
    getTodayMenu(),
    getWeeklyMenu(),
    getShuttleRoutes(),
    getFeedbackCategories(),
    getMyFeedbacks(),
    getMyLeaves(),
    getMyAttendanceCorrections(),
    getMyAttendanceRecords(),
  ]);
}
