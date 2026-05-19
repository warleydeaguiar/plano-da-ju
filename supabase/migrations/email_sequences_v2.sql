-- ============================================================================
-- 5 sequências de email — Plano da Ju (Maio/2026)
--
-- Pré-venda (audience='no_purchase', anchor='lead_created'):
--   1. 15min  — Curiosidade + revelação do diagnóstico
--   2. 4h     — Quebra de objeção + oferta forte
--
-- Pós-compra (audience='customers', anchor='purchase'):
--   3. +5min  — Boas-vindas + como acessar o app
--   4. +24h   — Primeiras ações da jornada
--   5. +7d    — Check-in da 1ª semana + comunidade
--
-- Variáveis ricas: {nome}, {tipo_cabelo}, {problema_principal}, {quimica},
--                  {idade}, {espessura}, {oleosidade}, {porosidade},
--                  {calor}, {areas_preocupantes}, {como_plano},
--                  {diagnostico_curto}, {email}
-- ============================================================================

-- Remove sequências antigas (D+1, D+3, D+7 estavam desativadas)
DELETE FROM wg_email_sequences WHERE name IN (
  'D+1 — Seu plano ainda está aqui',
  'D+3 — Resultado do seu quiz',
  'D+7 — Ultima mensagem'
);

-- ── 1) 15min após quiz — Curiosidade + Diagnóstico ────────────────────────────
INSERT INTO wg_email_sequences (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body, text_body) VALUES (
  '15min — Diagnóstico pronto',
  0, 15, 'no_purchase', 'lead_created', 'plano-capilar', 0, true,

  '{nome}, seu diagnóstico tá pronto (mas faltou 1 coisa…)',

  $HTML$<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seu plano</title></head>
<body style="margin:0;padding:0;background:#FFF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1E2C;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFF7F0;padding:24px 12px;"><tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 30px rgba(196,96,122,0.08);">
<tr><td style="padding:32px 32px 8px 32px;">
  <p style="margin:0 0 4px 0;font-size:13px;color:#C4607A;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;">Plano da Ju</p>
  <h1 style="font-family:'Georgia',serif;font-size:26px;line-height:1.25;margin:0 0 20px 0;color:#2A1E2C;font-weight:600;">{nome}, seu diagnóstico tá pronto 🌸</h1>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 16px 0;">Eu olhei suas respostas e já tenho uma noção bem clara do seu caso.</p>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 16px 0;">Em resumo: <strong>{diagnostico_curto}</strong>, lidando com <strong>{problema_principal}</strong>{quimica}, e você marcou <strong>{areas_preocupantes}</strong> como o que mais te preocupa hoje.</p>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 24px 0;">Essa combinação tem solução. Já cuidei de mais de 3.500 mulheres e a maioria com esse perfil sente diferença real nas primeiras 2 semanas — não é mágica, é cronograma certo.</p>
  <div style="background:#FFF1E8;border-left:3px solid #C4607A;padding:14px 18px;border-radius:8px;margin:0 0 28px 0;">
    <p style="font-size:14px;line-height:1.55;color:#4A3A4C;margin:0;">Mas tem 1 coisa que você ainda não viu: <strong>o cronograma personalizado de 90 dias</strong> que montei pra você — com os produtos certos pro seu cabelo, ordem das aplicações e a frequência exata.</p>
  </div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px auto;"><tr><td style="background:#C4607A;border-radius:12px;">
    <a href="https://planodaju.julianecost.com/oferta?utm_source=email&utm_medium=email&utm_campaign=15min" style="display:inline-block;padding:16px 32px;color:#fff;font-weight:600;text-decoration:none;font-size:16px;">Ver meu plano completo →</a>
  </td></tr></table>
  <p style="font-size:14px;line-height:1.55;color:#8A7A8C;margin:0 0 8px 0;text-align:center;">⏳ A oferta com desconto vale só hoje</p>
  <p style="font-size:13px;line-height:1.55;color:#8A7A8C;margin:0;text-align:center;">Bjos,<br><strong style="color:#C4607A;">Juliane</strong></p>
</td></tr></table>
<p style="font-size:11px;color:#B5A6B7;margin:20px 0 0 0;">Você recebeu este email porque preencheu seu diagnóstico em planodaju.julianecost.com.</p>
</td></tr></table></body></html>$HTML$,

  $TEXT${nome}, seu diagnóstico tá pronto 🌸

Eu olhei suas respostas e já tenho uma noção bem clara do seu caso.

Em resumo: {diagnostico_curto}, lidando com {problema_principal}{quimica}, e você marcou {areas_preocupantes} como o que mais te preocupa hoje.

Essa combinação tem solução. Já cuidei de mais de 3.500 mulheres e a maioria com esse perfil sente diferença real nas primeiras 2 semanas — não é mágica, é cronograma certo.

Mas tem 1 coisa que você ainda não viu: o cronograma personalizado de 90 dias que montei pra você — com os produtos certos pro seu cabelo, ordem das aplicações e a frequência exata.

Ver meu plano completo:
https://planodaju.julianecost.com/oferta?utm_source=email&utm_medium=email&utm_campaign=15min

⏳ A oferta com desconto vale só hoje

Bjos,
Juliane$TEXT$
);

