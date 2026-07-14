import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { EmptyState, LoadingState } from '../components/ScreenStates';
import { useTheme } from '../context/ThemeContext';
import { getApiErrorMessage } from '../services/api';
import {
  createAttendanceCorrection,
  getMyAttendanceCorrections,
  getMyAttendanceRecords,
  peekMobileCache,
  scanAttendanceQr,
} from '../services/mobileService';

const eventLabels = { CHECK_IN: 'Giriş', CHECK_OUT: 'Çıkış' };
const statusLabels = { PENDING: 'Bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi' };

function formatDateInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function formatTimeInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function toIsoDateTime(dateValue, timeValue) {
  const dateMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return null;

  const [, day, month, year] = dateMatch;
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const date = new Date(`${year}-${month}-${day}T12:00:00`);
  if (
    Number.isNaN(date.getTime())
    || date.getDate() !== Number(day)
    || date.getMonth() + 1 !== Number(month)
    || date.getFullYear() !== Number(year)
    || hour > 23
    || minute > 59
  ) return null;

  return `${year}-${month}-${day}T${timeValue}:00`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getDateKey(value) {
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function groupRecordsByDay(records) {
  const groups = new Map();
  records.forEach((record) => {
    const key = getDateKey(record.event_time);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  return Array.from(groups, ([date, dayRecords]) => ({ date, records: dayRecords }));
}

function calculateWorkedMinutes(records) {
  const chronological = records.filter((record) => !record.is_voided).sort(
    (first, second) => new Date(first.event_time) - new Date(second.event_time),
  );
  let checkInTime = null;
  let totalMilliseconds = 0;

  chronological.forEach((record) => {
    if (record.event_type === 'CHECK_IN') {
      checkInTime = new Date(record.event_time);
    } else if (record.event_type === 'CHECK_OUT' && checkInTime) {
      totalMilliseconds += new Date(record.event_time) - checkInTime;
      checkInTime = null;
    }
  });

  return Math.max(0, Math.floor(totalMilliseconds / 60000));
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} sa ${remainingMinutes} dk`;
}

function toCorrectionInputs(value) {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return { date: `${day}.${month}.${year}`, time: `${hour}:${minute}` };
}

export function AttendanceScreen({ refreshToken = 0, onRefreshComplete }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const cachedRecords = peekMobileCache('myAttendanceRecords');
  const cachedCorrections = peekMobileCache('myAttendanceCorrections');
  const [records, setRecords] = useState(cachedRecords || []);
  const [corrections, setCorrections] = useState(cachedCorrections || []);
  const [loading, setLoading] = useState(cachedRecords === null || cachedCorrections === null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingQrToken, setPendingQrToken] = useState(null);
  const [correctionType, setCorrectionType] = useState('CHECK_OUT');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [correctionDate, setCorrectionDate] = useState('');
  const [correctionTime, setCorrectionTime] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionError, setCorrectionError] = useState('');
  const [correctionNotice, setCorrectionNotice] = useState('');
  const [correctionFormOpen, setCorrectionFormOpen] = useState(false);
  const [correctionHistoryOpen, setCorrectionHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('LAST_7_DAYS');
  const [visibleDayCount, setVisibleDayCount] = useState(7);
  const [expandedDays, setExpandedDays] = useState(() => new Set());
  const [permission, requestPermission] = useCameraPermissions();

  const groupedRecords = useMemo(() => groupRecordsByDay(records), [records]);
  const filteredGroupedRecords = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return groupedRecords.filter((group) => {
      const groupDate = new Date(group.records[0]?.event_time);
      if (historyFilter === 'LAST_7_DAYS') return groupDate >= sevenDaysAgo;
      if (historyFilter === 'THIS_MONTH') {
        return groupDate.getMonth() === now.getMonth() && groupDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [groupedRecords, historyFilter]);
  const visibleGroups = filteredGroupedRecords.slice(0, visibleDayCount);
  const todayKey = getDateKey(new Date());
  const latestTodayRecord = records.find(
    (record) => !record.is_voided && getDateKey(record.event_time) === todayKey,
  );
  const nextEventType = latestTodayRecord?.event_type === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN';

  function selectHistoryFilter(value) {
    setHistoryFilter(value);
    setVisibleDayCount(7);
  }

  function toggleDay(date) {
    setExpandedDays((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function loadRecords(force = false) {
    setRecords(await getMyAttendanceRecords(force));
  }

  async function loadCorrections(force = false) {
    setCorrections(await getMyAttendanceCorrections(force));
  }

  useEffect(() => {
    Promise.all([loadRecords(refreshToken > 0), loadCorrections(refreshToken > 0)])
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => {
        setLoading(false);
        onRefreshComplete?.();
      });
  }, [refreshToken]);

  async function openScanner() {
    setError('');
    setNotice('');
    let currentPermission = permission;
    if (!currentPermission?.granted) {
      currentPermission = await requestPermission();
    }
    if (!currentPermission?.granted) {
      setError('QR okutmak için kamera izni vermelisin.');
      return;
    }
    setScanned(false);
    setScannerOpen(true);
  }

  async function submitCorrection() {
    const requestedTime = toIsoDateTime(correctionDate, correctionTime);
    if (!requestedTime || !correctionReason.trim()) {
      setCorrectionError('Tarih, saat ve düzeltme nedeni eksiksiz girilmeli.');
      return;
    }
    if (new Date(requestedTime).getTime() > Date.now()) {
      setCorrectionError('Gelecekteki bir saat için düzeltme talebi oluşturamazsın.');
      return;
    }

    setCorrectionSubmitting(true);
    setCorrectionError('');
    setCorrectionNotice('');
    try {
      await createAttendanceCorrection({
        attendance_record_id: selectedRecordId,
        requested_event_type: correctionType,
        requested_time: requestedTime,
        reason: correctionReason.trim(),
      });
      setCorrectionDate('');
      setCorrectionTime('');
      setCorrectionReason('');
      setSelectedRecordId(null);
      setCorrectionNotice('Mesai düzeltme talebin oluşturuldu.');
      await loadCorrections(true);
    } catch (requestError) {
      setCorrectionError(getApiErrorMessage(requestError));
    } finally {
      setCorrectionSubmitting(false);
    }
  }

  function handleBarcodeScanned({ data }) {
    if (scanned || submitting) return;
    setScanned(true);
    setPendingQrToken(data);
  }

  function cancelPendingScan() {
    setPendingQrToken(null);
    setScanned(false);
  }

  async function submitScan(qrToken) {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await scanAttendanceQr(qrToken);
      setPendingQrToken(null);
      setScannerOpen(false);
      setNotice(`${result.message} · ${formatTime(result.record.event_time)}`);
      await loadRecords(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setScanned(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState text="Mesai kayıtların yükleniyor..." />;

  return (
    <View style={styles.wrapper}>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>SIRADAKİ HAREKET</Text>
        <Text style={styles.statusValue}>{eventLabels[nextEventType]}</Text>
        <Text style={styles.statusText}>
          QR kodunu okuttuktan sonra işlemi onaylaman istenecek.
        </Text>
        <TouchableOpacity
          disabled={submitting}
          onPress={openScanner}
          style={[styles.primaryButton, submitting && styles.disabled]}
        >
          <Text style={styles.primaryButtonText}>QR kodunu okut</Text>
        </TouchableOpacity>
      </View>

      {scannerOpen ? (
        <View style={styles.scannerCard}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>QR kodunu kadraja al</Text>
            <TouchableOpacity onPress={() => setScannerOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            style={styles.camera}
          />
          <Text style={styles.scannerHint}>Yalnızca Cep Asistanı iş yeri QR kodu kabul edilir.</Text>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={cancelPendingScan}
        transparent
        visible={Boolean(pendingQrToken)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Text style={styles.confirmIconText}>✓</Text>
            </View>
            <Text style={styles.confirmTitle}>{eventLabels[nextEventType]} kaydı</Text>
            <Text style={styles.confirmText}>
              {nextEventType === 'CHECK_IN'
                ? 'İş yerine giriş yaptığını onaylıyor musun?'
                : 'İş yerinden çıkış yaptığını onaylıyor musun?'}
            </Text>
            <Text style={styles.confirmHint}>Kayıt saati otomatik olarak eklenecek.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                disabled={submitting}
                onPress={cancelPendingScan}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={submitting}
                onPress={() => submitScan(pendingQrToken)}
                style={[styles.confirmButton, submitting && styles.disabled]}
              >
                <Text style={styles.confirmButtonText}>
                  {submitting ? 'Kaydediliyor...' : 'Evet, onayla'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mesai hareketlerim</Text>
        <TouchableOpacity onPress={() => loadRecords(true)}>
          <Text style={styles.refreshText}>Yenile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {[
          ['LAST_7_DAYS', 'Son 7 gün'],
          ['THIS_MONTH', 'Bu ay'],
          ['ALL', 'Tümü'],
        ].map(([value, label]) => (
          <TouchableOpacity
            key={value}
            onPress={() => selectHistoryFilter(value)}
            style={[styles.filterButton, historyFilter === value && styles.activeFilterButton]}
          >
            <Text style={[styles.filterButtonText, historyFilter === value && styles.activeFilterButtonText]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!filteredGroupedRecords.length ? (
        <EmptyState title="Henüz mesai kaydın yok" text="QR ile oluşturduğun kayıtlar burada listelenecek." />
      ) : visibleGroups.map((group) => {
        const workedMinutes = calculateWorkedMinutes(group.records);
        const latestRecord = group.records.find((record) => !record.is_voided);
        const hasOpenSession = latestRecord?.event_type === 'CHECK_IN';
        const isToday = group.date === todayKey;
        const isExpanded = expandedDays.has(group.date);

        return (
          <View key={group.date} style={styles.dayCard}>
            <TouchableOpacity onPress={() => toggleDay(group.date)} style={styles.dayHeader}>
              <View>
                <Text style={styles.dayDate}>{group.date}</Text>
                <Text style={styles.dayDuration}>Toplam: {formatDuration(workedMinutes)}</Text>
              </View>
              <View style={styles.dayHeaderRight}>
                {hasOpenSession ? (
                  <Text style={isToday ? styles.openBadge : styles.missingBadge}>
                    {isToday ? 'Çıkış bekleniyor' : 'Çıkış eksik'}
                  </Text>
                ) : (
                  <Text style={styles.completedBadge}>Tamamlandı</Text>
                )}
                <Text style={styles.chevron}>{isExpanded ? '⌃' : '⌄'}</Text>
              </View>
            </TouchableOpacity>
            {isExpanded ? (
              <View style={styles.timeline}>
                {[...group.records].reverse().map((record) => (
                  <View key={record.id} style={[styles.recordRow, record.is_voided && styles.voidedRecord]}>
                    <View style={[
                      styles.recordDot,
                      record.event_type === 'CHECK_IN' ? styles.checkInDot : styles.checkOutDot,
                    ]} />
                    <Text style={[styles.recordType, record.is_voided && styles.voidedText]}>
                      {eventLabels[record.event_type]}{record.is_voided ? ' · Düzeltildi' : ''}
                    </Text>
                    <Text style={[styles.recordTime, record.is_voided && styles.voidedText]}>{formatTime(record.event_time)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      {visibleDayCount < filteredGroupedRecords.length ? (
        <TouchableOpacity
          onPress={() => setVisibleDayCount((count) => count + 7)}
          style={styles.loadMoreButton}
        >
          <Text style={styles.loadMoreButtonText}>Daha fazla göster</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity onPress={() => setCorrectionFormOpen(true)} style={styles.correctionLauncher}>
        <View style={styles.launcherTextArea}>
          <Text style={styles.launcherTitle}>Kayıt düzeltme talebi</Text>
          <Text style={styles.launcherDescription}>Unuttuğun veya hatalı oluşan bir hareketi İK'ya bildir.</Text>
        </View>
        <Text style={styles.launcherArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setCorrectionHistoryOpen((value) => !value)} style={styles.historyLauncher}>
        <Text style={styles.historyLauncherText}>Taleplerimi görüntüle</Text>
        <Text style={styles.historyCount}>{corrections.length}</Text>
      </TouchableOpacity>

      {correctionHistoryOpen ? (
        <View style={styles.correctionHistory}>
          {!corrections.length ? (
            <EmptyState title="Henüz düzeltme talebin yok" text="Gönderdiğin talepler burada listelenecek." />
          ) : corrections.map((correction) => (
            <View key={correction.id} style={styles.correctionCard}>
              <View style={styles.correctionHeader}>
                <Text style={styles.correctionType}>
                  {eventLabels[correction.requested_event_type]} düzeltmesi
                </Text>
                <Text style={styles.correctionStatus}>
                  {statusLabels[correction.status] || correction.status}
                </Text>
              </View>
              <Text style={styles.correctionDate}>{formatDateTime(correction.requested_time)}</Text>
              <Text style={styles.correctionReason}>{correction.reason}</Text>
              {!!correction.review_note && (
                <Text style={styles.reviewNote}>İK notu: {correction.review_note}</Text>
              )}
            </View>
          ))}
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setCorrectionFormOpen(false)}
        transparent
        visible={correctionFormOpen}
      >
        <View style={styles.formModalBackdrop}>
          <View style={styles.formModalCard}>
            <View style={styles.formModalHeader}>
              <View style={styles.launcherTextArea}>
                <Text style={styles.correctionTitle}>Mesai düzeltme talebi</Text>
                <Text style={styles.correctionDescription}>Unuttuğun veya hatalı oluşan kaydı İK'ya bildir.</Text>
              </View>
              <TouchableOpacity onPress={() => setCorrectionFormOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.correctionFormContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Ne düzeltilecek?</Text>
              <TouchableOpacity
                onPress={() => setSelectedRecordId(null)}
                style={[styles.recordChoice, selectedRecordId === null && styles.activeRecordChoice]}
              >
                <Text style={[styles.recordChoiceText, selectedRecordId === null && styles.activeRecordChoiceText]}>
                  Unuttuğum giriş/çıkışı ekle
                </Text>
              </TouchableOpacity>
              <View style={styles.recordChoices}>
                {records.filter((record) => !record.is_voided).slice(0, 8).map((record) => (
                  <TouchableOpacity
                    key={record.id}
                    onPress={() => {
                      const inputs = toCorrectionInputs(record.event_time);
                      setSelectedRecordId(record.id);
                      setCorrectionType(record.event_type);
                      setCorrectionDate(inputs.date);
                      setCorrectionTime(inputs.time);
                    }}
                    style={[styles.recordChoice, selectedRecordId === record.id && styles.activeRecordChoice]}
                  >
                    <Text style={[styles.recordChoiceText, selectedRecordId === record.id && styles.activeRecordChoiceText]}>
                      {eventLabels[record.event_type]} · {formatDateTime(record.event_time)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Kayıt türü</Text>
              <View style={styles.typeRow}>
                {Object.entries(eventLabels).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setCorrectionType(value)}
                    style={[styles.typeButton, correctionType === value && styles.activeTypeButton]}
                  >
                    <Text style={[styles.typeButtonText, correctionType === value && styles.activeTypeButtonText]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Olması gereken tarih ve saat</Text>
              <View style={styles.inputRow}>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={10}
                  onChangeText={(value) => setCorrectionDate(formatDateInput(value))}
                  placeholder="13.07.2026"
                  placeholderTextColor="#94A3B8"
                  style={[styles.formInput, styles.inputRowField]}
                  value={correctionDate}
                />
                <TextInput
                  keyboardType="number-pad"
                  maxLength={5}
                  onChangeText={(value) => setCorrectionTime(formatTimeInput(value))}
                  placeholder="17:30"
                  placeholderTextColor="#94A3B8"
                  style={[styles.formInput, styles.inputRowField]}
                  value={correctionTime}
                />
              </View>
              <Text style={styles.inputLabel}>Düzeltme nedeni</Text>
              <TextInput
                multiline
                onChangeText={setCorrectionReason}
                placeholder="Çıkışta QR okutmayı unuttum..."
                placeholderTextColor="#94A3B8"
                style={[styles.formInput, styles.reasonInput]}
                value={correctionReason}
              />
              {!!correctionError && <Text style={styles.error}>{correctionError}</Text>}
              {!!correctionNotice && <Text style={styles.notice}>{correctionNotice}</Text>}
              <TouchableOpacity
                disabled={correctionSubmitting}
                onPress={submitCorrection}
                style={[styles.correctionButton, correctionSubmitting && styles.disabled]}
              >
                <Text style={styles.correctionButtonText}>
                  {correctionSubmitting ? 'Gönderiliyor...' : 'Düzeltme talebi gönder'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  wrapper: { gap: 14 },
  statusCard: { padding: 20, borderRadius: 24, backgroundColor: colors.primary },
  statusLabel: { color: '#DBEAFE', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  statusValue: { color: '#FFFFFF', fontSize: 29, fontWeight: '900', marginTop: 7 },
  statusText: { color: '#DBEAFE', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 5 },
  primaryButton: { height: 52, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 17 },
  primaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  scannerCard: { padding: 14, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  scannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  scannerTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  closeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.background },
  closeButtonText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  camera: { height: 310, borderRadius: 18, overflow: 'hidden' },
  scannerHint: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  error: { padding: 13, borderRadius: 16, backgroundColor: '#FEF2F2', color: colors.danger, fontSize: 13, fontWeight: '800' },
  notice: { padding: 13, borderRadius: 16, backgroundColor: '#ECFDF5', color: '#047857', fontSize: 13, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  refreshText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterButton: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  activeFilterButton: { backgroundColor: colors.softBlue, borderColor: colors.primary },
  filterButtonText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  activeFilterButtonText: { color: colors.primary },
  dayCard: { padding: 17, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayDate: { color: colors.text, fontSize: 16, fontWeight: '900' },
  dayDuration: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 4 },
  openBadge: { color: '#B45309', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, fontSize: 11, fontWeight: '900' },
  missingBadge: { color: '#BE123C', backgroundColor: '#FFE4E6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, fontSize: 11, fontWeight: '900' },
  completedBadge: { color: '#047857', backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, fontSize: 11, fontWeight: '900' },
  chevron: { width: 18, color: colors.muted, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  timeline: { marginTop: 14, gap: 11 },
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  recordDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  checkInDot: { backgroundColor: '#10B981' },
  checkOutDot: { backgroundColor: '#F97316' },
  recordType: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  recordTime: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  voidedRecord: { opacity: 0.55 },
  voidedText: { textDecorationLine: 'line-through' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  confirmCard: { width: '100%', maxWidth: 390, alignItems: 'center', padding: 24, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  confirmIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.softBlue },
  confirmIconText: { color: colors.primary, fontSize: 28, fontWeight: '900' },
  confirmTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 16 },
  confirmText: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 22, textAlign: 'center', marginTop: 9 },
  confirmHint: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 7 },
  confirmActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  cancelButtonText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  confirmButton: { flex: 1.35, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.primary },
  confirmButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  loadMoreButton: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  loadMoreButtonText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  correctionLauncher: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, backgroundColor: colors.softBlue, borderWidth: 1, borderColor: colors.primary },
  launcherTextArea: { flex: 1 },
  launcherTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  launcherDescription: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  launcherArrow: { color: colors.primary, fontSize: 30, fontWeight: '700' },
  historyLauncher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 50, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  historyLauncherText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  historyCount: { minWidth: 28, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', color: colors.primary, backgroundColor: colors.softBlue, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  correctionHistory: { gap: 10 },
  formModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  formModalCard: { width: '100%', maxWidth: 430, maxHeight: '86%', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 20, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  formModalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  correctionFormContent: { paddingBottom: 14 },
  correctionTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  correctionDescription: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 5, marginBottom: 12 },
  inputLabel: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 9, marginBottom: 7 },
  recordChoices: { gap: 7, marginTop: 7 },
  recordChoice: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  activeRecordChoice: { backgroundColor: colors.softBlue, borderColor: colors.primary },
  recordChoiceText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  activeRecordChoiceText: { color: colors.primary },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeButton: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  activeTypeButton: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeButtonText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  activeTypeButtonText: { color: '#FFFFFF' },
  inputRow: { flexDirection: 'row', gap: 8 },
  formInput: { minHeight: 48, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14, fontWeight: '700' },
  inputRowField: { flex: 1 },
  reasonInput: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  correctionButton: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.primary, marginTop: 14 },
  correctionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  correctionCard: { padding: 16, borderRadius: 21, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  correctionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  correctionType: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '900' },
  correctionStatus: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  correctionDate: { color: colors.muted, fontSize: 13, fontWeight: '800', marginTop: 7 },
  correctionReason: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 8 },
  reviewNote: { color: '#047857', fontSize: 13, fontWeight: '800', marginTop: 8 },
});
