import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: 'Email e senha (mínimo 8 caracteres) são obrigatórios' },
        { status: 400 },
      );
    }

    const supabase = await createServiceClient();

    // Auth user já foi criado no checkout (com senha temporária).
    // Aqui só atualizamos a senha real escolhida pela usuária.
    const adminRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
      },
    );
    const adminData = await adminRes.json();
    const existingUser = adminData.users?.[0];

    if (existingUser) {
      // Atualizar senha do usuário existente
      const { error: updateErr } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password, email_confirm: true },
      );
      if (updateErr) throw updateErr;
      return NextResponse.json({ success: true });
    }

    // Fallback: usuário não encontrado (não passou pelo checkout) — criar do zero
    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !data?.user) {
      throw createError ?? new Error('Falha ao criar usuário');
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[auth/set-password]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar senha' },
      { status: 500 },
    );
  }
}
