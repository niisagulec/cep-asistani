import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '../services/api';
import { changePassword } from '../services/mobileService';
import { getCurrentUser } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

export function ForcePasswordChangeScreen({ onPasswordChanged, onLogout }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validateLocalPassword = (pwd) => {
    if (pwd.length < 7) {
      return 'Şifre en az 7 karakter uzunluğunda olmalıdır.';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Şifre en az bir büyük harf içermelidir.';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Şifre en az bir küçük harf içermelidir.';
    }
    if (!/\d/.test(pwd)) {
      return 'Şifre en az bir rakam içermelidir.';
    }
    if (!/[^A-Za-z0-9]/.test(pwd)) {
      return 'Şifre en az bir özel karakter içermelidir.';
    }
    return null;
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      setErrorMessage('Lütfen tüm alanları doldurun.');
      return;
    }

    const strengthError = validateLocalPassword(newPassword);
    if (strengthError) {
      setErrorMessage(strengthError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Call changePassword service
      await changePassword(currentPassword, newPassword);
      // Fetch updated user profile
      const updatedUser = await getCurrentUser();
      onPasswordChanged(updatedUser);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.outerContainer, { backgroundColor: colors.primary }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardArea}
        >
          <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
            <Text style={styles.logoText}>GÜVENLİK UYARISI</Text>
            <Text style={styles.title}>Şifre yenileme</Text>
            <Text style={styles.subtitle}>
              Hesabınızın güvenliği için ilk girişte varsayılan şifrenizi değiştirmeniz zorunludur.
            </Text>
          </View>

          <View style={[styles.card, { paddingBottom: insets.bottom + 26 }]}>
            <Text style={styles.cardTitle}>Yeni şifre belirleyin</Text>

            {errorMessage ? <Text style={styles.errorBox}>{errorMessage}</Text> : null}

            <Text style={styles.label}>Mevcut Şifre</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setCurrentPassword}
              placeholder="Geçici şifreniz"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
              value={currentPassword}
            />

            <Text style={styles.label}>Yeni Şifre</Text>
            <View style={styles.passwordRow}>
              <TextInput
                autoCapitalize="none"
                onChangeText={setNewPassword}
                placeholder="Yeni şifreniz"
                placeholderTextColor={colors.muted}
                secureTextEntry={!isPasswordVisible}
                style={styles.passwordInput}
                value={newPassword}
              />
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setIsPasswordVisible((current) => !current)}
                style={styles.visibilityButton}
              >
                <Text style={styles.visibilityText}>{isPasswordVisible ? 'Gizle' : 'Göster'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.hintText}>
              Şifreniz en az 7 karakter olmalı, büyük/küçük harf, rakam ve özel karakter içermelidir.
            </Text>

            <TouchableOpacity
              activeOpacity={0.84}
              disabled={isSubmitting}
              onPress={handleUpdatePassword}
              style={[styles.loginButton, isSubmitting && styles.disabledButton]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Şifreyi Güncelle ve Giriş Yap</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onLogout}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutButtonText}>Vazgeç ve Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  keyboardArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hero: {
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  logoText: {
    color: '#93b4cb',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 10,
  },
  subtitle: {
    color: '#E0E8F5',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    opacity: 0.9,
  },
  card: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 28,
    paddingTop: 32,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    color: '#EF4444',
    padding: 14,
    borderRadius: 16,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    height: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    height: 52,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    height: '100%',
    paddingHorizontal: 16,
  },
  visibilityButton: {
    paddingHorizontal: 16,
    height: '100%',
    justifyContent: 'center',
  },
  visibilityText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  hintText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  loginButton: {
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  logoutButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
});
