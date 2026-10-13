import type { Metadata } from 'next';
import { JU_WHATSAPP_EXIBICAO } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Termos de Uso — Consulta com a Tricologista | Juliane Cost',
  description:
    'Condições de uso, entrega e garantia incondicional de 7 dias da Consulta com a Tricologista Juliane Cost.',
  robots: { index: true, follow: true },
};

const ATUALIZADO_EM = '13 de outubro de 2026';
// Sobe a cada mudança no texto: a própria página diz qual versão vale para a
// compra, e manter 1.0 depois de trocar telefone e horário tornaria isso falso.
const VERSAO = '2.0';

const T = {
  bg: '#FFFAF5',
  card: '#FFFFFF',
  ink: '#2B1B20',
  inkSoft: '#5A4750',
  inkMuted: '#8A7680',
  border: '#F0E0E4',
  rosa: '#BE185D',
  rosaSuave: '#FDF2F6',
};

const fonte =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function Secao({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 40 }}>
      <h2
        style={{
          fontSize: 19,
          lineHeight: 1.3,
          fontWeight: 700,
          color: T.ink,
          margin: '0 0 12px',
          letterSpacing: '-0.01em',
        }}
      >
        <span style={{ color: T.rosa, marginRight: 8 }}>{n}.</span>
        {titulo}
      </h2>
      <div style={{ fontSize: 15.5, lineHeight: 1.75, color: T.inkSoft }}>{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 14px' }}>{children}</p>;
}

function Lista({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ul style={{ margin: '0 0 14px', paddingLeft: 20 }}>
      {itens.map((item, i) => (
        <li key={i} style={{ margin: '0 0 8px' }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Destaque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: T.rosaSuave,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: '18px 20px',
        margin: '0 0 16px',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: T.rosa, marginBottom: 8, textTransform: 'uppercase' }}>
        {titulo}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: T.ink }}>{children}</div>
    </div>
  );
}

