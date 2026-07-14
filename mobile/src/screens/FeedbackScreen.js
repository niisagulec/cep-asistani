import { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { EmptyState, LoadingState } from '../components/ScreenStates';
import { getApiErrorMessage } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import {
  createFeedback,
  deleteFeedback,
  getFeedbackCategories,
  getMyFeedbacks,
  peekMobileCache,
  analyzeFeedback,
  toggleFeedbackAnonymity,
} from '../services/mobileService';

const statusLabels = { NEW: 'Beklemede', IN_REVIEW: 'İnceleniyor', RESOLVED: 'Çözüldü' };

function formatDate(value) {
  if (!value) return '';

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function FeedbackScreen({ refreshToken = 0, onRefreshComplete }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const cachedCategories = peekMobileCache('feedbackCategories');
  const cachedFeedbacks = peekMobileCache('myFeedbacks');
  const [categories, setCategories] = useState(cachedCategories || []);
  const [feedbacks, setFeedbacks] = useState(cachedFeedbacks || []);
  const [categoryId, setCategoryId] = useState(null);
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(
    cachedCategories === null || cachedFeedbacks === null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [listDeletionId, setListDeletionId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(7);

  // ML/NLP Warning states
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isConfirmingWarning, setIsConfirmingWarning] = useState(false);

  // Anonymity toggle state
  const [togglingAnonymity, setTogglingAnonymity] = useState(false);

  const filteredFeedbacks = useMemo(
    () => feedbacks.filter((feedback) => (
      (statusFilter === 'ALL' || feedback.status === statusFilter)
      && (categoryFilter === 'ALL' || feedback.category_name === categoryFilter)
    )),
    [categoryFilter, feedbacks, statusFilter],
  );
  const visibleFeedbacks = filteredFeedbacks.slice(0, visibleCount);

  function updateFilter(setter, value) {
    setter(value);
    setVisibleCount(7);
  }

  async function loadData(force = false) {
    const [categoryData, feedbackData] = await Promise.all([
      getFeedbackCategories(force),
      getMyFeedbacks(force),
    ]);
    setCategories(categoryData);
    setFeedbacks(feedbackData);
    setCategoryId((current) => current || categoryData[0]?.id || null);
  }

  useEffect(() => {
    loadData(refreshToken > 0)
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => {
        setLoading(false);
        onRefreshComplete?.();
      });
  }, [refreshToken]);

  const handleMessageChange = (val) => {
    setMessage(val);
    if (isConfirmingWarning) {
      setIsConfirmingWarning(false);
      setAnalysisResult(null);
    }
  };

  const handleCategoryChange = (val) => {
    setCategoryId(val);
    if (isConfirmingWarning) {
      setIsConfirmingWarning(false);
      setAnalysisResult(null);
    }
  };

  async function handleSubmit() {
    const trimmedMessage = message.trim();
    if (!categoryId || !trimmedMessage) {
      setError('Kategori seçip mesajını yazmalısın.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      // If user has already reviewed the warning and clicks "Yine de Gönder"
      if (isConfirmingWarning) {
        await createFeedback({
          category_id: categoryId,
          message: trimmedMessage,
          is_anonymous: anonymous,
        });
        setMessage('');
        setAnonymous(false);
        setIsConfirmingWarning(false);
        setAnalysisResult(null);
        setNotice('Geri bildirimin oluşturuldu.');
        await loadData(true);
        setFormOpen(false);
        return;
      }

      // First call the analyze endpoint
      const analysis = await analyzeFeedback({
        category_id: categoryId,
        message: trimmedMessage,
      });

      if (analysis.action === 'ACCEPT') {
        // If accepted immediately, submit
        await createFeedback({
          category_id: categoryId,
          message: trimmedMessage,
          is_anonymous: anonymous,
        });
        setMessage('');
        setAnonymous(false);
        setNotice('Geri bildirimin oluşturuldu.');
        await loadData(true);
        setFormOpen(false);
      } else {
        // If low confidence/mismatch/spam warn user
        setAnalysisResult(analysis);
        setIsConfirmingWarning(true);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteFeedback(feedback = selectedFeedback) {
    if (!feedback) return;

    setDeleting(true);
    setDeleteError('');
    try {
      await deleteFeedback(feedback.id);
      if (selectedFeedback?.id === feedback.id) {
        setSelectedFeedback(null);
      }
      setShowDeleteConfirmation(false);
      setListDeletionId(null);
      setNotice('Geri bildirim silindi.');
      await loadData();
    } catch (requestError) {
      setDeleteError(getApiErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleAnonymity() {
    if (!selectedFeedback) return;
    setTogglingAnonymity(true);
    setDeleteError('');
    try {
      const updated = await toggleFeedbackAnonymity(selectedFeedback.id);
      setSelectedFeedback(updated);
      setNotice(updated.is_anonymous ? 'Geri bildirim anonim yapıldı.' : 'Geri bildirim isimli yapıldı.');
      await loadData();
    } catch (requestError) {
      setDeleteError(getApiErrorMessage(requestError));
    } finally {
      setTogglingAnonymity(false);
    }
  }

  if (loading) return <LoadingState text="Geri bildirimler yükleniyor..." />;

  if (selectedFeedback) {
    const isPending = selectedFeedback.status === 'NEW';

    return (
      <View style={styles.detailScreen}>
        <TouchableOpacity
          activeOpacity={0.78}
          style={styles.inlineBackButton}
          onPress={() => {
            setSelectedFeedback(null);
            setListDeletionId(null);
            setDeleteError('');
            setNotice('');
          }}
        >
          <Text style={styles.inlineBackText}>← Listeye Dön</Text>
        </TouchableOpacity>

        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeading}>
              <Text style={styles.detailEyebrow}>GERİ BİLDİRİM DETAYI</Text>
              <Text style={styles.detailTitle}>{selectedFeedback.category_name}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {statusLabels[selectedFeedback.status] || selectedFeedback.status}
              </Text>
            </View>
          </View>

          <View style={styles.detailMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.detailLabel}>Tarih</Text>
              <Text style={styles.metaValue}>{formatDate(selectedFeedback.created_at)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.detailLabel}>Tür</Text>
              <View style={styles.anonymityRow}>
                <Text style={styles.metaValueInline}>
                  {selectedFeedback.is_anonymous ? 'Anonim' : 'İsimli'}
                </Text>
                {isPending && (
                  <TouchableOpacity
                    disabled={togglingAnonymity}
                    activeOpacity={0.7}
                    style={styles.toggleBadge}
                    onPress={handleToggleAnonymity}
                  >
                    <Text style={styles.toggleBadgeText}>
                      {togglingAnonymity ? '...' : (selectedFeedback.is_anonymous ? 'İsimli Yap' : 'Anonim Yap')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={styles.messageBox}>
            <Text style={styles.detailLabel}>İletilen Mesaj</Text>
            <Text style={styles.detailMessage}>{selectedFeedback.message}</Text>
          </View>

          {selectedFeedback.reviewed_by_name && (
            <View style={styles.reviewerBox}>
              <Text style={styles.detailLabel}>İnceleyen Yetkili</Text>
              <Text style={styles.reviewerName}>{selectedFeedback.reviewed_by_name}</Text>
            </View>
          )}

          {selectedFeedback.review_note && (
            <View style={styles.noteBox}>
              <Text style={[styles.detailLabel, { color: '#047857' }]}>Yetkili Yanıtı</Text>
              <Text style={[styles.detailMessage, { color: '#065F46' }]}>
                {selectedFeedback.review_note}
              </Text>
            </View>
          )}

          {deleteError ? <Text style={[styles.error, { marginTop: 15 }]}>{deleteError}</Text> : null}
          {notice ? <Text style={[styles.notice, { marginTop: 15 }]}>{notice}</Text> : null}

          {isPending && !showDeleteConfirmation && (
            <TouchableOpacity
              activeOpacity={0.82}
              style={styles.cancelButton}
              onPress={() => setShowDeleteConfirmation(true)}
            >
              <Text style={styles.cancelButtonText}>Geri bildirimi sil</Text>
            </TouchableOpacity>
          )}

          {showDeleteConfirmation && (
            <View style={styles.cancelConfirmation}>
              <Text style={styles.confirmTitle}>Geri bildirimi silmek istiyor musun?</Text>
              <Text style={styles.confirmText}>
                Bu kayıt mobil listenden gizlenecektir ancak veritabanında arşiv olarak saklanmaya devam edecektir.
              </Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={styles.keepButton}
                  onPress={() => setShowDeleteConfirmation(false)}
                >
                  <Text style={styles.keepButtonText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={deleting}
                  style={[styles.confirmCancelButton, deleting && styles.disabled]}
                  onPress={() => handleDeleteFeedback()}
                >
                  <Text style={styles.confirmCancelText}>
                    {deleting ? 'Siliniyor...' : 'Evet, sil'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={() => {
          setError('');
          setNotice('');
          setFormOpen(true);
        }}
        style={styles.formLauncher}
      >
        <View style={styles.launcherTextArea}>
          <Text style={styles.launcherTitle}>Yeni geri bildirim oluştur</Text>
          <Text style={styles.launcherDescription}>Önerini, talebini veya yaşadığın sorunu ilet.</Text>
        </View>
        <Text style={styles.launcherArrow}>›</Text>
      </TouchableOpacity>

      {!!notice && <Text style={styles.noticeBox}>{notice}</Text>}

      <Modal animationType="fade" onRequestClose={() => setFormOpen(false)} transparent visible={formOpen}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.launcherTextArea}>
                <Text style={styles.formTitle}>Yeni geri bildirim</Text>
                <Text style={styles.formDescription}>Kategori seçip mesajını yaz.</Text>
              </View>
              <TouchableOpacity onPress={() => setFormOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.categoryList}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.chip, categoryId === category.id && styles.activeChip]}
              onPress={() => handleCategoryChange(category.id)}
            >
              <Text style={[styles.chipText, categoryId === category.id && styles.activeChipText]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Mesaj</Text>
        <TextInput
          multiline
          maxLength={1000}
          value={message}
          onChangeText={handleMessageChange}
          placeholder="Önerini veya yaşadığın sorunu yaz..."
          placeholderTextColor="#94A3B8"
          style={styles.textArea}
        />
        <Text style={styles.counter}>{message.length}/1000</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Anonim gönder</Text>
          <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: colors.primary }} />
        </View>

        {/* Dynamic Warning Alert Card */}
        {isConfirmingWarning && analysisResult && (
          <View style={styles.warningContainer}>
            <View style={styles.warningHeaderRow}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningTitle}>Mesaj kontrolü önerisi</Text>
            </View>
            <Text style={styles.warningMessage}>{analysisResult.user_message}</Text>
            {analysisResult.suggested_category_name && (
              <Text style={styles.warningDetail}>
                Önerilen kategori: <Text style={styles.boldText}>{analysisResult.suggested_category_name}</Text>
              </Text>
            )}
            {analysisResult.suggested_detail && (
              <Text style={styles.warningDetail}>
                Önerilen detay: <Text style={styles.boldText}>{analysisResult.suggested_detail}</Text>
                {analysisResult.detail_confidence != null && (
                  <Text> · Güven: %{Math.round(analysisResult.detail_confidence * 100)}</Text>
                )}
              </Text>
            )}
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
        {isConfirmingWarning ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.cancelWarningButton}
              onPress={() => {
                setIsConfirmingWarning(false);
                setAnalysisResult(null);
              }}
            >
              <Text style={styles.cancelWarningText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={submitting}
              style={[styles.confirmSendButton, submitting && styles.disabled]}
              onPress={handleSubmit}
            >
              <Text style={styles.confirmSendText}>
                {submitting ? 'Gönderiliyor...' : 'Yine de gönder'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            disabled={submitting}
            style={[styles.button, submitting && styles.disabled]}
            onPress={handleSubmit}
          >
            <Text style={styles.buttonText}>{submitting ? 'Gönderiliyor...' : 'Geri bildirim gönder'}</Text>
          </TouchableOpacity>
        )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Text style={styles.sectionTitle}>Gönderdiklerim</Text>

      <View style={styles.filterRow}>
        {[
          ['ALL', 'Tümü'],
          ['NEW', 'Beklemede'],
          ['IN_REVIEW', 'İnceleniyor'],
          ['RESOLVED', 'Çözüldü'],
        ].map(([value, label]) => (
          <TouchableOpacity
            key={value}
            onPress={() => updateFilter(setStatusFilter, value)}
            style={[styles.filterButton, statusFilter === value && styles.activeFilterButton]}
          >
            <Text style={[styles.filterButtonText, statusFilter === value && styles.activeFilterButtonText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFilters}>
        <TouchableOpacity
          onPress={() => updateFilter(setCategoryFilter, 'ALL')}
          style={[styles.categoryFilter, categoryFilter === 'ALL' && styles.activeCategoryFilter]}
        >
          <Text style={[styles.categoryFilterText, categoryFilter === 'ALL' && styles.activeCategoryFilterText]}>Tüm kategoriler</Text>
        </TouchableOpacity>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            onPress={() => updateFilter(setCategoryFilter, category.name)}
            style={[styles.categoryFilter, categoryFilter === category.name && styles.activeCategoryFilter]}
          >
            <Text style={[styles.categoryFilterText, categoryFilter === category.name && styles.activeCategoryFilterText]}>{category.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!filteredFeedbacks.length ? (
        <EmptyState title="Henüz kayıt yok" text="Gönderdiğin geri bildirimler burada görünecek." />
      ) : (
        visibleFeedbacks.map((feedback) => (
          <View key={feedback.id} style={styles.feedbackCard}>
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => {
                setSelectedFeedback(feedback);
                setDeleteError('');
                setNotice('');
              }}
            >
              <View style={styles.feedbackHeader}>
                <View style={styles.cardHeading}>
                  <Text style={styles.categoryName}>{feedback.category_name}</Text>
                  <Text style={styles.cardDate}>{formatDate(feedback.created_at)}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {statusLabels[feedback.status] || feedback.status}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={2} style={styles.feedbackExcerpt}>
                {feedback.message}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {visibleCount < filteredFeedbacks.length ? (
        <TouchableOpacity onPress={() => setVisibleCount((count) => count + 7)} style={styles.loadMoreButton}>
          <Text style={styles.loadMoreButtonText}>Daha fazla göster</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  wrapper: { gap: 14 },
  formLauncher: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, backgroundColor: colors.softBlue, borderWidth: 1, borderColor: colors.primary },
  launcherTextArea: { flex: 1 },
  launcherTitle: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  launcherDescription: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  launcherArrow: { color: colors.primary, fontSize: 30, fontWeight: '700' },
  noticeBox: { padding: 13, borderRadius: 16, backgroundColor: '#ECFDF5', color: '#047857', fontSize: 13, fontWeight: '800' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  modalCard: { width: '100%', maxWidth: 430, maxHeight: '86%', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 20, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  closeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.background },
  closeButtonText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  formTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  formDescription: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  form: { paddingBottom: 10 },
  label: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 8, marginTop: 4 },
  categoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  activeChipText: { color: '#FFFFFF' },
  textArea: {
    minHeight: 120,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 8,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  switchLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  button: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  notice: { color: '#047857', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 14, marginBottom: 2 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: { width: '48%', flexGrow: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  activeFilterButton: { backgroundColor: colors.softBlue, borderColor: colors.primary },
  filterButtonText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  activeFilterButtonText: { color: colors.primary },
  categoryFilters: { gap: 8, paddingRight: 10 },
  categoryFilter: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  activeCategoryFilter: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryFilterText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  activeCategoryFilterText: { color: '#FFFFFF' },
  feedbackCard: {
    padding: 17,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardHeading: { flex: 1 },
  categoryName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  cardDate: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
    backgroundColor: colors.softBlue,
  },
  badgeText: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  feedbackExcerpt: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 10,
  },
  loadMoreButton: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  loadMoreButtonText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  detailScreen: { gap: 14 },
  inlineBackButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: colors.softBlue,
  },
  inlineBackText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  detailCard: {
    padding: 20,
    borderRadius: 25,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 15,
    marginBottom: 16,
  },
  detailHeading: { flex: 1 },
  detailEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  detailTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 6 },
  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: colors.softBlue,
  },
  statusBadgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: '900' },
  detailMeta: { flexDirection: 'row', gap: 10 },
  metaItem: { flex: 1, padding: 13, borderRadius: 16, backgroundColor: colors.background },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 6 },
  metaValueInline: { color: colors.text, fontSize: 13, fontWeight: '800' },
  anonymityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  toggleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  messageBox: { padding: 15, borderRadius: 18, backgroundColor: colors.background, marginTop: 15 },
  reviewerBox: { padding: 15, borderRadius: 18, backgroundColor: colors.softBlue, marginTop: 12 },
  reviewerName: { color: colors.primaryDark, fontSize: 14, fontWeight: '900', marginTop: 6 },
  noteBox: { padding: 15, borderRadius: 18, backgroundColor: '#ECFDF5', marginTop: 15 },
  detailMessage: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 21, marginTop: 7 },
  cancelButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    marginTop: 20,
  },
  cancelButtonText: { color: colors.danger, fontSize: 15, fontWeight: '900' },
  cancelConfirmation: {
    padding: 16,
    borderRadius: 19,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginTop: 18,
  },
  confirmTitle: { color: '#9A3412', fontSize: 15, fontWeight: '900' },
  confirmText: { color: '#9A3412', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 6 },
  confirmActions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  keepButton: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.card,
  },
  keepButtonText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  confirmCancelButton: {
    flex: 1.4,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.danger,
  },
  confirmCancelText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

  // New ML/NLP Warning layout styles
  warningContainer: {
    backgroundColor: isDark ? '#1C1917' : '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  warningIcon: {
    fontSize: 16,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#D97706',
  },
  warningMessage: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  warningDetail: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginTop: 2,
  },
  boldText: {
    fontWeight: '900',
    color: colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelWarningButton: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  cancelWarningText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  confirmSendButton: {
    flex: 1.6,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
