// Dados + tempo da "Consulta com a Juliane" (experiência pós-compra).
// Funções PURAS, usadas no servidor (rota de geração, pra setar plan_released_at)
// E no cliente (componente Consulta, pra montar as falas e pacear as etapas) —
// assim o "seu caso levou X min" bate com o tempo real de liberação do plano.

/* eslint-disable @typescript-eslint/no-explicit-any */

const COR: Record<string, string> = {
  preto: 'preto', castanho_claro: 'castanho claro', castanho_esc: 'castanho escuro',
  ruivo: 'ruivo', loiro: 'loiro',
};
const TIPO: Record<string, string> = {
  crespo: 'Crespo', cacheado: 'Cacheado', ondulado: 'Ondulado', liso: 'Liso',
};
const OLEO: Record<string, string> = {
  seco: 'ressecado', normal: 'normal', oleoso: 'oleoso na raiz',
};
const QUIMICA: Record<string, string> = {
  progressiva: 'progressiva', descolor: 'descoloração', tintura: 'tintura',
  relax: 'relaxamento', botox: 'botox/selagem', decap: 'decapagem', mechas: 'mechas',
};
const INCOMODA: Record<string, string> = {
  pontas: 'pontas ralas', frizz: 'frizz', cresc: 'pouco crescimento',
  queda: 'queda', volume: 'muito volume', quebra: 'quebra',
};

function firstName(full?: string | null): string {
  const n = (full ?? '').trim().split(/\s+/)[0];
  return n && n.length > 1 ? n : 'linda';
}
function arr(v: any): string[] {
  return Array.isArray(v) ? v.map(String) : (v != null && v !== '' ? [String(v)] : []);
}

export interface ConsultaData {
  nome: string;
  tipo: string;          // ex.: "Cacheado"
  cor: string;           // ex.: "castanho escuro"
  couro: string;         // ex.: "oleoso na raiz"
  couroKind: 'seco' | 'normal' | 'oleoso' | '';
  porosidadeAlta: boolean;
  quimica: string[];     // rótulos
  temQuimica: boolean;
  problema: string;      // rótulo do incômodo principal
  incomodaCount: number;
}

// Constrói os dados da consulta a partir do profile (quiz_answers + colunas).
export function buildConsultaData(profile: any): ConsultaData {
  const qa = (profile?.quiz_answers ?? {}) as Record<string, any>;
  const tipoId = String(qa.tipo ?? profile?.hair_type ?? '').toLowerCase();
  const corId = String(qa.cor ?? '').toLowerCase();
  const oleoId = String(qa.oleosidade ?? '').toLowerCase() as ConsultaData['couroKind'];
  const quimIds = arr(qa.quimica).map(s => s.toLowerCase()).filter(q => q && q !== 'nenhuma');
  const incIds = arr(qa.incomoda).length ? arr(qa.incomoda) : arr(profile?.main_problems);
  const poros = String(qa.porosidade ?? profile?.porosity ?? '').toLowerCase();
  const porosidadeAlta = /alta|sim_absorve|absorve/.test(poros);

  return {
    nome: firstName(profile?.full_name),
    tipo: TIPO[tipoId] ?? (tipoId ? tipoId[0].toUpperCase() + tipoId.slice(1) : 'seu cabelo'),
    cor: COR[corId] ?? '',
    couro: OLEO[oleoId] ?? 'com o couro e os comprimentos pedindo cuidados diferentes',
    couroKind: (['seco', 'normal', 'oleoso'].includes(oleoId) ? oleoId : '') as ConsultaData['couroKind'],
    porosidadeAlta,
    quimica: quimIds.map(q => QUIMICA[q] ?? q),
    temQuimica: quimIds.length > 0,
    problema: INCOMODA[String(incIds[0] ?? '').toLowerCase()] ?? (incIds[0] ? String(incIds[0]) : 'o que mais te incomoda'),
    incomodaCount: incIds.length,
  };
}

// Minutos da consulta (= tempo até liberar o plano). Casos mais complexos levam
// mais tempo — é o que dá verdade à mensagem "o seu caso pediu mais atenção".
export const CONSULTA_AVG_MIN = 17;
export function computeConsultaMinutes(profile: any): number {
  const d = buildConsultaData(profile);
  let m = 20;
  m += Math.min(6, d.quimica.length * 2);   // cada química pesa
  if (d.porosidadeAlta) m += 2;
  if (d.couroKind === 'oleoso' || d.couroKind === 'seco') m += 1; // couro que exige atenção
  if (d.incomodaCount >= 3) m += 2;
  return Math.max(20, Math.min(28, m));
}
