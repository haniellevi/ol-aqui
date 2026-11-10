"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Hourglass, Megaphone, MessageCircle } from "lucide-react";
import { Campo } from "@/components/ui/campo";
import { Seletor } from "@/components/conta/seletor";
import { Chip } from "@/components/ui/chip";
import { Botao } from "@/components/ui/botao";
import { criarPedido } from "@/app/radar/actions";
import { linkMeuPedidoRadar } from "@/lib/rotas";
import { whatsappDigitado } from "@/lib/formato";
import type { ModoContato, RegrasRadar } from "@/lib/tipos-radar";
import { validarPedido } from "./validacao";
import { dataHoraCurta, rotuloPrazo } from "./util";

type Props = {
  textoInicial: string;
  categoriaInicial?: string | null;
  precoMinInicial?: string;
  precoMaxInicial?: string;
  categorias: { id: string; nome: string; filhas: { id: string; nome: string }[] }[];
  cidades: string[];
  cidadeInicial: string | null;
  regras: RegrasRadar;
  /** Celular ainda não confirmado e o painel não exige o código: pede o WhatsApp aqui. */
  pedirWhatsapp?: boolean;
  whatsappInicial?: string;
};

const ROTULO_GRUPO = "text-base font-semibold text-texto";

export function FormPedido({ textoInicial, categoriaInicial = null, precoMinInicial = "", precoMaxInicial = "", categorias, cidades, cidadeInicial, regras, pedirWhatsapp = false, whatsappInicial = "" }: Props) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const trava = useRef(false);
  const chaveEnvio = useRef<string | null>(null);
  const [titulo, setTitulo] = useState(textoInicial);
  const [detalhes, setDetalhes] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(categoriaInicial);
  const [precoMin, setPrecoMin] = useState(precoMinInicial);
  const [precoMax, setPrecoMax] = useState(precoMaxInicial);
  const [cidade, setCidade] = useState<string | null>(cidadeInicial);
  const [whatsapp, setWhatsapp] = useState(whatsappInicial);
  const [modo, setModo] = useState<ModoContato>("whatsapp_direto");
  const [prazo, setPrazo] = useState<number | null>(regras.prazosHoras[1] ?? regras.prazosHoras[0] ?? null);
  const [erro, setErro] = useState<{ texto: string; campo?: string; celular?: boolean } | null>(null);
  const [enviando, iniciar] = useTransition();
  // A data final depende da hora do aparelho: calculada só no navegador (evita diferença com o servidor).
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => setAgora(Date.now()), []);

  const temPrazos = regras.prazosHoras.length > 0;
  const fimPrazo = agora && prazo ? dataHoraCurta(new Date(agora + prazo * 3600_000)) : null;

  useEffect(() => {
    if (!erro) return;
    const campos: Record<string, string> = { preco_min_centavos: "preco_min", preco_max_centavos: "preco_max" };
    const nome = campos[erro.campo ?? ""] ?? erro.campo;
    const alvo = nome ? formulario.current?.elements.namedItem(nome) : null;
    if (alvo instanceof HTMLElement) alvo.focus();
    else formulario.current?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }, [erro]);

  async function enviar() {
    if (trava.current) return;
    setErro(null);
    chaveEnvio.current ??= crypto.randomUUID();
    const invalida = validarPedido({ chaveEnvio: chaveEnvio.current, titulo, detalhes, categoriaId, precoMin, precoMax, cidade: cidade ?? "", modo, prazoHoras: prazo });
    if (invalida) return setErro({ texto: invalida.erro, campo: invalida.campo });
    if (!cidades.includes(cidade ?? "")) return setErro({ texto: "Escolha uma cidade da lista.", campo: "cidade" });
    if (modo === "propostas_prazo" && !regras.prazosHoras.includes(prazo ?? 0)) return setErro({ texto: "Escolha um prazo da lista.", campo: "prazo" });
    if (pedirWhatsapp && !whatsappDigitado(whatsapp)) return setErro({ texto: "Digite seu WhatsApp com DDD, por exemplo (89) 99999-0000.", campo: "whatsapp" });
    trava.current = true;
    iniciar(async () => {
      try {
        const r = await criarPedido({
          chaveEnvio: chaveEnvio.current!,
          titulo,
          detalhes,
          categoriaId,
          precoMin,
          precoMax,
          cidade: cidade!,
          modo,
          prazoHoras: prazo,
          whatsapp: pedirWhatsapp ? whatsapp : undefined,
        });
        if (!r.ok) {
          setErro({ texto: r.erro, campo: r.campo, celular: r.precisaCelular });
          return;
        }
        router.push(`${linkMeuPedidoRadar(r.id)}?novo=1`);
      } catch {
        setErro({ texto: "Não conseguimos confirmar o envio. Seus dados continuam aqui; tente novamente." });
      } finally { trava.current = false; }
    });
  }

  const erroDe = (campo: string) => (erro?.campo === campo ? erro.texto : null);
  const erroGeral = erro && !["titulo", "detalhes", "categoria", "cidade", "prazo", "preco_min_centavos", "preco_max_centavos", "whatsapp"].includes(erro.campo ?? "") ? erro : null;

  return (
    <form ref={formulario} action={enviar} noValidate>
      <fieldset disabled={enviando} className="flex min-w-0 flex-col gap-6">
      <Campo
        rotulo="O que você quer comprar?"
        name="titulo"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={120}
        placeholder="Ex.: Geladeira frost free usada"
        erro={erroDe("titulo")}
        autoComplete="off"
      />

      <Campo
        rotulo="Detalhes"
        name="detalhes"
        multilinha
        opcional
        value={detalhes}
        onChange={(e) => setDetalhes(e.target.value)}
        maxLength={1000}
        placeholder="Cor, tamanho, marca, se aceita usado..."
        erro={erroDe("detalhes")}
      />

      {categorias.length > 0 && (
        <Seletor
          rotulo="Categoria (opcional)"
          name="categoria"
          value={categoriaId ?? ""}
          onChange={(e) => setCategoriaId(e.target.value || null)}
          erro={erroDe("categoria")}
          dica="Escolha a opção mais específica para ajudar vendedores da área a encontrar seu pedido."
        >
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <optgroup key={c.id} label={c.nome}>
              <option value={c.id}>{c.nome}{c.filhas.length ? " (geral)" : ""}</option>
              {c.filhas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </optgroup>
          ))}
        </Seletor>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className={`${ROTULO_GRUPO} mb-2`}>
          Quanto quer pagar? <span className="font-normal text-texto-suave">(opcional)</span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="De"
            name="preco_min"
            prefixo="R$"
            inputMode="decimal"
            value={precoMin}
            onChange={(e) => setPrecoMin(e.target.value)}
            placeholder="0"
            erro={erroDe("preco_min_centavos")}
          />
          <Campo
            rotulo="Até"
            name="preco_max"
            prefixo="R$"
            inputMode="decimal"
            value={precoMax}
            onChange={(e) => setPrecoMax(e.target.value)}
            placeholder="0"
            erro={erroDe("preco_max_centavos")}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${ROTULO_GRUPO} mb-2`}>Em qual cidade?</legend>
        {cidades.length === 0 ? (
          <p className="text-base text-texto-suave">Nenhuma cidade disponível na sua região ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cidades.map((c) => (
              <Chip key={c} ativo={cidade === c} onClick={() => setCidade(c)}>
                {c}
              </Chip>
            ))}
          </div>
        )}
        {erroDe("cidade") && (
          <p role="alert" tabIndex={-1} className="text-sm font-semibold text-perigo">
            {erroDe("cidade")}
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${ROTULO_GRUPO} mb-2`}>Como quer receber as ofertas?</legend>
        <CartaoModo
          ativo={modo === "whatsapp_direto"}
          onClick={() => setModo("whatsapp_direto")}
          icone={<MessageCircle />}
          titulo="Podem me chamar no WhatsApp"
          texto="As lojas mandam mensagem direto para o seu celular."
        />
        {temPrazos && (
          <CartaoModo
            ativo={modo === "propostas_prazo"}
            onClick={() => setModo("propostas_prazo")}
            icone={<Hourglass />}
            titulo={`Quero receber propostas aqui${fimPrazo && prazo ? ` até ${fimPrazo}` : ""}`}
            texto="Você compara preço e foto e só chama quem quiser. Seu número fica escondido."
          />
        )}
        {modo === "propostas_prazo" && temPrazos && (
          <div className="flex flex-col gap-2 rounded-card bg-cartao p-4 shadow-1">
            <span className="text-base font-semibold">Receber propostas por</span>
            <div className="flex flex-wrap gap-2">
              {regras.prazosHoras.map((h) => (
                <Chip key={h} ativo={prazo === h} onClick={() => setPrazo(h)}>
                  {rotuloPrazo(h)}
                </Chip>
              ))}
            </div>
            {erroDe("prazo") && (
              <p role="alert" tabIndex={-1} className="text-sm font-semibold text-perigo">
                {erroDe("prazo")}
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
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="(89) 99999-0000"
          maxLength={20}
          erro={erroDe("whatsapp")}
          dica={modo === "whatsapp_direto" ? "Com DDD. As lojas que enviarem uma proposta poderão ver este número." : "Com DDD. Seu número fica oculto; você escolhe com qual loja conversar."}
        />
      )}

      {erroGeral && (
        <div role="alert" tabIndex={-1} className="flex flex-col gap-2 rounded-card bg-perigo-fundo p-4 text-base font-semibold text-perigo">
          <span>{erroGeral.texto}</span>
          {erroGeral.celular && (
            <Link href="/confirmar-celular?destino=%2Fradar%2Fpedir" className="min-h-12 content-center underline underline-offset-4">
              Confirmar meu celular
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Botao type="submit" larguraTotal disabled={cidades.length === 0} carregando={enviando} textoCarregando="Enviando pedido..." icone={<Megaphone />}>
          Pedir no Radar
        </Botao>
        {regras.pedidosAbertosMax != null && (
          <p className="text-center text-sm text-texto-suave">Você pode ter até {regras.pedidosAbertosMax} pedidos no ar ao mesmo tempo.</p>
        )}
      </div>
      </fieldset>
    </form>
  );
}

function CartaoModo({
  ativo,
  onClick,
  icone,
  titulo,
  texto,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex min-h-12 items-start gap-3 rounded-card border-2 p-4 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro ${
        ativo ? "border-laranja-escuro bg-selecao" : "border-borda bg-cartao hover:bg-fundo"
      }`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cartao text-beringela [&>svg]:size-5" aria-hidden>
        {icone}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold text-beringela">{titulo}</span>
        <span className="text-[15px] text-texto-suave">{texto}</span>
      </span>
      {ativo && <CheckCircle2 className="size-6 shrink-0 text-laranja-escuro" aria-hidden />}
    </button>
  );
}
