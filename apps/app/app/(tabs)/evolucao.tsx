import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth';
import {
  usePhotoAnalyses,
  useHairEvents,
  calcStreak,
  type PhotoAnalysis,
} from '../../lib/hooks';
import { T, GRAD, SHADOW, R, SP } from '../../lib/theme/tokens';

interface ScoreDelta {
  emoji: string;
  label: string;
  value: number | null;
  delta: number | null;
  /** true = aumentar é bom (brilho/hidratação); false = aumentar é ruim (frizz) */
  higherIsBetter: boolean;
}

function buildScores(analyses: PhotoAnalysis[]): ScoreDelta[] {
  const latest = analyses[0];
  const previous = analyses[1];

  const delta = (key: keyof PhotoAnalysis) => {
    const cur = latest?.[key];
    const prev = previous?.[key];
    if (typeof cur === 'number' && typeof prev === 'number') {
      return Number((cur - prev).toFixed(1));
    }
    return null;
  };

  return [
    {
      emoji: '✨',
      label: 'Brilho',
      value: latest?.brilho_score ?? null,
      delta: delta('brilho_score'),
      higherIsBetter: true,
    },
    {
      emoji: '💧',
      label: 'Hidratação',
      value: latest?.hidratacao_score ?? null,
      delta: delta('hidratacao_score'),
      higherIsBetter: true,
    },
    {
      emoji: '🌀',
      label: 'Frizz',
      value: latest?.frizz_score ?? null,
      delta: delta('frizz_score'),
      higherIsBetter: false,
    },
  ];
}

/** Cor do delta: verde se mudou para o lado bom; rose se piorou; cinza se sem mudança */
function deltaColor(d: number | null, higherIsBetter: boolean): string {
  if (d === null || d === 0) return T.sub;
  const isImproving = higherIsBetter ? d > 0 : d < 0;
  return isImproving ? T.green : T.accent;
}

function deltaText(d: number | null): string {
  if (d === null) return '—';
  if (d === 0) return '·';
  return d > 0 ? `↑ +${d}` : `↓ ${d}`;
}