-- ── 2) 4h após quiz — Quebra de objeção + Oferta forte ───────────────────────
INSERT INTO wg_email_sequences (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body, text_body) VALUES (
  '4h — Última hora desconto',
  0, 240, 'no_purchase', 'lead_created', 'plano-capilar', 0, true,

  '{nome}, vou ser direta com você ↓',

  $HTML$<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Última hora</title></head>
<body style="margin:0;padding:0;background:#FFF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1E2C;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFF7F0;padding:24px 12px;"><tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 30px rgba(196,96,122,0.08);">
<tr><td style="padding:32px 32px 8px 32px;">
  <p style="margin:0 0 4px 0;font-size:13px;color:#C4607A;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;">⏳ Última hora</p>
  <h1 style="font-family:'Georgia',serif;font-size:26px;line-height:1.25;margin:0 0 20px 0;color:#2A1E2C;font-weight:600;">{nome}, vou ser direta com você</h1>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 16px 0;">Você fez o quiz há algumas horas. Eu vi seu diagnóstico — <strong>{diagnostico_curto}</strong> com <strong>{problema_principal}</strong> — e sei o que esse perfil precisa.</p>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 16px 0;">Você não voltou pra fechar. Sem julgamento — eu entendo. Algumas dúvidas que recebo todo dia de mulheres como você:</p>
  <div style="background:#FFF1E8;border-radius:12px;padding:18px 20px;margin:0 0 16px 0;">
    <p style="font-size:15px;line-height:1.6;color:#4A3A4C;margin:0 0 10px 0;"><strong style="color:#C4607A;">"Será que funciona com {tipo_cabelo}?"</strong></p>
    <p style="font-size:14px;line-height:1.6;color:#5A4A5C;margin:0 0 16px 0;">→ 73% das mulheres que cuido têm cabelo {tipo_cabelo}. Não é genérico, é montado pro SEU tipo.</p>
    <p style="font-size:15px;line-height:1.6;color:#4A3A4C;margin:0 0 10px 0;"><strong style="color:#C4607A;">"E se eu já tentei tudo?"</strong></p>
    <p style="font-size:14px;line-height:1.6;color:#5A4A5C;margin:0 0 16px 0;">→ A diferença é a SEQUÊNCIA. Hidratar, nutrir, reconstruir — a ordem importa mais que o produto.</p>
    <p style="font-size:15px;line-height:1.6;color:#4A3A4C;margin:0 0 10px 0;"><strong style="color:#C4607A;">"R$29,90 não é caro?"</strong></p>
    <p style="font-size:14px;line-height:1.6;color:#5A4A5C;margin:0;">→ Você gasta isso num lanche. O plano é 1 ano de acompanhamento + cronograma adaptado + acesso ao app.</p>
  </div>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 16px 0;">Olha, falando reto: <strong>amanhã o valor volta pra R$39,90</strong>. Você fez o quiz hoje porque seu cabelo está te incomodando hoje. Por que esperar até depois da virada?</p>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px auto 12px auto;"><tr><td style="background:#C4607A;border-radius:12px;">
    <a href="https://planodaju.julianecost.com/oferta?utm_source=email&utm_medium=email&utm_campaign=4h" style="display:inline-block;padding:16px 32px;color:#fff;font-weight:600;text-decoration:none;font-size:16px;">Garantir por R$29,90/ano →</a>
  </td></tr></table>
  <p style="font-size:13px;line-height:1.55;color:#8A7A8C;margin:0 0 24px 0;text-align:center;">É menos que R$2,50/mês. Garantia de 7 dias.</p>
  <p style="font-size:14px;line-height:1.6;color:#4A3A4C;margin:0 0 8px 0;">Se não for hoje, tá tudo bem — só não fala depois que eu não avisei 😉</p>
  <p style="font-size:14px;line-height:1.55;color:#5A4A5C;margin:0;"><strong style="color:#C4607A;">Juliane Cost</strong><br><span style="font-size:12px;color:#8A7A8C;">Especialista capilar · +3.500 mulheres atendidas</span></p>
</td></tr></table>
<p style="font-size:11px;color:#B5A6B7;margin:20px 0 0 0;">Email enviado para {email}. Se chegou aqui por engano, pode ignorar.</p>
</td></tr></table></body></html>$HTML$,

  $TEXT$⏳ Última hora — {nome}, vou ser direta

Você fez o quiz há algumas horas. Eu vi seu diagnóstico — {diagnostico_curto} com {problema_principal} — e sei o que esse perfil precisa.

Você não voltou pra fechar. Sem julgamento, eu entendo. Dúvidas que recebo todo dia:

"Será que funciona com {tipo_cabelo}?"
→ 73% das mulheres que cuido têm cabelo {tipo_cabelo}. Não é genérico.

"E se eu já tentei tudo?"
→ A diferença é a SEQUÊNCIA. Hidratar, nutrir, reconstruir — a ordem importa mais que o produto.

"R$29,90 não é caro?"
→ É menos que um lanche. O plano é 1 ano de acompanhamento + cronograma + app.

Falando reto: amanhã o valor volta pra R$39,90. Você fez o quiz hoje porque seu cabelo te incomoda hoje. Por que esperar?

Garantir por R$29,90/ano:
https://planodaju.julianecost.com/oferta?utm_source=email&utm_medium=email&utm_campaign=4h

É menos que R$2,50/mês. Garantia de 7 dias.

Se não for hoje, tá tudo bem 😉

Juliane Cost
Especialista capilar — +3.500 mulheres atendidas$TEXT$
);

