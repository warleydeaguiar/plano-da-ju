'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, gradient } from '../theme';
import {
  SbDashboard, SbPlanos, SbUsuarias, SbGrupos, SbFollowup, SbAnuncios, SbAnalytics,
  SbEmail, SbQuiz, SbStories, SbSuporte, SbChat, SbProdutos, SbYbera, SbExperimentos,
  SbCheckout, SbErros, SbConfig, SbFunil, type SidebarIcon,
} from './sidebar-icons';

type NavItem = {
  icon: SidebarIcon
  label: string
  href: string
  children?: { label: string; href: string }[]
}

/**
 * Menu por SEÇÃO, não uma lista corrida.
 *
 * Eram 22 itens soltos no primeiro nível — dava para rolar o menu inteiro sem
 * achar o que se procura, e coisas do mesmo assunto ficavam longe umas das
 * outras (Anúncios em cima, Google Analytics no meio, Checkout no fim). Agora
 * cada seção responde a uma pergunta: como estamos, onde entra dinheiro, quem
 * são as clientes, o que estamos divulgando, o que publicamos e o que quebrou.
 */
type NavGroup = { secao: string; itens: NavItem[] }

const NAV: NavGroup[] = [
  {
    secao: 'Visão geral',
    itens: [
      { icon: SbDashboard, label: 'Dashboard', href: '/' },
      { icon: SbFunil, label: 'Funil do quiz', href: '/funil' },
      {
        icon: SbAnalytics, label: 'Relatórios', href: '/relatorios/lucro',
        children: [
          { label: 'Lucro', href: '/relatorios/lucro' },
          { label: 'Conversão dos anúncios', href: '/relatorios/conversao' },
        ],
      },
    ],
  },
  {
    secao: 'Vendas',
    itens: [
      {
        icon: SbCheckout, label: 'Checkout', href: '/checkout',
        children: [
          { label: 'Funil e preços', href: '/checkout' },
          { label: 'Erros no checkout', href: '/checkout/erros' },
        ],
      },
      { icon: SbExperimentos, label: 'Experimentos A/B', href: '/experimentos' },
    ],
  },
  {
    secao: 'Clientes',
    itens: [
      {
        icon: SbUsuarias, label: 'Usuárias', href: '/usuarios',
        children: [
          { label: 'Todas as usuárias', href: '/usuarios' },
          { label: 'Assinaturas', href: '/assinaturas' },
          { label: 'Leads', href: '/leads' },
        ],
      },
      {
        icon: SbPlanos, label: 'Planos', href: '/planos',
        children: [
          { label: 'Revisar planos', href: '/planos' },
          { label: 'Aprovação de planos', href: '/planos/aprovacao' },
          { label: 'Galeria de fotos', href: '/planos/galeria' },
          { label: 'Fotos de progresso', href: '/planos/progresso' },
        ],
      },
      {
        icon: SbSuporte, label: 'Atendimento', href: '/suporte',
        children: [
          { label: 'Suporte Plano Capilar', href: '/suporte' },
          { label: 'Follow-up', href: '/followup' },
        ],
      },
      { icon: SbChat, label: 'Chatwoot', href: 'https://chat.julianecost.com' },
    ],
  },
  {
    secao: 'Marketing',
    itens: [
      {
        icon: SbAnuncios, label: 'Anúncios', href: '/anuncios',
        children: [
          { label: 'Meta Ads', href: '/anuncios' },
          { label: 'Google Analytics', href: '/analytics' },
        ],
      },
      {
        icon: SbQuiz, label: 'Quiz', href: '/quiz',
        children: [
          { label: 'Plano Capilar', href: '/quiz/plano-capilar' },
          { label: 'Fashion Gold', href: '/quiz/fashion-gold' },
          { label: '🇺🇸 Brasileiras nos EUA', href: '/quiz/eua' },
          { label: 'Imagens & mídia', href: '/quiz/imagens' },
          { label: 'Depoimentos & fotos', href: '/quiz/configuracoes' },
        ],
      },
      { icon: SbEmail, label: 'E-mail marketing', href: '/email-marketing' },
      {
        icon: SbGrupos, label: 'Grupos de promoções', href: '/grupos',
        children: [
          { label: 'Lista de grupos', href: '/grupos' },
          { label: 'Broadcast', href: '/grupos/broadcast' },
          { label: 'Gerenciar', href: '/grupos/gerenciar' },
          { label: 'Conexões Evolution', href: '/grupos/conexao' },
          { label: 'Promoções no app', href: '/promocoes' },
        ],
      },
    ],
  },
  {
    secao: 'Conteúdo',
    itens: [
      {
        icon: SbProdutos, label: 'Site e blog', href: '/site',
        children: [
          { label: 'Conteúdo', href: '/site' },
          { label: 'Perguntas frequentes', href: '/site/faq' },
          { label: 'Avaliações', href: '/site/avaliacoes' },
          { label: 'Cliques no WhatsApp', href: '/site/whatsapp' },
        ],
      },
      { icon: SbProdutos, label: 'Produtos', href: '/produtos' },
      { icon: SbStories, label: 'Stories da Juliane', href: '/stories' },
      {
        icon: SbYbera, label: 'Ybera', href: '/ybera',
        children: [
          { label: 'Visão geral', href: '/ybera' },
          { label: 'Conversão', href: '/ybera/conversao' },
        ],
      },
    ],
  },
  {
    secao: 'Sistema',
    itens: [
      { icon: SbErros, label: 'Erros do sistema', href: '/erros' },
      { icon: SbSuporte, label: 'Feedback', href: '/feedback' },
      {
        icon: SbConfig, label: 'Configurações', href: '/configuracoes',
        children: [
          { label: 'Geral', href: '/configuracoes' },
          { label: 'Funcionários', href: '/funcionarios' },
        ],
      },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      await supabase.auth.signOut();
    } catch {}
    router.push('/login');
  }

  // No celular o menu não cabe ao lado do conteúdo: vira gaveta, aberta pelo
  // botão. Antes ele era simplesmente escondido abaixo de 768px — dava para ver
  // a página, mas não para trocar de página.
  const [aberto, setAberto] = useState(false);
  useEffect(() => { setAberto(false); }, [pathname]);   // fecha ao navegar

  return (
    <>
      <button
        type="button"
        className="dash-menu-btn"
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={aberto}
        onClick={() => setAberto(v => !v)}
      >
        {aberto ? '✕' : '☰'}
      </button>
      {aberto && <div className="dash-backdrop" onClick={() => setAberto(false)} aria-hidden="true" />}
    <aside className={`dash-sidebar${aberto ? ' aberta' : ''}`} style={{
      width: 234, minWidth: 234, background: T.cream,
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'fixed', left: 0, top: 0,
      borderRight: `1px solid ${T.border}`,
      fontFamily: fonts.ui,
    }}>
      {/* Brand */}
      <div style={{ padding: '26px 22px 22px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{
          fontSize: 21, fontWeight: 600, color: T.ink, letterSpacing: -0.4,
          fontFamily: fonts.display,
        }}>
          Plano da <em style={{ fontStyle: 'italic', color: T.pinkDeep }}>Ju</em>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, color: T.gold, letterSpacing: 1.5,
          textTransform: 'uppercase', marginTop: 3,
        }}>Painel Admin</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
        {NAV.map(grupo => (
          <div key={grupo.secao} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 9.5, fontWeight: 800, color: T.inkMuted, letterSpacing: 1.2,
              textTransform: 'uppercase', padding: '8px 13px 5px',
            }}>{grupo.secao}</div>
            {grupo.itens.map(item => {
          const isExternal = item.href.startsWith('http://') || item.href.startsWith('https://');
          const hasChildren = item.children && item.children.length > 0;
          // Filho casa com a rota atual mesmo quando não fica sob o href do pai
          // (ex: Assinaturas /assinaturas e Leads /leads sob Usuárias /usuarios).
          const childMatch = hasChildren
            ? item.children!.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
            : false;
          const isActive = isExternal
            ? false
            : item.href === '/'
              ? pathname === '/'
              : (pathname.startsWith(item.href) || childMatch);
          const isExpanded = hasChildren && isActive;

          const itemStyle: React.CSSProperties = {
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '10px 13px', fontSize: 13.5, fontWeight: isActive ? 600 : 500,
            color: isActive ? '#fff' : T.inkSoft,
            background: isActive && !hasChildren ? gradient.heroSoft : 'transparent',
            textDecoration: 'none',
            borderRadius: 11,
            marginBottom: 2,
            transition: 'all 0.15s',
            boxShadow: isActive && !hasChildren ? '0 4px 12px rgba(190,24,93,0.22)' : 'none',
          };
          // Item-pai com filhos quando ativo: fundo rosa suave (não gradiente)
          if (isActive && hasChildren) {
            itemStyle.background = T.pinkSoft;
            itemStyle.color = T.pinkDeep;
            itemStyle.boxShadow = 'none';
          }

          const Icon = item.icon;
          const innerContent = (
            <>
              <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} />
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {isExternal && (
                <span style={{ fontSize: 10, color: T.inkMuted, marginRight: -2 }}>↗</span>
              )}
              {hasChildren && (
                <span style={{ fontSize: 10, color: isActive ? T.pinkDeep : T.inkMuted, marginRight: -2 }}>
                  {isExpanded ? '▾' : '▸'}
                </span>
              )}
            </>
          );

          return (
            <div key={item.href}>
              {isExternal ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" style={itemStyle}>
                  {innerContent}
                </a>
              ) : (
                <Link href={item.href} style={itemStyle}>
                  {innerContent}
                </Link>
              )}
              {/* Submenus */}
              {isExpanded && item.children && (
                <div style={{ margin: '2px 0 6px 18px', paddingLeft: 12, borderLeft: `2px solid ${T.pinkBlush}` }}>
                  {item.children.map(child => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        style={{
                          display: 'block',
                          padding: '7px 12px',
                          fontSize: 12.5, fontWeight: childActive ? 700 : 500,
                          color: childActive ? T.pinkDeep : T.inkSoft,
                          textDecoration: 'none',
                          background: childActive ? T.pinkSoft : 'transparent',
                          borderRadius: 8,
                          marginBottom: 1,
                        }}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div style={{
        padding: '14px 18px', borderTop: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: 11,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: gradient.hero,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
          boxShadow: '0 4px 12px rgba(190,24,93,0.25)',
        }}>JC</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Juliane Cost</div>
          <div onClick={handleLogout} style={{ fontSize: 11, color: T.inkMuted, cursor: 'pointer' }}>Sair</div>
        </div>
      </div>
    </aside>
    </>
  );
}
