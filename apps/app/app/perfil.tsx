import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const C = {
  bg: '#1C1C1E', card: '#2C2C2E', cardAlt: '#3A3A3C',
  pink: '#C4607A', green: '#34C759', red: '#FF453A',
  text: '#FFFFFF', sub: '#8E8E93', border: 'rgba(255,255,255,0.08)',
};

const menuItems = [
  { icon: '💆‍♀️', label: 'Dados do cabelo', sub: 'Cacheado · Alta porosidade' },
  { icon: '🔔', label: 'Notificações', sub: 'Lembretes de cuidados' },
  { icon: '🔐', label: 'Segurança', sub: 'Senha e acesso' },
  { icon: '📞', label: 'Falar com a Juliane', sub: 'Suporte via WhatsApp' },
  { icon: '⭐', label: 'Avaliar o app', sub: 'App Store / Google Play' },
];

export default function PerfilScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={{ fontSize: 40 }}>👤</Text>
          </View>
          <Text style={s.name}>Maria Fernanda</Text>
          <Text style={s.email}>maria@email.com</Text>
        </View>

        {/* Assinatura */}
        <View style={s.planCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 24 }}>💳</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.planLabel}>Plano Anual</Text>
              <Text style={s.planSub}>Renova em 15/04/2027 · R$34,90/ano</Text>
            </View>
            <View style={s.activeBadge}>
              <Text style={s.activeBadgeText}>Ativo</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: 'Semana', value: '4' },
            { label: 'Check-ins', value: '18' },
            { label: 'Streak', value: '4 dias' },
          ].map((st, i) => (
            <View key={i} style={s.statBox}>
              <Text style={s.statValue}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={s.menuCard}>
          {menuItems.map((item, i) => (
            <TouchableOpacity key={i} style={[s.menuItem, i < menuItems.length - 1 && s.menuBorder]}>
              <Text style={{ fontSize: 20, width: 28 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuSub}>{item.sub}</Text>
              </View>
              <Text style={{ color: C.sub, fontSize: 16 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn}>
          <Text style={s.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={s.version}>Plano da Ju v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderColor: C.pink },
  name: { fontSize: 20, fontWeight: '700', color: C.text },
  email: { fontSize: 13, color: C.sub, marginTop: 4 },
  planCard: { backgroundColor: '#2A1820', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(196,96,122,0.3)' },
  planLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  planSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  activeBadge: { backgroundColor: 'rgba(52,199,89,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: C.green },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  statValue: { fontSize: 20, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 11, color: C.sub, marginTop: 4 },
  menuCard: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  menuLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  menuSub: { fontSize: 12, color: C.sub, marginTop: 1 },
  logoutBtn: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)', padding: 16, alignItems: 'center' },
  logoutText: { color: C.red, fontSize: 14, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, color: C.sub },
});
