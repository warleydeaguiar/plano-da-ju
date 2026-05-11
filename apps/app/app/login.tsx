import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { T, GRAD, R } from '../lib/theme/tokens';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // Auth listener no _layout vai redirecionar
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao entrar';
      // Mensagem amigável
      if (msg.toLowerCase().includes('invalid login')) {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bgWarm }}>
      <LinearGradient
        colors={GRAD.heroDark}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.gradient}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={s.scroll}
              keyboardShouldPersistTaps="handled"
            >
              <View style={s.heroBlock}>
                <Text style={s.brandEmoji}>💇‍♀️</Text>
                <Text style={s.brand}>Plano da Ju</Text>
                <Text style={s.tagline}>Seu plano capilar personalizado</Text>
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>Entrar na minha conta</Text>
                <Text style={s.cardSub}>
                  Use o e-mail e senha que você criou após a compra.
                </Text>

                <View style={{ gap: 12, marginTop: 18 }}>
                  <TextInput
                    placeholder="Seu e-mail"
                    placeholderTextColor={T.sub}
                    value={email}
                    onChangeText={setEmail}
                    style={s.input}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    editable={!loading}
                  />
                  <TextInput
                    placeholder="Sua senha"
                    placeholderTextColor={T.sub}
                    value={password}
                    onChangeText={setPassword}
                    style={s.input}
                    secureTextEntry
                    autoComplete="password"
                    editable={!loading}
                    onSubmitEditing={handleSubmit}
                  />
                </View>

                {error && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.cta, (!email || !password || loading) && s.ctaOff]}
                  onPress={handleSubmit}
                  disabled={!email || !password || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={s.ctaText}>Entrar →</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      'Recuperar senha',
                      'Entre em contato com o suporte da Juliane para resetar sua senha.',
                    )
                  }
                  style={{ alignItems: 'center', marginTop: 14 }}
                >
                  <Text style={s.forgot}>Esqueci minha senha</Text>
                </TouchableOpacity>
              </View>

              <View style={s.signupBlock}>
                <Text style={s.signupText}>Ainda não tem acesso?</Text>
                <Text style={s.signupCta}>
                  Faça o quiz em julianecost.com
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 24 },

  heroBlock: { alignItems: 'center', paddingVertical: 32 },
  brandEmoji: { fontSize: 56, marginBottom: 12 },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },

  card: {
    backgroundColor: T.surface,
    borderRadius: R.xxl,
    padding: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: T.dark,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 13,
    color: T.sub,
    marginTop: 4,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: R.l,
    padding: 14,
    fontSize: 15,
    color: T.dark,
    backgroundColor: '#FFF',
  },
  errorBox: {
    marginTop: 14,
    backgroundColor: '#FEEAEA',
    borderRadius: R.m,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorText: { fontSize: 13, color: '#C0392B' },
  cta: {
    marginTop: 18,
    backgroundColor: T.accent,
    borderRadius: R.l,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaOff: { backgroundColor: '#E0BFCA' },
  ctaText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  forgot: { color: T.accent, fontSize: 13, fontWeight: '600' },

  signupBlock: { alignItems: 'center', marginTop: 28 },
  signupText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  signupCta: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
});
