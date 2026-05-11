import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHairEvents, type HairEvent } from '../../lib/hooks';
import { T, SHADOW, R, SP } from '../../lib/theme/tokens';

const DAY_NAMES_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const EVENT_META: Record<
  HairEvent['event_type'],
  { icon: string; label: string; categoryColor: string }
> = {
  wash: { icon: '🚿', label: 'Lavagem', categoryColor: T.catLavagem },
  hydration_mask: { icon: '💧', label: 'Hidratação', categoryColor: T.catHidratacao },
  nutrition_mask: { icon: '🌿', label: 'Nutrição', categoryColor: T.catNutricao },
  reconstruction: { icon: '💪', label: 'Reconstrução', categoryColor: T.catReconstrucao },
  oil_treatment: { icon: '✨', label: 'Óleo', categoryColor: T.catFinalizacao },
  heat_used: { icon: '💨', label: 'Calor', categoryColor: T.gold },
  sun_exposure: { icon: '☀️', label: 'Sol', categoryColor: T.gold },
  cut: { icon: '✂️', label: 'Corte', categoryColor: T.dark },
  chemical: { icon: '🧪', label: 'Química', categoryColor: T.purple },
};

function eventDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function buildWeek(): Array<{ short: string; num: number; key: string; isToday: boolean }> {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday
  // Start the strip on Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week.push({
      short: DAY_NAMES_PT[d.getDay()],
      num: d.getDate(),
      key: d.toISOString().slice(0, 10),
      isToday: d.toDateString() === today.toDateString(),
    });
  }
  return week;
}

