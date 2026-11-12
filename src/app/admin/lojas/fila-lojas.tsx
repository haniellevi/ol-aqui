import { quando } from "@/lib/admin/formato";
import { Aviso, Cartao, estiloBotaoSec } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import {
  API_VERIFICACAO_LOJA,
  textoItemParecerVerificacaoLoja,
  textoMotivoEquipeVerificacaoLoja,
} from "@/lib/verificacao-loja/constantes";
import { FormAvisoVerificacaoLoja, FormDecidirVerificacaoLoja } from "./formularios";

// Fila da equipe na verificação automática de lojas (`#fila-lojas`): pedidos que a IA encaminhou e aprovações da IA
// sorteadas para revisão. Só mostra; quem decide e confere papel e status é o banco.

export type ItemParecer = { item: string; ok: boolean | null; nota?: string };
export type PedidoVerificacaoLoja = {
  id: string;
  vitrine_id: string;
  loja_nome: string;
  cidade: string | null;
  cnpj: string;
  status: "equipe" | "revisao_amostra";
  motivos_equipe: string[] | null;
  parecer: ItemParecer[] | null;
  criado_em: string;
  prazo_em: string | null;
  atrasada: boolean;
  amostra: boolean;
  tem_fachada: boolean;
};
export type AvisoVerificacaoLoja = {
  id: string;
  vitrine_id: string;
  loja_nome: string;
  tipo: string;
  detalhe: Record<string, unknown> | null;
  criado_em: string;
};

const TEXTO_AVISO: Record<string, string> = {
  mudou_nome: "mudou o nome e o selo foi mantido. Confira se continua a mesma loja.",
  mudou_instagram: "mudou o Instagram e o selo foi mantido. Confira o perfil novo.",
  receita_inativa: "o CNPJ não está ativo na Receita. Veja se o selo deve continuar.",
  amostra_erro: "o selo foi tirado na revisão por amostra. Vale ver o que a IA deixou passar.",
};

function cnpjComPontos(cnpj: string): string {
  return /^\d{14}$/.test(cnpj) ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : cnpj;
}

function Parecer({ itens }: { itens: ItemParecer[] }) {
  if (!itens.length) return <p className="text-sm text-texto-suave">A IA não deixou parecer.</p>;
  return (
    <ul className="my-2 space-y-1">
      {itens.map((p, i) => (
        <li key={`${p.item}-${i}`} className={`text-sm ${p.ok === true ? "text-verde-escuro" : p.ok === false ? "text-perigo" : "text-texto-suave"}`}>
          <span aria-hidden>{p.ok === true ? "✓" : p.ok === false ? "✗" : "?"} </span>
          {textoItemParecerVerificacaoLoja(p.item)}
          {p.ok === true ? ": conferido" : p.ok === false ? ": não confere" : ": sem resposta"}
          {p.nota ? ` (${p.nota})` : ""}
        </li>
      ))}
    </ul>
  );
}

export function FilaLojas({ pedidos, erro }: { pedidos: PedidoVerificacaoLoja[]; erro: boolean }) {
  return (
    <section id="fila-lojas" aria-labelledby="fila-lojas-titulo" className="mb-6 space-y-3">
      <h2 id="fila-lojas-titulo" className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Verificação de lojas (CNPJ)</h2>
      {erro ? <Aviso tipo="erro">Não foi possível carregar a fila de verificação de lojas.</Aviso>
        : !pedidos.length ? <p className="text-sm text-texto-suave">Nenhuma loja aguardando conferência.</p>
          : <ul className="grid gap-3">
            {pedidos.map((p) => {
              const amostra = p.status === "revisao_amostra";
              const motivos = (p.motivos_equipe ?? []).map(textoMotivoEquipeVerificacaoLoja);
              return (
                <li key={p.id}>
                  <Cartao>
                    <p className="font-semibold text-beringela">
                      {p.loja_nome}
                      {p.atrasada && <Badge variant="destructive" className="ml-2">Atrasada</Badge>}
                      {amostra && <Badge variant="secondary" className="ml-2">Revisão por amostra</Badge>}
                    </p>
                    <p className="text-sm text-texto-suave">
                      {p.cidade ? `${p.cidade} · ` : ""}CNPJ {cnpjComPontos(p.cnpj)} · Enviado {quando(p.criado_em)}
                      {p.prazo_em ? ` · ${amostra ? "Revisar até" : "Responder até"} ${quando(p.prazo_em)}` : ""}
                    </p>
                    {amostra
                      ? <p className="mt-2 text-sm">A IA aprovou esta loja e o selo já está no ar. Confirme ou tire o selo.</p>
                      : motivos.length > 0 && <p className="mt-2 text-sm">Encaminhada porque: {motivos.join("; ")}.</p>}
                    <Parecer itens={Array.isArray(p.parecer) ? p.parecer : []} />
                    <div className="my-2 flex flex-wrap gap-3">
                      <a href={`${API_VERIFICACAO_LOJA}/${p.id}/comprovante`} download className={estiloBotaoSec}>Baixar comprovante</a>
                      {p.tem_fachada && <a href={`${API_VERIFICACAO_LOJA}/${p.id}/fachada`} download className={estiloBotaoSec}>Ver fachada</a>}
                    </div>
                    <FormDecidirVerificacaoLoja id={p.id} status={p.status} />
                  </Cartao>
                </li>
              );
            })}
          </ul>}
    </section>
  );
}

export function AvisosLojas({ avisos, erro }: { avisos: AvisoVerificacaoLoja[]; erro: boolean }) {
  return (
    <section aria-labelledby="avisos-lojas-titulo" className="mb-6 space-y-3">
      <h2 id="avisos-lojas-titulo" className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Avisos sobre lojas verificadas</h2>
      {erro ? <Aviso tipo="erro">Não foi possível carregar os avisos de verificação.</Aviso>
        : !avisos.length ? <p className="text-sm text-texto-suave">Nenhum aviso aberto.</p>
          : <ul className="grid gap-3">
            {avisos.map((a) => {
              const texto = Object.hasOwn(TEXTO_AVISO, a.tipo) ? TEXTO_AVISO[a.tipo] : "há um aviso novo sobre a verificação.";
              return (
                <li key={a.id}>
                  <Cartao>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        <span className="font-semibold text-beringela">{a.loja_nome}</span>: {texto}
                        <span className="text-texto-suave"> · {quando(a.criado_em)}</span>
                      </p>
                      <FormAvisoVerificacaoLoja id={a.id} />
                    </div>
                  </Cartao>
                </li>
              );
            })}
          </ul>}
    </section>
  );
}
