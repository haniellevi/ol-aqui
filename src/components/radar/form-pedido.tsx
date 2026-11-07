"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ChevronDown, Inbox, MessageCircle, Radar } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import { AvisoErro } from "@/components/anunciar/aviso-erro";
import { aoEnviar } from "@/components/anunciar/enviar";
import { criarPedido, type EstadoPedido } from "@/app/radar/acoes-comprador";
import {
  CATEGORIAS_PEDIDO,
  DETALHES_MAX,
  TITULO_MAX,
  URGENCIAS,
  rotuloPrazo,
  type CategoriaPedido,
  type ModoContato,
  type UrgenciaPedido,
} from "@/lib/radar";

// T27 · Fazer pedido no Radar: uma tela só, de cima para baixo na ordem em que a pessoa pensa
// (o que quer → até quanto → onde → para quando → como quer ser chamada). Escolhas por botões
// grandes; só o "o que você procura" é obrigatório de digitar.

export function FormPedido({
  textoInicial,
  cidades,
  cidadeInicial,
  prazos,
  pedirWhatsapp = false,
  whatsappInicial = "",
}: {
  textoInicial: string;
  cidades: { nome: string; uf: string }[];
  cidadeInicial: string;
  prazos: number[];
  /** Celular ainda não confirmado: pede o WhatsApp aqui (sem código). */
  pedirWhatsapp?: boolean;
  whatsappInicial?: string;
}) {
  const [estado, acao, enviando] = useActionState<EstadoPedido, FormData>(criarPedido, null);
  const [titulo, setTitulo] = useState(textoInicial);
  const [categoria, setCategoria] = useState<CategoriaPedido>("geral");
  const [urgencia, setUrgencia] = useState<UrgenciaPedido>("normal");
  const [cidade, setCidade] = useState(cidadeInicial);
  const [modo, setModo] = useState<ModoContato>("whatsapp_direto");
  const [prazo, setPrazo] = useState<number>(prazos.includes(72) ? 72 : prazos[0]);
  const erro = estado?.campos ?? {};

  return (
    <form onSubmit={aoEnviar(acao)} className="flex flex-col gap-6" noValidate>
      <AvisoErro mensagem={estado?.erro?.mensagem} />

      <Campo
        rotulo="O que você procura?"
        name="titulo"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={TITULO_MAX}
        placeholder="Ex.: Geladeira frost free usada"
        autoComplete="off"
        enterKeyHint="next"
        erro={erro.titulo}
        dica="Escreva como você falaria para o vendedor."
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-semibold">É de que tipo?</legend>
        <input type="hidden" name="categoria" value={categoria} />
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS_PEDIDO.map((c) => (
            <Chip key={c.valor} ativo={categoria === c.valor} onClick={() => setCategoria(c.valor)}>
              {c.rotulo}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Campo
        rotulo="Até quanto quer pagar?"
        name="preco"
        prefixo="R$"
        inputMode="decimal"
        autoComplete="off"
        placeholder="2.000"
        opcional
        erro={erro.preco}
        dica="Deixe em branco se ainda não sabe."
      />

      {cidades.length ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="campo-cidade" className="text-base font-semibold">
            Em que cidade?
          </label>
          <div className="relative">
            <select
              id="campo-cidade"
              name="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              aria-invalid={erro.cidade ? true : undefined}
              aria-describedby={erro.cidade ? "campo-cidade-erro" : undefined}
              className={`h-12 w-full appearance-none rounded-campo border-2 bg-cartao pl-3 pr-10 text-base focus:outline-none focus-visible:border-laranja-escuro focus-visible:ring-2 focus-visible:ring-laranja-escuro/30 ${erro.cidade ? "border-perigo" : "border-borda"}`}
            >
              <option value="">Escolha a cidade</option>
              {cidades.map((c) => (
                <option key={c.nome} value={c.nome}>
                  {c.nome} – {c.uf}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-texto-suave" aria-hidden />
          </div>
          {erro.cidade && (
            <p id="campo-cidade-erro" role="alert" className="text-sm font-semibold text-perigo">
              {erro.cidade}
            </p>
          )}
        </div>
      ) : (
        <Campo rotulo="Em que cidade?" name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={80} erro={erro.cidade} />
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-semibold">Para quando?</legend>
        <input type="hidden" name="urgencia" value={urgencia} />
        <div className="flex flex-wrap gap-2">
          {URGENCIAS.map((u) => (
            <Chip key={u.valor} ativo={urgencia === u.valor} onClick={() => setUrgencia(u.valor)}>
              {u.rotulo}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Campo
        rotulo="Mais detalhes"
        name="detalhes"
        multilinha
        maxLength={DETALHES_MAX}
        opcional
        placeholder="Ex.: branca, até 2 portas, pode ser usada se estiver funcionando."
        erro={erro.detalhes}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-semibold">Como as lojas falam com você?</legend>
        <input type="hidden" name="modo" value={modo} />
        <OpcaoModo
          ativo={modo === "whatsapp_direto"}
          onClick={() => setModo("whatsapp_direto")}
          icone={<MessageCircle />}
          titulo="Podem me chamar no WhatsApp"
          texto="As lojas que têm o que você quer te chamam direto. Mais rápido."
        />
        <OpcaoModo
          ativo={modo === "propostas_prazo"}
          onClick={() => setModo("propostas_prazo")}
          icone={<Inbox />}
          titulo="Quero receber propostas aqui"
          texto="Seu número fica guardado. Você vê as ofertas e escolhe com quem falar."
        />
        {erro.modo && (
          <p role="alert" className="text-sm font-semibold text-perigo">
            {erro.modo}
          </p>
        )}
        {modo === "propostas_prazo" && (
          <div className="flex flex-col gap-2 rounded-card bg-fundo p-3">
            <p id="rotulo-prazo" className="text-base font-semibold">
              Receber propostas por quanto tempo?
            </p>
            <input type="hidden" name="prazo" value={prazo} />
            <div role="group" aria-labelledby="rotulo-prazo" className="flex flex-wrap gap-2">
              {prazos.map((h) => (
                <Chip key={h} ativo={prazo === h} onClick={() => setPrazo(h)}>
                  {rotuloPrazo(h)}
                </Chip>
              ))}
            </div>
            {erro.prazo && (
              <p role="alert" className="text-sm font-semibold text-perigo">
                {erro.prazo}
              </p>
            )}
          </div>
        )}
      </fieldset>

      {pedirWhatsapp && (
        <Campo
          rotulo="Seu WhatsApp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          defaultValue={whatsappInicial}
          placeholder="(89) 99999-0000"
          maxLength={20}
          erro={erro.whatsapp}
          dica="Com DDD. É por ele que as lojas falam com você."
        />
      )}

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-borda bg-cartao/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <Botao type="submit" larguraTotal icone={<Radar />} carregando={enviando} textoCarregando="Enviando o pedido...">
          Pedir no Radar
        </Botao>
      </div>
    </form>
  );
}

function OpcaoModo({
  ativo,
  onClick,
  icone,
  titulo,
  texto,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`flex min-h-12 w-full items-start gap-3 rounded-card border-2 p-4 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro ${
        ativo ? "border-beringela bg-laranja-claro" : "border-borda bg-cartao hover:bg-fundo"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${ativo ? "border-beringela" : "border-borda"}`}
      >
        {ativo && <span className="size-3 rounded-full bg-beringela" />}
      </span>
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-base font-semibold text-beringela [&>svg]:size-5">
          {icone}
          {titulo}
        </span>
        <span className="text-[15px] text-texto-suave">{texto}</span>
      </span>
    </button>
  );
}
