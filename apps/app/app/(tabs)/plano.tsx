import { useMemo, useState } from 'react';
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
import { useHairPlan } from '../../lib/hooks';
import { T, GRAD, SHADOW, R, SP } from '../../lib/theme/tokens';

const HAIR_TYPE_LABEL: Record<string, string> = {
  liso: 'Liso',
  ondulado: 'Ondulado',
  cacheado: 'Cacheado',
  crespo: 'Crespo',
};

const POROSITY_LABEL: Record<string, string> = {
  baixa: 'Baixa porosidade',
  media: 'Média porosidade',
  alta: 'Alta porosidade',
};

type Tab = 'rotina' | 'produtos' | 'dicas';

export default function PlanoScreen() {
  const { profile } = useAuth();
  const { data: plans, loading, error, refresh } = useHairPlan();
  const [tab, setTab] = useState<Tab>('rotina');
  const [activeWeek, setActiveWeek] = useState(1);

  // Pega a semana ativa (default = primeira)
  const week = useMemo(() => {
    return plans?.find(p => p.week_number === activeWeek) ?? plans?.[0];
  }, [plans, activeWeek]);

  // Lista de chips do hero
  const heroChips = useMemo(() => {
    const chips: string[] = [];
    if (profile?.hair_type) {
      chips.push(HAIR_TYPE_LABEL[profile.hair_type] ?? profile.hair_type);
    }
    if (profile?.porosity) {
      chips.push(POROSITY_LABEL[profile.porosity] ?? profile.porosity);
    }
    if (profile?.main_problems?.[0]) {
      chips.push(profile.main_problems[0]);
    }
    return chips;
  }, [profile]);

  // Tasks vindas do plano (objeto ou string)
  const tasks = useMemo(() => {
    if (!week?.tasks) return [];
    return week.tasks.map((t, i) => {
      if (typeof t === 'string') return { idx: i + 1, title: t, description: '' };
      return { idx: t.day ?? i + 1, title: t.title, description: t.description ?? '' };
    });
  }, [week]);

  if (loading && !plans) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={T.accent} size="large" />
        <Text style={s.loadingText}>Carregando seu plano…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={T.accent} />
        }
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
              <Text style={s.heroEyebrow}>Seu plano personalizado</Text>
              <Text style={s.heroTitle}>Cronograma Capilar</Text>
              <Text style={s.heroSub}>
                {plans?.length ? `${plans.length} semanas planejadas` : 'Em construção'}
              </Text>
              <View style={s.heroBadgesRow}>
                {heroChips.map((b, i) => (
                  <View key={i} style={s.heroBadge}>
                    <Text style={s.heroBadgeText}>{b}</Text>
                  </View>
                ))}
              </View>
              <View style={s.julianeBadge}>
                <View style={s.julianeAvatar}>
                  <Text style={{ fontSize: 14, color: '#FFF' }}>👩‍⚕️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.julianeName}>Juliane Cost</Text>
                  <Text style={s.julianeRole}>Especialista capilar · ✓ Revisado</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Week selector */}
        {plans && plans.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.weekRow}
          >
            {plans.map(p => (
              <TouchableOpacity
                key={p.week_number}
                onPress={() => setActiveWeek(p.week_number)}
                style={[
                  s.weekChip,
                  p.week_number === (week?.week_number ?? 1) && s.weekChipActive,
                ]}
              >
                <Text
                  style={[
                    s.weekChipText,
                    p.week_number === (week?.week_number ?? 1) && s.weekChipTextActive,
                  ]}
                >
                  Sem. {p.week_number}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Tabs */}
        <View style={s.tabRow}>
          {(['rotina', 'produtos', 'dicas'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
                {t === 'rotina' ? 'Rotina' : t === 'produtos' ? 'Produtos' : 'Dicas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>Erro: {error}</Text>
          </View>
        )}

        {!plans?.length ? (
          <View style={s.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
            <Text style={s.emptyTitle}>Plano em preparação</Text>
            <Text style={s.emptySub}>
              A Juliane está montando seu plano personalizado. Em algumas horas você poderá ver tudo aqui!
            </Text>
          </View>
        ) : tab === 'rotina' ? (
          <>
            {/* Foco da semana */}
            <View style={s.card}>
              <Text style={s.cardTitleStandalone}>
                Foco — Semana {week?.week_number ?? 1}
              </Text>
              <View style={s.focoBox}>
                <Text style={s.focoText}>{week?.focus ?? 'Carregando…'}</Text>
                {week?.juliane_notes && (
                  <View style={s.notesBox}>
                    <Text style={s.notesLabel}>💬 Da Juliane</Text>
                    <Text style={s.notesText}>{week.juliane_notes}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Tarefas da semana */}
            {tasks.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitleStandalone}>Tarefas da semana</Text>
                {tasks.map((task, i) => (
                  <View
                    key={i}
                    style={[s.rotinaRow, i < tasks.length - 1 && s.diagBorder]}
                  >
                    <View style={s.taskNum}>
                      <Text style={s.taskNumText}>{task.idx}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rotinaAcao}>{task.title}</Text>
                      {task.description ? (
                        <Text style={s.rotinaDetalhe}>{task.description}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : tab === 'produtos' ? (
          <View style={s.card}>
            <Text style={s.cardTitleStandalone}>Produtos da semana</Text>
            {(week?.products ?? []).length === 0 ? (
              <Text style={s.emptyInline}>Sem produtos definidos para esta semana.</Text>
            ) : (
              (week?.products ?? []).map((p, i, arr) => (
                <View
                  key={i}
                  style={[s.prodRow, i < arr.length - 1 && s.diagBorder]}
                >
                  <Text style={s.prodCheck}>✓</Text>
                  <Text style={s.prodNome}>{p}</Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitleStandalone}>💡 Da Juliane para você</Text>
            {(week?.tips ?? []).length === 0 ? (
              <Text style={s.emptyInline}>Sem dicas específicas nesta semana.</Text>
            ) : (
              (week?.tips ?? []).map((d, i) => (
                <View key={i} style={s.dicaItem}>
                  <View style={s.dicaBulletDot} />
                  <Text style={s.dicaItemText}>{d}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: T.sub, fontSize: 13 },

  hero: { paddingBottom: 24 },
  heroInner: { paddingHorizontal: SP.xl, paddingTop: 16, gap: 6 },
  heroEyebrow: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  heroBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: R.pill,
    paddingVertical: 4, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroBadgeText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  julianeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: R.m,
    paddingVertical: 10, paddingHorizontal: 12, marginTop: 12,
  },
  julianeAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  julianeName: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  julianeRole: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },

  weekRow: {
    paddingHorizontal: SP.l,
    paddingTop: SP.l,
    gap: 8,
  },
  weekChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  weekChipActive: { backgroundColor: T.accent, borderColor: T.accent },
  weekChipText: { fontSize: 13, fontWeight: '700', color: T.dark },
  weekChipTextActive: { color: '#FFF' },

  tabRow: {
    flexDirection: 'row', backgroundColor: T.surface,
    marginHorizontal: SP.l, marginTop: SP.l, marginBottom: SP.m,
    borderRadius: R.m, padding: 4,
    ...SHADOW.card,
  },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  tabBtnActive: { backgroundColor: T.accent },
  tabBtnText: { fontSize: 14, fontWeight: '700', color: T.sub },
  tabBtnTextActive: { color: '#FFF' },

  card: {
    marginHorizontal: SP.l, marginBottom: SP.m,
    backgroundColor: T.surface, borderRadius: R.xl, overflow: 'hidden',
    ...SHADOW.card,
  },
  cardTitleStandalone: {
    fontSize: 15,
    fontWeight: '800',
    color: T.dark,
    paddingHorizontal: SP.l,
    paddingTop: SP.l,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.sep,
  },

  focoBox: { padding: SP.l },
  focoText: {
    fontSize: 18,
    fontWeight: '800',
    color: T.dark,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  notesBox: {
    marginTop: SP.m,
    backgroundColor: T.rose50,
    borderRadius: R.m,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: T.accent,
  },
  notesLabel: { fontSize: 11, color: T.accent, fontWeight: '800', letterSpacing: 0.3, marginBottom: 4 },
  notesText: { fontSize: 13, color: T.mid, lineHeight: 18, fontStyle: 'italic' },

  diagBorder: { borderTopWidth: 1, borderTopColor: T.sep },
  rotinaRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: SP.l, paddingVertical: 14, gap: 12 },
  taskNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.rose50,
    borderWidth: 1.5,
    borderColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  taskNumText: { fontSize: 12, fontWeight: '800', color: T.accent },
  rotinaAcao: { fontSize: 14, fontWeight: '700', color: T.dark },
  rotinaDetalhe: { fontSize: 13, color: T.mid, marginTop: 3, lineHeight: 18 },

  prodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingVertical: 12, gap: 10 },
  prodCheck: { fontSize: 16, color: T.accent, fontWeight: '800' },
  prodNome: { fontSize: 14, color: T.dark, fontWeight: '600', flex: 1 },

  dicaItem: { flexDirection: 'row', gap: 12, paddingHorizontal: SP.l, paddingVertical: 12, alignItems: 'flex-start' },
  dicaBulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent, marginTop: 8 },
  dicaItemText: { fontSize: 14, color: T.mid, flex: 1, lineHeight: 21 },

  emptyCard: {
    marginHorizontal: SP.l,
    marginTop: 16,
    backgroundColor: T.surface,
    borderRadius: R.xl,
    padding: 24,
    alignItems: 'center',
    ...SHADOW.card,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: T.dark, marginTop: 4 },
  emptySub: { fontSize: 13, color: T.sub, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  emptyInline: { fontSize: 13, color: T.sub, padding: SP.l, textAlign: 'center' },

  errorBox: {
    marginHorizontal: SP.l,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEEAEA',
    borderRadius: R.m,
  },
  errorText: { fontSize: 13, color: '#C0392B' },
});