-- ── 3) Pós-compra +5min — Boas-vindas + Como acessar ─────────────────────────
INSERT INTO wg_email_sequences (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body, text_body) VALUES (
  'Pós-compra 1 — Acesso liberado',
  0, 5, 'customers', 'purchase', null, 0, true,

  '🌸 {nome}, seu acesso ao Plano da Ju está liberado',

  $HTML$<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bem-vinda</title></head>
<body style="margin:0;padding:0;background:#FFF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1E2C;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFF7F0;padding:24px 12px;"><tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 30px rgba(196,96,122,0.08);">
<tr><td style="padding:32px 32px 8px 32px;">
  <p style="margin:0 0 4px 0;font-size:13px;color:#22C55E;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;">✓ Pagamento confirmado</p>
  <h1 style="font-family:'Georgia',serif;font-size:28px;line-height:1.25;margin:0 0 16px 0;color:#2A1E2C;font-weight:600;">Bem-vinda, {nome}! 🌸</h1>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 20px 0;">Eu sou a Juliane e a partir de agora vamos juntas nessa jornada de 90 dias pro seu {tipo_cabelo} ficar do jeito que você sempre quis.</p>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 28px 0;">Pra começar, é só seguir 3 passos rápidos ↓</p>

  <div style="background:#F9F4F6;border-radius:14px;padding:24px;margin:0 0 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="width:36px;"><div style="width:30px;height:30px;background:#C4607A;color:#fff;border-radius:50%;font-weight:700;text-align:center;line-height:30px;font-size:14px;">1</div></td>
      <td valign="top" style="padding-left:14px;">
        <p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:#2A1E2C;">Acesse pelo navegador do celular</p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#5A4A5C;">Por enquanto o Plano da Ju funciona pelo navegador — o app nativo iOS/Android chega nas próximas semanas. No celular funciona perfeito (pode salvar na tela inicial 📱).</p>
      </td>
    </tr></table>
  </div>

  <div style="background:#F9F4F6;border-radius:14px;padding:24px;margin:0 0 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="width:36px;"><div style="width:30px;height:30px;background:#C4607A;color:#fff;border-radius:50%;font-weight:700;text-align:center;line-height:30px;font-size:14px;">2</div></td>
      <td valign="top" style="padding-left:14px;">
        <p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:#2A1E2C;">Defina sua senha</p>
        <p style="margin:0 0 10px 0;font-size:14px;line-height:1.55;color:#5A4A5C;">Use o email <strong>{email}</strong> que você já cadastrou. Depois é só criar uma senha (mínimo 6 caracteres).</p>
      </td>
    </tr></table>
  </div>

  <div style="background:#F9F4F6;border-radius:14px;padding:24px;margin:0 0 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="width:36px;"><div style="width:30px;height:30px;background:#C4607A;color:#fff;border-radius:50%;font-weight:700;text-align:center;line-height:30px;font-size:14px;">3</div></td>
      <td valign="top" style="padding-left:14px;">
        <p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:#2A1E2C;">Veja seu plano personalizado</p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#5A4A5C;">Seu cronograma de 90 dias, lista de produtos, agenda diária e check-ins já estão prontos esperando você.</p>
      </td>
    </tr></table>
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px auto;"><tr><td style="background:#C4607A;border-radius:12px;">
    <a href="https://planodaju.julianecost.com/login?email={email}&utm_source=email&utm_medium=email&utm_campaign=welcome" style="display:inline-block;padding:16px 32px;color:#fff;font-weight:600;text-decoration:none;font-size:16px;">Acessar meu plano →</a>
  </td></tr></table>

  <p style="font-size:14px;line-height:1.6;color:#5A4A5C;margin:0 0 8px 0;text-align:center;">💡 Dica: salva esse email — você vai precisar do link de acesso depois.</p>

  <p style="font-size:14px;line-height:1.6;color:#4A3A4C;margin:24px 0 12px 0;">Qualquer dúvida, responde aqui mesmo. Tô do outro lado.</p>
  <p style="font-size:14px;line-height:1.55;color:#5A4A5C;margin:0;">Com carinho,<br><strong style="color:#C4607A;">Juliane Cost</strong></p>
</td></tr></table>
</td></tr></table></body></html>$HTML$,

  $TEXT$🌸 Bem-vinda, {nome}!

Eu sou a Juliane e a partir de agora vamos juntas nessa jornada de 90 dias pro seu {tipo_cabelo} ficar do jeito que você sempre quis.

Pra começar, 3 passos rápidos:

1. ACESSE PELO NAVEGADOR DO CELULAR
   Por enquanto o Plano da Ju funciona pelo navegador — o app nativo iOS/Android chega nas próximas semanas. No celular funciona perfeito (pode salvar na tela inicial).

2. DEFINA SUA SENHA
   Use o email {email} que você já cadastrou. Depois é só criar uma senha (mínimo 6 caracteres).

3. VEJA SEU PLANO PERSONALIZADO
   Seu cronograma de 90 dias, lista de produtos, agenda diária e check-ins já estão prontos.

Link de acesso:
https://planodaju.julianecost.com/login?email={email}

💡 Salva esse email — você vai precisar do link depois.

Qualquer dúvida, responde aqui mesmo.

Com carinho,
Juliane Cost$TEXT$
);

