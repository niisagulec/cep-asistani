import { useState, useMemo } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getApiErrorMessage } from '../services/api';
import { changePassword } from '../services/mobileService';
import { useTheme } from '../context/ThemeContext';
import * as Notifications from 'expo-notifications';

function getInitials(firstName, lastName, email) {
  if (firstName || lastName) {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toLocaleUpperCase('tr-TR');
  }

  if (!email) {
    return '?';
  }

  return email.slice(0, 2).toLocaleUpperCase('tr-TR');
}

function formatRole(role) {
  if (role === 'ADMIN') {
    return 'Admin';
  }

  if (role === 'EMPLOYEE') {
    return 'Çalışan';
  }

  return role || 'Bilinmiyor';
}

export function ProfileScreen({ currentUser, onLogout }) {
  const { colors, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const email = currentUser?.email || 'E-posta bilgisi yok';
  const role = formatRole(currentUser?.role);
  const isActive = currentUser?.is_active;
  const mustChangePassword = currentUser?.must_change_password;
  const fullName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ');
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  async function triggerTestNotification() {
    console.log('[TEST NOTIFICATION] Butona basıldı, bildirim planlanıyor...');
    try {
      const result = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Cep Asistanı Test Bildirimi 🔔',
          body: 'Harika! Telefon kilitliyken bildirim bannerı başarıyla düşüyor.',
          sound: true,
        },
        trigger: {
          type: 'timeInterval',
          seconds: 3,
        },
      });
      console.log('[TEST NOTIFICATION] Planlama başarılı! ID:', result);
    } catch (e) {
      console.error('[TEST NOTIFICATION] Planlama hatası:', e.message || e);
    }
  }

  const formattedCreatedAt = currentUser?.created_at
    ? new Intl.DateTimeFormat('tr-TR').format(new Date(currentUser.created_at))
    : 'Belirtilmedi';

  async function handleChangePassword() {
    setPasswordError('');
    setPasswordNotice('');
    setIsSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordNotice('Şifren başarıyla güncellendi.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      setPasswordError(getApiErrorMessage(error));
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageEyebrow}>PROFİL</Text>
        <Text style={styles.pageTitle}>Hesabım</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(currentUser?.first_name, currentUser?.last_name, email)}
            </Text>
          </View>

          <Text style={styles.profileName}>{fullName || email}</Text>
          <Text style={styles.profileSubtitle}>
            {[currentUser?.position, currentUser?.department].filter(Boolean).join(' · ') || role}
          </Text>

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>E-posta</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Personel numarası</Text>
              <Text style={styles.infoValue}>{currentUser?.personnel_no || 'Belirtilmedi'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Departman</Text>
              <Text style={styles.infoValue}>{currentUser?.department || 'Belirtilmedi'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pozisyon</Text>
              <Text style={styles.infoValue}>{currentUser?.position || 'Belirtilmedi'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>İşe giriş / kayıt tarihi</Text>
              <Text style={styles.infoValue}>{formattedCreatedAt}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vardiya</Text>
              <Text style={styles.infoValue}>{currentUser?.shift_name || 'Atanmadı'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Hesap durumu</Text>
              <Text style={[styles.infoValue, isActive ? styles.successText : styles.dangerText]}>
                {isActive ? 'Aktif' : 'Pasif'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Şifre durumu</Text>
              <Text style={styles.infoValue}>
                {mustChangePassword ? 'İlk girişte değiştirme gerekiyor' : 'Güncel'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.themeSelectorContainer}>
          <Text style={styles.themeLabel}>Görünüm Tercihi</Text>
          <View style={styles.themeChips}>
            {['system', 'light', 'dark'].map((mode) => (
              <TouchableOpacity
                key={mode}
                activeOpacity={0.8}
                style={[
                  styles.themeChip,
                  themeMode === mode && styles.activeThemeChip,
                ]}
                onPress={() => setThemeMode(mode)}
              >
                <Text
                  style={[
                    styles.themeChipText,
                    themeMode === mode && styles.activeThemeChipText,
                  ]}
                >
                  {mode === 'system' ? 'Otomatik' : mode === 'light' ? 'Açık' : 'Koyu'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.82}
          style={styles.testNotificationButton}
          onPress={triggerTestNotification}
        >
          <Text style={styles.testNotificationButtonText}>Kilit Ekranı Test Bildirimi Gönder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.82}
          style={styles.primaryButton}
          onPress={() => setPasswordModalVisible(true)}
        >
          <Text style={styles.primaryButtonText}>Şifre değiştir</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.82} style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>Çıkış yap</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şifreni değiştir</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Mevcut şifre</Text>
            <TextInput
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              style={styles.input}
            />
            <Text style={styles.inputLabel}>Yeni şifre</Text>
            <TextInput
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Abc123!"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <Text style={styles.passwordHint}>
              En az 7 karakter; büyük harf, küçük harf, rakam ve sembol içermeli.
            </Text>
            {!!passwordError && <Text style={styles.modalError}>{passwordError}</Text>}
            {!!passwordNotice && <Text style={styles.modalNotice}>{passwordNotice}</Text>}
            <TouchableOpacity
              disabled={isSavingPassword || !currentPassword || !newPassword}
              style={[
                styles.primaryButton,
                (isSavingPassword || !currentPassword || !newPassword) && styles.disabledButton,
              ]}
              onPress={handleChangePassword}
            >
              <Text style={styles.primaryButtonText}>
                {isSavingPassword ? 'Güncelleniyor...' : 'Şifreyi güncelle'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 24,
  },
  pageEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 5,
    marginBottom: 10,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 31,
    fontWeight: '900',
    marginBottom: 18,
  },
  profileCard: {
    padding: 22,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  profileName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  profileSubtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 18,
  },
  infoList: {
    alignSelf: 'stretch',
    gap: 10,
  },
  infoRow: {
    padding: 15,
    borderRadius: 18,
    backgroundColor: colors.softBlue,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  infoValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  successText: {
    color: '#047857',
  },
  dangerText: {
    color: colors.danger,
  },
  primaryButton: {
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  logoutButton: {
    height: 56,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  modalCard: {
    padding: 22,
    paddingBottom: 34,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  closeText: {
    color: colors.muted,
    fontSize: 21,
    fontWeight: '900',
  },
  inputLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 7,
  },
  input: {
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  passwordHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 14,
  },
  modalError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalNotice: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  themeSelectorContainer: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  themeLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 12,
  },
  themeChips: {
    flexDirection: 'row',
    gap: 8,
  },
  themeChip: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeThemeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  activeThemeChipText: {
    color: '#FFFFFF',
  },
  testNotificationButton: {
    height: 56,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  testNotificationButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
});
