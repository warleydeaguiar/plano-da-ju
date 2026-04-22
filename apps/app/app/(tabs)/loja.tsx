import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  bg: '#1C1C1E', card: '#2C2C2E', cardAlt: '#3A3A3C',
  pink: '#C4607A', green: '#34C759', yellow: '#FFD60A',
  text: '#FFFFFF', sub: '#8E8E93', border: 'rgba(255,255,255,0.08)',
};

const categories = ['Todos', 'Hidratação', 'Nutrição', 'Limpeza', 'Finalização'];

const products = [
  { name: 'Shampoo Lowpoo Iberaparis', brand: 'Iberaparis', category: 'Limpeza', price: 'R$45,90', tag: 'Principal', icon: '🧴', recommended: true },
  { name: 'Máscara Mega Hidratação', brand: 'Iberaparis', category: 'Hidratação', price: 'R$52,90', tag: 'Principal', icon: '💆‍♀️', recommended: true },
  { name: 'Óleo de Argan Marroquino', brand: 'Iberaparis', category: 'Nutrição', price: 'R$38,90', tag: 'Principal', icon: '💧', recommended: true },
  { name: 'Leave-in Protetor Térmico', brand: 'Iberaparis', category: 'Finalização', price: 'R$34,90', tag: 'Principal', icon: '✨', recommended: true },
  { name: 'Co-wash Limpeza Suave', brand: 'Dabur Vatika', category: 'Limpeza', price: 'R$28,90', tag: 'Alternativo', icon: '🚿', recommended: false },
  { name: 'Máscara de Aloe Vera', brand: 'Salon Line', category: 'Hidratação', price: 'R$22,90', tag: 'Alternativo', icon: '🌿', recommended: false },
];

export default function LojaScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Produtos</Text>
        <Text style={s.pageSub}>Selecionados para o seu tipo de cabelo</Text>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
          <View style={s.catRow}>
            {categories.map((c, i) => (
              <TouchableOpacity key={i} style={[s.catPill, i === 0 && s.catPillActive]}>
                <Text style={[s.catText, i === 0 && { color: '#FFF' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Recommended Banner */}
        <View style={s.banner}>
          <Text style={{ fontSize: 20 }}>⭐</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>Produtos do seu plano</Text>
            <Text style={s.bannerSub}>Selecionados pela Juliane para cacheados com alta porosidade</Text>
          </View>
        </View>

        {/* Products */}
        {products.map((p, i) => (
          <View key={i} style={s.productCard}>
            <View style={[s.productIcon, { backgroundColor: p.recommended ? 'rgba(196,96,122,0.1)' : C.cardAlt }]}>
              <Text style={{ fontSize: 26 }}>{p.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.productName}>{p.name}</Text>
              <Text style={s.productBrand}>{p.brand} · {p.category}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Text style={s.productPrice}>{p.price}</Text>
                <View style={[s.badge, p.recommended ? s.badgePink : s.badgeGray]}>
                  <Text style={[s.badgeText, { color: p.recommended ? C.pink : C.sub }]}>{p.tag}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={s.buyBtn} onPress={() => {}}>
              <Text style={s.buyBtnText}>Comprar</Text>
            </TouchableOpacity>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: '#FFF', letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  catRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  catPill: { backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  catPillActive: { backgroundColor: C.pink },
  catText: { fontSize: 13, fontWeight: '600', color: C.sub },
  banner: { backgroundColor: '#2A1820', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(196,96,122,0.3)' },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  bannerSub: { fontSize: 12, color: C.sub, lineHeight: 16 },
  productCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  productIcon: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 13, fontWeight: '600', color: C.text, lineHeight: 18 },
  productBrand: { fontSize: 11, color: C.sub, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '700', color: C.text },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgePink: { backgroundColor: 'rgba(196,96,122,0.15)' },
  badgeGray: { backgroundColor: 'rgba(142,142,147,0.15)' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  buyBtn: { backgroundColor: C.pink, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  buyBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
