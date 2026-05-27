-- 005_email_seq_nopurchase_7.sql
-- Sequência de 7 emails para LEADS que entraram no funil e NÃO compraram o
-- Plano Capilar. Foco: explicar POR QUE o cabelo dela está com problema e usar
-- as respostas do quiz (vars {nome}, {tipo_cabelo}, {problema_principal},
-- {incomoda}, {quimica}, {porosidade}, {diagnostico_curto}, {como_plano}...).
-- audience='no_purchase', anchor_event='lead_created', quiz_slug='plano-capilar'.
--
-- Desabilita as 2 sequências no_purchase antigas (15min / 4h) para não duplicar.

update public.wg_email_sequences set enabled = false
 where audience = 'no_purchase' and anchor_event = 'lead_created'
   and quiz_slug = 'plano-capilar'
   and name in ('15min — Diagnóstico pronto', '4h — Última hora desconto');

-- Limpa execuções anteriores destes nomes (idempotência ao reaplicar)
delete from public.wg_email_sequences
 where quiz_slug = 'plano-capilar' and audience = 'no_purchase'
   and name like 'NP%';

-- Wrapper HTML comum (cada email injeta seu próprio conteúdo). O footer de
-- descadastro e o tracking são adicionados automaticamente no envio.

-- ── Email 1 — 20 min após o lead ────────────────────────────────────────────
insert into public.wg_email_sequences
  (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body)
values
('NP1 — Diagnóstico (o porquê)', 0, 20, 'no_purchase', 'lead_created', 'plano-capilar', 10, true,
 '{nome}, descobri por que seu cabelo está com {problema_principal} 🔍',
$html$
<!doctype html><html><body style="margin:0;background:#FFFAF5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:8px 0 18px;"><span style="font-size:22px;font-weight:700;color:#2A1E2C;">Plano da <span style="color:#BE185D;font-style:italic;">Ju</span></span></div>
  <div style="background:#fff;border-radius:18px;padding:28px 24px;box-shadow:0 1px 3px rgba(42,30,44,0.06);font-size:15px;line-height:1.65;color:#2A1E2C;">
    <p>Oi, {nome}! Terminei de analisar as respostas que você deu no diagnóstico.</p>
    <p>Seu <strong>{diagnostico_curto}</strong>, com <strong>{incomoda}</strong>, não é "cabelo ruim" — e definitivamente não é falta de comprar produto caro.</p>
    <p>Na maioria dos casos como o seu, o problema é simples: <strong>a rotina não foi feita pro seu tipo de fio</strong>. Você cuida do cabelo do jeito errado pra ele — e aí ele responde com {problema_principal}.</p>
    <p>A boa notícia? Dá pra reverter <strong>em casa</strong>, com um passo a passo montado especificamente pro seu cabelo {tipo_cabelo}.</p>
    <div style="text-align:center;margin:26px 0 6px;">
      <a href="https://planodaju.julianecost.com/oferta" style="display:inline-block;background:#BE185D;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:99px;">Ver meu plano personalizado →</a>
    </div>
    <p style="font-size:13px;color:#7C6B7E;text-align:center;margin-top:14px;">Com carinho, Juliane 💗</p>
  </div>
</div></body></html>
$html$);

-- ── Email 2 — dia 1: a causa real ───────────────────────────────────────────
insert into public.wg_email_sequences
  (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body)
values
('NP2 — A causa real', 1, 0, 'no_purchase', 'lead_created', 'plano-capilar', 10, true,
 'A verdadeira causa do seu {problema_principal}, {nome}',
$html$
<!doctype html><html><body style="margin:0;background:#FFFAF5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:8px 0 18px;"><span style="font-size:22px;font-weight:700;color:#2A1E2C;">Plano da <span style="color:#BE185D;font-style:italic;">Ju</span></span></div>
  <div style="background:#fff;border-radius:18px;padding:28px 24px;box-shadow:0 1px 3px rgba(42,30,44,0.06);font-size:15px;line-height:1.65;color:#2A1E2C;">
    <p>{nome}, deixa eu te contar o erro nº 1 que mantém o seu {problema_principal}:</p>
    <p>A maioria trata o <em>sintoma</em> — passa máscara, corta as pontas, compra o shampoo da moda — e o problema sempre volta. Porque a causa continua lá.</p>
    <p>No seu caso, com <strong>{porosidade}</strong> e histórico de <strong>{quimica}</strong>, o fio perde nutrição e proteção mais rápido do que consegue repor. É por isso que {problema_principal} insiste em voltar, por mais que você tente.</p>
    <p>O Plano da Ju corrige a <strong>causa</strong>, na ordem certa pro seu cabelo {tipo_cabelo} — não fica tapando buraco.</p>
    <div style="text-align:center;margin:26px 0 6px;">
      <a href="https://planodaju.julianecost.com/oferta" style="display:inline-block;background:#BE185D;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:99px;">Quero corrigir a causa →</a>
    </div>
  </div>
</div></body></html>
$html$);

