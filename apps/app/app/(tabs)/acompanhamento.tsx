import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { T, GRAD, SHADOW, R, SP } from '../../lib/theme/tokens';

type HairFeeling = 'great' | 'normal' | 'dry' | 'breaking' | 'oily' | null;
type RoutineFollow = 'all' | 'most' | 'little' | 'none' | null;
type HairStage = 'hydration' | 'nutrition' | 'reconstruction' | 'wash' | null;

const HAIR_FEELING_OPTIONS: { value: HairFeeling; label: string }[] = [
  { value: 'great', label: '😊 Ótimo' },
  { value: 'normal', label: '😐 Normal' },
  { value: 'dry', label: '😢 Ressecado' },
  { value: 'breaking', label: '😤 Quebrando' },
  { value: 'oily', label: '💧 Oleoso' },
];

const ROUTINE_OPTIONS: { value: RoutineFollow; label: string }[] = [
  { value: 'all', label: '✅ Segui tudo' },
  { value: 'most', label: '🔄 Maior parte' },
  { value: 'little', label: '⚠️ Pouco' },
  { value: 'none', label: '❌ Não segui' },
];

const STAGE_OPTIONS: { value: HairStage; label: string }[] = [
  { value: 'hydration', label: '💧 Hidratação' },
  { value: 'nutrition', label: '🌿 Nutrição' },
  { value: 'reconstruction', label: '💪 Reconstrução' },
  { value: 'wash', label: '🚿 Lavagem' },
];

const HISTORICO_MOCK = [
  {
    id: '1',
    date: '23 abr',
    question: 'Posso usar óleo de coco antes da máscara de hidratação?',
    answered: true,
    answeredAt: '24/abr',
    responsePreview: 'Sim! Mas aplique em pequena quantidade só nas pontas antes de lavar...',
  },
  {
    id: '2',
    date: '14 abr',
    question: 'Meu cabelo está ressecando mesmo seguindo a rotina, o que fazer?',
    answered: true,
    answeredAt: '15/abr',
    responsePreview: 'Vamos aumentar a frequência de hidratação para 2x por semana por enquanto...',
  },
  {
    id: '3',
    date: '7 abr',
    question: 'Posso trocar a máscara Iberaparis pela Salon Line?',
    answered: true,
    answeredAt: '8/abr',
    responsePreview: 'Pode sim! A Salon Line Restauração tem proteína similar e é uma boa opção...',
  },
];