-- ── 4) Pós-compra +24h — Primeiras ações ─────────────────────────────────────
INSERT INTO wg_email_sequences (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body, text_body) VALUES (
  'Pós-compra 2 — Primeiros passos',
  1, 0, 'customers', 'purchase', null, 9, true,

  '{nome}, 3 coisas pra fazer HOJE no seu plano',

  $HTML$<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Primeiros passos</title></head>
<body style="margin:0;padding:0;background:#FFF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1E2C;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFF7F0;padding:24px 12px;"><tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 30px rgba(196,96,122,0.08);">
<tr><td style="padding:32px 32px 8px 32px;">
  <p style="margin:0 0 4px 0;font-size:13px;color:#C4607A;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;">Dia 1 da sua jornada</p>
  <h1 style="font-family:'Georgia',serif;font-size:26px;line-height:1.25;margin:0 0 16px 0;color:#2A1E2C;font-weight:600;">Bora começar com pé direito, {nome}?</h1>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 24px 0;">Você comprou ontem. Já entrou no app? Hoje eu separei 3 coisinhas rápidas que fazem TODA diferença pro seu {tipo_cabelo} sentir resultado mais rápido ↓</p>

  <div style="border-left:3px solid #C4607A;padding:0 0 0 16px;margin:0 0 24px 0;">
    <p style="font-size:13px;color:#C4607A;font-weight:600;margin:0 0 4px 0;">AÇÃO 1 · 2 min</p>
    <p style="font-size:17px;font-weight:600;color:#2A1E2C;margin:0 0 8px 0;">Tira a foto do "antes"</p>
    <p style="font-size:15px;line-height:1.6;color:#5A4A5C;margin:0;">Vai no app → Progresso → Adicionar foto. Daqui 30 dias você vai querer ver de novo como tava — pode confiar.</p>
  </div>

  <div style="border-left:3px solid #C4607A;padding:0 0 0 16px;margin:0 0 24px 0;">
    <p style="font-size:13px;color:#C4607A;font-weight:600;margin:0 0 4px 0;">AÇÃO 2 · 5 min</p>
    <p style="font-size:17px;font-weight:600;color:#2A1E2C;margin:0 0 8px 0;">Lê seu cronograma da semana</p>
    <p style="font-size:15px;line-height:1.6;color:#5A4A5C;margin:0;">No app → Plano. Eu adaptei o passo a passo pro seu cabelo {tipo_cabelo} com {problema_principal}. Não pula essa parte: a ordem das aplicações faz mais diferença que os produtos.</p>
  </div>

  <div style="border-left:3px solid #C4607A;padding:0 0 0 16px;margin:0 0 28px 0;">
    <p style="font-size:13px;color:#C4607A;font-weight:600;margin:0 0 4px 0;">AÇÃO 3 · 1 min</p>
    <p style="font-size:17px;font-weight:600;color:#2A1E2C;margin:0 0 8px 0;">Marca seu 1º check-in</p>
    <p style="font-size:15px;line-height:1.6;color:#5A4A5C;margin:0;">Toda vez que você lavar, hidratar ou fizer um tratamento, marca no app. É assim que eu sei o que ajustar pra você na próxima semana.</p>
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px auto;"><tr><td style="background:#C4607A;border-radius:12px;">
    <a href="https://planodaju.julianecost.com/login?email={email}&utm_source=email&utm_medium=email&utm_campaign=onboarding_d1" style="display:inline-block;padding:16px 32px;color:#fff;font-weight:600;text-decoration:none;font-size:16px;">Abrir meu plano →</a>
  </td></tr></table>

  <div style="background:#FFF1E8;border-radius:12px;padding:16px 18px;margin:0 0 16px 0;">
    <p style="font-size:14px;line-height:1.55;color:#4A3A4C;margin:0;">💬 Já lavou o cabelo desde ontem? Conta pra mim como foi respondendo esse email. Eu leio uma por uma.</p>
  </div>

  <p style="font-size:14px;line-height:1.55;color:#5A4A5C;margin:0;"><strong style="color:#C4607A;">Juliane</strong></p>
</td></tr></table>
</td></tr></table></body></html>$HTML$,

  $TEXT$Dia 1 da sua jornada — Bora começar com pé direito, {nome}?

Você comprou ontem. Já entrou no app? Hoje eu separei 3 coisinhas rápidas que fazem TODA diferença pro seu {tipo_cabelo} sentir resultado mais rápido:

AÇÃO 1 · 2 min — Tira a foto do "antes"
Vai no app → Progresso → Adicionar foto. Daqui 30 dias você vai querer ver como tava.

AÇÃO 2 · 5 min — Lê seu cronograma da semana
No app → Plano. Eu adaptei pro seu cabelo {tipo_cabelo} com {problema_principal}. A ORDEM das aplicações faz mais diferença que os produtos.

AÇÃO 3 · 1 min — Marca seu 1º check-in
Toda vez que lavar, hidratar ou tratar, marca no app. É assim que eu sei o que ajustar na próxima semana.

Abrir meu plano:
https://planodaju.julianecost.com/login?email={email}

💬 Já lavou o cabelo desde ontem? Conta pra mim respondendo esse email — eu leio uma por uma.

Juliane$TEXT$
);

