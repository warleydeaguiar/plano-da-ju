import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth';
import { T, GRAD, SHADOW, R, SP } from '../../lib/theme/tokens';

const HAIR_TYPE_LABEL: Record<string, string> = {
  liso: 'Liso',
  ondulado: 'Ondulado',
  cacheado: 'Cacheado',
  crespo: 'Crespo',
};

const POROSITY_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const CHEMICAL_LABEL: Record<string, string> = {
  virgem: 'Virgem',
  colorida: 'Colorida',
  descolorida: 'Descolorida',
  alisada: 'Alisada',
  permanente: 'Permanente',
};

const SUBSCRIPTION_LABEL: Record<string, string> = {
  annual_card: 'Plano da Ju · Anual (cartão)',
  annual_pix: 'Plano da Ju · Anual (PIX)',
  none: 'Plano da Ju',
};

function formatBrl(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR');
}

export default function PerfilScreen() {
  const { profile, signOut } = useAuth();

  const initial = profile?.full_name?.[0]?.toUpperCase() ?? 'U';
  const hairType = profile?.hair_type
    ? HAIR_TYPE_LABEL[profile.hair_type] ?? profile.hair_type
    : '—';
  const porosity = profile?.porosity
    ? POROSITY_LABEL[profile.porosity] ?? profile.porosity
    : '—';
  const chemical = profile?.chemical_history
    ? CHEMICAL_LABEL[profile.chemical_history] ?? profile.chemical_history
    : '—';
  const mainProblem =
    profile?.main_problems?.[0] ?? 'Não informado';

  const subActive = profile?.subscription_status === 'active';
  const subLabel =
    SUBSCRIPTION_LABEL[profile?.subscription_type ?? 'none'] ?? 'Plano da Ju';

  function confirmSignOut() {
    Alert.alert(
      'Sair da conta?',
      'Você precisará entrar de novo na próxima vez.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => {
            signOut();
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero gradient */}
        <LinearGradient
          colors={GRAD.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <SafeAreaView edges={['top']}>
            <View style={s.heroInner}>
              <View style={s.heroAvatar}>
                <Text style={s.heroAvatarText}>{initial}</Text>
              </View>
              <Text style={s.heroName} numberOfLines={1}>
                {profile?.full_name ?? 'Usuária'}
              </Text>
              <Text style={s.heroEmail} numberOfLines={1}>
                {profile?.email ?? ''}
              </Text>
              {subActive && (
                <View style={s.heroBadge}>
                  <Text style={s.heroBadgeText}>✨ Plano Ativo</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={s.contentArea}>
          {/* Perfil Capilar */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Seu Perfil Capilar</Text>
            <View style={s.hairGrid}>
              {[
                { label: 'Tipo', value: hairType },
                { label: 'Porosidade', value: porosity },
                { label: 'Químicas', value: chemical },
                { label: 'Foco', value: mainProblem },
              ].map((item, i) => (
                <View
                  key={i}
                  style={[
                    s.hairItem,
                    i % 2 === 0 && s.hairItemBorderRight,
                    i < 2 && s.hairItemBorderBottom,
                  ]}
                >
                  <Text style={s.hairLabel}>{item.label}</Text>
                  <Text style={s.hairValue} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Plano / Assinatura */}
          <View style={s.subCard}>
            <View style={s.subTop}>
              <Text style={s.subName}>{subLabel}</Text>
              <View
                style={[
                  s.subActiveBadge,
                  !subActive && { backgroundColor: '#FFF3E0' },
                ]}
              >
                <Text
                  style={[
                    s.subActiveText,
                    !subActive && { color: T.gold },
                  ]}
                >
                  {subActive ? 'Ativo' : 'Pendente'}
                </Text>
              </View>
            </View>
            <Text style={s.subRenewal}>
              Próxima renovação: {formatBrl(profile?.subscription_expires_at ?? null)}
            </Text>
            <Text style={s.subPrice}>
              R$ 34,90 <Text style={s.subPeriod}>/ano</Text>
            </Text>
            <TouchableOpacity
              style={s.subBtn}
              onPress={() =>
                Alert.alert(
                  'Gerenciar assinatura',
                  'Acesse plano.julianecost.com em breve para cancelar ou trocar plano.',
                )
              }
            >
              <Text style={s.subBtnText}>Gerenciar assinatura</Text>
            </TouchableOpacity>
          </View>

          {/* Configurações */}
          <View style={s.settingsGroup}>
            {[
              { icon: '🔔', label: 'Notificações', bg: '#EEF3FF' },
              { icon: '📷', label: 'Privacidade de fotos', bg: '#F3EEFF' },
              { icon: '🎨', label: 'Aparência', bg: '#FFF3DD' },
              { icon: '❓', label: 'Central de ajuda', bg: '#F2F2F7' },
              { icon: '📄', label: 'Termos de uso', bg: '#F2F2F7' },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={i}
                style={[s.settingsRow, i < arr.length - 1 && s.settingsRowBorder]}
                onPress={() =>
                  Alert.alert(
                    item.label,
                    'Em breve disponível nesta versão.',
                  )
                }
              >
                <View style={[s.settingsIconBox, { backgroundColor: item.bg }]}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                </View>
                <Text style={s.settingsLabel}>{item.label}</Text>
                <Text style={s.settingsChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sair */}
          <TouchableOpacity style={s.dangerZone} onPress={confirmSignOut}>
            <Text style={s.dangerText}>Sair da conta</Text>
          </TouchableOpacity>

          <Text style={s.versionText}>
            Plano da Ju · v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 24 },

  // Hero
  hero: {
    paddingBottom: 32,
  },
  heroInner: {
    paddingTop: 24,
    alignItems: 'center',
    gap: 6,
  },
  heroAvatar: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroAvatarText: { fontSize: 30, fontWeight: '800', color: '#FFF' },
  heroName: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3, marginTop: 6 },
  heroEmail: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: -2 },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 14,
    marginTop: 6,
  },
  heroBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  contentArea: { paddingTop: 16 },

  // Perfil capilar card
  card: {
    marginHorizontal: SP.l, marginBottom: SP.m,
    backgroundColor: T.surface, borderRadius: R.xl, overflow: 'hidden',
    ...SHADOW.card,
  },
  cardTitle: {
    paddingHorizontal: SP.l, paddingVertical: 14,
    fontSize: 15, fontWeight: '800', color: T.dark,
    borderBottomWidth: 1, borderBottomColor: T.sep,
  },
  hairGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  hairItem: { width: '50%', padding: 14, paddingHorizontal: SP.l },
  hairItemBorderRight: { borderRightWidth: 1, borderRightColor: T.sep },
  hairItemBorderBottom: { borderBottomWidth: 1, borderBottomColor: T.sep },
  hairLabel: {
    fontSize: 11, fontWeight: '700', color: T.sub,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  hairValue: { fontSize: 14, fontWeight: '700', color: T.dark },

  // Assinatura
  subCard: {
    marginHorizontal: SP.l, marginBottom: SP.m,
    backgroundColor: T.surface, borderRadius: R.xl, padding: SP.l,
    ...SHADOW.card,
  },
  subTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  subName: { fontSize: 15, fontWeight: '800', color: T.dark, letterSpacing: -0.3, flex: 1, marginRight: 8 },
  subActiveBadge: { backgroundColor: '#EDFBF1', borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 12 },
  subActiveText: { fontSize: 12, fontWeight: '700', color: T.green },
  subRenewal: { fontSize: 13, color: T.sub, marginBottom: 4 },
  subPrice: { fontSize: 24, fontWeight: '800', color: T.dark, letterSpacing: -0.5, marginBottom: 14 },
  subPeriod: { fontSize: 14, fontWeight: '500', color: T.sub },
  subBtn: {
    borderWidth: 1.5, borderColor: T.accent, borderRadius: R.m,
    paddingVertical: 11, alignItems: 'center',
  },
  subBtnText: { fontSize: 14, fontWeight: '700', color: T.accent },

  // Configurações
  settingsGroup: {
    marginHorizontal: SP.l, marginBottom: SP.m,
    backgroundColor: T.surface, borderRadius: R.xl, overflow: 'hidden',
    ...SHADOW.card,
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: SP.l,
  },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: T.sep },
  settingsIconBox: {
    width: 34, height: 34, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsLabel: { fontSize: 15, fontWeight: '600', color: T.dark, flex: 1 },
  settingsChevron: { fontSize: 16, color: '#C7C7CC' },

  // Sair
  dangerZone: { alignItems: 'center', paddingVertical: 8 },
  dangerText: { fontSize: 15, fontWeight: '600', color: T.red, paddingVertical: 8, paddingHorizontal: 20 },

  versionText: {
    fontSize: 11,
    color: T.sub,
    textAlign: 'center',
    marginTop: 8,
  },
});
