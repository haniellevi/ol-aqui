import { MessageSquareText, RefreshCw } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/auth";
import { quando } from "@/lib/admin/formato";
import { Cartao, Titulo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { LINK_ADMIN_MENSAGENS } from "@/lib/rotas";
import { CANAIS_ATIVOS, NOME_CANAL, type ModeloMensagem } from "@/lib/tipos-relatorios";
import { FormModelo } from "./form-modelo";

export const metadata = { title: "Mensagens automáticas" };

// Tela 13 · Mensagens automáticas: textos do aviso no site (já mandado), do WhatsApp e do e-mail
// (guardados: envio em breve, ainda sem provedor). Cada uma liga e desliga. Mudanças no histórico.

const COLUNAS = "id, chave, canal, nome, quando, variaveis, titulo, texto, titulo_padrao, texto_padrao, ativo, ordem, atualizado_em, atualizado_por";

function Situacao({ modelo }: { modelo: ModeloMensagem }) {
  const enviaHoje = CANAIS_ATIVOS.includes(modelo.canal);
  if (!enviaHoje) {
    return (
      <span className="rounded-full bg-fundo px-2 text-[13px] font-semibold text-texto-suave">
        Envio em breve{modelo.ativo ? "" : " · desligada"}
      </span>
    );
  }
  return modelo.ativo ? (
    <span className="rounded-full bg-sucesso-fundo px-2 text-[13px] font-semibold text-verde-escuro">Ligada</span>
  ) : (
    <span className="rounded-full bg-aviso-fundo px-2 text-[13px] font-semibold text-aviso">Desligada</span>
  );
}

export default async function MensagensPage() {
  const { supabase } = await exigirAdmin();
  const { data, error } = await supabase.from("modelos_mensagem").select(COLUNAS).order("ordem").order("canal");
  const modelos = (data ?? []) as ModeloMensagem[];

  // Agrupa por mensagem, na ordem do banco
  const grupos: { chave: string; nome: string; quando: string; itens: ModeloMensagem[] }[] = [];
  for (const m of modelos) {
    const g = grupos.find((x) => x.chave === m.chave);
    if (g) g.itens.push(m);
    else grupos.push({ chave: m.chave, nome: m.nome, quando: m.quando, itens: [m] });
  }

  return (
    <>
      <Titulo sub="Textos que o OLAKI manda sozinho. Hoje só o aviso dentro do site é mandado; WhatsApp e e-mail ficam prontos para quando o envio começar. Toda mudança fica no histórico.">
        Mensagens automáticas
      </Titulo>

      {error ? (
        <Vazio titulo="Não deu para abrir as mensagens" texto="Pode ser a internet. Tente de novo." icone={<RefreshCw />}>
          <Botao href={LINK_ADMIN_MENSAGENS} variante="secundario">
            Tentar de novo
          </Botao>
        </Vazio>
      ) : grupos.length === 0 ? (
        <Vazio titulo="Nenhuma mensagem cadastrada" texto="As mensagens entram junto com a atualização do banco. Fale com o desenvolvedor." icone={<MessageSquareText />}>
          <Botao href="/admin" variante="secundario">
            Voltar ao resumo
          </Botao>
        </Vazio>
      ) : (
        <div className="space-y-6">
          <Cartao className="bg-selecao">
            <p className="text-base text-beringela">
              Use as palavras entre chaves, como <strong>{"{nome}"}</strong>, para o sistema trocar pelo valor certo. Palavra que não está na
              lista da mensagem não é aceita.
            </p>
          </Cartao>

          {grupos.map((g) => (
            <section key={g.chave} className="space-y-2">
              <h2 className="text-lg font-semibold text-beringela">{g.nome}</h2>
              <p className="text-sm text-texto-suave">{g.quando}</p>
              <Cartao className="p-0">
                {g.itens.map((m) => (
                  <details key={m.id} className="border-b border-borda px-4 last:border-0">
                    <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold text-beringela focus-visible:outline-2 focus-visible:outline-laranja-escuro">
                      <span className="ml-1 inline-flex flex-wrap items-center gap-2">{NOME_CANAL[m.canal]}
                      <Situacao modelo={m} /></span>
                    </summary>
                    <div className="pb-4">
                      <FormModelo modelo={m} />
                      <p className="mt-3 text-[13px] text-texto-suave">Última mudança: {quando(m.atualizado_em)}</p>
                    </div>
                  </details>
                ))}
              </Cartao>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
