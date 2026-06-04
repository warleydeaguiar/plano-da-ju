# Como destravar o ENVIO de mensagens no WhatsApp (Juliane Cost)

**Para:** Diego (admin do Business Manager "Agência Ferraz")
**Situação:** o WhatsApp da Juliane **recebe** mensagens normalmente, mas **não consegue enviar** — toda tentativa dá erro `#200 / #10`.

**Por quê:** o número está num WhatsApp Business Account (WABA) cujo Business (Agência Ferraz) ainda **não concluiu o cadastro de envio (Cloud API)** na Meta. Falta um passo que **só você, como admin do Business Manager, consegue fazer pelo painel** — não dá pra resolver por código nem por token.

São 2 coisas, na ordem. Faça a 1 primeiro e teste; se ainda não enviar, faça a 2.

---

## Passo 1 — Anexar forma de pagamento ao WABA (resolve a maioria dos casos)

Sem um cartão/forma de pagamento no WABA, a Meta bloqueia o envio mesmo nas conversas grátis.

1. Acesse **business.facebook.com** logado na conta que administra a Agência Ferraz.
2. Vá em **Configurações do negócio** (Business Settings) → **Contas** → **Contas do WhatsApp** → selecione **"Juliane Cost"**.
3. Abra **Configurações de pagamento** (Payment settings) **DESSE WABA**.
   - ⚠️ Não confundir com "Configurações de pagamento" do Facebook/Instagram nem com pagamentos ao consumidor. Tem que ser o **pagamento do WhatsApp Business / WABA**.
4. **Adicione um cartão de crédito** como forma de pagamento.
5. Salve.

Depois disso, peça pra Warley testar um envio pelo Chatwoot. Se enviar → resolvido. Se ainda der #200 → Passo 2.

---

## Passo 2 — Concluir o Embedded Signup (vincula o App ao WABA com permissão de envio)

Isso cria oficialmente a permissão de **mensageria** entre o App e o WABA (hoje todos os usuários do WABA só têm permissão de "gerenciar", nenhum tem "enviar").

**No App da Meta** (App "Plano da Ju - Chatwoot", ID `1441106717770238`):

1. Em **developers.facebook.com** → seu App → mude o App de **Desenvolvimento** para **Ativo/Live** (botão no topo).
2. Confirme que o produto **"Login do Facebook para Empresas"** está adicionado, com uma **Configuração** do tipo **"WhatsApp Embedded Signup"** apontando para o WABA **Juliane Cost**.
   - Anote o **Configuration ID** dessa configuração e passe pra Warley (ele pluga no Chatwoot).

**No fluxo de conexão (Embedded Signup):**

3. Quando a Warley abrir o botão **"Conectar via Facebook"** no Chatwoot, **você (Diego)** loga, **seleciona o WABA Juliane Cost**, escolhe o número e **autoriza**.
4. Esse handshake atribui automaticamente a permissão de envio e anexa a linha de crédito.

---

## O que a Warley já deixou pronto (não precisa mexer)
- App, número (+55 31 7126-0408), webhook e recebimento → **funcionando**.
- Token permanente do System User → gerado.
- Só falta o que está acima, que depende do seu acesso de admin no Business Manager.

## Dados úteis
- Business Manager: **Agência Ferraz** — ID `2159939127599203`
- WABA: **Juliane Cost** — ID `574753749051415`
- App: **Plano da Ju - Chatwoot** — ID `1441106717770238`
- Erro atual ao enviar: `#200` (e `#10` na API: "requires that the Business that owns this App is a Business Solution Provider")