-- ── 5) Pós-compra +7d — Check-in da 1ª semana ────────────────────────────────
INSERT INTO wg_email_sequences (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body, text_body) VALUES (
  'Pós-compra 3 — Semana 1',
  7, 0, 'customers', 'purchase', null, 10, true,

  '{nome}, completou 1 semana — como foi? 💕',

  $HTML$<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>1 semana</title></head>
<body style="margin:0;padding:0;background:#FFF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1E2C;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFF7F0;padding:24px 12px;"><tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 30px rgba(196,96,122,0.08);">
<tr><td style="padding:32px 32px 8px 32px;">
  <p style="margin:0 0 4px 0;font-size:13px;color:#C4607A;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;">Semana 1 ✓</p>
  <h1 style="font-family:'Georgia',serif;font-size:26px;line-height:1.25;margin:0 0 16px 0;color:#2A1E2C;font-weight:600;">Completou 1 semana, {nome} 💕</h1>
  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 20px 0;">7 dias atrás você apostou em você. Bora ver o que costuma acontecer com cabelo {tipo_cabelo}{quimica} nessa fase ↓</p>

  <div style="background:#F9F4F6;border-radius:14px;padding:22px;margin:0 0 24px 0;">
    <p style="font-size:14px;color:#C4607A;font-weight:700;margin:0 0 12px 0;letter-spacing:0.3px;">O QUE A 1ª SEMANA SUSTENTA</p>
    <p style="font-size:15px;line-height:1.7;color:#4A3A4C;margin:0 0 10px 0;">✦ <strong>Couro cabeludo mais leve</strong> — sem aquela sensação de oleoso no dia seguinte</p>
    <p style="font-size:15px;line-height:1.7;color:#4A3A4C;margin:0 0 10px 0;">✦ <strong>Fios começam a "se comportar"</strong> — ressecamento dá uma cedida</p>
    <p style="font-size:15px;line-height:1.7;color:#4A3A4C;margin:0;">✦ <strong>Você nota DIA pra lavar</strong> — não é mais reflexo, é resposta do cabelo</p>
  </div>

  <p style="font-size:16px;line-height:1.6;color:#4A3A4C;margin:0 0 16px 0;">Se notou alguma dessas coisas: tá no caminho. Se ainda não: também é normal — {problema_principal} demora um pouquinho mais.</p>

  <div style="background:#FFF1E8;border-left:3px solid #C4607A;border-radius:8px;padding:16px 18px;margin:0 0 24px 0;">
    <p style="font-size:15px;line-height:1.6;color:#4A3A4C;margin:0 0 8px 0;"><strong>Próximos 7 dias — o que muda:</strong></p>
    <p style="font-size:14px;line-height:1.6;color:#5A4A5C;margin:0;">Seu cronograma vai pra fase de <strong>nutrição</strong>. A composição dos produtos muda — segue o passo a passo no app que tudo se ajusta automaticamente.</p>
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px auto;"><tr><td style="background:#C4607A;border-radius:12px;">
    <a href="https://planodaju.julianecost.com/login?email={email}&utm_source=email&utm_medium=email&utm_campaign=onboarding_d7" style="display:inline-block;padding:16px 32px;color:#fff;font-weight:600;text-decoration:none;font-size:16px;">Ver cronograma semana 2 →</a>
  </td></tr></table>

  <div style="background:#F9F4F6;border-radius:12px;padding:18px;margin:0 0 16px 0;">
    <p style="font-size:14px;color:#C4607A;font-weight:600;margin:0 0 8px 0;">📸 Hora da 2ª foto</p>
    <p style="font-size:14px;line-height:1.55;color:#5A4A5C;margin:0;">Tira mais uma — mesma luz, mesmo ângulo da primeira. Daqui 60 dias a comparação vai te emocionar.</p>
  </div>

  <p style="font-size:14px;line-height:1.55;color:#5A4A5C;margin:0;">Tô aqui pra qualquer coisa.<br><strong style="color:#C4607A;">Juliane</strong></p>
</td></tr></table>
</td></tr></table></body></html>$HTML$,

  $TEXT$Semana 1 ✓ — Completou 1 semana, {nome} 💕

7 dias atrás você apostou em você. Bora ver o que costuma acontecer com cabelo {tipo_cabelo}{quimica} nessa fase:

O QUE A 1ª SEMANA SUSTENTA:
✦ Couro cabeludo mais leve — sem aquela sensação de oleoso no dia seguinte
✦ Fios começam a "se comportar" — ressecamento dá uma cedida
✦ Você nota DIA pra lavar — não é mais reflexo, é resposta do cabelo

Se notou alguma dessas: tá no caminho. Se ainda não: também é normal — {problema_principal} demora um pouquinho mais.

PRÓXIMOS 7 DIAS:
Seu cronograma vai pra fase de NUTRIÇÃO. A composição dos produtos muda — segue o passo a passo no app que tudo se ajusta automaticamente.

Ver cronograma semana 2:
https://planodaju.julianecost.com/login?email={email}

📸 Hora da 2ª foto — mesma luz, mesmo ângulo. Daqui 60 dias a comparação vai te emocionar.

Tô aqui pra qualquer coisa.
Juliane$TEXT$
);
