import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const C = {
  bg: '#1C1C1E', card: '#2C2C2E', cardAlt: '#3A3A3C',
  pink: '#C4607A', green: '#34C759',
  text: '#FFFFFF', sub: '#8E8E93', border: 'rgba(255,255,255,0.08)',
};

const questions = [
  {
    id: 'hair_feel',
    question: 'Como está seu cabelo agora?',
    context: 'Dia 3 desde a última lavagem',
    options: [
      { label: 'Seco e sem vida', icon: '🥲', value: 'seco' },
      { label: 'Normal, tudo bem', icon: '😊', value: 'normal' },
      { label: 'Oleoso na raiz', icon: '💦', value: 'oleoso' },
      { label: 'Ótimo, macio', icon: '✨', value: 'otimo' },
    ],
  },
  {
    id: 'breakage',
    question: 'Notou queda ou quebra hoje?',
    context: null,
    options: [
      { label: 'Sim, bastante', icon: '😟', value: 'sim_muito' },
      { label: 'Só um pouco', icon: '🤔', value: 'sim_pouco' },
      { label: 'Não notei nada', icon: '👍', value: 'nao' },
    ],
  },
];

export default function CheckinScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={{ color: C.text, fontSize: 16 }}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Check-in</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Progress */}
      <View style={s.progress}>
        <View style={s.progressFill} />
      </View>
      <Text style={s.progressText}>Pergunta 1 de {questions.length}</Text>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.contextBadge}>
          <Text style={s.contextText}>📅 {questions[0].context}</Text>
        </View>

        <Text style={s.question}>{questions[0].question}</Text>

        <View style={s.optGrid}>
          {questions[0].options.map((o, i) => (
            <TouchableOpacity key={i} style={s.optCard} onPress={() => {}}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>{o.icon}</Text>
              <Text style={s.optLabel}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backBtn: { width: 70 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  progress: { height: 4, backgroundColor: C.card, marginHorizontal: 20 },
  progressFill: { height: 4, width: '50%', backgroundColor: C.pink, borderRadius: 2 },
  progressText: { fontSize: 11, color: C.sub, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  scroll: { padding: 20, paddingBottom: 40 },
  contextBadge: { backgroundColor: 'rgba(196,96,122,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 20 },
  contextText: { fontSize: 12, color: C.pink },
  question: { fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.5, marginBottom: 24, lineHeight: 30 },
  optGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  optCard: { flex: 1, minWidth: '45%', backgroundColor: C.card, borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  optLabel: { fontSize: 13, color: C.text, textAlign: 'center', lineHeight: 18 },
});
