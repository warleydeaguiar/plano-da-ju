import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  bg: '#1C1C1E', card: '#2C2C2E', cardAlt: '#3A3A3C',
  pink: '#C4607A', green: '#34C759', yellow: '#FFD60A',
  text: '#FFFFFF', sub: '#8E8E93', border: 'rgba(255,255,255,0.08)',
};

const weeks = [
  { week: 1, focus: 'Detox e preparação do couro cabeludo', done: true },
  { week: 2, focus: 'Hidratação profunda — poros abertos', done: true },
  { week: 3, focus: 'Nutrição com proteína vegetal', done: true },
  { week: 4, focus: 'Hidratação + nutrição combinadas', done: false, current: true },
  { week: 5, focus: 'Reconstrução capilar leve', done: false },
  { week: 6, focus: 'Selagem com óleo de rícino', done: false },
];

const products = [
  { name: 'Shampoo Lowpoo Iberaparis', type: 'Limpeza', price: 'R$45,90', tag: 'Recomendado' },
  { name: 'Máscara Hidratação Iberaparis', type: 'Hidratação', price: 'R$52,90', tag: 'Principal' },
  { name: 'Óleo de Argan Iberaparis', type: 'Nutrição', price: 'R$38,90', tag: 'Recomendado' },
  { name: 'Leave-in Iberaparis', type: 'Finalização', price: 'R$34,90', tag: 'Opcional' },
];

export default function PlanoScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Meu Plano</Text>

        {/* Perfil */}
        <View style={s.profileCard}>
          <View style={s.profileRow}>
            <Text style={{ fontSize: 28 }}>🌀</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.profileName}>Maria Fernanda</Text>
              <Text style={s.profileSub}>Cacheado · Alta porosidade · Ressecamento</Text>
            </View>
          </View>
          <View style={s.tagRow}>
            {['Sem química', 'Rotina semanal', 'Foco: hidratação'].map((t, i) => (
              <View key={i} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
            ))}
          </View>
        </View>

        {/* Cronograma */}
        <Text style={s.sectionLabel}>CRONOGRAMA — 52 SEMANAS</Text>
        {weeks.map((w, i) => (
          <View key={i} style={[s.weekCard, w.current && s.weekCurrent]}>
            <View style={[s.weekBadge, w.done && s.weekDone, w.current && s.weekBadgeCurrent]}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: w.done ? C.green : w.current ? '#FFF' : C.sub }}>
                {w.done ? '✓' : `S${w.week}`}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.weekLabel, w.current && { color: C.pink }]}>
                {w.current ? '📍 Semana atual' : `Semana ${w.week}`}
              </Text>
              <Text style={s.weekFocus}>{w.focus}</Text>
            </View>
          </View>
        ))}
        <Text style={[s.sectionLabel, { textAlign: 'center', marginTop: 4 }]}>· · · 46 semanas restantes · · ·</Text>

        {/* Produtos */}
        <Text style={s.sectionLabel}>PRODUTOS RECOMENDADOS</Text>
        {products.map((p, i) => (
          <View key={i} style={s.productCard}>
            <View style={s.productIcon}><Text style={{ fontSize: 20 }}>🧴</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.productName}>{p.name}</Text>
              <Text style={s.productType}>{p.type} · {p.price}</Text>
            </View>
            <View style={[s.productBadge, p.tag === 'Principal' && { backgroundColor: 'rgba(196,96,122,0.2)' }]}>
              <Text style={[s.productBadgeText, p.tag === 'Principal' && { color: C.pink }]}>{p.tag}</Text>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: '#FFF', letterSpacing: -0.5, marginBottom: 4 },
  profileCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  profileRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  profileName: { fontSize: 16, fontWeight: '700', color: C.text },
  profileSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: { backgroundColor: C.cardAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, color: C.sub },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  weekCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  weekCurrent: { borderColor: 'rgba(196,96,122,0.4)', backgroundColor: '#2A1820' },
  weekBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },
  weekDone: { backgroundColor: 'rgba(52,199,89,0.15)' },
  weekBadgeCurrent: { backgroundColor: C.pink },
  weekLabel: { fontSize: 11, color: C.sub, marginBottom: 2 },
  weekFocus: { fontSize: 13, color: C.text, fontWeight: '500' },
  productCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  productIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 13, fontWeight: '600', color: C.text },
  productType: { fontSize: 11, color: C.sub, marginTop: 2 },
  productBadge: { backgroundColor: 'rgba(142,142,147,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  productBadgeText: { fontSize: 10, fontWeight: '700', color: C.sub },
});
