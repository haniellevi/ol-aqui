import { telefone as formatarTelefone } from "@/lib/formato";
import type { ReactNode } from "react";
import { Clock, CreditCard, Instagram, MapPin, Navigation, Store, Truck } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";
import { DIAS_EM_ORDEM, NOME_DIA, agoraNaRegiao, faixasDoDia, linkComoChegar, linkInstagram, linkSiteLoja, situacaoAgora, temHorarios, textoDoDia } from "@/components/vitrine/regras";
import { MapaLoja, coordenadasValidas } from "@/components/vitrine/mapa-loja";
import type { VitrinePublica } from "@/lib/tipos-vitrine";

// Bloco "Informações da loja" da vitrine pública: só aparece o que a loja preencheu.
export function InformacoesLoja({ v, agora, mapa = false }: { v: VitrinePublica; agora: Date; /** Vitrine nova: mapa com o pino. */ mapa?: boolean }) {
  const pino = mapa ? coordenadasValidas(v.lat, v.lng) : null;
  const comoChegar = linkComoChegar({ lat: v.lat, lng: v.lng, endereco: v.endereco, cidade: v.cidade });
  const insta = linkInstagram(v.instagram);
  const situacao = situacaoAgora(v.horarios, agora);
  const hoje = agoraNaRegiao(agora).dia;
  const site = linkSiteLoja(v.site_url);
  const telefone = /^55[1-9][0-9]9?[0-9]{8}$/.test(v.telefone_publico ?? "") ? v.telefone_publico : null;
  const temAlgo = site || telefone || v.endereco || comoChegar || temHorarios(v.horarios) || insta || v.sobre || v.formas_pagamento.length || v.faz_entrega !== null;
  if (!temAlgo) return null;

  return (
    <section aria-labelledby="titulo-info-loja" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
      <h2 id="titulo-info-loja" className="text-lg font-semibold">
        Informações da loja
      </h2>

      {(site || telefone) && (
        <div className="flex flex-wrap gap-4">
          {site && <a href={site} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center font-semibold text-laranja-escuro underline">Visitar site da loja</a>}
          {telefone && <a href={`tel:+${telefone}`} className="inline-flex min-h-10 items-center font-semibold text-laranja-escuro underline">Ligar para {formatarTelefone(telefone)}</a>}
        </div>
      )}
      {(v.endereco || comoChegar) && (
        <Bloco icone={<MapPin />} titulo="Endereço">
          <p className="text-base break-words">{[v.endereco, v.bairro && !v.endereco ? v.bairro : null, v.cidade].filter(Boolean).join(" · ")}</p>
          {pino && <MapaLoja lat={pino.lat} lng={pino.lng} nome={v.nome} />}
          {comoChegar && (
            <a href={comoChegar} data-medir="mapa" target="_blank" rel="noopener noreferrer" aria-label="Como chegar à loja (abre em nova aba)" className={classesBotao("secundario", false, "mt-1 w-full sm:w-fit")}>
              <Navigation className="size-5" aria-hidden />
              Como chegar
            </a>
          )}
        </Bloco>
      )}

      {temHorarios(v.horarios) && (
        <Bloco icone={<Clock />} titulo="Horário de funcionamento">
          {situacao && (
            <p className={`text-base font-semibold ${situacao.aberto ? "text-verde-escuro" : "text-perigo"}`} suppressHydrationWarning>
              {situacao.texto}
            </p>
          )}
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Horário de cada dia da semana</caption>
            <tbody>
              {DIAS_EM_ORDEM.map((d) => (
                <tr key={d} className={d === hoje ? "font-semibold" : ""}>
                  <th scope="row" className="py-1 pr-3 text-left font-[inherit]">
                    {NOME_DIA[d]}
                    {d === hoje && <span className="sr-only"> (hoje)</span>}
                  </th>
                  <td className="py-1 text-right text-pretty">{textoDoDia(faixasDoDia(v.horarios, d))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-legenda text-texto-suave">Horário de Brasília (sem horário de verão), como na região.</p>
        </Bloco>
      )}

      {insta && (
        <Bloco icone={<Instagram />} titulo="Instagram">
          <a href={insta} target="_blank" rel="noopener noreferrer" aria-label={`Instagram da loja: @${v.instagram} (abre em nova aba)`} className="inline-flex min-h-10 max-w-full items-center font-semibold break-all text-laranja-escuro underline underline-offset-4">
            @{v.instagram}
          </a>
        </Bloco>
      )}

      {v.formas_pagamento.length > 0 && (
        <Bloco icone={<CreditCard />} titulo="Formas de pagamento">
          <ul className="flex flex-wrap gap-2">
            {v.formas_pagamento.map((f) => (
              <li key={f} className="rounded-full border border-borda bg-fundo px-3 py-1 text-base">
                {f}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {v.faz_entrega !== null && (
        <Bloco icone={<Truck />} titulo="Entrega">
          <p className="text-base">{v.faz_entrega ? "Faz entrega" : "Não faz entrega"}</p>
          {v.faz_entrega && v.entrega_obs && <p className="text-base text-texto-suave">{v.entrega_obs}</p>}
        </Bloco>
      )}

      {v.sobre && (
        <Bloco icone={<Store />} titulo="Sobre nós">
          <p className="text-base leading-6 break-words whitespace-pre-line">{v.sobre}</p>
        </Bloco>
      )}
    </section>
  );
}

function Bloco({ icone, titulo, children }: { icone: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-borda pt-4 first-of-type:border-0 first-of-type:pt-0">
      <span className="mt-0.5 shrink-0 text-laranja-escuro [&>svg]:size-5" aria-hidden>
        {icone}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-base font-semibold">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}
