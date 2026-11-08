import Link from "next/link";
import { Scale } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/auth";
import { ipDoNavegador } from "@/lib/admin/equipe";
import { quando } from "@/lib/admin/formato";
import { buscarCompliance, dadosDaConta, lerConsulta, registrarEntrada } from "@/lib/dados/compliance";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_COMPLIANCE } from "@/lib/rotas";
import type { ResultadoCompliance } from "@/lib/tipos-equipe";
import { Aviso, Cartao, Titulo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { DadosConta } from "./dados-conta";
import { FormAbrirConsulta, FormBusca, FormRelatorio } from "./formularios";

export const metadata = { title: "Compliance jurídico" };
export const dynamic = "force-dynamic";

// Tela 8 · Compliance jurídico (só administrador). Para atender ordem judicial ou pedido da polícia
// (Marco Civil da Internet, art. 15: registros de acesso guardados por 6 meses).
// Cada entrada na tela, busca, conta aberta e relatório fica gravado no banco com motivo, IP e data.
// O motivo nunca vai no endereço: só o id da consulta (?c=), que vale por alguns minutos e só para quem abriu.

type Params = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const USUARIO = /^user_[A-Za-z0-9]+$/;

const NOME_TIPO: Record<ResultadoCompliance["tipo"], string> = {
  conta: "Conta",
  anuncio: "Anúncio",
  anuncio_apagado: "Anúncio apagado",
};

export default async function CompliancePage({ searchParams }: { searchParams: Params }) {
  const { supabase, userId } = await exigirAdmin();
  const sp = await searchParams;
  const ip = await ipDoNavegador();
  const idConsulta = ehUuid(um(sp.c)) ? um(sp.c) : null;
  const termo = um(sp.q).trim().slice(0, 120);
  const conta = USUARIO.test(um(sp.conta)) ? um(sp.conta) : null;

  // Toda abertura da tela fica gravada, antes de qualquer dado.
  const gravou = await registrarEntrada(supabase, ip);
  if (!gravou) {
    return (
      <>
        <Titulo>Compliance jurídico</Titulo>
        <Aviso tipo="erro">Não deu para gravar o acesso agora, então nenhum dado é mostrado. Atualize a página.</Aviso>
      </>
    );
  }

  const consulta = idConsulta ? await lerConsulta(supabase, idConsulta, userId) : null;

  if (!consulta) {
    return (
      <>
        <Titulo sub="Para atender ordem judicial ou pedido da polícia. Tudo o que você vê aqui fica gravado com o motivo, a data e o seu IP.">
          Compliance jurídico
        </Titulo>
        {idConsulta && (
          <div className="mb-4">
            <Aviso tipo="erro">Esta consulta acabou. Escreva o motivo de novo para continuar.</Aviso>
          </div>
        )}
        <Cartao>
          <h2 className="mb-3 text-lg font-semibold text-beringela">Por que você vai consultar?</h2>
          <FormAbrirConsulta />
        </Cartao>
      </>
    );
  }

  const [resultados, dados] = await Promise.all([
    termo.length >= 3 ? buscarCompliance(supabase, consulta.id, termo, ip) : Promise.resolve(null),
    conta ? dadosDaConta(supabase, consulta.id, conta, ip) : Promise.resolve(null),
  ]);
  const linkConta = (usuario: string) =>
    `${LINK_ADMIN_COMPLIANCE}?c=${consulta.id}${termo ? `&q=${encodeURIComponent(termo)}` : ""}&conta=${encodeURIComponent(usuario)}`;

  return (
    <>
      <Titulo sub="Tudo o que você vê aqui fica gravado com o motivo, a data e o seu IP.">Compliance jurídico</Titulo>

      <Cartao className="mb-6">
        <p className="text-sm text-texto-suave">Consulta aberta · vale até {quando(consulta.vence_em)}</p>
        <p className="mt-1 break-words text-base font-semibold text-beringela">Motivo: {consulta.motivo}</p>
        <Link href={LINK_ADMIN_COMPLIANCE} prefetch={false} className="mt-2 inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4">
          Começar outra consulta (outro motivo)
        </Link>
      </Cartao>

      <Cartao className="mb-6">
        <FormBusca consulta={consulta.id} termo={termo} />
        {termo.length > 0 && termo.length < 3 && <p className="mt-3 text-sm text-perigo">Digite pelo menos 3 letras ou números.</p>}
      </Cartao>

      {resultados && !resultados.ok && (
        <div className="mb-6">
          <Aviso tipo="erro">{resultados.erro}</Aviso>
        </div>
      )}
      {resultados?.ok && resultados.dados.length === 0 && (
        <Vazio
          className="mb-6"
          icone={<Scale />}
          titulo="Nada encontrado"
          texto="Tente o celular com DDD, o nome completo, o CNPJ ou o código do anúncio (aparece no endereço da página do anúncio)."
        />
      )}
      {resultados?.ok && resultados.dados.length > 0 && (
        <section aria-labelledby="resultados" className="mb-6">
          <h2 id="resultados" className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
            Encontrados ({resultados.dados.length})
          </h2>
          <ul className="flex flex-col gap-3">
            {resultados.dados.map((r) => (
              <li key={`${r.tipo}-${r.id}`} className="rounded-card border border-borda bg-cartao p-4 shadow-1">
                <p className="text-[13px] font-bold uppercase tracking-wide text-texto-suave">{NOME_TIPO[r.tipo]}</p>
                <p className="break-words text-base font-semibold text-beringela">{r.titulo ?? "Sem nome"}</p>
                {r.detalhe && <p className="text-sm text-texto-suave">{r.detalhe}</p>}
                <p className="font-mono text-[13px] text-texto-suave">{r.id}</p>
                {r.usuario_id ? (
                  <Link
                    href={linkConta(r.usuario_id)}
                    prefetch={false}
                    className="mt-2 inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4"
                  >
                    {r.tipo === "conta" ? "Ver dados da conta" : "Ver dados de quem anunciou"}
                  </Link>
                ) : (
                  <p className="mt-2 text-sm text-texto-suave">A loja deste anúncio já foi apagada. Busque pelo código de quem apagou.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {dados && !dados.ok && (
        <div className="mb-6">
          <Aviso tipo="erro">{dados.erro}</Aviso>
        </div>
      )}
      {dados?.ok && conta && (
        <Cartao className="mb-6">
          <h2 className="text-xl font-semibold text-beringela">Dados da conta</h2>
          <p className="font-mono text-[13px] text-texto-suave">{conta}</p>
          <DadosConta d={dados.dados} />
          <div className="mt-8 border-t border-borda pt-4">
            <h3 className="mb-3 text-lg font-semibold text-beringela">Relatório para imprimir</h3>
            <FormRelatorio consulta={consulta.id} usuario={conta} motivoConsulta={consulta.motivo} />
          </div>
        </Cartao>
      )}

      {!termo && !conta && (
        <Vazio
          icone={<Scale />}
          titulo="Busque a pessoa ou o anúncio"
          texto="Use o celular com DDD, o nome, o CNPJ da loja, o título ou o código do anúncio."
        >
          <Botao href={LINK_ADMIN_COMPLIANCE} variante="texto" prefetch={false}>
            Trocar o motivo
          </Botao>
        </Vazio>
      )}
    </>
  );
}
