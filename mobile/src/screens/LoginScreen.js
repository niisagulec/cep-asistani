import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { getCurrentUser, login } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

export function LoginScreen({ isLoginDisabled = false, onLoginSuccess }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (isLoginDisabled) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setErrorMessage('E-posta ve şifre alanları boş bırakılamaz.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const tokenData = await login(trimmedEmail, password);
      const currentUser = await getCurrentUser();
      onLoginSuccess({ tokenData, currentUser });
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
          <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>CEP ASİSTANI</Text>
            <Text style={styles.title}>Mobil giriş</Text>
            <Text style={styles.subtitle}>
              Şirket içi duyurulara, yemekhaneye ve geri bildirimlere çalışan hesabınla eriş.
            </Text>
          </View>

          <View style={[styles.card, { paddingBottom: insets.bottom + 26 }]}>
            <Text style={styles.cardTitle}>Hesabına giriş yap</Text>

            {errorMessage ? <Text style={styles.errorBox}>{errorMessage}</Text> : null}

            <Text style={styles.label}>E-posta</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="ornek@cepasistani.com"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={email}
            />

            <Text style={styles.label}>Şifre</Text>
            <View style={styles.passwordRow}>
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="Şifren"
                placeholderTextColor={colors.muted}
                secureTextEntry={!isPasswordVisible}
                style={styles.passwordInput}
                value={password}
              />
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setIsPasswordVisible((current) => !current)}
                style={styles.visibilityButton}
              >
                <Text style={styles.visibilityText}>{isPasswordVisible ? 'Gizle' : 'Göster'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isSubmitting || isLoginDisabled}
              onPress={handleLogin}
              style={[
                styles.loginButton,
                isSubmitting || isLoginDisabled ? styles.disabledButton : null,
              ]}
            >
              {isSubmitting || isLoginDisabled ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Giriş Yap</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const getStyles = (colors) => StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  keyboardArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 34,
  },
  logoImage: {
    width: 90,
    height: 90,
    marginBottom: 16,
    borderRadius: 20,
  },
  logoText: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 5,
    marginBottom: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 10,
  },
  subtitle: {
    color: '#DBEAFE',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  card: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 26,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: colors.background,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 18,
  },
  errorBox: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    height: 58,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  passwordRow: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  visibilityButton: {
    paddingHorizontal: 14,
    height: '100%',
    justifyContent: 'center',
  },
  visibilityText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  loginButton: {
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
});
