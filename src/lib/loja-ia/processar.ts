import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { coletarFonte, gerarSugestoesMerc, montarSugestoes, type EvidenciaFonte, type FonteExterna } from "./fontes";
import { coletarMateriais, limparMateriaisPendentes } from "./imagens";
import type { EntradaRascunho } from "./tipos";
import { consultarPerfilComercial } from "./whatsapp";

type Trabalho = {
  id: string;
  rascunho_id: string;
  dono_id: string;
  fonte: FonteExterna | "materiais" | "whatsapp" | "merc";
  tentativa: string;
  entrada: EntradaRascunho;
};
type Banco = ReturnType<typeof supabaseAdmin>;

async function resultado(trabalho: Trabalho, db: Banco) {
  switch (trabalho.fonte) {
    case "whatsapp":
      return consultarPerfilComercial(trabalho, db);
    case "materiais":
      return coletarMateriais(trabalho.rascunho_id, trabalho.entrada.materiais);
    case "merc": {
      const { data, error } = await db.rpc("loja_ia_evidencias_atuais", { p_trabalho: trabalho.id, p_tentativa: trabalho.tentativa });
      if (error || !Array.isArray(data)) throw new Error("Evidências indisponíveis.");
      let motivo: string | undefined;
      const sugestoes = await montarSugestoes(data as EvidenciaFonte[], async evidencias => {
        try {
          const geradas = await gerarSugestoesMerc(evidencias, trabalho.dono_id, db);
          if (geradas.length === 0) motivo = "O Merc não encontrou dados suficientes para sugerir mais informações.";
          return geradas;
        } catch {
          motivo = "O Merc não conseguiu completar as sugestões agora.";
          return [];
        }
      });
      return { estado: motivo ? "indisponivel" : "ok", motivo, sugestoes };
    }
    default: {
      const cnpjAutorizado = trabalho.fonte === "cnpj"
        && (await db.rpc("loja_ia_cnpj_disponivel")).data === true;
      return coletarFonte({ fonte: trabalho.fonte, entrada: trabalho.entrada }, { cnpjAutorizado });
    }
  }
}

export async function processarFilaLojaIa() {
  const db = supabaseAdmin();
  let concluidos = 0;
  let erros = 0;
  for (let rodada = 0; rodada < 2; rodada++) {
    const { data, error } = await db.rpc("loja_ia_pegar", { p_limite: 8 });
    if (error) throw error;
    const trabalhos = (data ?? []) as Trabalho[];
    if (!trabalhos.length) break;
    await Promise.all(trabalhos.map(async trabalho => {
      let retorno;
      try {
        retorno = await resultado(trabalho, db);
      } catch {
        retorno = { estado: "indisponivel", motivo: "Não foi possível consultar esta fonte." };
      }
      const gravado = await db.rpc("loja_ia_concluir_fonte", {
        p_trabalho: trabalho.id, p_tentativa: trabalho.tentativa, p_resultado: retorno,
      });
      if (gravado.error) erros++;
      else if (gravado.data === true) concluidos++;
    }));
  }
  const [aviso, limpeza] = await Promise.allSettled([
    db.rpc("loja_ia_enfileirar_avisos", { p_limite: 5 }),
    limparMateriaisPendentes(),
  ]);
  if (aviso.status === "rejected" || aviso.value.error) erros++;
  erros += limpeza.status === "rejected" ? 1 : limpeza.value;
  return { concluidos, erros };
}
