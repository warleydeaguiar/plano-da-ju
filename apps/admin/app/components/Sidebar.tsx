'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, gradient } from '../theme';

type NavItem = {
  icon: string
  label: string
  href: string
  children?: { label: string; href: string }[]
}

const NAV: NavItem[] = [
  { icon: '📊', label: 'Dashboard', href: '/' },
  {
    icon: '🔍', label: 'Revisão de Planos', href: '/planos',
    children: [
      { label: 'Revisar planos', href: '/planos' },
      { label: 'Galeria de fotos', href: '/planos/galeria' },
    ],
  },
  {
    icon: '👥', label: 'Usuárias', href: '/usuarios',
    children: [
      { label: 'Assinaturas', href: '/assinaturas' },
      { label: 'Leads', href: '/leads' },
    ],
  },
  {
    icon: '💬', label: 'Grupos de Promoções', href: '/grupos',
    children: [
      { label: 'Lista', href: '/grupos' },
      { label: 'Broadcast', href: '/grupos/broadcast' },
      { label: 'Promoções no App', href: '/promocoes' },
      { label: 'Gerenciar', href: '/grupos/gerenciar' },
      { label: 'Conexões Evolution', href: '/grupos/conexao' },
    ],
  },
  { icon: '📞', label: 'Followup', href: '/followup' },
  { icon: '📣', label: 'Anúncios', href: '/anuncios' },
  { icon: '📈', label: 'Google Analytics', href: '/analytics' },
  { icon: '📧', label: 'Email Marketing', href: '/email-marketing' },
  {
    icon: '🎯', label: 'Quiz', href: '/quiz',
    children: [
      { label: 'Fashion Gold', href: '/quiz/fashion-gold' },
      { label: 'Plano Capilar', href: '/quiz/plano-capilar' },
      { label: 'Imagens & Mídia', href: '/quiz/imagens' },
      { label: 'Depoimentos & Fotos', href: '/quiz/configuracoes' },
    ],
  },
  { icon: '🎬', label: 'Stories da Juliane', href: '/stories' },
  { icon: '🎧', label: 'Suporte Plano Capilar', href: '/suporte' },
  { icon: '🗨️', label: 'Atendimento (Chatwoot)', href: 'https://chat.julianecost.com' },
  { icon: '🛍️', label: 'Produtos', href: '/produtos' },
  { icon: '🌿', label: 'Ybera', href: '/ybera' },
  { icon: '🧪', label: 'Experimentos A/B', href: '/experimentos' },
  {
    icon: '🛒', label: 'Checkout', href: '/checkout',
    children: [
      { label: 'Funil', href: '/checkout' },
      { label: 'Erros', href: '/checkout/erros' },
    ],
  },
  { icon: '⚙️', label: 'Configurações', href: '/configuracoes' },
];

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

  return (
    <aside className="dash-sidebar" style={{
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
        {NAV.map(item => {
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

          const innerContent = (
            <>
              <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
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
  );
}