export default function AgendaScreen() {
  const today = useMemo(() => new Date(), []);
  const { data: events, loading, refresh } = useHairEvents(120);
  const week = useMemo(() => buildWeek(), []);
  const [selectedKey, setSelectedKey] = useState<string>(
    today.toISOString().slice(0, 10),
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, HairEvent[]>();
    (events ?? []).forEach(e => {
      const key = eventDateKey(e.occurred_at);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    });
    return map;
  }, [events]);

  const selectedEvents = eventsByDay.get(selectedKey) ?? [];

  // Eventos da semana inteira para a lista "Esta semana"
  const weekKeys = new Set(week.map(d => d.key));
  const weekEvents = useMemo(
    () =>
      (events ?? []).filter(e => weekKeys.has(eventDateKey(e.occurred_at))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, week],
  );

  function eventDayLabel(iso: string) {
    const d = new Date(iso);
    return `${DAY_NAMES_PT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={T.accent}
          />
        }
      >
        <View style={s.header}>
          <Text style={s.headerTitle}>Agenda</Text>
          <Text style={s.headerSub}>
            {MONTHS_PT[today.getMonth()]} {today.getFullYear()}
          </Text>
        </View>

        {/* Week strip */}
        <View style={s.weekStrip}>
          {week.map(day => {
            const active = day.key === selectedKey;
            const hasEvents = (eventsByDay.get(day.key) ?? []).length > 0;
            return (
              <TouchableOpacity
                key={day.key}
                style={[s.dayBtn, active && s.dayBtnActive]}
                onPress={() => setSelectedKey(day.key)}
              >
                <Text style={[s.dayShort, active && s.dayShortActive]}>
                  {day.short}
                </Text>
                <Text style={[s.dayNum, active && s.dayNumActive]}>
                  {day.num}
                </Text>
                {hasEvents && (
                  <View
                    style={[
                      s.dayDot,
                      { backgroundColor: active ? '#FFF' : T.accent },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day events */}
        <View style={s.titleWrap}>
          <Text style={s.sectionTitle}>
            {selectedKey === today.toISOString().slice(0, 10)
              ? 'Hoje'
              : new Date(selectedKey).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}
          </Text>
        </View>

        {selectedEvents.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={{ fontSize: 36 }}>🌸</Text>
            <Text style={s.emptyTitle}>Sem registros nesse dia</Text>
            <Text style={s.emptySub}>
              Use a tela inicial para registrar lavagens, hidratações e mais.
            </Text>
          </View>
        ) : (
          <View style={s.listGroup}>
            {selectedEvents.map((ev, i) => {
              const meta = EVENT_META[ev.event_type];
              return (
                <View
                  key={ev.id}
                  style={[s.eventRow, i < selectedEvents.length - 1 && s.eventBorder]}
                >
                  <View
                    style={[
                      s.eventLeftIcon,
                      { backgroundColor: meta.categoryColor + '20' },
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{meta.icon}</Text>
                  </View>
                  <View style={s.eventContent}>
                    <View
                      style={[
                        s.eventTipoChip,
                        { backgroundColor: meta.categoryColor + '15' },
                      ]}
                    >
                      <Text
                        style={[
                          s.eventTipoText,
                          { color: meta.categoryColor },
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </View>
                    <Text style={s.eventTime}>
                      {new Date(ev.occurred_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    {ev.notes && (
                      <Text style={s.eventNotes}>{ev.notes}</Text>
                    )}
                  </View>
                  <View style={s.badgeDone}>
                    <Text style={{ color: '#FFF', fontSize: 11 }}>✓</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Esta semana — todos os eventos */}
        {weekEvents.length > 0 && (
          <>
            <View style={s.titleWrap}>
              <Text style={s.sectionTitle}>Esta semana</Text>
            </View>
            <View style={s.listGroup}>
              {weekEvents
                .sort(
                  (a, b) =>
                    new Date(b.occurred_at).getTime() -
                    new Date(a.occurred_at).getTime(),
                )
                .map((ev, i, arr) => {
                  const meta = EVENT_META[ev.event_type];
                  return (
                    <View
                      key={ev.id}
                      style={[
                        s.weekRow,
                        i < arr.length - 1 && s.eventBorder,
                      ]}
                    >
                      <View style={s.weekLeft}>
                        <Text style={s.weekDate}>
                          {eventDayLabel(ev.occurred_at)}
                        </Text>
                      </View>
                      <Text style={s.weekIcon}>{meta.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.weekLabel}>{meta.label}</Text>
                        {ev.notes && (
                          <Text style={s.weekNotes} numberOfLines={1}>
                            {ev.notes}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 24 },

  header: { paddingHorizontal: SP.xl, paddingTop: SP.l, paddingBottom: SP.s },
  headerTitle: { fontSize: 28, fontWeight: '800', color: T.dark, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: T.sub, marginTop: 2 },

  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: SP.m,
    gap: 6,
    paddingBottom: 16,
    paddingTop: 4,
  },
  dayBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: T.surface,
    ...SHADOW.card,
    minHeight: 56,
    justifyContent: 'center',
  },
  dayBtnActive: { backgroundColor: T.accent },
  dayShort: { fontSize: 10, fontWeight: '700', color: T.sub, letterSpacing: 0.3 },
  dayShortActive: { color: 'rgba(255,255,255,0.85)' },
  dayNum: { fontSize: 16, fontWeight: '800', color: T.dark, marginTop: 2 },
  dayNumActive: { color: '#FFF' },
  dayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },

  titleWrap: {
    paddingHorizontal: SP.xl,
    paddingTop: SP.xl,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: T.dark,
    letterSpacing: -0.3,
  },

  emptyCard: {
    marginHorizontal: SP.l,
    backgroundColor: T.surface,
    borderRadius: R.xl,
    padding: 28,
    alignItems: 'center',
    ...SHADOW.card,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: T.dark, marginTop: 8 },
  emptySub: {
    fontSize: 12,
    color: T.sub,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 17,
  },

  listGroup: {
    marginHorizontal: SP.l,
    backgroundColor: T.surface,
    borderRadius: R.xl,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  eventRow: {
    flexDirection: 'row',
    paddingHorizontal: SP.l,
    paddingVertical: 14,
    gap: 12,
    alignItems: 'center',
  },
  eventBorder: { borderTopWidth: 1, borderTopColor: T.sep },
  eventLeftIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventContent: { flex: 1, gap: 4 },
  eventTipoChip: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: R.pill,
  },
  eventTipoText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  eventTime: { fontSize: 12, color: T.sub, fontWeight: '500' },
  eventNotes: { fontSize: 13, color: T.mid, lineHeight: 18 },
  badgeDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.green,
    alignItems: 'center',
    justifyContent: 'center',
  },

  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: SP.l,
    paddingVertical: 12,
    gap: 12,
    alignItems: 'center',
  },
  weekLeft: { width: 50 },
  weekDate: {
    fontSize: 11,
    fontWeight: '700',
    color: T.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  weekIcon: { fontSize: 22 },
  weekLabel: { fontSize: 14, fontWeight: '700', color: T.dark },
  weekNotes: { fontSize: 12, color: T.sub, marginTop: 1 },
});
