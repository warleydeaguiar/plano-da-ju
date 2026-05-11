import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProducts, type Product } from '../../lib/hooks';
import { T, SHADOW, R, SP } from '../../lib/theme/tokens';

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'limpeza', label: 'Limpeza' },
  { key: 'hidratacao', label: 'Hidratação' },
  { key: 'nutricao', label: 'Nutrição' },
  { key: 'reconstrucao', label: 'Reconstrução' },
  { key: 'finalizacao', label: 'Finalização' },
];

const CATEGORY_EMOJI: Record<string, string> = {
  limpeza: '🧴',
  hidratacao: '💧',
  nutricao: '🌿',
  reconstrucao: '💪',
  finalizacao: '✨',
  tratamento: '🎭',
};

const CATEGORY_COLOR: Record<string, string> = {
  limpeza: T.catLavagem,
  hidratacao: T.catHidratacao,
  nutricao: T.catNutricao,
  reconstrucao: T.catReconstrucao,
  finalizacao: T.catFinalizacao,
  tratamento: T.catReconstrucao,
};

function ProductCard({ item }: { item: Product }) {
  const emoji = CATEGORY_EMOJI[item.category] ?? '🧴';
  const color = CATEGORY_COLOR[item.category] ?? T.accent;

  function open() {
    if (!item.affiliate_url) {
      Alert.alert(
        'Link em breve',
        'Esse produto ainda não tem link de compra disponível.',
      );
      return;
    }
    Linking.openURL(item.affiliate_url).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o link'),
    );
  }

  return (
    <TouchableOpacity style={s.prodCard} onPress={open}>
      <View
        style={[
          s.prodImage,
          { backgroundColor: color + '15' },
        ]}
      >
        <Text style={s.prodEmoji}>{emoji}</Text>
        {item.is_iberaparis && (
          <View style={s.affBadge}>
            <Text style={s.affText}>🔗 Afiliado</Text>
          </View>
        )}
      </View>
      <View style={s.prodInfo}>
        <Text style={s.prodMarca}>{item.brand}</Text>
        <Text style={s.prodNome} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={s.prodBottom}>
          <Text style={s.prodPreco}>
            {item.price_brl != null
              ? `R$ ${item.price_brl.toFixed(2).replace('.', ',')}`
              : '—'}
          </Text>
          {item.is_iberaparis && (
            <View style={[s.tag, { backgroundColor: T.rose50 }]}>
              <Text style={[s.tagText, { color: T.accent }]}>Iberaparis</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function LojaScreen() {
  const { data, loading, refresh } = useProducts();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (filter !== 'todos') {
      list = list.filter(p => p.category === filter);
    }
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(term) ||
          p.brand.toLowerCase().includes(term),
      );
    }
    return list;
  }, [data, filter, search]);

  const iberaparis = filtered.filter(p => p.is_iberaparis);
  const alternativas = filtered.filter(p => !p.is_iberaparis);

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
          <Text style={s.headerTitle}>Produtos</Text>
          <Text style={s.headerSub}>
            {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'} para você
          </Text>
        </View>

        <View style={s.searchBox}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Buscar produto ou marca…"
            placeholderTextColor={T.sub}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: T.sub, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterPill, filter === f.key && s.filterPillActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text
                style={[
                  s.filterText,
                  filter === f.key && s.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && !data && (
          <ActivityIndicator
            color={T.accent}
            style={{ marginTop: 30 }}
          />
        )}

        {!loading && filtered.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={{ fontSize: 36 }}>🔎</Text>
            <Text style={s.emptyTitle}>Nenhum produto encontrado</Text>
            <Text style={s.emptySub}>
              {data?.length
                ? 'Tente outra busca ou troque o filtro.'
                : 'O catálogo ainda está em construção pela Juliane.'}
            </Text>
          </View>
        )}

        {iberaparis.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionEmoji}>✨</Text>
              <Text style={s.sectionTitle}>Iberaparis</Text>
              <Text style={s.sectionSubText}>(curadoria da Ju)</Text>
            </View>
            <View style={s.gridWrap}>
              {iberaparis.map(item => (
                <View key={item.id} style={s.gridItem}>
                  <ProductCard item={item} />
                </View>
              ))}
            </View>
          </>
        )}

        {alternativas.length > 0 && (
          <>
            <View style={[s.sectionHeader, { marginTop: 20 }]}>
              <Text style={s.sectionEmoji}>💚</Text>
              <Text style={s.sectionTitle}>Alternativas acessíveis</Text>
            </View>
            <View style={s.gridWrap}>
              {alternativas.map(item => (
                <View key={item.id} style={s.gridItem}>
                  <ProductCard item={item} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 24 },

  header: { paddingHorizontal: SP.xl, paddingTop: SP.l, paddingBottom: SP.m },
  headerTitle: { fontSize: 28, fontWeight: '800', color: T.dark, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: T.sub, marginTop: 2 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: SP.l, marginBottom: SP.m,
    backgroundColor: T.surface, borderRadius: R.l,
    paddingHorizontal: 14, paddingVertical: 12,
    ...SHADOW.card,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: T.dark },

  filtersRow: { paddingHorizontal: SP.l, gap: 8, marginBottom: 4 },
  filterPill: {
    paddingVertical: 7, paddingHorizontal: 14,
    backgroundColor: T.surface, borderRadius: R.pill,
    borderWidth: 1, borderColor: T.sep,
  },
  filterPillActive: { backgroundColor: T.accent, borderColor: T.accent },
  filterText: { fontSize: 13, fontWeight: '700', color: T.sub },
  filterTextActive: { color: '#FFF' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SP.xl, paddingTop: SP.l, paddingBottom: 10,
  },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: T.dark, letterSpacing: -0.2 },
  sectionSubText: { fontSize: 12, color: T.sub, fontWeight: '500' },

  emptyCard: {
    marginHorizontal: SP.l,
    marginTop: 24,
    backgroundColor: T.surface,
    borderRadius: R.xl,
    padding: 28,
    alignItems: 'center',
    ...SHADOW.card,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: T.dark, marginTop: 8 },
  emptySub: { fontSize: 12, color: T.sub, marginTop: 4, textAlign: 'center', lineHeight: 17 },

  gridWrap: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: { width: '50%', padding: 4 },

  prodCard: {
    backgroundColor: T.surface,
    borderRadius: R.xl,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  prodImage: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  prodEmoji: { fontSize: 44 },
  affBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFF9E6',
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  affText: { fontSize: 10, fontWeight: '700', color: '#A0750A' },
  prodInfo: { padding: 12 },
  prodMarca: {
    fontSize: 10,
    color: T.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  prodNome: { fontSize: 13, fontWeight: '700', color: T.dark, marginTop: 3, lineHeight: 17 },
  prodBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  prodPreco: { fontSize: 14, fontWeight: '800', color: T.dark },
  tag: {
    borderRadius: R.pill,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  tagText: { fontSize: 10, fontWeight: '700' },
});
