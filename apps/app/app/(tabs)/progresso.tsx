import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import {
  usePhotoAnalyses,
  useHairEvents,
  calcStreak,
} from '../../lib/hooks';
import { T, GRAD, SHADOW, R, SP } from '../../lib/theme/tokens';

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function ScoreBar({ value, max = 5 }: { value: number | null; max?: number }) {
  const pct = value != null ? (value / max) * 100 : 0;
  return (
    <View style={{ height: 4, backgroundColor: T.sep, borderRadius: 2, marginTop: 6 }}>
      <View
        style={{
          height: 4,
          width: `${pct}%`,
          backgroundColor: T.accent,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

function PhotoPlaceholder({ label, date }: { label: string; date?: string }) {
  return (
    <View style={ph.wrap}>
      <View style={ph.inner}>
        <Ionicons name="person-outline" size={32} color={T.sub} />
        <Text style={ph.label}>{label}</Text>
        {date && <Text style={ph.date}>{date}</Text>}
      </View>
    </View>
  );
}

const ph = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: T.bg,
    borderRadius: R.l,
    aspectRatio: 0.75,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { alignItems: 'center', gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: T.sub },
  date: { fontSize: 11, color: T.sub },
});

export default function ProgressoScreen() {
  const { profile } = useAuth();
  const pa = usePhotoAnalyses(10);
  const ev = useHairEvents(30);

  const streak = useMemo(() => calcStreak(ev.data ?? []), [ev.data]);

  const latest = pa.data?.[0] ?? null;
  const oldest = pa.data?.[pa.data.length - 1] ?? null;

  const totalDias = useMemo(() => {
    if (!oldest || !latest) return null;
    const ms = new Date(latest.analyzed_at).getTime() - new Date(oldest.analyzed_at).getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }, [latest, oldest]);

  const crescimentoTotal = useMemo(() => {
    if (!latest?.crescimento_estimado_cm || !oldest?.crescimento_estimado_cm) return null;
    return latest.crescimento_estimado_cm - oldest.crescimento_estimado_cm;
  }, [latest, oldest]);

  // Streak dots (last 14 days)
  const streakDots = useMemo(() => {
    const days: { key: string; filled: boolean; isToday: boolean }[] = [];
    const eventDays = new Set((ev.data ?? []).map(e => e.occurred_at.slice(0, 10)));
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, filled: eventDays.has(key), isToday: i === 0 });
    }
    return days;
  }, [ev.data]);

  // Gallery mock (last 6 analyses)
  const gallery = pa.data?.slice(0, 6) ?? [];

  if (!profile && (pa.loading || ev.loading)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color={T.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Progresso</Text>
            <Text style={s.headerSub}>90 dias de rotina</Text>
          </View>
          <TouchableOpacity style={s.periodBtn} activeOpacity={0.75}>
            <Text style={s.periodBtnText}>3 meses ▾</Text>
          </TouchableOpacity>
        </View>

        {/* Photo hero CTA */}
        <LinearGradient
          colors={GRAD.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.photoCTA}
        >
          <View style={s.photoCTAIcon}>
            <Ionicons name="camera-outline" size={28} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.photoCTATitle}>Registrar foto de hoje</Text>
            <Text style={s.photoCTASub}>
              IA compara com fotos anteriores e analisa evolução
            </Text>
          </View>
          <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>›</Text>
        </LinearGradient>

        {/* Comprimento card */}
        <View style={s.comprimentoCard}>
          <View style={s.comprimentoRow}>
            <View style={s.comprimentoLeft}>
              <View style={s.comprimentoLabelRow}>
                <Ionicons name="resize-outline" size={14} color={T.sub} />
                <Text style={s.comprimentoLabelText}>Comprimento</Text>
                {crescimentoTotal != null && crescimentoTotal > 0 && (
                  <View style={s.deltaBadge}>
                    <Text style={s.deltaBadgeText}>↑ +{crescimentoTotal.toFixed(1)} cm</Text>
                  </View>
                )}
              </View>
              <Text style={s.comprimentoBig}>
                {latest?.crescimento_estimado_cm != null
                  ? `${latest.crescimento_estimado_cm} cm`
                  : '— cm'}
              </Text>
              {crescimentoTotal != null && crescimentoTotal > 0 && (
                <Text style={s.comprimentoGrowth}>
                  Cresceu +{crescimentoTotal.toFixed(1)} cm em 90 dias
                </Text>
              )}
            </View>
            <TouchableOpacity style={s.atualizarBtn} activeOpacity={0.75}>
              <Text style={s.atualizarBtnText}>Atualizar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scores row */}
        <View style={s.scoresRow}>
          {[
            { icon: 'sparkles-outline' as const, label: 'Brilho', value: latest?.brilho_score },
            { icon: 'water-outline' as const, label: 'Hidratação', value: latest?.hidratacao_score },
            { icon: 'cloudy-outline' as const, label: 'Frizz', value: latest?.frizz_score },
          ].map(sc => (
            <View key={sc.label} style={s.scoreCard}>
              <Ionicons name={sc.icon} size={20} color={T.accent} />
              <Text style={s.scoreValue}>{sc.value != null ? sc.value.toFixed(1) : '—'}</Text>
              <Text style={s.scoreLabel}>{sc.label}</Text>
            </View>
          ))}
        </View>

        {/* Antes & Depois */}
        <View style={s.titleWrap}>
          <Text style={s.sectionTitle}>Antes &amp; Depois</Text>
        </View>
        <View style={s.antesDepoisCard}>
          <View style={s.antesDepoisPhotos}>
            <View style={{ flex: 1 }}>
              <PhotoPlaceholder
                label="Antes"
                date={oldest ? formatDateBR(oldest.analyzed_at) : undefined}
              />
            </View>
            <View style={s.antesDepoisDivider}>
              <View style={s.antesDepoisHandle}>
                <Ionicons name="swap-horizontal-outline" size={14} color={T.sub} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <PhotoPlaceholder
                label="Hoje"
                date={latest ? formatDateBR(latest.analyzed_at) : undefined}
              />
            </View>
          </View>
          <View style={s.antesDepoisFooter}>
            <Text style={s.antesDepoisRange}>
              {oldest ? formatDateBR(oldest.analyzed_at) : '—'} →{' '}
              {latest ? formatDateBR(latest.analyzed_at) : '—'}
            </Text>
            <Text style={s.antesDepoisDias}>
              {totalDias != null ? `${totalDias} dias de rotina` : '—'}
            </Text>
          </View>
        </View>

        {/* Análise da IA */}
        {latest && (
          <>
            <View style={s.titleWrap}>
              <Text style={s.sectionTitle}>Análise da IA</Text>
            </View>
            <View style={s.iaCard}>
              <View style={s.iaCardHeader}>
                <View style={s.iaIconWrap}>
                  <Ionicons name="flask-outline" size={20} color={T.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.iaCardTitle}>Última análise</Text>
                  <Text style={s.iaCardDate}>{formatDateBR(latest.analyzed_at)}</Text>
                </View>
              </View>

              {/* Score grid */}
              <View style={s.iaGrid}>
                {[
                  { label: 'Brilho', value: latest.brilho_score },
                  { label: 'Hidratação', value: latest.hidratacao_score },
                  { label: 'Pontas', value: latest.pontas_score },
                  { label: 'Frizz', value: latest.frizz_score },
                ].map(sc => (
                  <View key={sc.label} style={s.iaScoreRow}>
                    <View style={s.iaScoreTop}>
                      <Text style={s.iaScoreLabel}>{sc.label}</Text>
                      <Text style={s.iaScoreValue}>
                        {sc.value != null ? `${sc.value}/5` : '—'}
                      </Text>
                    </View>
                    <ScoreBar value={sc.value} />
                  </View>
                ))}
              </View>

              {/* Summary text */}
              {latest.avaliacao_texto && (
                <Text style={s.iaSummary}>{latest.avaliacao_texto}</Text>
              )}

              {/* Badges */}
              <View style={s.iaBadgeRow}>
                {latest.brilho_score != null && latest.brilho_score >= 3.5 && (
                  <View style={[s.iaBadge, { backgroundColor: '#E8F8EE' }]}>
                    <Text style={[s.iaBadgeText, { color: T.green }]}>✓ Brilho melhorou</Text>
                  </View>
                )}
                {latest.pontas_score != null && latest.pontas_score < 3 && (
                  <View style={[s.iaBadge, { backgroundColor: '#FFF3E0' }]}>
                    <Text style={[s.iaBadgeText, { color: T.gold }]}>⚠ Pontas secas</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        {/* Consistência streak */}
        <View style={s.titleWrap}>
          <Text style={s.sectionTitle}>Consistência</Text>
        </View>
        <View style={s.streakCard}>
          <View style={s.streakTop}>
            <Text style={s.streakNumber}>{streak}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.streakLabel}>dias seguindo a rotina</Text>
              <Text style={s.streakSub}>Continue assim!</Text>
            </View>
            <Ionicons name="flame" size={28} color={T.gold} />
          </View>
          <View style={s.streakDots}>
            {streakDots.map(d => (
              <View
                key={d.key}
                style={[
                  s.streakDot,
                  d.isToday
                    ? { backgroundColor: T.gold }
                    : d.filled
                    ? { backgroundColor: T.accent }
                    : { backgroundColor: T.sep },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Galeria */}
        <View style={s.titleWrap}>
          <Text style={s.sectionTitle}>Galeria</Text>
        </View>
        <View style={s.gallery}>
          {gallery.length > 0
            ? gallery.map((item, i) => (
                <View key={item.id} style={s.galleryItem}>
                  <LinearGradient
                    colors={['#DDB8C8', '#C4607A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.galleryThumb}
                  >
                    <Ionicons name="image-outline" size={26} color="rgba(255,255,255,0.8)" />
                    {item.avaliacao_texto && (
                      <View style={s.galleryBadgeAI}>
                        <Text style={s.galleryBadgeAIText}>IA ✓</Text>
                      </View>
                    )}
                  </LinearGradient>
                  <Text style={s.galleryDate}>{formatDateBR(item.analyzed_at)}</Text>
                </View>
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={s.galleryItem}>
                  <View style={[s.galleryThumb, { backgroundColor: T.sep, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="image-outline" size={26} color={T.sub} />
                  </View>
                  <Text style={s.galleryDate}>—</Text>
                </View>
              ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SP.xl,
    paddingTop: 10,
    paddingBottom: 18,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: T.dark, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: T.sub, marginTop: 2 },
  periodBtn: {
    backgroundColor: T.accent,
    borderRadius: R.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  periodBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Photo CTA
  photoCTA: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  photoCTAIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCTATitle: { fontSize: 16, fontWeight: '800', color: '#FFF', marginBottom: 2 },
  photoCTASub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 17 },

  // Comprimento
  comprimentoCard: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    backgroundColor: T.surface,
    borderRadius: R.xxl,
    padding: 16,
    ...SHADOW.card,
  },
  comprimentoRow: { flexDirection: 'row', alignItems: 'center' },
  comprimentoLeft: { flex: 1 },
  comprimentoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  comprimentoLabelText: { fontSize: 12, color: T.sub, fontWeight: '600' },
  deltaBadge: {
    backgroundColor: '#E8F8EE',
    borderRadius: R.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  deltaBadgeText: { fontSize: 11, fontWeight: '700', color: T.green },
  comprimentoBig: { fontSize: 36, fontWeight: '800', color: T.dark, letterSpacing: -1 },
  comprimentoGrowth: { fontSize: 13, color: T.sub, marginTop: 2 },
  atualizarBtn: {
    backgroundColor: T.bg,
    borderRadius: R.m,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  atualizarBtnText: { fontSize: 13, fontWeight: '700', color: T.accent },

  // Scores
  scoresRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: SP.l,
    marginBottom: SP.m,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: R.xl,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    ...SHADOW.card,
  },
  scoreValue: { fontSize: 20, fontWeight: '800', color: T.dark, marginTop: 4 },
  scoreLabel: { fontSize: 11, color: T.sub, fontWeight: '600' },

  // Section
  titleWrap: { paddingHorizontal: SP.xl, paddingTop: SP.xl, paddingBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: T.dark },

  // Antes & Depois
  antesDepoisCard: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    backgroundColor: T.surface,
    borderRadius: R.xxl,
    padding: 14,
    ...SHADOW.card,
  },
  antesDepoisPhotos: { flexDirection: 'row', gap: 0, alignItems: 'stretch', minHeight: 160 },
  antesDepoisDivider: {
    width: 2,
    backgroundColor: T.sep,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  antesDepoisHandle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: T.sep,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  antesDepoisFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  antesDepoisRange: { fontSize: 12, color: T.sub },
  antesDepoisDias: { fontSize: 12, fontWeight: '700', color: T.accent },

  // IA card
  iaCard: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    backgroundColor: T.dark,
    borderRadius: R.xxl,
    padding: 18,
    ...SHADOW.cardLg,
  },
  iaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iaIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(196,96,122,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iaCardTitle: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  iaCardDate: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  iaGrid: { gap: 12 },
  iaScoreRow: {},
  iaScoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  iaScoreLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  iaScoreValue: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  iaSummary: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  iaBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  iaBadge: {
    borderRadius: R.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  iaBadgeText: { fontSize: 12, fontWeight: '700' },

  // Streak
  streakCard: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    backgroundColor: T.surface,
    borderRadius: R.xxl,
    padding: 18,
    ...SHADOW.card,
  },
  streakTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  streakNumber: { fontSize: 40, fontWeight: '800', color: T.dark, letterSpacing: -1 },
  streakLabel: { fontSize: 14, fontWeight: '700', color: T.dark },
  streakSub: { fontSize: 12, color: T.sub, marginTop: 2 },
  streakDots: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  streakDot: { width: 14, height: 14, borderRadius: 7 },

  // Gallery
  gallery: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  galleryItem: { width: '31%' },
  galleryThumb: {
    aspectRatio: 0.85,
    borderRadius: R.l,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  galleryBadgeAI: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: R.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  galleryBadgeAIText: { fontSize: 10, color: '#FFF', fontWeight: '700' },
  galleryDate: { fontSize: 11, color: T.sub, marginTop: 4, textAlign: 'center' },
});