function Lei({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${T.rosa}`,
        padding: '4px 0 4px 16px',
        margin: '0 0 16px',
        fontSize: 14.5,
        lineHeight: 1.7,
        color: T.inkSoft,
      }}
    >
      {children}
    </div>
  );
}

export default function TermosPage() {
  return (
    <main style={{ background: T.bg, minHeight: '100vh', fontFamily: fonte, padding: '48px 20px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Cabeçalho */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: T.rosa, fontWeight: 800, textTransform: 'uppercase' }}>
            Juliane Cost
          </div>
          <h1
            style={{
              fontSize: 34,
              lineHeight: 1.15,
              fontWeight: 800,
              color: T.ink,
              margin: '10px 0 10px',
              letterSpacing: '-0.02em',
            }}
          >
            Termos de Uso da Consulta com a Tricologista
          </h1>
          <div style={{ fontSize: 13.5, color: T.inkMuted }}>
            Versão {VERSAO} · Atualizado em {ATUALIZADO_EM}
          </div>
        </div>

        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            padding: '32px 28px 36px',
          }}
        >
          {/* Resumo */}
          <Destaque titulo="Em resumo">
            <div style={{ marginBottom: 8 }}>
              Você contrata a <strong>Consulta com a Tricologista Juliane Cost</strong>: a análise do seu caso
              (questionário, foto do cabelo e conversa pelo WhatsApp) e o seu{' '}
              <strong>plano capilar personalizado de 90 dias</strong>, montado na consulta.
            </div>
            <div style={{ marginBottom: 8 }}>
              Você tem <strong>garantia incondicional de 7 dias</strong>: se não gostar, por qualquer motivo,
              devolvemos <strong>100% do valor</strong> — inclusive depois de o plano ser entregue.
            </div>
            <div>O pagamento é único: sem assinatura, sem renovação e sem cobrança recorrente.</div>
          </Destaque>

          <P>
            Este documento reúne as condições de contratação e uso da Consulta com a Tricologista Juliane
            Cost e do plano capilar que sai dela. Ele foi escrito em linguagem simples, e traz as leis que se
            aplicam a cada ponto. Ao contratar, você declara que leu e concorda com o que está aqui.
          </P>

          <Secao n={1} titulo="Quem oferece o serviço">
            <P>
              A Consulta é oferecida por <strong>julianecost.com</strong>, inscrita no CNPJ nº
              20.227.193/0001-18, com endereço na Avenida Quinze de Novembro, 609, Jardim Petrópolis, Contagem
              — MG, CEP 32.185-122.
            </P>
            <P>
              Atendimento de segunda a sexta-feira, das 8h às 17h30, pelo telefone/WhatsApp{' '}
              <strong>{JU_WHATSAPP_EXIBICAO}</strong>.
            </P>
            <Lei>
              Estas informações são apresentadas em cumprimento ao Decreto nº 7.962/2013, art. 2º, que obriga
              todo site de comércio eletrônico a exibir de forma clara a identificação, o CNPJ e o endereço do
              fornecedor.
            </Lei>
          </Secao>

          <Secao n={2} titulo="O que você contrata">
            <P>
              A <strong>Consulta com a Tricologista Juliane Cost</strong> é um serviço individual e
              personalizado, prestado de forma digital. Ela inclui:
            </P>
            <Lista
              itens={[
                <>
                  <strong>Análise do seu caso:</strong> as respostas do questionário (tipo de fio, rotina,
                  química, quedas, objetivos) e a foto do seu cabelo que você envia.
                </>,
                <>
                  <strong>Conversa com a Juliane pelo WhatsApp</strong>, para entender o seu caso.
                </>,
                <>
                  <strong>Plano capilar personalizado de 90 dias</strong>, montado a partir da consulta, com o
                  cronograma, as orientações e a indicação dos produtos certos para o seu cabelo.
                </>,
                <>
                  <strong>Entrega digital</strong>, na sua área de cliente / aplicativo, com login e senha
                  pessoais. Não existe produto físico, nem envio de itens pelos Correios.
                </>,
              ]}
            />
          </Secao>

          <Secao n={3} titulo="Como a contratação acontece">
            <Lista
              itens={[
                <>
                  Você responde ao questionário e recebe a oferta com o <strong>valor exato</strong> da
                  Consulta. O preço válido é sempre o exibido na tela de finalização, no momento da compra.
                  No cartão parcelado incidem juros, e o valor de cada parcela e o total são mostrados antes
                  do pagamento.
                </>,
                <>
                  O pagamento é processado por instituição de pagamento parceira (PIX ou cartão de crédito). A
                  cobrança é <strong>única</strong>: não há assinatura, renovação automática nem cobrança
                  recorrente.
                </>,
                <>
                  <strong>Depois da confirmação do pagamento</strong> você cria a sua senha e envia a foto do
                  cabelo — etapa necessária para a consulta e a personalização do plano.
                </>,
                <>
                  Concluída a consulta, o seu plano de 90 dias fica disponível na sua área de cliente e você é
                  avisada.
                </>,
              ]}
            />
          </Secao>

          <Secao n={4} titulo="Aceite destes termos no momento da compra">
            <P>
              Estes Termos de Uso são aceitos <strong>no ato da compra</strong>. Ao concluir o pagamento, você
              declara, de forma livre e informada, que:
            </P>
            <Lista
              itens={[
                <>leu e compreendeu estas condições, que ficam permanentemente disponíveis nesta página;</>,
                <>
                  está contratando um <strong>serviço digital personalizado</strong>, prestado a partir das
                  informações que você fornece;
                </>,
                <>
                  <strong>solicita o início imediato</strong> da consulta e da elaboração do seu plano, sem
                  prejuízo da garantia de 7 dias do item 5.
                </>,
              ]}
            />
            <P>
              O registro eletrônico da compra (data, hora, meio de pagamento e dados informados por você) é
              conservado e serve como comprovação desse aceite.
            </P>
          </Secao>

          <Secao n={5} titulo="Garantia incondicional de 7 dias">
            <Destaque titulo="Não gostou? Devolvemos 100%">
              Dentro de <strong>7 dias corridos contados da compra</strong>, se você não gostar da consulta
              ou do seu plano, <strong>por qualquer motivo</strong>, basta pedir e devolvemos{' '}
              <strong>100% do valor pago</strong> — sem perguntas, sem burocracia e{' '}
              <strong>mesmo que o plano já tenha sido entregue</strong>.
            </Destaque>
            <P>
              A garantia é um compromisso nosso com o seu resultado: o risco da compra fica conosco, não com
              você. Ela vale uma vez por cliente e não se aplica a casos de uso indevido descritos no item 9
              (compartilhamento de acesso, revenda ou reprodução do conteúdo).
            </P>
          </Secao>

          <Secao n={6} titulo="A lei que se aplica">
            <P>
              O <strong>Código de Defesa do Consumidor (Lei nº 8.078/1990), art. 49</strong>, garante ao
              consumidor o direito de desistir da compra feita fora do estabelecimento comercial — como pela
              internet — no prazo de <strong>7 dias</strong>:
            </P>
            <Lei>
              <em>
                &ldquo;Art. 49. O consumidor pode desistir do contrato, no prazo de 7 dias a contar de sua
                assinatura ou do ato de recebimento do produto ou serviço, sempre que a contratação de
                fornecimento de produtos e serviços ocorrer fora do estabelecimento comercial, especialmente
                por telefone ou a domicílio.&rdquo;
              </em>
            </Lei>
            <P>
              A nossa garantia do item 5 <strong>cumpre e amplia</strong> esse direito: dentro dos 7 dias, a
              devolução é integral em qualquer situação, antes ou depois da entrega do plano.
            </P>
            <P>
              Depois dos 7 dias, permanecem garantidos os direitos do consumidor em caso de{' '}
              <strong>vício ou defeito</strong> do serviço (CDC, arts. 18 e 20): se o plano entregue estiver
              incompleto, inacessível ou em desacordo com o que foi oferecido, corrigimos, refazemos ou
              devolvemos o valor. As condições de reembolso são informadas de forma clara e prévia, como
              exigem o <strong>CDC, art. 6º, III</strong>, e o <strong>Decreto nº 7.962/2013, art. 5º</strong>.
            </P>
          </Secao>

          <Secao n={7} titulo="Como pedir o reembolso">
            <Lista
              itens={[
                <>
                  Fale com a gente pelo WhatsApp <strong>{JU_WHATSAPP_EXIBICAO}</strong> (segunda a sexta, das
                  8h às 17h30) ou responda qualquer e-mail nosso, informando o nome e o e-mail usado na compra.
                  Dentro dos 7 dias não é preciso dizer o motivo.
                </>,
                <>Respondemos em até 2 dias úteis.</>,
                <>
                  A devolução é feita <strong>pelo mesmo meio de pagamento</strong>: no PIX, em até 5 dias
                  úteis; no cartão de crédito, o estorno aparece conforme o prazo da administradora,
                  normalmente em até 2 faturas.
                </>,
              ]}
            />
          </Secao>

          <Secao n={8} titulo="Natureza do serviço: não é consulta médica">
            <P>
              A Consulta com a Tricologista e o diagnóstico capilar são uma avaliação{' '}
              <strong>estética e cosmética</strong> dos fios e do couro cabeludo, com orientação sobre
              cuidados capilares e produtos. Ela <strong>não</strong> é consulta médica, não constitui
              diagnóstico de doença, prescrição ou tratamento de saúde, e <strong>não substitui</strong> a
              avaliação de médica dermatologista ou de outro profissional de saúde habilitado.
            </P>
            <P>
              Resultados variam de pessoa para pessoa e dependem da constância na rotina, da saúde geral, de
              fatores hormonais, genéticos e do uso correto dos produtos. Não prometemos cura de qualquer
              condição. Em caso de queda intensa, feridas, dor, descamação, alergia ou qualquer sinal
              clínico, procure uma profissional de saúde.
            </P>
          </Secao>

          <Secao n={9} titulo="Uso pessoal e direitos autorais">
            <P>
              O acesso é <strong>pessoal e intransferível</strong>. O conteúdo do Plano — textos, cronogramas,
              vídeos, materiais de apoio e a plataforma — é protegido pela{' '}
              <strong>Lei nº 9.610/1998</strong> (Direitos Autorais).
            </P>
            <P>
              É proibido copiar, reproduzir, distribuir, revender, publicar ou compartilhar o conteúdo, no
              todo ou em parte, bem como emprestar login e senha. O descumprimento permite a suspensão
              imediata do acesso, sem reembolso, além das medidas civis e criminais cabíveis.
            </P>
          </Secao>

          <Secao n={10} titulo="Seus dados e a sua foto">
            <P>
              Tratamos os seus dados pessoais conforme a{' '}
              <strong>Lei nº 13.709/2018 (LGPD)</strong>. As respostas do questionário e a foto do seu cabelo
              são usadas <strong>exclusivamente</strong> para elaborar e acompanhar o seu Plano, e para o
              atendimento relacionado a ele.
            </P>
            <Lista
              itens={[
                <>
                  <strong>Não publicamos</strong> a sua foto nem a usamos em divulgação sem a sua autorização
                  expressa e específica.
                </>,
                <>
                  Você pode, a qualquer momento, solicitar acesso, correção ou exclusão dos seus dados pelo
                  WhatsApp de atendimento (LGPD, art. 18).
                </>,
                <>
                  Comunicações por WhatsApp e e-mail relacionadas ao seu Plano podem ser enviadas; você pode
                  pedir para não receber mensagens quando quiser, e o pedido é atendido.
                </>,
              ]}
            />
          </Secao>

          <Secao n={11} titulo="Acesso, prazo e suporte">
            <P>
              O acompanhamento é de <strong>90 dias</strong> a partir da entrega do Plano, com suporte pelos
              canais oficiais nos horários de atendimento. Podemos atualizar a plataforma, melhorar materiais
              e ajustar funcionalidades, sem prejuízo do conteúdo já entregue a você.
            </P>
            <P>
              Perda de senha, troca de aparelho ou de número não fazem você perder o acesso: fale com o
              atendimento que reestabelecemos.
            </P>
          </Secao>

          <Secao n={12} titulo="Alterações destes termos">
            <P>
              Podemos atualizar estes Termos para refletir melhorias no serviço ou mudanças na legislação. A
              versão válida para a sua compra é a que estava publicada nesta página{' '}
              <strong>na data em que você comprou</strong>. Toda versão traz número e data de atualização no
              topo.
            </P>
          </Secao>

          <Secao n={13} titulo="Legislação aplicável e foro">
            <P>
              Estes Termos são regidos pelas leis brasileiras, em especial o Código de Defesa do Consumidor
              (Lei nº 8.078/1990), o Código Civil (Lei nº 10.406/2002), o Marco Civil da Internet (Lei nº
              12.965/2014) e a LGPD (Lei nº 13.709/2018).
            </P>
            <P>
              Fica assegurado ao consumidor o direito de propor eventual demanda no{' '}
              <strong>foro do seu domicílio</strong>, conforme o CDC, art. 101, I. Antes disso, procure o nosso
              atendimento: a maioria das situações se resolve em poucos minutos de conversa.
            </P>
          </Secao>

          {/* Rodapé */}
          <div
            style={{
              marginTop: 44,
              paddingTop: 22,
              borderTop: `1px solid ${T.border}`,
              fontSize: 12.5,
              lineHeight: 1.8,
              color: T.inkMuted,
            }}
          >
            <div>julianecost.com · CNPJ 20.227.193/0001-18</div>
            <div>Avenida Quinze de Novembro, 609, Jardim Petrópolis, Contagem — MG · CEP 32.185-122</div>
            <div>Atendimento: segunda a sexta, das 8h às 17h30 · {JU_WHATSAPP_EXIBICAO}</div>
            <div style={{ marginTop: 10 }}>
              © 2026 julianecost.com — Todos os direitos reservados. Versão {VERSAO}, de {ATUALIZADO_EM}.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
