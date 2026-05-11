import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import {
  useHairState,
  useHairEvents,
  useHairPlan,
  useCheckIns,
  daysSinceWash,
  calcStreak,
  logHairEvent,
  type HairEvent,
} from '../../lib/hooks';
import { T, GRAD, SHADOW, R, SP } from '../../lib/theme/tokens';

const TIPO_LABEL: Record<string, string> = {
  liso: 'liso',
  ondulado: 'ondulado',
  cacheado: 'cacheado',
  crespo: 'crespo',
};

const FREQ_LAVAGEM_IDEAL: Record<string, number> = {
  liso: 2,
  ondulado: 4,
  cacheado: 5,
  crespo: 7,
};

function greetingNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const EVENT_LABEL: Record<HairEvent['event_type'], { label: string }> = {
  wash: { label: 'Lavagem' },
  hydration_mask: { label: 'Hidratação' },
  nutrition_mask: { label: 'Nutrição' },
  reconstruction: { label: 'Reconstrução' },
  oil_treatment: { label: 'Óleo' },
  heat_used: { label: 'Calor' },
  sun_exposure: { label: 'Sol' },
  cut: { label: 'Corte' },
  chemical: { label: 'Química' },
};

const EVENT_ICON: Record<HairEvent['event_type'], { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  wash: { name: 'water-outline', color: T.blue },
  hydration_mask: { name: 'water-outline', color: T.catHidratacao },
  nutrition_mask: { name: 'leaf-outline', color: T.green },
  reconstruction: { name: 'barbell-outline', color: T.accent },
  oil_treatment: { name: 'sparkles-outline', color: T.gold },
  heat_used: { name: 'flame-outline', color: '#FF6B35' },
  sun_exposure: { name: 'sunny-outline', color: T.gold },
  cut: { name: 'cut-outline', color: T.mid },
  chemical: { name: 'flask-outline', color: T.purple },
};

