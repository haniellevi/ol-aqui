import { exigirAdmin } from "@/lib/admin/auth";
import { quando } from "@/lib/admin/formato";
import { listarEquipe, listarRegioes } from "@/lib/dados/equipe";
import { telefone } from "@/lib/formato";
import { NOME_PAPEL, O_QUE_FAZ, PAPEIS, type MembroEquipe, type Regiao } from "@/lib/tipos-equipe";
import { Aviso, Cartao, Titulo } from "@/components/admin/ui";
import { BuscaConta, FormDesativar, FormPapel } from "./formularios";
import { Badge, type TomSelo } from "@/components/ui/badge";

export const metadata = { title: "Equipe e permissões" };

// Tela 14 · Equipe e permissões (só administrador). Quem trabalha no painel, com que papel e em que região.
// O banco recusa o que o papel não pode (tem_papel); aqui é só a tela. Tudo fica no histórico.

const COR_PAPEL: Record<string, TomSelo> = {
  administrador: "default",
  moderador: "secondary",
  financeiro: "success",
  suporte: "secondary",
  franqueado: "warning",
};

function Membro({ m, eu, regioes }: { m: MembroEquipe; eu: boolean; regioes: Regiao[] }) {
  return (
    <li className="rounded-card border border-borda bg-cartao p-4 shadow-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-beringela">
            {m.nome}
            {eu && <span className="ml-2 text-legenda font-bold text-texto-suave">(você)</span>}
          </p>
          <p className="text-sm text-texto-suave">
            {[m.whatsapp ? telefone(m.whatsapp) : null, m.cidade].filter(Boolean).join(" · ") || "Sem celular no cadastro"}
          </p>
        </div>
        <Badge variant={COR_PAPEL[m.papel] ?? "secondary"}>
          {NOME_PAPEL[m.papel]}
          {m.papel === "franqueado" && m.regiao_nome ? ` · ${m.regiao_nome}` : ""}
        </Badge>
      </div>
      <p className="mt-2 text-legenda text-texto-suave">
        {m.ativo ? "Na equipe desde" : "Saiu em"} {quando(m.ativo ? m.criado_em : m.desativado_em)}
        {m.ativo
          ? m.adicionado_por_nome
            ? ` · posto por ${m.adicionado_por_nome}`
            : ""
          : ` · tirado por ${m.desativado_por_nome ?? "sistema"}`}
        {m.observacao ? ` · ${m.observacao}` : ""}
      </p>
      {!eu && (
        <div className="mt-3 flex flex-col border-t border-borda">
          <details className="pt-1">
            <summary className="flex min-h-10 cursor-pointer items-center font-semibold text-beringela">
              {m.ativo ? "Trocar o papel" : "Pôr de volta na equipe"}
            </summary>
            <div className="pb-2 pt-2">
              <FormPapel
                usuarioId={m.usuario_id}
                papelAtual={m.ativo ? m.papel : null}
                regiaoAtual={m.microrregiao_id}
                regioes={regioes}
                rotulo={m.ativo ? "Salvar o papel" : "Pôr de volta"}
              />
            </div>
          </details>
          {m.ativo && (
            <details className="border-t border-borda pt-1">
              <summary className="flex min-h-10 cursor-pointer items-center font-semibold text-perigo">Tirar da equipe</summary>
              <div className="pb-2 pt-2">
                <FormDesativar usuarioId={m.usuario_id} nome={m.nome.split(" ")[0] ?? m.nome} />
              </div>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

export default async function EquipePage() {
  const { supabase, userId } = await exigirAdmin();
  const [membros, regioes] = await Promise.all([listarEquipe(supabase), listarRegioes(supabase)]);
  const ativos = (membros ?? []).filter((m) => m.ativo);
  const sairam = (membros ?? []).filter((m) => !m.ativo);

  return (
    <>
      <Titulo sub="Quem trabalha no painel e o que cada um pode fazer. Toda mudança fica no histórico com quem fez e quando.">
        Equipe e permissões
      </Titulo>

      <Cartao className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-beringela">Pôr alguém na equipe</h2>
        <BuscaConta regioes={regioes} euId={userId} />
      </Cartao>

      <section aria-labelledby="na-equipe" className="mb-6">
        <h2 id="na-equipe" className="mb-3 text-lg font-semibold text-beringela">
          Na equipe agora ({ativos.length})
        </h2>
        {membros === null ? (
          <Aviso tipo="erro">Não deu para ler a equipe agora. Atualize a página.</Aviso>
        ) : (
          <ul className="flex flex-col gap-3">
            {ativos.map((m) => (
              <Membro key={m.usuario_id} m={m} eu={m.usuario_id === userId} regioes={regioes} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-texto-suave">
          Você não muda o seu próprio papel, e o Mercado da Região nunca fica sem pelo menos um administrador.
        </p>
      </section>

      {sairam.length > 0 && (
        <details className="mb-6">
          <summary className="flex min-h-10 cursor-pointer items-center text-lg font-semibold text-beringela">
            Saíram da equipe ({sairam.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-3">
            {sairam.map((m) => (
              <Membro key={m.usuario_id} m={m} eu={m.usuario_id === userId} regioes={regioes} />
            ))}
          </ul>
        </details>
      )}

      <Cartao>
        <h2 className="mb-3 text-lg font-semibold text-beringela">O que cada papel pode fazer</h2>
        <dl className="flex flex-col gap-3">
          {PAPEIS.map((p) => (
            <div key={p}>
              <dt className="text-base font-semibold text-beringela">{NOME_PAPEL[p]}</dt>
              <dd className="text-sm text-texto-suave">{O_QUE_FAZ[p]}</dd>
            </div>
          ))}
        </dl>
      </Cartao>
    </>
  );
}
