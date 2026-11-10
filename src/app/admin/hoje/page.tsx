import { CalendarCheck } from "lucide-react";
import { exigirTela } from "@/lib/admin/equipe";
import { hojeLocal, NOME_TIPO, tarefasDeHoje } from "@/lib/admin/hoje";
import { Aviso, Titulo } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { BotaoDesfazer, BotaoFeito } from "./botoes";

export const metadata = { title: "Hoje" };
export const dynamic = "force-dynamic";

const dataLonga = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Fortaleza" });

export default async function HojePage() {
  const { supabase } = await exigirTela("hoje");
  const agora = new Date();
  const { tarefas, total, feitas, erro, max } = await tarefasDeHoje(supabase, agora);
  const dia = hojeLocal(agora);

  return (
    <>
      <Titulo sub={<span className="first-letter:uppercase">{dataLonga.format(agora)}</span>}>Hoje</Titulo>
      {erro && <div className="mb-3"><Aviso tipo="erro">Parte das tarefas não carregou. Atualize a página.</Aviso></div>}

      {tarefas.length === 0 ? (
        <Vazio
          icone={<CalendarCheck />}
          titulo={feitas > 0 ? "Tudo feito por hoje" : "Nada pendente agora"}
          texto="Que tal visitar uma loja nova e anotar no funil?"
        >
          <Botao href="/admin/funil/novo" variante="secundario" tamanho="pequeno">Anotar loja no funil</Botao>
        </Vazio>
      ) : (
        <ol className="divide-y divide-borda overflow-hidden rounded-card border border-borda bg-cartao">
          {tarefas.map((t) => (
            <li key={`${t.tipo}:${t.alvo}`} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={t.urgente ? "destructive" : "secondary"}>{NOME_TIPO[t.tipo]}</Badge>
                </div>
                <p className="mt-1 text-lg font-medium text-beringela [overflow-wrap:anywhere]">{t.titulo}</p>
                <p className="text-sm text-texto-suave">{t.detalhe}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Botao
                  href={t.acao.href}
                  variante={t.acao.externo ? "whatsapp" : "secundario"}
                  tamanho="pequeno"
                  {...(t.acao.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {t.acao.rotulo}
                </Botao>
                {t.apoio && (
                  <Botao href={t.apoio.href} variante="texto" tamanho="pequeno"
                    {...(t.apoio.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {t.apoio.rotulo}
                  </Botao>
                )}
                <BotaoFeito tipo={t.tipo} alvo={t.alvo} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-legenda text-texto-suave">
        {total > tarefas.length && <>Mostrando {tarefas.length} de {total} tarefas (limite de {max} em Configurações, grupo hoje). </>}
        {feitas > 0 && <>{feitas} {feitas === 1 ? "tarefa marcada" : "tarefas marcadas"} como feita hoje. <BotaoDesfazer dia={dia} /></>}
      </p>
    </>
  );
}
