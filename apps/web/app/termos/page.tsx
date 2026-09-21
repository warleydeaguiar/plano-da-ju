import type { Metadata } from 'next';
import { JU_WHATSAPP_EXIBICAO } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Termos de Uso — Plano Capilar | Juliane Cost',
  description:
    'Condições de uso, entrega, garantia e política de reembolso do Plano Capilar personalizado.',
  robots: { index: true, follow: true },
};

const ATUALIZADO_EM = '17 de setembro de 2026';
const VERSAO = '1.0';

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
            Termos de Uso do Plano Capilar
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
              O Plano Capilar é um <strong>produto digital e personalizado</strong>, produzido individualmente
              para você <strong>depois</strong> da confirmação do pagamento.
            </div>
            <div style={{ marginBottom: 8 }}>
              A <strong>garantia de 7 dias</strong> assegura que você vai receber o seu Plano: enquanto ele não
              for entregue, você pode desistir e receber 100% do valor de volta.
            </div>
            <div>
              Depois que o Plano personalizado é criado e entregue a você,{' '}
              <strong>não é possível fazer reembolso</strong>, porque é um conteúdo feito sob medida, que não
              pode ser devolvido nem revertido.
            </div>
          </Destaque>

          <P>
            Este documento reúne as condições de contratação e uso do Plano Capilar. Ele foi escrito em
            linguagem simples, e traz as leis que se aplicam a cada ponto. Ao contratar o Plano Capilar, você
            declara que leu e concorda com o que está aqui.
          </P>

          <Secao n={1} titulo="Quem oferece o serviço">
            <P>
              O Plano Capilar é oferecido por <strong>julianecost.com</strong>, inscrita no CNPJ nº
              20.227.193/0001-18, com endereço na Avenida Quinze de Novembro, 609, Jardim Petrópolis, Contagem
              — MG, CEP 32.185-122.
            </P>
            <P>
              Atendimento de segunda a sexta-feira, das 9h às 17h30, pelo telefone/WhatsApp{' '}
              <strong>{JU_WHATSAPP_EXIBICAO}</strong>.
            </P>
            <Lei>
              Estas informações são apresentadas em cumprimento ao Decreto nº 7.962/2013, art. 2º, que obriga
              todo site de comércio eletrônico a exibir de forma clara a identificação, o CNPJ e o endereço do
              fornecedor.
            </Lei>
          </Secao>

          <Secao n={2} titulo="O que é o Plano Capilar">
            <P>
              O Plano Capilar é um <strong>produto digital, individual e personalizado</strong>. Ele não é um
              e-book pronto, nem um material padronizado vendido em série: cada Plano é elaborado
              especificamente para uma pessoa, a partir das informações que ela mesma fornece.
            </P>
            <Lista
              itens={[
                <>
                  <strong>É montado a partir dos seus dados:</strong> as respostas do questionário (tipo de
                  fio, rotina, química, quedas, objetivos) e a foto do seu cabelo que você envia.
                </>,
                <>
                  <strong>É entregue de forma digital</strong>, na sua área de cliente / aplicativo, com login
                  e senha pessoais. Não existe produto físico, nem envio de itens pelos Correios.
                </>,
                <>
                  <strong>Tem acompanhamento de 90 dias</strong>, com o cronograma, as orientações e os
                  materiais correspondentes ao seu caso.
                </>,
                <>
                  <strong>É único e não reaproveitável:</strong> o conteúdo produzido para você não serve para
                  outra pessoa e não retorna ao estoque, porque estoque não existe.
                </>,
              ]}
            />
          </Secao>

          <Secao n={3} titulo="Como a contratação acontece">
            <Lista
              itens={[
                <>
                  Você responde ao questionário e recebe a oferta com o <strong>valor exato</strong> do Plano.
                  O preço válido é sempre o exibido na tela de finalização, no momento da compra — promoções,
                  cupons e condições especiais têm prazo e regras próprias, informadas ali.
                </>,
                <>
                  O pagamento é processado por instituição de pagamento parceira (PIX ou cartão de crédito). A
                  cobrança é <strong>única</strong>: não há assinatura, renovação automática nem cobrança
                  recorrente.
                </>,
                <>
                  <strong>Só depois da confirmação do pagamento</strong> o seu Plano começa a ser produzido.
                  Em seguida você cria a sua senha e envia a foto do cabelo — etapa necessária para a
                  personalização.
                </>,
                <>
                  Concluída a produção, o Plano fica disponível na sua área de cliente e você é avisada. A
                  partir desse momento, o serviço está <strong>integralmente executado</strong>.
                </>,
              ]}
            />
          </Secao>

          <Secao n={4} titulo="Aceite destes termos no momento da compra">
            <P>
              Estes Termos de Uso são aceitos <strong>no ato da compra</strong>. Ao concluir o pagamento do
              Plano Capilar, você declara, de forma livre e informada, que:
            </P>
            <Lista
              itens={[
                <>leu e compreendeu estas condições, que ficam permanentemente disponíveis nesta página;</>,
                <>
                  está contratando um <strong>conteúdo digital personalizado</strong>, produzido sob medida
                  para você após a confirmação do pagamento;
                </>,
                <>
                  <strong>solicita expressamente o início imediato</strong> da elaboração e da entrega do seu
                  Plano, sem aguardar qualquer prazo de reflexão;
                </>,
                <>
                  está ciente de que, <strong>depois de o Plano ser criado e disponibilizado a você</strong>,
                  não cabe reembolso, nos termos do item 6.
                </>,
              ]}
            />
            <P>
              O registro eletrônico da compra (data, hora, meio de pagamento e dados informados por você) é
              conservado e serve como comprovação desse aceite.
            </P>
          </Secao>

          <Secao n={5} titulo="Garantia de 7 dias: o que ela cobre">
            <Destaque titulo="A garantia protege a entrega">
              A garantia de 7 dias existe para você ter a segurança de que{' '}
              <strong>vai receber o Plano que comprou</strong>. Enquanto o seu Plano não tiver sido entregue,
              você pode desistir e receber <strong>100% do valor pago de volta</strong>, sem discussão.
            </Destaque>
            <P>Na prática, dentro dos 7 dias corridos contados da compra, você tem direito à devolução integral se:</P>
            <Lista
              itens={[
                <>o seu Plano não for entregue no prazo informado;</>,
                <>houver falha nossa que impeça o acesso ao conteúdo e não a resolvermos; ou</>,
                <>
                  você simplesmente mudar de ideia <strong>antes</strong> de o Plano personalizado ser criado
                  e disponibilizado para você.
                </>,
              ]}
            />
            <P>
              A garantia <strong>não</strong> é um período de teste do conteúdo já recebido: ela cobre a
              entrega, não o arrependimento depois da entrega. Uma vez que o Plano personalizado foi criado e
              está disponível na sua área de cliente, o serviço foi cumprido e não há reembolso.
            </P>
          </Secao>

          <Secao n={6} titulo="Por que não há reembolso depois da entrega">
            <P>
              O Plano Capilar não é um produto de prateleira. Ele é{' '}
              <strong>criado do zero para uma única pessoa</strong>, com base na foto e nas respostas dela, e
              é entregue em formato digital — ou seja, seu conteúdo é conhecido integralmente no instante em
              que é recebido.
            </P>
            <P>Por isso, uma vez entregue:</P>
            <Lista
              itens={[
                <>
                  <strong>não pode ser devolvido</strong> — não existe item físico a restituir, e o conteúdo
                  já foi visto;
                </>,
                <>
                  <strong>não pode ser revertido</strong> — o trabalho de análise e montagem já foi executado
                  e não é desfeito;
                </>,
                <>
                  <strong>não pode ser revendido nem reaproveitado</strong> — foi feito sob medida para você e
                  não serve para outra pessoa.
                </>,
              ]}
            />
            <P>
              Devolver o valor nessa situação significaria entregar o conteúdo de graça, o que caracteriza
              enriquecimento sem causa de quem recebeu — vedado pelo Código Civil, art. 884.
            </P>
          </Secao>

          <Secao n={7} titulo="A lei que se aplica ao reembolso">
            <P>
              O <strong>Código de Defesa do Consumidor (Lei nº 8.078/1990), art. 49</strong>, garante ao
              consumidor o direito de desistir da compra feita fora do estabelecimento comercial — como pela
              internet — no prazo de <strong>7 dias</strong> contados da contratação ou do recebimento:
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
              <strong>Nós respeitamos integralmente esse direito</strong> — é exatamente o que a nossa
              garantia do item 5 assegura: enquanto o serviço não tiver sido executado e entregue, dentro dos
              7 dias, você desiste e recebe tudo de volta.
            </P>
            <P>
              A restituição deixa de ser cabível quando o serviço personalizado{' '}
              <strong>já foi integralmente prestado a seu pedido</strong>. Isso se apoia em:
            </P>
            <Lista
              itens={[
                <>
                  <strong>CDC, art. 49, parágrafo único</strong> — a devolução dos valores pressupõe a
                  desistência do contrato; com o conteúdo personalizado já produzido e entregue, não há
                  prestação a devolver, e o objeto do contrato se exauriu.
                </>,
                <>
                  <strong>Código Civil, arts. 593 e seguintes</strong> (contrato de prestação de serviço) — o
                  serviço efetivamente prestado é devido a quem o executou.
                </>,
                <>
                  <strong>Código Civil, art. 884</strong> — ninguém pode enriquecer-se sem causa à custa de
                  outrem, o que ocorreria ao manter o conteúdo e reaver o preço.
                </>,
                <>
                  <strong>CDC, art. 6º, III, e Decreto nº 7.962/2013, art. 5º</strong> — o consumidor deve ser
                  informado de forma clara e prévia sobre as características do serviço e sobre as condições
                  de reembolso. É a função desta página, apresentada antes e no momento da compra.
                </>,
              ]}
            />
            <P>
              Em qualquer hipótese, permanecem garantidos os direitos do consumidor em caso de{' '}
              <strong>vício ou defeito</strong> do serviço (CDC, arts. 18 e 20): se o Plano entregue estiver
              incompleto, inacessível ou em desacordo com o que foi oferecido, corrigimos, refazemos ou
              devolvemos o valor.
            </P>
          </Secao>

          <Secao n={8} titulo="Como pedir o reembolso quando ele é devido">
            <Lista
              itens={[
                <>
                  Fale com a gente pelo WhatsApp <strong>{JU_WHATSAPP_EXIBICAO}</strong>, de segunda a sexta, das 9h
                  às 17h30, informando o nome, o e-mail usado na compra e o motivo.
                </>,
                <>Respondemos em até 2 dias úteis.</>,
                <>
                  Confirmado o direito, a devolução é feita <strong>pelo mesmo meio de pagamento</strong>: no
                  PIX, em até 5 dias úteis; no cartão de crédito, o estorno aparece conforme o prazo da
                  administradora, normalmente em até 2 faturas.
                </>,
              ]}
            />
          </Secao>

          <Secao n={9} titulo="Natureza do serviço: não é consulta médica">
            <P>
              O Plano Capilar é um material de <strong>orientação sobre cuidados capilares e cosméticos</strong>.
              Ele <strong>não</strong> é consulta médica, não constitui diagnóstico, prescrição ou tratamento
              de saúde, e <strong>não substitui</strong> a avaliação de médica dermatologista ou de outro
              profissional habilitado.
            </P>
            <P>
              Resultados variam de pessoa para pessoa e dependem da constância na rotina, da saúde geral, de
              fatores hormonais, genéticos e do uso correto dos produtos. Não prometemos resultado específico
              nem cura de qualquer condição. Em caso de queda intensa, feridas, dor, descamação, alergia ou
              qualquer sinal clínico, procure uma profissional de saúde.
            </P>
          </Secao>

          <Secao n={10} titulo="Uso pessoal e direitos autorais">
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

          <Secao n={11} titulo="Seus dados e a sua foto">
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

          <Secao n={12} titulo="Acesso, prazo e suporte">
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

          <Secao n={13} titulo="Alterações destes termos">
            <P>
              Podemos atualizar estes Termos para refletir melhorias no serviço ou mudanças na legislação. A
              versão válida para a sua compra é a que estava publicada nesta página{' '}
              <strong>na data em que você comprou</strong>. Toda versão traz número e data de atualização no
              topo.
            </P>
          </Secao>

          <Secao n={14} titulo="Legislação aplicável e foro">
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
            <div>Atendimento: segunda a sexta, das 9h às 17h30 · {JU_WHATSAPP_EXIBICAO}</div>
            <div style={{ marginTop: 10 }}>
              © 2026 julianecost.com — Todos os direitos reservados. Versão {VERSAO}, de {ATUALIZADO_EM}.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