-- ── Email 3 — dia 2: custo de não agir ──────────────────────────────────────
insert into public.wg_email_sequences
  (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body)
values
('NP3 — Custo de não agir', 2, 0, 'no_purchase', 'lead_created', 'plano-capilar', 10, true,
 '{nome}, e se daqui a 3 meses estiver igual (ou pior)?',
$html$
<!doctype html><html><body style="margin:0;background:#FFFAF5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:8px 0 18px;"><span style="font-size:22px;font-weight:700;color:#2A1E2C;">Plano da <span style="color:#BE185D;font-style:italic;">Ju</span></span></div>
  <div style="background:#fff;border-radius:18px;padding:28px 24px;box-shadow:0 1px 3px rgba(42,30,44,0.06);font-size:15px;line-height:1.65;color:#2A1E2C;">
    <p>Vou ser sincera com você, {nome}.</p>
    <p>Cabelo {tipo_cabelo} que não recebe o cuidado certo <strong>não fica parado</strong> — ele piora. O {problema_principal} aumenta, a quebra sobe pelo comprimento e o que hoje se resolve em semanas vira meses de recuperação.</p>
    <p>Cada semana sem a rotina certa é mais fio danificado pra reverter depois. Não é pra te assustar — é o que eu vejo todo dia com {areas_preocupantes}.</p>
    <p>Começar <strong>agora</strong> é mais rápido, mais barato e muito menos frustrante do que daqui a 3 meses.</p>
    <div style="text-align:center;margin:26px 0 6px;">
      <a href="https://planodaju.julianecost.com/oferta" style="display:inline-block;background:#BE185D;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:99px;">Começar meu plano hoje →</a>
    </div>
  </div>
</div></body></html>
$html$);

-- ── Email 4 — dia 3: prova social + como funciona ───────────────────────────
insert into public.wg_email_sequences
  (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body)
values
('NP4 — Prova social + como funciona', 3, 0, 'no_purchase', 'lead_created', 'plano-capilar', 10, true,
 'Mulheres com cabelo {tipo_cabelo} igual o seu conseguiram, {nome}',
$html$
<!doctype html><html><body style="margin:0;background:#FFFAF5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:8px 0 18px;"><span style="font-size:22px;font-weight:700;color:#2A1E2C;">Plano da <span style="color:#BE185D;font-style:italic;">Ju</span></span></div>
  <div style="background:#fff;border-radius:18px;padding:28px 24px;box-shadow:0 1px 3px rgba(42,30,44,0.06);font-size:15px;line-height:1.65;color:#2A1E2C;">
    <p>{nome}, mais de <strong>3.500 mulheres</strong> já passaram pelo Plano da Ju — muitas com exatamente o seu perfil: cabelo {tipo_cabelo} e {problema_principal}.</p>
    <p>O que mudou pra elas não foi um produto milagroso. Foi ter um <strong>passo a passo semana a semana</strong>, na ordem certa, feito pro tipo de cabelo delas.</p>
    <p>E o melhor: o plano se adapta ao que você já tem em casa ({como_plano}) — você não precisa torrar dinheiro trocando tudo de uma vez.</p>
    <p>É o seu diagnóstico ({diagnostico_curto}) virando um cronograma simples de seguir.</p>
    <div style="text-align:center;margin:26px 0 6px;">
      <a href="https://planodaju.julianecost.com/oferta" style="display:inline-block;background:#BE185D;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:99px;">Ver como funciona →</a>
    </div>
  </div>
</div></body></html>
$html$);

-- ── Email 5 — dia 5: quebra de objeção ──────────────────────────────────────
insert into public.wg_email_sequences
  (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body)
