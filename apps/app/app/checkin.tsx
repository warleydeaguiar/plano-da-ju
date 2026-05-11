import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { saveCheckIn } from '../lib/hooks';
import { T, GRAD, R, SP } from '../lib/theme/tokens';

interface QuestionOption {
  emoji: string;
  label: string;
  sub: string;
  value: string;
}

interface Question {
  id: string;
  field: 'hair_feel' | 'scalp_feel' | 'breakage_observed';
  text: string;
  options: QuestionOption[];
}

const QUESTIONS: Question[] = [
  {
    id: 'hair_feel',
    field: 'hair_feel',
    text: 'Como você está sentindo seu cabelo agora?',
    options: [
      { emoji: '💧', label: 'Muito ressecado', sub: 'Sem brilho, palha', value: 'muito_seco' },
      { emoji: '🌫️', label: 'Ressecado', sub: 'Pouca umidade', value: 'seco' },
      { emoji: '✨', label: 'Normal / Bom', sub: 'Macio e com brilho', value: 'normal' },
      { emoji: '💦', label: 'Oleoso', sub: 'Pesado na raiz', value: 'oleoso' },
    ],
  },
  {
    id: 'scalp_feel',
    field: 'scalp_feel',
    text: 'Como está seu couro cabeludo?',
    options: [
      { emoji: '😣', label: 'Com coceira', sub: '', value: 'coceira' },
      { emoji: '😌', label: 'Sensível', sub: '', value: 'sensivel' },
      { emoji: '😐', label: 'Normal', sub: '', value: 'normal' },
      { emoji: '😬', label: 'Oleoso', sub: '', value: 'oleoso' },
    ],
  },
  {
    id: 'breakage_observed',
    field: 'breakage_observed',
    text: 'Percebeu queda ou quebra de cabelo hoje?',
    options: [
      { emoji: '😌', label: 'Não, queda normal', sub: '', value: 'false' },
      { emoji: '😟', label: 'Sim, mais que o normal', sub: '', value: 'true' },
    ],
  },
];

export default function CheckinScreen() {
  const { session } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const question = QUESTIONS[step];
  const total = QUESTIONS.length;
  const progress = ((step + 1) / total) * 100;
  const selected = answers[question.id];
  const isLast = step === total - 1;

  function select(value: string) {
    setAnswers(prev => ({ ...prev, [question.id]: value }));
  }

  async function next() {
    if (!isLast) {
      setStep(s => s + 1);
      return;
    }
    if (!session?.user.id) {
      Alert.alert('Sessão expirada', 'Entre novamente para registrar seu check-in.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace('/login' as any);
      return;
    }
    setSaving(true);
    try {
      await saveCheckIn(session.user.id, {
        hair_feel: answers.hair_feel,
        scalp_feel: answers.scalp_feel,
        breakage_observed: answers.breakage_observed === 'true',
        questions_asked: QUESTIONS.map(q => q.id),
        answers_raw: answers,
      });
      Alert.alert('Pronto! ✨', 'Seu check-in foi salvo. Continue cuidando do seu cabelo!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao salvar check-in');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bgWarm }}>
      <LinearGradient
        colors={GRAD.checkinTop}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.topBlock}
      >
        <SafeAreaView edges={['top']}>
          <View style={s.topInner}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Text style={s.backArrow}>‹</Text>
              <Text style={s.backText}>Voltar</Text>
            </TouchableOpacity>
            <Text style={s.headerLabel}>Check-in diário</Text>
            <Text style={s.headerTitle}>Como está seu cabelo hoje?</Text>
            <Text style={s.headerContext}>{total} perguntas rápidas</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progress}%` as `${number}%` }]} />
            </View>
            <Text style={s.progressLabel}>
              {step + 1} de {total}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.questionLabel}>
          Pergunta {step + 1} de {total}
        </Text>
        <Text style={s.questionText}>{question.text}</Text>

        <View style={s.optionsGrid}>
          {question.options.map((opt, i) => {
            const isSelected = selected === opt.value;
            const wide = question.options.length <= 2;
            return (
              <TouchableOpacity
                key={i}
                style={[s.optionCard, wide && s.optionWide, isSelected && s.optionSelected]}
                onPress={() => select(opt.value)}
              >
                <Text style={s.optionEmoji}>{opt.emoji}</Text>
                <Text style={[s.optionLabel, isSelected && s.optionLabelOn]}>
                  {opt.label}
                </Text>
                {!!opt.sub && (
                  <Text style={[s.optionSub, isSelected && s.optionSubOn]}>{opt.sub}</Text>
                )}
                {isSelected && (
                  <View style={s.checkBadge}>
                    <Text style={{ color: '#FFF', fontSize: 11 }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: T.bgWarm }}>
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.saveBtn, (selected === undefined || saving) && s.saveBtnOff]}
            onPress={next}
            disabled={selected === undefined || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={s.saveBtnText}>
                {isLast ? 'Salvar check-in →' : 'Próxima pergunta →'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.skipText}>Pular por hoje</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  topBlock: { paddingBottom: 24 },
  topInner: {
    paddingHorizontal: SP.xxl,
    paddingTop: 6,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 },
  backArrow: { fontSize: 22, color: 'rgba(255,255,255,0.85)', lineHeight: 24 },
  backText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  headerLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  headerContext: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  progressTrack: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2, marginTop: 16, overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: '#FFF', borderRadius: 2 },
  progressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6, textAlign: 'right' },

  scroll: { padding: SP.xl, gap: SP.l, paddingBottom: SP.xxl },

  questionLabel: { fontSize: 12, fontWeight: '700', color: T.sub, letterSpacing: 0.5 },
  questionText: { fontSize: 18, fontWeight: '800', color: T.dark, lineHeight: 26, marginTop: 4 },

  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionCard: {
    width: '47.5%',
    backgroundColor: T.surface,
    borderRadius: R.xl,
    padding: SP.l,
    borderWidth: 1.5,
    borderColor: T.border,
    position: 'relative',
  },
  optionWide: { width: '100%' },
  optionSelected: {
    borderColor: T.accent,
    backgroundColor: T.rose100,
  },
  optionEmoji: { fontSize: 30, marginBottom: 10 },
  optionLabel: { fontSize: 14, fontWeight: '700', color: T.dark },
  optionLabelOn: { color: T.accent },
  optionSub: { fontSize: 12, color: T.sub, marginTop: 3, lineHeight: 17 },
  optionSubOn: { color: T.mid },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    paddingHorizontal: SP.xl,
    paddingBottom: 12,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: T.sep,
    backgroundColor: T.bgWarm,
  },
  saveBtn: {
    backgroundColor: T.accent,
    borderRadius: R.l,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnOff: { backgroundColor: '#E0BFCA' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  skipText: { textAlign: 'center', fontSize: 13, color: T.sub, paddingVertical: 4 },
});
