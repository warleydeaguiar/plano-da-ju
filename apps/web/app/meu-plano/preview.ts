// Modo PREVIEW (admin "Ver como cliente"): carrega os dados de QUALQUER cliente,
// read-only, sem sessão. O contexto (preview_user + k) viaja pela URL — o Shell
// preserva os params na navegação (previewHref), então funciona no app inteiro.

export interface PreviewCtx { user: string; k: string }

// Lê o contexto de preview da URL atual (?preview_user=<id|email>&k=<segredo>).
export function previewCtx(): PreviewCtx | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  const user = p.get('preview_user');
  const k = p.get('k');
  return user && k ? { user, k } : null;
}

// Acrescenta os params de preview a um href (pros links da navegação de baixo).
export function previewHref(href: string, ctx: PreviewCtx | null): string {
  if (!ctx) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}preview_user=${encodeURIComponent(ctx.user)}&k=${encodeURIComponent(ctx.k)}`;
}

// Busca o bundle completo da cliente (profile + planos + produtos + fotos + eventos).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchPreviewBundle(ctx: PreviewCtx): Promise<any | null> {
  try {
    const r = await fetch(`/api/admin/plan-preview?user=${encodeURIComponent(ctx.user)}&k=${encodeURIComponent(ctx.k)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