const WEEK_DAYS_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/** Returns the array of 7 days for the current week (Mon–Sun). */
function getCurrentWeekDays(): Date[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun..6=Sat
  // Shift so week starts on Monday
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    return d;
  });
}

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const hs = useHairState();
  const ev = useHairEvents(50);
  const ck = useCheckIns(7);
  const hp = useHairPlan();

  const dias = daysSinceWash(hs.data);
  const streak = useMemo(() => calcStreak(ev.data ?? []), [ev.data]);
  const tipoCabelo = profile?.hair_type ?? 'ondulado';
  const tipoLabel = TIPO_LABEL[tipoCabelo] ?? tipoCabelo;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Olá';
  const initial = firstName[0]?.toUpperCase() ?? 'M';

  const todayCheckedIn = useMemo(() => {
    if (!ck.data?.length) return false;
    const todayKey = new Date().toISOString().slice(0, 10);
    return ck.data.some(c => c.checked_at.slice(0, 10) === todayKey);
  }, [ck.data]);

  const proximosEventos = useMemo(() => (ev.data ?? []).slice(0, 4), [ev.data]);

  const refreshing = hs.loading || ev.loading || ck.loading;

  const handleRefresh = () => {
    hs.refresh();
    ev.refresh();
    ck.refresh();
    hp.refresh();
  };

  async function quickLog(type: HairEvent['event_type'], label: string) {
    if (!session?.user.id) return;
    try {
      await logHairEvent(session.user.id, type);
      Alert.alert('Registrado!', `${label} salvo no seu histórico ✓`);
      hs.refresh();
      ev.refresh();
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao registrar');
    }
  }

  const heroFocoSugestao = useMemo(() => {
    if (!hp.data?.length) return null;
    const week = hp.data[0];
    return week.focus;
  }, [hp.data]);

  // Week calendar
  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const todayKey = new Date().toISOString().slice(0, 10);
  const eventDays = useMemo(
    () => new Set((ev.data ?? []).map(e => e.occurred_at.slice(0, 10))),
    [ev.data],
  );

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
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerName}>{greetingNow()}, {firstName}</Text>
            <Text style={s.headerSub}>
              Cabelo {tipoLabel}{dias != null && dias >= 0 ? ` · dia ${dias} sem lavar` : ''}
            </Text>
          </View>
          <Link href="/perfil" asChild>
            <TouchableOpacity>
              <LinearGradient
                colors={GRAD.avatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.avatar}
              >
                <Text style={s.avatarText}>{initial}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Streak pills */}
        <View style={s.pillRow}>
          <View style={s.pill}>
            <View style={[s.pillDot, { backgroundColor: T.green }]} />
            <Text style={s.pillText}>
              {streak} {streak === 1 ? 'dia' : 'dias'} seguidos
            </Text>
          </View>
          {dias != null && dias >= 0 && (
            <View style={s.pill}>
              <View style={[s.pillDot, { backgroundColor: T.gold }]} />
              <Text style={s.pillText}>
                {dias} {dias === 1 ? 'dia' : 'dias'} desde lavagem
              </Text>
            </View>
          )}
        </View>

        {/* Week calendar strip */}
        <View style={s.weekStrip}>
          {weekDays.map(d => {
            const key = d.toISOString().slice(0, 10);
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const hasEvent = eventDays.has(key);
            const dayNum = d.getDate();
            const dayName = WEEK_DAYS_PT[d.getDay()];

            return (
              <View key={key} style={s.weekDayCol}>
                <Text style={[s.weekDayName, !isPast && !isToday && s.weekDayFuture]}>
                  {dayName}
                </Text>
                {isToday ? (
                  <LinearGradient
                    colors={GRAD.hero}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.weekDayCircleToday}
                  >
                    <Text style={s.weekDayNumToday}>{dayNum}</Text>
                  </LinearGradient>
                ) : (
                  <View style={s.weekDayCircle}>
                    <Text style={[s.weekDayNum, !isPast && s.weekDayFuture]}>{dayNum}</Text>
                  </View>
                )}
                {hasEvent && <View style={s.weekEventDot} />}
                {!hasEvent && <View style={s.weekEventDotEmpty} />}
              </View>
            );
          })}
        </View>

        {/* Hero card — Próximo Tratamento */}
        <LinearGradient
          colors={GRAD.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.heroCard}
        >
          <Text style={s.heroEyebrow}>✦ PRÓXIMO TRATAMENTO</Text>
          <Text style={s.heroTitle} numberOfLines={2}>
            {heroFocoSugestao ?? 'Máscara de Hidratação'}
          </Text>
          <Text style={s.heroDesc}>
            {dias != null && dias >= 0
              ? `Dia ${dias} desde a última lavagem — hora de hidratar profundamente`
              : 'Siga o cronograma para melhores resultados'}
          </Text>

          {/* Tag pills */}
          <View style={s.heroTags}>
            <View style={s.heroTag}>
              <Ionicons name="flask-outline" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={s.heroTagText}>
                {hp.data?.[0]?.products?.[0] ?? 'Iberaparis Hydra'}
              </Text>
            </View>
            <View style={s.heroTag}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={s.heroTagText}>20 minutos</Text>
            </View>
            <View style={s.heroTag}>
              <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={s.heroTagText}>Pós lavagem</Text>
            </View>
          </View>

          <View style={s.heroFooter}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroNextLabel}>Próximo passo</Text>
              <Text style={s.heroNextValue}>
                {hp.data?.[0]?.tasks?.[0]
                  ? typeof hp.data[0].tasks[0] === 'string'
                    ? hp.data[0].tasks[0]
                    : (hp.data[0].tasks[0] as { title: string }).title
                  : 'Lavar com shampoo lowpoo'}
              </Text>
            </View>
            <Link href="/(tabs)/plano" asChild>
              <TouchableOpacity style={s.heroBtn}>
                <Text style={s.heroBtnText}>Ver como fazer</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </LinearGradient>

        {/* Para hoje */}
        <View style={s.titleWrap}>
          <Text style={s.sectionTitle}>Para hoje</Text>
        </View>

        <View style={s.todayCard}>
          <View style={s.todayMain}>
            <Ionicons name="flask-outline" size={32} color={T.accent} />
            <View style={s.todayText}>
              <Text style={s.todayTag}>Indicado agora</Text>
              <Text style={s.todayName}>
                {hp.data?.[0]?.focus ?? 'Hidratação semanal'}
              </Text>
              <Text style={s.todayProduct}>
                {hp.data?.[0]?.products?.[0] ?? 'Iberaparis Hydra + Óleo de Argan'}
              </Text>
            </View>
            <Text style={s.todayChevron}>›</Text>
          </View>
          <Link href="/(tabs)/plano" asChild>
            <TouchableOpacity style={s.todayAction}>
              <Ionicons name="book-outline" size={18} color={T.accent} />
              <Text style={s.todayActionText}>Ver passo a passo</Text>
              <Text style={s.todayActionChevron}>›</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Check-in */}
        <Link href="/checkin" asChild>
          <TouchableOpacity style={s.checkinCard}>
            <Ionicons
              name={todayCheckedIn ? 'checkmark-circle' : 'leaf-outline'}
              size={24}
              color={todayCheckedIn ? T.green : T.green}
            />
            <View style={s.checkinText}>
              <Text style={s.checkinTitle}>
                {todayCheckedIn ? 'Check-in feito hoje!' : 'Check-in de hoje'}
              </Text>
              <Text style={s.checkinSub}>
                {todayCheckedIn
                  ? 'Você já respondeu hoje · obrigada ✨'
                  : 'Como está seu cabelo? · 3 perguntas'}
              </Text>
            </View>
            <Text style={s.checkinCaret}>›</Text>
          </TouchableOpacity>
        </Link>

        {/* Histórico recente */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Histórico recente</Text>
          <Link href="/(tabs)/agenda" asChild>
            <TouchableOpacity>
              <Text style={s.sectionLink}>Ver agenda</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {ev.loading ? (
          <View style={s.listGroup}>
            <ActivityIndicator
              color={T.accent}
              size="small"
              style={{ paddingVertical: 28 }}
            />
          </View>
        ) : proximosEventos.length === 0 ? (
          <View style={[s.listGroup, { padding: 22, alignItems: 'center' }]}>
            <Ionicons name="calendar-outline" size={32} color={T.sub} style={{ marginBottom: 6 }} />
            <Text style={s.emptyTitle}>Sem registros ainda</Text>
            <Text style={s.emptySub}>
              Toque em &quot;Registrar lavagem&quot; ou nas ações abaixo para começar
            </Text>
          </View>
        ) : (
          <View style={s.listGroup}>
            {proximosEventos.map((e, i, arr) => {
              const meta = EVENT_LABEL[e.event_type];
              const iconMeta = EVENT_ICON[e.event_type];
              return (
                <View
                  key={e.id}
                  style={[s.listRow, i < arr.length - 1 && s.listRowBorder]}
                >
                  <View style={[s.listIconWrap, { backgroundColor: `${iconMeta.color}18` }]}>
                    <Ionicons name={iconMeta.name} size={20} color={iconMeta.color} />
                  </View>
                  <View style={s.listContent}>
                    <Text style={s.listDay}>{formatRelativeDate(e.occurred_at)}</Text>
                    <Text style={s.listName}>{meta.label}</Text>
                    {e.notes && (
                      <Text style={s.listNote} numberOfLines={1}>
                        {e.notes}
                      </Text>
                    )}
                  </View>
                  <View style={s.badgeDone}>
                    <Ionicons name="checkmark" size={12} color="#FFF" />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Registrar agora */}
        <View style={s.titleWrap}>
          <Text style={s.sectionTitle}>Registrar agora</Text>
        </View>

        <View style={s.quickGrid}>
          {([
            { iconName: 'water-outline' as const, iconColor: T.blue, name: 'Lavei o cabelo', sub: 'Marcar agora', type: 'wash' as const },
            { iconName: 'flask-outline' as const, iconColor: T.catHidratacao, name: 'Hidratação', sub: 'Máscara concluída', type: 'hydration_mask' as const },
            { iconName: 'leaf-outline' as const, iconColor: T.green, name: 'Nutrição', sub: 'Máscara nutritiva', type: 'nutrition_mask' as const },
            { iconName: 'flame-outline' as const, iconColor: '#FF6B35', name: 'Usei calor', sub: 'Secador, chapinha', type: 'heat_used' as const },
          ]).map((tile, i) => (
            <TouchableOpacity
              key={i}
              style={s.quickTile}
              onPress={() => quickLog(tile.type, tile.name)}
              activeOpacity={0.75}
            >
              <Ionicons name={tile.iconName} size={26} color={tile.iconColor} style={{ marginBottom: 10 }} />
              <Text style={s.qtName}>{tile.name}</Text>
              <Text style={s.qtSub}>{tile.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dica do dia */}
        {hp.data?.[0]?.tips?.[0] && (
          <>
            <View style={s.titleWrap}>
              <Text style={s.sectionTitle}>Dica do dia</Text>
            </View>
            <View style={s.tipCard}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={T.gold} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.tipLabel}>Juliane recomenda</Text>
                <Text style={s.tipText}>{hp.data[0].tips[0]}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SP.xl,
    paddingTop: 10,
    paddingBottom: 18,
  },
  headerName: { fontSize: 26, fontWeight: '800', color: T.dark, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: T.sub, marginTop: 2 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },

  // Pills
  pillRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SP.xl, paddingBottom: 14, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.surface, borderRadius: R.pill,
    paddingVertical: 6, paddingHorizontal: 12,
    ...SHADOW.pill,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 13, fontWeight: '600', color: T.dark },

  // Week calendar strip
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SP.l,
    paddingVertical: SP.m,
    marginBottom: SP.s,
  },
  weekDayCol: { alignItems: 'center', flex: 1 },
  weekDayName: {
    fontSize: 10,
    fontWeight: '700',
    color: T.sub,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  weekDayFuture: { color: T.sep },
  weekDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayCircleToday: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayNum: { fontSize: 14, fontWeight: '700', color: T.dark },
  weekDayNumToday: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  weekEventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: T.green,
    marginTop: 4,
  },
  weekEventDotEmpty: { width: 5, height: 5, marginTop: 4 },

  // Hero card
  heroCard: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
  },
  heroEyebrow: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
  },
  heroTitle: {
    fontSize: 28, fontWeight: '800', color: '#FFF', letterSpacing: -0.8, lineHeight: 34,
    marginBottom: 6,
  },
  heroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 19, marginBottom: 14 },
  heroTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: R.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  heroTagText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  heroFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', paddingTop: 14,
  },
  heroNextLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroNextValue: { fontSize: 13, fontWeight: '700', color: '#FFF', marginTop: 2 },
  heroBtn: {
    backgroundColor: 'rgba(255,255,255,0,)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: R.pill, paddingVertical: 8, paddingHorizontal: 14,
  },
  heroBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  // Section titles
  titleWrap: { paddingHorizontal: SP.xl, paddingTop: SP.xl, paddingBottom: 10 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingHorizontal: SP.xl, paddingTop: SP.xl, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: T.dark },
  sectionLink: { fontSize: 14, color: T.accent, fontWeight: '600' },

  // Today card
  todayCard: {
    marginHorizontal: SP.l, marginBottom: SP.m,
    backgroundColor: T.surface, borderRadius: R.xl, overflow: 'hidden',
    ...SHADOW.card,
  },
  todayMain: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderBottomWidth: 1, borderBottomColor: T.sep,
  },
  todayText: { flex: 1 },
  todayTag: {
    fontSize: 11, fontWeight: '700', color: T.accent,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  todayName: { fontSize: 16, fontWeight: '700', color: T.dark, marginTop: 2 },
  todayProduct: { fontSize: 13, color: T.sub, marginTop: 2 },
  todayChevron: { fontSize: 18, color: T.sep },
  todayAction: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 16 },
  todayActionText: { fontSize: 14, color: T.accent, fontWeight: '600', flex: 1 },
  todayActionChevron: { fontSize: 14, color: T.sep },

  // Check-in card
  checkinCard: {
    marginHorizontal: SP.l, marginBottom: SP.m,
    backgroundColor: T.dark, borderRadius: R.xl,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16,
    ...SHADOW.cardLg,
  },
  checkinText: { flex: 1 },
  checkinTitle: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  checkinSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  checkinCaret: { fontSize: 20, color: 'rgba(255,255,255,0.35)' },

  // List group
  listGroup: {
    marginHorizontal: SP.l,
    backgroundColor: T.surface, borderRadius: R.xl, overflow: 'hidden',
    ...SHADOW.card,
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, paddingHorizontal: 18,
  },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: T.sep },
  listIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { flex: 1 },
  listDay: { fontSize: 11, color: T.sub, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  listName: { fontSize: 15, fontWeight: '600', color: T.dark, marginTop: 1 },
  listNote: { fontSize: 13, color: T.sub, marginTop: 1 },
  badgeDone: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: T.green, alignItems: 'center', justifyContent: 'center',
  },

  emptyTitle: { fontSize: 14, fontWeight: '700', color: T.dark, marginTop: 4 },
  emptySub: { fontSize: 12, color: T.sub, marginTop: 4, textAlign: 'center', lineHeight: 17 },

  // Quick grid
  quickGrid: {
    marginHorizontal: SP.l,
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  quickTile: {
    width: '47.5%',
    backgroundColor: T.surface, borderRadius: R.xl,
    padding: 16,
    ...SHADOW.card,
  },
  qtName: { fontSize: 14, fontWeight: '700', color: T.dark, letterSpacing: -0.2 },
  qtSub: { fontSize: 12, color: T.sub, marginTop: 3 },

  // Tip
  tipCard: {
    marginHorizontal: SP.l, marginBottom: SP.s,
    backgroundColor: T.surface, borderRadius: R.xl,
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
    padding: 16,
    ...SHADOW.card,
  },
  tipLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, color: T.gold, marginBottom: 4,
  },
  tipText: { fontSize: 14, color: T.mid, lineHeight: 21 },
});
