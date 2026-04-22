import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const W = Dimensions.get('window').width;
const C = {
  bg: '#1C1C1E', card: '#2C2C2E', cardAlt: '#3A3A3C',
  pink: '#C4607A', green: '#34C759', yellow: '#FFD60A',
  text: '#FFFFFF', sub: '#8E8E93', border: 'rgba(255,255,255,0.08)',
};

const scores = [
  { label: 'Hidratação', score: 4.2, prev: 3.5, icon: '💧' },
  { label: 'Brilho', score: 3.8, prev: 3.0, icon: '✨' },
  { label: 'Frizz', score: 2.1, prev: 3.2, icon: '🌀', lower: true },
  { label: 'Pontas', score: 3.5, prev: 2.8, icon: '✂️' },
];

const achievements = [
  { icon: '🔥', label: '30 dias de rotina', done: false, progress: 4 },
  { icon: '📏', label: 'Cabelo cresceu 3cm', done: false, progress: 40 },
  { icon: '💧', label: 'Hidratação consistente', done: true },
  { icon: '✨', label: 'Brilho recuperado', done: false, progress: 75 },
];

export default function EvolucaoScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Evolução</Text>

        {/* Foto Antes/Depois */}
        <View style={s.photoCard}>
          <Text style={s.cardLabel}>ANTES E DEPOIS</Text>
          <View style={s.photoRow}>
            <View style={s.photoBox}>
              <View style={s.photoPlaceholder}><Text style={{ fontSize: 32 }}>📷</Text></View>
              <Text style={s.photoLabel}>Semana 1</Text>
            </View>
            <View style={s.photoArrow}><Text style={{ color: C.pink, fontSize: 22 }}>→</Text></View>
            <View style={s.photoBox}>
              <View style={[s.photoPlaceholder, { borderColor: C.pink }]}><Text style={{ fontSize: 32 }}>🌟</Text></View>
              <Text style={s.photoLabel}>Hoje</Text>
            </View>
          </View>
          <TouchableOpacity style={s.btnOutline}>
            <Text style={s.btnOutlineText}>📸 Registrar nova foto</Text>
          </TouchableOpacity>
        </View>

        {/* Análise IA */}
        <View style={s.card}>
          <Text style={s.cardLabel}>ANÁLISE DA IA — ÚLTIMA FOTO</Text>
          {scores.map((sc, i) => {
            const diff = sc.lower
              ? sc.prev - sc.score
              : sc.score - sc.prev;
            const pct = (sc.score / 5) * 100;
            return (
              <View key={i} style={s.scoreRow}>
                <Text style={{ fontSize: 18, width: 28 }}>{sc.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={s.scoreLabel}>{sc.label}</Text>
                    <Text style={[s.scoreDiff, { color: diff > 0 ? C.green : C.pink }]}>
                      {diff > 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}
                    </Text>
                  </View>
                  <View style={s.scoreBg}>
                    <View style={[s.scoreFill, { width: `${pct}%` }]} />
                  </View>
                </View>
                <Text style={s.scoreVal}>{sc.score.toFixed(1)}</Text>
              </View>
            );
          })}
          <Text style={[s.aiFeedback]}>
            "Cabelo com boa hidratação. Pontas pedem atenção — priorize nutrição nas próximas 2 semanas."
          </Text>
        </View>

        {/* Conquistas */}
        <Text style={s.sectionLabel}>CONQUISTAS</Text>
        {achievements.map((a, i) => (
          <View key={i} style={[s.achieveCard, a.done && s.achieveDone]}>
            <Text style={{ fontSize: 24 }}>{a.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.achieveLabel}>{a.label}</Text>
              {!a.done && a.progress !== undefined && (
                <View style={s.achieveBar}>
                  <View style={[s.achieveFill, { width: `${a.progress}%` }]} />
                </View>
              )}
            </View>
            <Text style={{ color: a.done ? C.green : C.sub, fontSize: 18 }}>
              {a.done ? '✓' : `${a.progress}%`}
            </Text>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: '#FFF', letterSpacing: -0.5 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  photoCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  cardLabel: { fontSize: 11, fontWeight: '600', color: C.pink, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  photoBox: { flex: 1, alignItems: 'center', gap: 8 },
  photoPlaceholder: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: C.cardAlt, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  photoArrow: { width: 32, alignItems: 'center' },
  photoLabel: { fontSize: 12, color: C.sub },
  btnOutline: { borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 12, alignItems: 'center' },
  btnOutlineText: { color: C.text, fontSize: 14, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  scoreLabel: { fontSize: 13, color: C.text },
  scoreDiff: { fontSize: 12, fontWeight: '600' },
  scoreBg: { height: 6, backgroundColor: C.cardAlt, borderRadius: 3 },
  scoreFill: { height: 6, backgroundColor: C.pink, borderRadius: 3 },
  scoreVal: { fontSize: 13, fontWeight: '700', color: C.text, width: 28, textAlign: 'right' },
  aiFeedback: { fontSize: 12, color: C.sub, fontStyle: 'italic', marginTop: 8, lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: C.sub, letterSpacing: 1, textTransform: 'uppercase' },
  achieveCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border },
  achieveDone: { borderColor: 'rgba(52,199,89,0.3)', backgroundColor: '#1A2A1E' },
  achieveLabel: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 },
  achieveBar: { height: 4, backgroundColor: C.cardAlt, borderRadius: 2 },
  achieveFill: { height: 4, backgroundColor: C.pink, borderRadius: 2 },
});
