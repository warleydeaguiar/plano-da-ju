import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  bg: '#1C1C1E',
  card: '#2C2C2E',
  cardAlt: '#3A3A3C',
  pink: '#C4607A',
  pinkLight: 'rgba(196,96,122,0.15)',
  green: '#34C759',
  greenLight: 'rgba(52,199,89,0.15)',
  yellow: '#FFD60A',
  text: '#FFFFFF',
  sub: '#8E8E93',
  border: 'rgba(255,255,255,0.08)',
};

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Boa tarde, Maria 👋</Text>
            <Text style={s.subGreeting}>Dia 3 desde a última lavagem</Text>
          </View>
          <Link href="/perfil" asChild>
            <TouchableOpacity style={s.avatar}>
              <Text style={{ fontSize: 20 }}>👤</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Recomendação do Dia */}
        <View style={[s.card, s.highlightCard]}>
          <Text style={s.cardLabel}>HOJE PARA VOCÊ</Text>
          <Text style={s.cardTitle}>🧴 Hora da máscara de hidratação!</Text>
          <Text style={s.cardBody}>Seu cronograma indica tratamento hoje. O cabelo está no 3º dia — momento ideal.</Text>
          <TouchableOpacity style={s.btnPrimary}>
            <Text style={s.btnPrimaryText}>Ver como fazer →</Text>
          </TouchableOpacity>
        </View>

        {/* Check-in */}
        <Link href="/checkin" asChild>
          <TouchableOpacity style={[s.card, s.checkinCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 28 }}>📊</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Check-in rápido</Text>
                <Text style={s.cardBody}>Como está seu cabelo hoje?</Text>
              </View>
              <Text style={{ color: C.pink, fontSize: 18 }}>›</Text>
            </View>
          </TouchableOpacity>
        </Link>

        {/* Progresso da Semana */}
        <View style={s.card}>
          <Text style={s.cardLabel}>SEMANA 4 DE 52</Text>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: '7%' }]} />
          </View>
          <View style={s.streakRow}>
            {['S','T','Q','Q','S','S','D'].map((d, i) => (
              <View key={i} style={[s.streakDay, i < 4 && s.streakDone]}>
                <Text style={{ fontSize: 10, color: i < 4 ? C.green : C.sub }}>{d}</Text>
              </View>
            ))}
          </View>
          <Text style={s.cardBody}>4 dias consecutivos seguindo a rotina 🔥</Text>
        </View>

        {/* Próximos Passos */}
        <View style={s.card}>
          <Text style={s.cardLabel}>PRÓXIMOS PASSOS</Text>
          {[
            { day: 'Amanhã', action: 'Lavagem com shampoo lowpoo', icon: '🚿' },
            { day: 'Sexta', action: 'Óleo de reparação nas pontas', icon: '💧' },
            { day: 'Sábado', action: 'Máscara de nutrição (20min)', icon: '🧴' },
          ].map((item, i) => (
            <View key={i} style={s.nextItem}>
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.sub, fontSize: 11 }}>{item.day}</Text>
                <Text style={{ color: C.text, fontSize: 14 }}>{item.action}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#FFF', letterSpacing: -0.5 },
  subGreeting: { fontSize: 13, color: C.sub, marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  highlightCard: { borderColor: 'rgba(196,96,122,0.3)', backgroundColor: '#2A1820' },
  checkinCard: { borderColor: 'rgba(196,96,122,0.2)' },
  cardLabel: { fontSize: 11, fontWeight: '600', color: C.pink, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 },
  cardBody: { fontSize: 13, color: C.sub, lineHeight: 18 },
  btnPrimary: { marginTop: 14, backgroundColor: C.pink, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  progressBar: { height: 6, backgroundColor: C.cardAlt, borderRadius: 3, marginVertical: 10 },
  progressFill: { height: 6, backgroundColor: C.pink, borderRadius: 3 },
  streakRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  streakDay: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },
  streakDone: { backgroundColor: C.greenLight },
  nextItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
});
