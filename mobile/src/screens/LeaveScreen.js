import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { EmptyState, LoadingState } from '../components/ScreenStates';
import { getApiErrorMessage } from '../services/api';
import {
  createLeave,
  getMyLeaves,
  peekMobileCache,
} from '../services/mobileService';
import { useTheme } from '../context/ThemeContext';
import { getInclusiveDayCount, getLocalIsoDate, isMeaningfulText } from '../utils/validation';

const leaveTypes = [
  { value: 'ANNUAL', label: 'Yıllık izin' },
  { value: 'HEALTH', label: 'Hastalık / Rapor' },
  { value: 'EXCUSE', label: 'Mazeret izni' },
  { value: 'UNPAID', label: 'Ücretsiz izin' },
];
const statusLabels = { PENDING: 'Bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi' };

function formatDateInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function toIsoDate(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00`);
  if (
    Number.isNaN(date.getTime())
    || date.getDate() !== Number(day)
    || date.getMonth() + 1 !== Number(month)
    || date.getFullYear() !== Number(year)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

export function LeaveScreen({ currentUser, refreshToken = 0, onRefreshComplete, module }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const cachedLeaves = peekMobileCache('myLeaves');
  const [leaves, setLeaves] = useState(cachedLeaves || []);
  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(cachedLeaves === null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(7);
  const [expandedLeaves, setExpandedLeaves] = useState(() => new Set());
  const [formViewportHeight, setFormViewportHeight] = useState(0);
  const [formContentHeight, setFormContentHeight] = useState(0);
  const formScrollY = useRef(new Animated.Value(0)).current;

  const filteredLeaves = useMemo(
    () => leaves.filter((leave) => statusFilter === 'ALL' || leave.status === statusFilter),
    [leaves, statusFilter],
  );
  const visibleLeaves = filteredLeaves.slice(0, visibleCount);
  const parsedStartDate = toIsoDate(startDate);
  const parsedEndDate = toIsoDate(endDate);
  const calculatedTotalDays = getInclusiveDayCount(parsedStartDate, parsedEndDate);
  const scrollThumbHeight = formContentHeight > formViewportHeight
    ? Math.max((formViewportHeight / formContentHeight) * formViewportHeight, 32)
    : formViewportHeight;
  const scrollThumbOffset = formScrollY.interpolate({
    inputRange: [0, Math.max(formContentHeight - formViewportHeight, 1)],
    outputRange: [0, Math.max(formViewportHeight - scrollThumbHeight, 0)],
    extrapolate: 'clamp',
  });

  function selectStatusFilter(value) {
    setStatusFilter(value);
    setVisibleCount(7);
  }

  function toggleLeave(leaveId) {
    setExpandedLeaves((current) => {
      const next = new Set(current);
      if (next.has(leaveId)) next.delete(leaveId);
      else next.add(leaveId);
      return next;
    });
  }

  async function loadLeaves(force = false) {
    setLeaves(await getMyLeaves(force));
  }

  useEffect(() => {
    loadLeaves(refreshToken > 0)
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => {
        setLoading(false);
        onRefreshComplete?.();
      });
  }, [refreshToken]);

  useEffect(() => {
    if (!loading && module?.targetId && leaves.length > 0) {
      const targetId = Number(module.targetId);
      setExpandedLeaves(new Set([targetId]));
      const index = filteredLeaves.findIndex((l) => l.id === targetId);
      if (index !== -1 && index >= visibleCount) {
        setVisibleCount(index + 1);
      }
    }
  }, [loading, module?.targetId, leaves, filteredLeaves, visibleCount]);

  async function handleSubmit() {
    const isoStartDate = toIsoDate(startDate);
    const isoEndDate = toIsoDate(endDate);
    if (!isoStartDate || !isoEndDate) {
      setError('Tarihleri GG.AA.YYYY biçiminde eksiksiz girmelisin.');
      return;
    }
    if (isoStartDate < getLocalIsoDate()) {
      setError('Geçmiş tarihli izin talebi oluşturamazsın.');
      return;
    }
    if (isoEndDate < isoStartDate) {
      setError('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }
    if (!isMeaningfulText(reason)) {
      setError('İzin nedenini anlamlı ve açıklayıcı bir metin olarak yazmalısın.');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await createLeave({
        leave_type: leaveType,
        start_date: isoStartDate,
        end_date: isoEndDate,
        reason: reason.trim(),
      });
      setStartDate('');
      setEndDate('');
      setReason('');
      setNotice('İzin talebin oluşturuldu.');
      await loadLeaves(true);
      setFormOpen(false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState text="İzin bilgilerin yükleniyor..." />;

  return (
    <View style={styles.wrapper}>
      {!!currentUser?.shift_name && (
        <View style={styles.shiftCard}>
          <Text style={styles.shiftLabel}>AKTİF VARDİYAN</Text>
          <Text style={styles.shiftName}>{currentUser.shift_name}</Text>
        </View>
      )}
      <TouchableOpacity
        onPress={() => {
          setError('');
          setNotice('');
          setFormOpen(true);
        }}
        style={styles.formLauncher}
      >
        <View style={styles.launcherTextArea}>
          <Text style={styles.launcherTitle}>Yeni izin talebi oluştur</Text>
          <Text style={styles.launcherDescription}>İzin türünü ve tarihlerini belirleyerek talebini ilet.</Text>
        </View>
        <Text style={styles.launcherArrow}>›</Text>
      </TouchableOpacity>

      {!!notice && <Text style={styles.noticeBox}>{notice}</Text>}

      <Text style={styles.sectionTitle}>Taleplerim</Text>

      <View style={styles.filterRow}>
        {[
          ['ALL', 'Tümü'],
          ['PENDING', 'Bekleyen'],
          ['APPROVED', 'Onaylanan'],
          ['REJECTED', 'Reddedilen'],
        ].map(([value, label]) => (
          <TouchableOpacity
            key={value}
            onPress={() => selectStatusFilter(value)}
            style={[styles.filterButton, statusFilter === value && styles.activeFilterButton]}
          >
            <Text style={[styles.filterButtonText, statusFilter === value && styles.activeFilterButtonText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!filteredLeaves.length ? (
        <EmptyState title="Henüz izin talebin yok" text="Yeni taleplerin burada listelenecek." />
      ) : visibleLeaves.map((leave) => (
        <View key={leave.id} style={styles.leaveCard}>
          <TouchableOpacity onPress={() => toggleLeave(leave.id)} style={styles.leaveHeader}>
            <View style={styles.leaveHeaderText}>
              <Text style={styles.leaveType}>{leaveTypes.find((item) => item.value === leave.leave_type)?.label || leave.leave_type}</Text>
              <Text style={styles.dates}>
                {formatDisplayDate(leave.start_date)} → {formatDisplayDate(leave.end_date)}
                {' · '}{leave.total_days} gün
              </Text>
            </View>
            <View style={styles.leaveHeaderRight}>
              <Text style={styles.status}>{statusLabels[leave.status] || leave.status}</Text>
              <Text style={styles.chevron}>{expandedLeaves.has(leave.id) ? '⌃' : '⌄'}</Text>
            </View>
          </TouchableOpacity>
          {expandedLeaves.has(leave.id) ? (
            <View style={styles.leaveDetails}>
              {!!leave.reason && <Text style={styles.reasonText}>{leave.reason}</Text>}
              {!leave.reason && <Text style={styles.emptyDetail}>Açıklama eklenmemiş.</Text>}
              {!!leave.review_note && <Text style={styles.reviewNote}>İK notu: {leave.review_note}</Text>}
            </View>
          ) : null}
        </View>
      ))}

      {visibleCount < filteredLeaves.length ? (
        <TouchableOpacity onPress={() => setVisibleCount((count) => count + 7)} style={styles.loadMoreButton}>
          <Text style={styles.loadMoreButtonText}>Daha fazla göster</Text>
        </TouchableOpacity>
      ) : null}

      <Modal animationType="fade" onRequestClose={() => setFormOpen(false)} transparent visible={formOpen}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.launcherTextArea}>
                <Text style={styles.formTitle}>Yeni izin talebi</Text>
                <Text style={styles.formDescription}>Talep bilgilerini eksiksiz doldur.</Text>
              </View>
              <TouchableOpacity onPress={() => setFormOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.formScrollArea} onLayout={(event) => setFormViewportHeight(event.nativeEvent.layout.height)}>
              <Animated.ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                bounces
                scrollEventThrottle={16}
                onContentSizeChange={(_, height) => setFormContentHeight(height)}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: formScrollY } } }],
                  { useNativeDriver: true },
                )}
              >
              <Text style={styles.label}>İzin türü</Text>
              <View style={styles.chips}>
                {leaveTypes.map((type) => (
                  <TouchableOpacity key={type.value} style={[styles.chip, leaveType === type.value && styles.activeChip]} onPress={() => setLeaveType(type.value)}>
                    <Text style={[styles.chipText, leaveType === type.value && styles.activeChipText]}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Tarih aralığı</Text>
              <View style={styles.dateRow}>
                <TextInput value={startDate} onChangeText={(value) => setStartDate(formatDateInput(value))} keyboardType="number-pad" maxLength={10} placeholder="15.07.2026" placeholderTextColor="#94A3B8" style={styles.dateInput} />
                <TextInput value={endDate} onChangeText={(value) => setEndDate(formatDateInput(value))} keyboardType="number-pad" maxLength={10} placeholder="18.07.2026" placeholderTextColor="#94A3B8" style={styles.dateInput} />
              </View>
              {calculatedTotalDays ? (
                <View style={styles.totalDaysPreview}>
                  <Text style={styles.totalDaysLabel}>Toplam izin süresi</Text>
                  <Text style={styles.totalDaysValue}>{calculatedTotalDays} gün</Text>
                </View>
              ) : null}
              <Text style={styles.label}>Açıklama</Text>
              <TextInput value={reason} onChangeText={setReason} multiline placeholder="İzin nedenini kısaca yazabilirsin." placeholderTextColor="#94A3B8" style={[styles.input, styles.reason]} />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity disabled={submitting} style={[styles.button, submitting && styles.disabled]} onPress={handleSubmit}>
                <Text style={styles.buttonText}>{submitting ? 'Oluşturuluyor...' : 'İzin talebi oluştur'}</Text>
              </TouchableOpacity>
              <View style={styles.formBottomSpace} />
              </Animated.ScrollView>
              {formContentHeight > formViewportHeight ? (
                <View pointerEvents="none" style={styles.scrollTrack}>
                  <Animated.View
                    style={[styles.scrollThumb, { height: scrollThumbHeight, transform: [{ translateY: scrollThumbOffset }] }]}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  wrapper: { gap: 14 },
  shiftCard: { padding: 17, borderRadius: 21, backgroundColor: colors.primary },
  shiftLabel: { color: '#DBEAFE', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  shiftName: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginTop: 6 },
  formLauncher: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, backgroundColor: colors.softBlue, borderWidth: 1, borderColor: colors.primary },
  launcherTextArea: { flex: 1 },
  launcherTitle: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  launcherDescription: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  launcherArrow: { color: colors.primary, fontSize: 30, fontWeight: '700' },
  noticeBox: { padding: 13, borderRadius: 16, backgroundColor: '#ECFDF5', color: '#047857', fontSize: 13, fontWeight: '800' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  modalCard: { width: '100%', maxWidth: 430, height: '52%', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 20, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  closeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.background },
  closeButtonText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  formScrollArea: { flex: 1, position: 'relative' },
  formScroll: { flex: 1 },
  formContent: { paddingRight: 10 },
  formBottomSpace: { height: 90 },
  scrollTrack: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 4, borderRadius: 2, backgroundColor: colors.border },
  scrollThumb: { width: 4, borderRadius: 2, backgroundColor: colors.primary },
  formDescription: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  label: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 8, marginTop: 5 },
  formTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 15, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  activeChipText: { color: '#FFFFFF' },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1, height: 48, paddingHorizontal: 11, borderRadius: 15, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, fontWeight: '700' },
  totalDaysPreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, backgroundColor: colors.softBlue, marginTop: 10, marginBottom: 8 },
  totalDaysLabel: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  totalDaysValue: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  input: { height: 48, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, fontWeight: '700', marginBottom: 8 },
  reason: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  button: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.primary,
    marginTop: 12,
  },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  notice: { color: '#047857', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 14,
    marginBottom: 2,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: { width: '48%', flexGrow: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  activeFilterButton: { backgroundColor: colors.softBlue, borderColor: colors.primary },
  filterButtonText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  activeFilterButtonText: { color: colors.primary },
  leaveCard: { padding: 17, borderRadius: 21, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  leaveHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  leaveHeaderText: { flex: 1 },
  leaveHeaderRight: { alignItems: 'flex-end', gap: 6 },
  leaveType: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '900' },
  status: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  dates: { color: colors.muted, fontSize: 13, fontWeight: '800', marginTop: 7 },
  chevron: { width: 20, color: colors.muted, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  leaveDetails: { marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.border },
  reasonText: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 8 },
  emptyDetail: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  reviewNote: { color: '#047857', fontSize: 13, fontWeight: '800', marginTop: 8 },
  loadMoreButton: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  loadMoreButtonText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
});