export default function EvolucaoScreen() {
  const { profile } = useAuth();
  const photos = usePhotoAnalyses(20);
  const events = useHairEvents(60);

  const scores = useMemo(
    () => buildScores(photos.data ?? []),
    [photos.data],
  );
  const streak = useMemo(() => calcStreak(events.data ?? []), [events.data]);

  const latest = photos.data?.[0];
  const oldest = photos.data?.[photos.data.length - 1];

  // Streak grid (últimos 14 dias)
  const streakGrid = useMemo(() => {
    const eventDays = new Set(
      (events.data ?? []).map(e => e.occurred_at.slice(0, 10)),
    );
    const days: Array<{ letter: string; key: string; done: boolean }> = [];
    const today = new Date();
    const dayLetters = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        letter: dayLetters[d.getDay()],
        key,
        done: eventDays.has(key),
      });
    }
    return days;
  }, [events.data]);

  const refreshing = photos.loading || events.loading;
  const handleRefresh = () => {
    photos.refresh();
    events.refresh();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={T.accent}
          />
        }
      >
        <View style={s.header}>
          <Text style={s.headerTitle}>Evolução</Text>
          <Text style={s.headerSub}>
            {photos.data?.length
              ? `${photos.data.length} análises registradas`
              : 'Adicione sua primeira foto para começar'}
          </Text>
        </View>

        {/* Score cards */}
        <View style={s.scoreRow}>
          {scores.map((sc, i) => (
            <View key={i} style={s.scoreCard}>
              <Text style={s.scoreEmoji}>{sc.emoji}</Text>
              <Text style={s.scoreValue}>
                {sc.value !== null ? sc.value.toFixed(1) : '—'}
              </Text>
              <Text style={s.scoreLabel}>{sc.label}</Text>
              <Text
                style={[
                  s.scoreDelta,
                  { color: deltaColor(sc.delta, sc.higherIsBetter) },
                ]}
              >
                {deltaText(sc.delta)}
              </Text>
            </View>
          ))}
        </View>

        {/* Antes & Depois */}
        {photos.data && photos.data.length >= 2 && (
          <>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Antes & Depois</Text>
            </View>
            <View style={s.beforeAfterCard}>
              <View style={s.beforeAfterRow}>
                <View style={s.photoBox}>
                  {oldest?.photo_url ? (
                    <Text style={s.photoEmoji}>📸</Text>
                  ) : (
                    <Text style={s.photoEmoji}>💇‍♀️</Text>
                  )}
                  <Text style={s.photoLabel}>
                    {oldest
                      ? new Date(oldest.analyzed_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                        })
                      : 'Antes'}
                  </Text>
                </View>
                <View style={s.swapIcon}>
                  <Text style={{ fontSize: 22, color: T.accent }}>⟺</Text>
                </View>
                <View style={s.photoBox}>
                  {latest?.photo_url ? (
                    <Text style={s.photoEmoji}>✨</Text>
                  ) : (
                    <Text style={s.photoEmoji}>👱‍♀️</Text>
                  )}
                  <Text style={s.photoLabel}>Hoje</Text>
                </View>
              </View>
              {oldest && latest && (
                <Text style={s.beforeAfterCaption}>
                  {Math.floor(
                    (new Date(latest.analyzed_at).getTime() -
                      new Date(oldest.analyzed_at).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )}{' '}
                  dias de rotina
                </Text>
              )}
            </View>
          </>
        )}

        {/* Análise IA */}
        {latest && (
          <>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Análise da IA</Text>
            </View>
            <LinearGradient
              colors={[T.dark, '#3A2440']}
              style={s.aiCard}
            >
              <View style={s.aiHeader}>
                <Text style={s.aiIcon}>🔬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.aiTitle}>
                    Última análise · {new Date(latest.analyzed_at).toLocaleDateString('pt-BR')}
                  </Text>
                  <Text style={s.aiSub}>Baseada na sua última foto enviada</Text>
                </View>
              </View>

              {[
                { label: 'Brilho', value: latest.brilho_score, max: 5 },
                { label: 'Hidratação', value: latest.hidratacao_score, max: 5 },
                { label: 'Pontas', value: latest.pontas_score, max: 5 },
                {
                  label: 'Frizz (menor é melhor)',
                  value: latest.frizz_score,
                  max: 5,
                },
              ].map((sc, i) => (
                <View key={i} style={s.aiScoreRow}>
                  <Text style={s.aiScoreLabel}>{sc.label}</Text>
                  <View style={s.aiBarTrack}>
                    <View
                      style={[
                        s.aiBarFill,
                        {
                          width: `${
                            sc.value !== null && typeof sc.value === 'number'
                              ? (sc.value / sc.max) * 100
                              : 0
                          }%` as `${number}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.aiScoreVal}>
                    {sc.value !== null && typeof sc.value === 'number'
                      ? sc.value.toFixed(1)
                      : '—'}
                  </Text>
                </View>
              ))}

              {latest.avaliacao_texto && (
                <Text style={s.aiDescription}>{latest.avaliacao_texto}</Text>
              )}
            </LinearGradient>
          </>
        )}

        {/* Comprimento */}
        {profile?.hair_length_cm != null && (
          <>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Comprimento</Text>
            </View>
            <View style={s.comprimentoCard}>
              <Text style={s.comprimentoValue}>
                {profile.hair_length_cm} cm
              </Text>
              <Text style={s.comprimentoLabel}>
                Comprimento atual auto-declarado
              </Text>
            </View>
          </>
        )}

        {/* Consistência */}
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Consistência</Text>
        </View>
        <View style={s.streakCard}>
          <View style={s.streakHeader}>
            <Text style={s.streakCount}>{streak} {streak === 1 ? 'dia' : 'dias'}</Text>
            {streak > 0 && <Text style={s.streakFire}>🔥</Text>}
          </View>
          <Text style={s.streakSub}>seguindo a rotina</Text>
          <View style={s.streakGrid}>
            {streakGrid.map((d, i) => (
              <View
                key={i}
                style={[s.streakDot, d.done && s.streakDotDone]}
              >
                <Text
                  style={[
                    s.streakDotText,
                    d.done && s.streakDotTextDone,
                  ]}
                >
                  {d.letter}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Galeria */}
        {photos.data && photos.data.length > 0 && (
          <>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Galeria</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.galleryRow}
            >
              {photos.data.map(photo => (
                <View key={photo.id} style={s.galleryItem}>
                  <View style={s.galleryThumb}>
                    <Text style={s.galleryEmoji}>📸</Text>
                  </View>
                  <Text style={s.galleryLabel}>
                    {new Date(photo.analyzed_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Adicionar foto */}
        <TouchableOpacity style={s.addPhotoBtn}>
          <Text style={s.addPhotoIcon}>📸</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.addPhotoTitle}>Registrar foto de hoje</Text>
            <Text style={s.addPhotoSub}>
              Em breve · IA analisa e compara com fotos anteriores
            </Text>
          </View>
          <Text style={s.addPhotoChevron}>›</Text>
        </TouchableOpacity>

        {photos.loading && !photos.data && (
          <ActivityIndicator
            color={T.accent}
            style={{ marginTop: 24 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 24 },

  header: { paddingHorizontal: SP.xl, paddingTop: SP.l, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: T.dark, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: T.sub, marginTop: 2 },

  scoreRow: { flexDirection: 'row', gap: 10, paddingHorizontal: SP.l, marginBottom: 4 },
  scoreCard: {
    flex: 1, backgroundColor: T.surface, borderRadius: R.xl, padding: 14,
    alignItems: 'center',
    ...SHADOW.card,
  },
  scoreEmoji: { fontSize: 24 },
  scoreValue: { fontSize: 26, fontWeight: '800', color: T.dark, letterSpacing: -0.5, marginTop: 6 },
  scoreLabel: { fontSize: 11, color: T.sub, marginTop: 2 },
  scoreDelta: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingHorizontal: SP.xl, paddingTop: SP.xl, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: T.dark, letterSpacing: -0.3 },

  beforeAfterCard: {
    marginHorizontal: SP.l, backgroundColor: T.surface, borderRadius: R.xl, padding: SP.l,
    ...SHADOW.card,
  },
  beforeAfterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoBox: { flex: 1, alignItems: 'center', backgroundColor: T.bg, borderRadius: 12, paddingVertical: 24 },
  photoEmoji: { fontSize: 48 },
  photoLabel: { fontSize: 12, color: T.sub, marginTop: 8, fontWeight: '600' },
  swapIcon: { alignItems: 'center' },
  beforeAfterCaption: { fontSize: 12, color: T.sub, textAlign: 'center', marginTop: 12, fontWeight: '500' },

  aiCard: {
    marginHorizontal: SP.l, borderRadius: R.xl, padding: SP.l,
  },
  aiHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 },
  aiIcon: { fontSize: 26 },
  aiTitle: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  aiSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  aiScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  aiScoreLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', width: 130 },
  aiBarTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' },
  aiBarFill: { height: 6, backgroundColor: T.accent, borderRadius: 3 },
  aiScoreVal: { fontSize: 12, color: 'rgba(255,255,255,0.85)', width: 30, textAlign: 'right', fontWeight: '700' },
  aiDescription: {
    fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 20,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
  },

  comprimentoCard: {
    marginHorizontal: SP.l, backgroundColor: T.surface, borderRadius: R.xl, padding: SP.l,
    ...SHADOW.card,
  },
  comprimentoValue: { fontSize: 32, fontWeight: '800', color: T.dark, letterSpacing: -1 },
  comprimentoLabel: { fontSize: 13, color: T.sub, marginTop: 2 },

  streakCard: {
    marginHorizontal: SP.l, backgroundColor: T.surface, borderRadius: R.xl, padding: SP.l,
    ...SHADOW.card,
  },
  streakHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakCount: { fontSize: 26, fontWeight: '800', color: T.dark, letterSpacing: -0.5 },
  streakFire: { fontSize: 22 },
  streakSub: { fontSize: 13, color: T.sub, marginBottom: 14 },
  streakGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  streakDot: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center',
  },
  streakDotDone: { backgroundColor: T.accent },
  streakDotText: { fontSize: 11, fontWeight: '700', color: T.sub },
  streakDotTextDone: { color: '#FFF' },

  galleryRow: { paddingHorizontal: SP.l, gap: 10 },
  galleryItem: { alignItems: 'center', gap: 6 },
  galleryThumb: {
    width: 76, height: 76, borderRadius: R.l,
    backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
  galleryEmoji: { fontSize: 36 },
  galleryLabel: { fontSize: 11, color: T.sub, fontWeight: '600' },

  addPhotoBtn: {
    marginHorizontal: SP.l, marginTop: SP.l,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.surface, borderRadius: R.xl, padding: SP.l,
    borderWidth: 1.5, borderColor: T.accent, borderStyle: 'dashed',
  },
  addPhotoIcon: { fontSize: 28 },
  addPhotoTitle: { fontSize: 15, fontWeight: '700', color: T.dark },
  addPhotoSub: { fontSize: 12, color: T.sub, marginTop: 2 },
  addPhotoChevron: { fontSize: 18, color: T.accent },
});
