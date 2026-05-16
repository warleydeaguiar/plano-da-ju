// ViaCEP — resolve CEP brasileiro em endereço real
// API gratuita, sem chave. Doc: https://viacep.com.br/

export interface ViaCepAddress {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;  // cidade
  uf: string;          // estado (SP, MG, etc)
  erro?: boolean;
}

export async function lookupCep(cep: string): Promise<ViaCepAddress | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
      // Cache no Vercel Edge — CEP nunca muda
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data: ViaCepAddress = await res.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}
