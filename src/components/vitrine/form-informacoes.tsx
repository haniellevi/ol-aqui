"use client";

import { useActionState, useState } from "react";
import { Copy, LocateFixed, MapPin, Plus, Save, Trash2, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import { Aviso } from "@/components/conta/aviso";
import { DIAS_EM_ORDEM, NOME_DIA, limparInstagram } from "@/components/vitrine/regras";
import { salvarInformacoes, type EstadoVitrine } from "@/app/(conta)/minha-conta/loja/vitrine-actions";
import type { DiaSemana, FaixaHorario, Horarios } from "@/lib/tipos-vitrine";

// Informações da loja (todas opcionais): endereço + localização, horários por dia, Instagram,
// "Sobre nós", formas de pagamento (lista do painel) e entrega.

type Dia = { aberto: boolean; faixas: FaixaHorario[] };
type Semana = Record<DiaSemana, Dia>;

const FAIXA_PADRAO: FaixaHorario = { abre: "08:00", fecha: "18:00" };
const DIAS_UTEIS: DiaSemana[] = ["seg", "ter", "qua", "qui", "sex"];

function semanaInicial(h: Horarios | null): Semana {
  const s = {} as Semana;
  for (const d of DIAS_EM_ORDEM) {
    const faixas = (h?.[d] ?? []).filter((f) => f?.abre && f?.fecha).map((f) => ({ abre: f.abre, fecha: f.fecha }));
    s[d] = { aberto: faixas.length > 0, faixas: faixas.length ? faixas : [{ ...FAIXA_PADRAO }] };
  }
  return s;
}

/** Semana da tela → JSON do banco. Nenhum dia aberto = "não informado" (vazio). */
function paraJson(s: Semana): string {
  if (!DIAS_EM_ORDEM.some((d) => s[d].aberto)) return "";
  const h: Horarios = {};
  for (const d of DIAS_EM_ORDEM) h[d] = s[d].aberto ? s[d].faixas : [];
  return JSON.stringify(h);
}

export type DadosInformacoes = {
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  horarios: Horarios | null;
  instagram: string | null;
  sobre: string | null;
  formas_pagamento: string[];
  faz_entrega: boolean | null;
  entrega_obs: string | null;
};

export function FormInformacoes({ dados, formasDoPainel }: { dados: DadosInformacoes; formasDoPainel: string[] }) {
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
  const [estado, acao, salvando] = useActionState<EstadoVitrine, FormData>(async (anterior, form) => {
    setMostrarSucesso(true);
    try {
      return await salvarInformacoes(anterior, form);
    } catch {
      return { erro: "Confira a conexão e tente salvar de novo. Seus dados continuam preenchidos." };
    }
  }, null);
  const campos = estado?.campos ?? {};

  // Todos os campos são controlados: o React limpa campo solto depois de cada envio, mesmo com erro.
  const [endereco, setEndereco] = useState(dados.endereco ?? "");
  const [lat, setLat] = useState<number | null>(dados.lat);
  const [lng, setLng] = useState<number | null>(dados.lng);
  const [localizando, setLocalizando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const [semana, setSemana] = useState<Semana>(() => semanaInicial(dados.horarios));
  const [instagram, setInstagram] = useState(dados.instagram ?? "");
  const [sobre, setSobre] = useState(dados.sobre ?? "");
  const opcoesPagamento = [...formasDoPainel, ...dados.formas_pagamento.filter((f) => !formasDoPainel.includes(f))];
  const [formas, setFormas] = useState<string[]>(dados.formas_pagamento);
  const [entrega, setEntrega] = useState<"sim" | "nao" | "">(dados.faz_entrega === true ? "sim" : dados.faz_entrega === false ? "nao" : "");
  const [obs, setObs] = useState(dados.entrega_obs ?? "");

  function marcarLocal() {
    setErroLocal(null);
    if (!("geolocation" in navigator)) {
      setErroLocal("Este celular não deixa pegar a localização. Escreva o endereço acima.");
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(Math.round(p.coords.latitude * 1e6) / 1e6);
        setLng(Math.round(p.coords.longitude * 1e6) / 1e6);
        setLocalizando(false);
      },
      () => {
        setErroLocal("Não deu para pegar a localização. Confira se o GPS está ligado e se você deixou o site usar.");
        setLocalizando(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function mudarDia(d: DiaSemana, f: (dia: Dia) => Dia) {
    setSemana((s) => ({ ...s, [d]: f(s[d]) }));
  }

  function copiarParaDiasUteis() {
    setSemana((s) => {
      const base = s.seg;
      const nova = { ...s };
      for (const d of DIAS_UTEIS) nova[d] = { aberto: base.aberto, faixas: base.faixas.map((f) => ({ ...f })) };
      return nova;
    });
  }

  return (
    <form
      action={acao}
      onReset={(e) => e.preventDefault()}
      onChangeCapture={() => setMostrarSucesso(false)}
      onClickCapture={(e) => { if ((e.target as HTMLElement).closest('button[type="button"]')) setMostrarSucesso(false); }}
      className="flex flex-col gap-5" noValidate
    >
      <div aria-live="polite">
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {mostrarSucesso && !salvando && estado?.ok && <Aviso tipo="ok">Informações da loja salvas.</Aviso>}
      </div>

      <fieldset disabled={salvando} className="flex min-w-0 flex-col gap-5">
      {/* Endereço */}
      <section aria-labelledby="titulo-endereco" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="titulo-endereco" className="text-lg font-bold">
          Onde fica
        </h2>
        <Campo
          rotulo="Endereço da loja"
          name="endereco"
          opcional
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          maxLength={160}
          placeholder="Rua, número e bairro"
          autoComplete="street-address"
          erro={campos.endereco}
        />
        <input type="hidden" name="lat" value={lat ?? ""} />
        <input type="hidden" name="lng" value={lng ?? ""} />
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold">
            Localização no mapa <span className="font-normal text-texto-suave">(opcional)</span>
          </p>
          <p className="text-sm text-texto-suave">Estando na loja, toque no botão. O botão &quot;Como chegar&quot; da vitrine leva o cliente até aqui.</p>
          {lat != null && lng != null ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-base font-semibold text-verde-escuro">
                <MapPin className="size-5" aria-hidden /> Localização marcada
              </span>
              <Botao variante="texto" icone={<X />} onClick={() => { setLat(null); setLng(null); }} disabled={salvando}>
                Tirar
              </Botao>
            </div>
          ) : null}
          <Botao
            variante="secundario"
            icone={<LocateFixed />}
            carregando={localizando}
            textoCarregando="Pegando a localização..."
            onClick={marcarLocal}
            disabled={salvando}
            className="sm:w-fit"
          >
            {lat != null ? "Marcar de novo" : "Usar minha localização"}
          </Botao>
          {(erroLocal ?? campos.localizacao) && (
            <p role="alert" className="text-sm font-semibold text-perigo">
              {erroLocal ?? campos.localizacao}
            </p>
          )}
        </div>
      </section>

      {/* Horários */}
      <section aria-labelledby="titulo-horarios" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="titulo-horarios" className="text-lg font-bold">
          Horário de funcionamento
        </h2>
        <p className="text-sm text-texto-suave">A vitrine mostra &quot;Aberto agora&quot; ou &quot;Fechado agora&quot; pelo horário daqui. Deixe todos fechados para não mostrar horário.</p>
        <input type="hidden" name="horarios" value={paraJson(semana)} />
        <ul className="flex flex-col divide-y divide-borda">
          {DIAS_EM_ORDEM.map((d) => {
            const dia = semana[d];
            return (
              <li key={d} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-semibold">{NOME_DIA[d]}</span>
                  <div className="flex gap-2">
                    <Chip aria-label={`Aberto: ${NOME_DIA[d]}`} ativo={dia.aberto} onClick={() => mudarDia(d, (x) => ({ ...x, aberto: true }))}>
                      Aberto
                    </Chip>
                    <Chip aria-label={`Fechado: ${NOME_DIA[d]}`} ativo={!dia.aberto} onClick={() => mudarDia(d, (x) => ({ ...x, aberto: false }))}>
                      Fechado
                    </Chip>
                  </div>
                </div>
                {dia.aberto && (
                  <div className="flex flex-col gap-2">
                    {dia.faixas.map((f, i) => (
                      <div key={i} className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-1 text-sm font-semibold">
                          Abre
                          <input
                            type="time"
                            aria-label={`Abre: ${NOME_DIA[d]}, horário ${i + 1}`}
                            value={f.abre}
                            required
                            onChange={(e) => mudarDia(d, (x) => ({ ...x, faixas: x.faixas.map((y, j) => (j === i ? { ...y, abre: e.target.value } : y)) }))}
                            className="h-12 rounded-campo border-2 border-borda bg-cartao px-3 text-base focus:outline-none focus-visible:border-laranja-escuro"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-semibold">
                          Fecha
                          <input
                            type="time"
                            aria-label={`Fecha: ${NOME_DIA[d]}, horário ${i + 1}`}
                            value={f.fecha === "24:00" ? "00:00" : f.fecha}
                            disabled={f.fecha === "24:00"}
                            required
                            onChange={(e) => mudarDia(d, (x) => ({ ...x, faixas: x.faixas.map((y, j) => (j === i ? { ...y, fecha: e.target.value } : y)) }))}
                            className="h-12 rounded-campo border-2 border-borda bg-cartao px-3 text-base focus:outline-none focus-visible:border-laranja-escuro"
                          />
                        </label>
                        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
                          <input type="checkbox" className="size-5 accent-laranja-escuro"
                            aria-label={`Fecha à meia-noite: ${NOME_DIA[d]}, horário ${i + 1}`}
                            checked={f.fecha === "24:00"}
                            onChange={(e) => mudarDia(d, (x) => ({ ...x, faixas: x.faixas.map((y, j) => j === i ? { ...y, fecha: e.target.checked ? "24:00" : "23:59" } : y) }))} />
                          Fecha à meia-noite
                        </label>
                        {dia.faixas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => mudarDia(d, (x) => ({ ...x, faixas: x.faixas.filter((_, j) => j !== i) }))}
                            className="inline-flex size-12 items-center justify-center rounded-campo text-perigo hover:bg-perigo-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                            aria-label={`Tirar o horário ${i + 1} de ${NOME_DIA[d]}`}
                          >
                            <Trash2 className="size-5" aria-hidden />
                          </button>
                        )}
                      </div>
                    ))}
                    {dia.faixas.length < 3 && dia.faixas.at(-1)?.fecha !== "24:00" && (
                      <Botao
                        variante="texto"
                        icone={<Plus />}
                        className="h-auto min-h-12 w-fit whitespace-normal px-0 text-left"
                        onClick={() => {
                          const ultimo = dia.faixas[dia.faixas.length - 1];
                          mudarDia(d, (x) => ({ ...x, faixas: [...x.faixas, { abre: ultimo?.fecha ?? "14:00", fecha: "23:59" }] }));
                        }}
                      >
                        Outro horário no mesmo dia (ex.: depois do almoço)
                      </Botao>
                    )}
                  </div>
                )}
                {d === "seg" && (
                  <Botao variante="texto" icone={<Copy />} className="h-auto min-h-12 w-fit whitespace-normal px-0 text-left" onClick={copiarParaDiasUteis}>
                    Copiar segunda para os dias úteis
                  </Botao>
                )}
              </li>
            );
          })}
        </ul>
        {campos.horarios && (
          <p role="alert" className="text-sm font-semibold text-perigo">
            {campos.horarios}
          </p>
        )}
      </section>

      {/* Instagram e Sobre */}
      <section aria-labelledby="titulo-sobre" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="titulo-sobre" className="text-lg font-bold">
          Sobre a loja
        </h2>
        <Campo
          rotulo="Instagram da loja"
          name="instagram"
          opcional
          prefixo="@"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={instagram}
          onChange={(e) => setInstagram(limparInstagram(e.target.value))}
          maxLength={30}
          placeholder="minhaloja"
          dica="Só o nome, sem o @."
          erro={campos.instagram}
        />
        <Campo
          rotulo="Sobre nós"
          name="sobre"
          multilinha
          opcional
          maxLength={1500}
          value={sobre}
          onChange={(e) => setSobre(e.target.value)}
          dica={`${sobre.length} de 1500 letras. Conte desde quando a loja existe, o que vende e o que tem de bom.`}
          erro={campos.sobre}
        />
      </section>

      {/* Pagamento e entrega */}
      <section aria-labelledby="titulo-pagamento" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="titulo-pagamento" className="text-lg font-bold">
          Pagamento e entrega
        </h2>
        {opcoesPagamento.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-semibold">
              Formas de pagamento <span className="font-normal text-texto-suave">(toque para marcar)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {opcoesPagamento.map((f) => {
                const marcado = formas.includes(f);
                return (
                  <Chip key={f} ativo={marcado} onClick={() => setFormas((l) => (marcado ? l.filter((x) => x !== f) : [...l, f]))}>
                    {f}
                  </Chip>
                );
              })}
            </div>
            {formas.map((f) => (
              <input key={f} type="hidden" name="formas_pagamento" value={f} />
            ))}
            {campos.formas_pagamento && (
              <p role="alert" className="text-sm font-semibold text-perigo">
                {campos.formas_pagamento}
              </p>
            )}
          </fieldset>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-semibold">Faz entrega?</legend>
          <input type="hidden" name="faz_entrega" value={entrega} />
          <div className="flex flex-wrap gap-2">
            <Chip ativo={entrega === "sim"} onClick={() => setEntrega("sim")}>
              Sim, faço entrega
            </Chip>
            <Chip ativo={entrega === "nao"} onClick={() => setEntrega("nao")}>
              Não faço
            </Chip>
            <Chip ativo={entrega === ""} onClick={() => setEntrega("")}>
              Não mostrar
            </Chip>
          </div>
        </fieldset>
        {entrega === "sim" && (
          <Campo
            rotulo="Recado sobre a entrega"
            name="entrega_obs"
            opcional
            maxLength={200}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: grátis no centro de Corrente"
            erro={campos.entrega_obs}
          />
        )}
        {entrega !== "sim" && <input type="hidden" name="entrega_obs" value={entrega === "nao" ? "" : obs} />}
      </section>

      </fieldset>
      {estado?.erro && <p role="alert" className="text-sm font-semibold text-perigo">{estado.erro}</p>}
      <Botao type="submit" larguraTotal icone={<Save />} carregando={salvando} textoCarregando="Salvando..." disabled={localizando}>
        Salvar informações
      </Botao>
    </form>
  );
}