export default function AcompanhamentoScreen() {
  const [hairFeeling, setHairFeeling] = useState<HairFeeling>(null);
  const [routineFollow, setRoutineFollow] = useState<RoutineFollow>(null);
  const [hairStage, setHairStage] = useState<HairStage>(null);
  const [question, setQuestion] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const canSubmit = hairFeeling !== null && routineFollow !== null && hairStage !== null;

  function handleSubmit() {
    Alert.alert('Enviado!', 'A Juliane responderá em até 48 horas úteis. ✨');
    setHairFeeling(null);
    setRoutineFollow(null);
    setHairStage(null);
    setQuestion('');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Acompanhamento</Text>
          <Text style={s.headerSub}>Tire dúvidas diretamente com a Ju</Text>
        </View>

        {/* Status card — available */}
        <View style={s.statusCard}>
          <View style={s.statusIconWrap}>
            <Ionicons name="chatbubble-outline" size={22} color={T.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.statusBadge}>DISPONÍVEL ESTA SEMANA</Text>
            <Text style={s.statusTitle}>Envie sua dúvida para a Ju</Text>
            <Text style={s.statusSub}>Resposta em até 48 horas úteis</Text>
          </View>
        </View>

        {/* Quota strip */}
        <View style={s.quotaCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.quotaTitle}>Esta semana</Text>
            <Text style={s.quotaSub}>Renova toda segunda-feira</Text>
          </View>
          <View style={s.quotaPill}>
            <Text style={s.quotaPillText}>0 de 1 usado</Text>
          </View>
        </View>

        {/* Form section */}
        <View style={s.titleWrap}>
          <Text style={s.sectionTitle}>Nova mensagem para a Ju</Text>
        </View>

        {/* Form header */}
        <LinearGradient
          colors={GRAD.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.formHeader}
        >
          <Text style={s.formHeaderTitle}>Como está seu cabelo agora?</Text>
          <Text style={s.formHeaderSub}>Responda rapidinho para a Ju entender sua situação</Text>
        </LinearGradient>

        {/* Q1 */}
        <View style={s.questionCard}>
          <Text style={s.questionLabel}>Como seu cabelo está esta semana?</Text>
          <View style={s.chipsWrap}>
            {HAIR_FEELING_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[s.chip, hairFeeling === opt.value && s.chipSelected]}
                onPress={() => setHairFeeling(opt.value)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipText, hairFeeling === opt.value && s.chipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Q2 */}
        <View style={s.questionCard}>
          <Text style={s.questionLabel}>Seguiu a rotina do seu plano?</Text>
          <View style={s.chipsWrap}>
            {ROUTINE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[s.chip, routineFollow === opt.value && s.chipSelected]}
                onPress={() => setRoutineFollow(opt.value)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipText, routineFollow === opt.value && s.chipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Q3 */}
        <View style={s.questionCard}>
          <Text style={s.questionLabel}>Em qual etapa você está?</Text>
          <View style={s.chipsWrap}>
            {STAGE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[s.chip, hairStage === opt.value && s.chipSelected]}
                onPress={() => setHairStage(opt.value)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipText, hairStage === opt.value && s.chipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Free text */}
        <View style={s.questionCard}>
          <Text style={s.questionLabel}>Sua pergunta para a Ju (opcional)</Text>
          <Text style={s.questionHint}>1 pergunta por semana — aproveite bem!</Text>
          <TextInput
            style={s.textArea}
            value={question}
            onChangeText={t => t.length <= 300 && setQuestion(t)}
            multiline
            placeholder="O que você quer perguntar para a Ju? Ex: Posso trocar a máscara X pela Y?"
            placeholderTextColor={T.sub}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{question.length} / 300</Text>
        </View>

        {/* Submit */}
        <View style={s.submitWrap}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
            style={{ opacity: canSubmit ? 1 : 0.5 }}
          >
            <LinearGradient
              colors={GRAD.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.submitBtn}
            >
              <Text style={s.submitBtnText}>Enviar para a Ju →</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={s.submitSub}>Resposta em até 48h úteis</Text>
        </View>

        {/* Histórico */}
        <View style={s.titleWrap}>
          <Text style={s.sectionTitle}>Histórico</Text>
        </View>

        <View style={s.historicoGroup}>
          {HISTORICO_MOCK.map((item, i) => (
            <View key={item.id}>
              <TouchableOpacity
                style={[s.historicoRow, i < HISTORICO_MOCK.length - 1 && s.historicoRowBorder]}
                onPress={() => setExpanded(expanded === item.id ? null : item.id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.historicoDate}>{item.date}</Text>
                  <Text style={s.historicoQuestion} numberOfLines={expanded === item.id ? undefined : 2}>
                    {item.question}
                  </Text>
                  {item.answered && (
                    <View style={s.answeredRow}>
                      <Ionicons name="checkmark-circle" size={14} color={T.green} />
                      <Text style={s.answeredText}>Respondido por Juliane · {item.answeredAt}</Text>
                    </View>
                  )}
                  {expanded === item.id && item.answered && (
                    <View style={s.responseBox}>
                      <Text style={s.responseText}>{item.responsePreview}</Text>
                    </View>
                  )}
                </View>
                <Ionicons
                  name={expanded === item.id ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={T.sub}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 100 },

  header: {
    paddingHorizontal: SP.xl,
    paddingTop: 10,
    paddingBottom: 18,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: T.dark, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: T.sub, marginTop: 2 },

  // Status card
  statusCard: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    backgroundColor: T.surface,
    borderRadius: R.xxl,
    borderWidth: 1.5,
    borderColor: T.green,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    ...SHADOW.card,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F8EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: T.green,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statusTitle: { fontSize: 15, fontWeight: '700', color: T.dark },
  statusSub: { fontSize: 13, color: T.sub, marginTop: 2 },

  // Quota
  quotaCard: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    backgroundColor: T.surface,
    borderRadius: R.xl,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    ...SHADOW.card,
  },
  quotaTitle: { fontSize: 14, fontWeight: '700', color: T.dark },
  quotaSub: { fontSize: 12, color: T.sub, marginTop: 2 },
  quotaPill: {
    backgroundColor: T.bg,
    borderRadius: R.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  quotaPillText: { fontSize: 13, fontWeight: '700', color: T.mid },

  // Section
  titleWrap: { paddingHorizontal: SP.xl, paddingTop: SP.xl, paddingBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: T.dark },

  // Form header
  formHeader: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    borderRadius: R.xxl,
    padding: 18,
  },
  formHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  formHeaderSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  // Question card
  questionCard: {
    marginHorizontal: SP.l,
    marginBottom: SP.m,
    backgroundColor: T.surface,
    borderRadius: R.xl,
    padding: 16,
    ...SHADOW.card,
  },
  questionLabel: { fontSize: 15, fontWeight: '700', color: T.dark, marginBottom: 4 },
  questionHint: { fontSize: 12, color: T.sub, marginBottom: 12 },

  // Chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1.5,
    borderColor: T.sep,
    borderRadius: R.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: T.bg,
  },
  chipSelected: {
    borderColor: T.accent,
    backgroundColor: '#FDE8EE',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: T.mid },
  chipTextSelected: { color: T.accent },

  // Text area
  textArea: {
    borderWidth: 1.5,
    borderColor: T.sep,
    borderRadius: R.xl,
    backgroundColor: T.surface,
    minHeight: 100,
    padding: 14,
    fontSize: 14,
    color: T.dark,
    marginTop: 4,
  },
  charCount: { fontSize: 11, color: T.sub, textAlign: 'right', marginTop: 6 },

  // Submit
  submitWrap: { marginHorizontal: SP.l, marginBottom: SP.m, alignItems: 'center' },
  submitBtn: {
    borderRadius: R.pill,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  submitSub: { fontSize: 12, color: T.sub, marginTop: 8 },

  // Historico
  historicoGroup: {
    marginHorizontal: SP.l,
    backgroundColor: T.surface,
    borderRadius: R.xl,
    overflow: 'hidden',
    marginBottom: SP.m,
    ...SHADOW.card,
  },
  historicoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
  },
  historicoRowBorder: { borderBottomWidth: 1, borderBottomColor: T.sep },
  historicoDate: {
    fontSize: 10,
    fontWeight: '700',
    color: T.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  historicoQuestion: { fontSize: 14, color: T.dark, lineHeight: 20, marginBottom: 6 },
  answeredRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  answeredText: { fontSize: 12, color: T.green, fontWeight: '600' },
  responseBox: {
    marginTop: 10,
    backgroundColor: '#F0FBF4',
    borderRadius: R.m,
    padding: 12,
  },
  responseText: { fontSize: 13, color: T.mid, lineHeight: 19 },
});