values
('NP5 — Já tentei de tudo', 5, 0, 'no_purchase', 'lead_created', 'plano-capilar', 10, true,
 '"Já tentei de tudo no meu cabelo" — leia isso, {nome}',
$html$
<!doctype html><html><body style="margin:0;background:#FFFAF5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:8px 0 18px;"><span style="font-size:22px;font-weight:700;color:#2A1E2C;">Plano da <span style="color:#BE185D;font-style:italic;">Ju</span></span></div>
  <div style="background:#fff;border-radius:18px;padding:28px 24px;box-shadow:0 1px 3px rgba(42,30,44,0.06);font-size:15px;line-height:1.65;color:#2A1E2C;">
    <p>"Ju, eu já tentei de tudo e nada resolve meu {problema_principal}."</p>
    <p>Eu ouço isso todo dia, {nome}. E quase sempre o motivo é o mesmo: você tentou várias coisas <strong>soltas</strong>, sem diagnóstico e sem ordem. Máscara essa semana, óleo na outra, um corte… cada uma puxando pra um lado.</p>
    <p>O Plano é diferente porque parte do <strong>seu</strong> diagnóstico ({diagnostico_curto}) e organiza tudo na sequência que o seu cabelo precisa.</p>
    <p>E olha que justo: leva <strong>~10 minutos por dia</strong>, usa o que você já tem, e tem <strong>garantia de 7 dias</strong> — se não for pra você, devolvo seu dinheiro.</p>
    <div style="text-align:center;margin:26px 0 6px;">
      <a href="https://planodaju.julianecost.com/oferta" style="display:inline-block;background:#BE185D;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:99px;">Quero tentar do jeito certo →</a>
    </div>
  </div>
</div></body></html>
$html$);

-- ── Email 6 — dia 7: urgência + oferta ──────────────────────────────────────
insert into public.wg_email_sequences
  (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body)
values
('NP6 — Oferta com desconto', 7, 0, 'no_purchase', 'lead_created', 'plano-capilar', 10, true,
 '{nome}, separei uma condição especial pro seu plano 🎁',
$html$
<!doctype html><html><body style="margin:0;background:#FFFAF5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:8px 0 18px;"><span style="font-size:22px;font-weight:700;color:#2A1E2C;">Plano da <span style="color:#BE185D;font-style:italic;">Ju</span></span></div>
  <div style="background:#fff;border-radius:18px;padding:28px 24px;box-shadow:0 1px 3px rgba(42,30,44,0.06);font-size:15px;line-height:1.65;color:#2A1E2C;">
    <p>{nome}, você fez o diagnóstico há alguns dias e eu não quero que o seu {problema_principal} continue te incomodando.</p>
    <p>Por isso separei uma <strong>condição especial</strong> pra você começar hoje o plano do seu cabelo {tipo_cabelo} — por menos de um café por semana.</p>
    <p>São <strong>90 dias</strong> de cronograma personalizado, ajustado pela própria Juliane, com garantia de 7 dias. O risco é todo meu.</p>
    <p style="color:#BE185D;font-weight:700;">Essa condição é por tempo limitado — não deixa passar.</p>
    <div style="text-align:center;margin:26px 0 6px;">
      <a href="https://planodaju.julianecost.com/oferta" style="display:inline-block;background:#BE185D;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:99px;">Garantir minha condição →</a>
    </div>
  </div>
</div></body></html>
$html$);

-- ── Email 7 — dia 10: última chamada ────────────────────────────────────────
insert into public.wg_email_sequences
  (name, delay_days, delay_minutes, audience, anchor_event, quiz_slug, send_hour, enabled, subject, html_body)
values
('NP7 — Última chamada', 10, 0, 'no_purchase', 'lead_created', 'plano-capilar', 10, true,
 'Última vez que te escrevo sobre isso, {nome}',
$html$
<!doctype html><html><body style="margin:0;background:#FFFAF5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:8px 0 18px;"><span style="font-size:22px;font-weight:700;color:#2A1E2C;">Plano da <span style="color:#BE185D;font-style:italic;">Ju</span></span></div>
  <div style="background:#fff;border-radius:18px;padding:28px 24px;box-shadow:0 1px 3px rgba(42,30,44,0.06);font-size:15px;line-height:1.65;color:#2A1E2C;">
    <p>{nome}, essa é a última vez que te escrevo sobre o seu plano — prometo não lotar a sua caixa de entrada. 💗</p>
    <p>Só não quero que você fique mais um mês convivendo com {problema_principal} achando que é "normal" ou que não tem jeito. <strong>Tem.</strong> Seu cabelo {tipo_cabelo} pode mudar muito com a rotina certa.</p>
    <p>Se for o seu momento, eu te espero do outro lado com o plano pronto, baseado no <strong>seu</strong> diagnóstico ({diagnostico_curto}).</p>
    <p>E se não for agora, tudo bem — fica o convite de coração.</p>
    <div style="text-align:center;margin:26px 0 6px;">
      <a href="https://planodaju.julianecost.com/oferta" style="display:inline-block;background:#BE185D;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:99px;">Começar meu plano agora →</a>
    </div>
    <p style="font-size:13px;color:#7C6B7E;text-align:center;margin-top:14px;">Um abraço, Juliane</p>
  </div>
</div></body></html>
$html$);
