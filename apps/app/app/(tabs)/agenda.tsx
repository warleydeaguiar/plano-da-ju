import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  bg: '#1C1C1E', card: '#2C2C2E', cardAlt: '#3A3A3C',
  pink: '#C4607A', pinkLight: 'rgba(196,96,122,0.15)',
  green: '#34C759', blue: '#0A84FF',
  text: '#FFFFFF', sub: '#8E8E93', border: 'rgba(255,255,255,0.08)',
};

const WEEK = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const DAYS = [21, 22, 23, 24, 25, 26, 27];

const events = [
  { day: 22, icon: '🚿', label: 'Lavagem lowpoo', color: C.blue, time: 'Manhã' },
  { day: 23, icon: '🧴', label: 'Máscara de hidratação', color: C.pink, time: 'Noite' },
  { day: 25, icon: '🚿', label: 'Lavagem co-wash', color: C.blue, time: 'Manhã' },
  { day: 26, icon: '💧', label: 'Óleo de reparação', color: C.green, time: 'Qualquer hora' },
  { day: 27, icon: '🧴', label: 'Máscara de nutrição', color: C.pink, time: 'Tarde' },
];

export default function AgendaScreen() {
  const today = 22;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Agenda</Text>
        <Text style={s.pageSub}>Semana 4 de 52 · Abril 2026</Text>

        {/* Week Row */}
        <View style={s.weekRow}>
          {DAYS.map((d, i) => (
            <TouchableOpacity key={i} style={[s.dayPill, d === today && s.dayPillActive]}>
              <Text style={[s.dayLabel, d === today && { color: '#FFF' }]}>{WEEK[i]}</Text>
              <Text style={[s.dayNum, d === today && { color: '#FFF', fontWeight: '700' }]}>{d}</Text>
              {events.some(e => e.day === d) && (
                <View style={[s.dot, { backgroundColor: d === today ? '#FFF' : C.pink }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Events for the week */}
        <Text style={s.sectionLabel}>CUIDADOS DA SEMANA</Text>
        {events.map((e, i) => (
          <View key={i} style={s.eventCard}>
            <View style={[s.eventIconBox, { backgroundColor: e.color + '20' }]}>
              <Text style={{ fontSize: 22 }}>{e.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.eventDay}>
                {WEEK[DAYS.indexOf(e.day)]} {e.day}/04 · {e.time}
              </Text>
              <Text style={s.eventName}>{e.label}</Text>
            </View>
            <TouchableOpacity style={s.checkBtn}>
              <Text style={{ color: C.green, fontSize: 18 }}>○</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Event */}
        <TouchableOpacity style={s.addBtn}>
          <Text style={s.addBtnText}>+ Registrar cuidado manual</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: '#FFF', letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: C.sub, marginTop: 2, marginBottom: 8 },
  weekRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  dayPill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: C.card },
  dayPillActive: { backgroundColor: C.pink },
  dayLabel: { fontSize: 10, color: C.sub, marginBottom: 4 },
  dayNum: { fontSize: 15, color: C.text },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: C.sub, letterSpacing: 1, textTransform: 'uppercase' },
  eventCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border },
  eventIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eventDay: { fontSize: 11, color: C.sub, marginBottom: 2 },
  eventName: { fontSize: 14, fontWeight: '600', color: C.text },
  checkBtn: { padding: 4 },
  addBtn: { borderRadius: 14, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', padding: 16, alignItems: 'center' },
  addBtnText: { color: C.sub, fontSize: 14 },
});
