"use client";

import { useActionState, useState } from "react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { acaoLoja, analisarVerificacao, revisarLoja, decidirVerificacaoPf, decidirVerificacaoLoja, resolverAvisoVerificacaoLoja, revogarVendedorPf } from "./actions";
import { MOTIVOS_VERIFICACAO_LOJA } from "@/lib/verificacao-loja/constantes";
import { MOTIVOS_VERIFICACAO_PF } from "@/lib/verificacao-vendedor";
import type { AcaoLoja, LojaAdmin } from "@/lib/tipos-cobranca";

// Formulários da tela 5. Cada ação pede o motivo (fica no histórico) e mostra "carregando".

function Retorno({ estado }: { estado: { ok?: string; erro?: string } | null }) {
  if (!estado) return null;
  return estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}

type AcaoOperacional = Exclude<AcaoLoja, "dar_selo" | "tirar_selo">;

const ROTULO: Record<AcaoOperacional, string> = {
  cortesia: "Dar dias de cortesia",
  trocar_plano: "Trocar o plano",
  suspender: "Suspender",
  reativar: "Reativar",
};

/** `permitidas`: ações que o papel pode fazer (null = todas, administrador). O banco confere de novo. */
export function FormAcaoLoja({
  loja,
  planos,
  permitidas = null,
}: {
  loja: LojaAdmin;
  planos: { codigo: string; nome: string }[];
  permitidas?: AcaoLoja[] | null;
}) {
  const [estado, acao, pendente] = useActionState(acaoLoja, null);
  const opcoes: AcaoOperacional[] = (
    [
      "cortesia",
      "trocar_plano",
      loja.status === "suspensa" ? "reativar" : "suspender",
    ] as AcaoOperacional[]
  ).filter((a) => permitidas === null || permitidas.includes(a));
  const [escolha, setEscolha] = useState<AcaoOperacional>(opcoes[0] ?? "suspender");
  const perigo = escolha === "suspender";

  return (
    <form action={acao} className="grid grid-cols-2 items-end gap-3 @3xl/painel:grid-cols-4">
      <input type="hidden" name="vitrine" value={loja.id} />
      <label className="col-span-2 text-sm font-medium">
        O que fazer
        <select name="acao" value={escolha} onChange={(e) => setEscolha(e.target.value as AcaoOperacional)} className={estiloCampo}>
          {opcoes.map((a) => (
            <option key={a} value={a}>
              {ROTULO[a]}
            </option>
          ))}
        </select>
      </label>
      {escolha === "trocar_plano" && (
        <label className="text-sm font-medium">
          Plano
          <select name="plano" required className={estiloCampo} defaultValue="">
            <option value="" disabled>
              Escolha
            </option>
            {planos.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {(escolha === "cortesia" || escolha === "trocar_plano") && (
        <label className="text-sm font-medium">
          {escolha === "cortesia" ? "Quantos dias" : "Vale por (dias)"}
          <input name="dias" type="number" min={1} max={365} required={escolha === "cortesia"} placeholder={escolha === "trocar_plano" ? "grátis: vazio" : ""} className={estiloCampo} />
        </label>
      )}
      <label className="col-span-2 text-sm font-medium @3xl/painel:col-span-4">
        Motivo (fica no histórico)
        <input name="motivo" required minLength={3} maxLength={300} placeholder="Ex.: compensação pela queda do site" className={estiloCampo} />
      </label>
      {escolha === "trocar_plano" && loja.plano_proximo && (
        <p className="col-span-2 text-legenda text-aviso @3xl/painel:col-span-4">
          Esta loja tem uma troca já paga para {loja.plano_proximo_nome ?? loja.plano_proximo}. Trocar o plano aqui desfaz essa troca marcada.
        </p>
      )}
      {escolha === "trocar_plano" && (
        <p className="col-span-2 text-legenda text-texto-suave @3xl/painel:col-span-4">
          Plano pago ou teste: diga por quantos dias vale. Plano grátis não vence (deixe os dias em branco). Nada é cobrado.
        </p>
      )}
      <div className="col-span-2 flex justify-end @3xl/painel:col-span-4">
        <Botao type="submit" variante={perigo ? "perigo" : "secundario"} carregando={pendente} textoCarregando="Salvando...">
          {ROTULO[escolha]}
        </Botao>
      </div>
      <div className="col-span-2 @3xl/painel:col-span-4">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

type DecisaoLoja = "aprovar" | "correcao" | "recusar";

export function FormRevisaoLoja({
  loja, revisao, motivos, whatsappConfirmado, instagramValido, aprovada,
}: {
  loja: string;
  revisao: number;
  motivos: { valor: string; rotulo: string }[];
  whatsappConfirmado: boolean;
  instagramValido: boolean;
  aprovada: boolean;
}) {
  const [estado, acao, pendente] = useActionState(revisarLoja, null);
  const [decisao, setDecisao] = useState<DecisaoLoja>("aprovar");
  const [motivo, setMotivo] = useState("");
  const [conferido, setConferido] = useState({ dados: false, link: false, whatsapp: false });
  const itens = [
    ["dados", "Conferi o nome, a titularidade e os dados comerciais cadastrados."],
    ["link", "Abri a vitrine e conferi o site e o Instagram cadastrados."],
    ["whatsapp", "Conferi os contatos comerciais e o controle de números diferentes do WhatsApp confirmado da conta."],
  ] as const;

  return (
    <form action={acao} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="loja" value={loja} />
      <input type="hidden" name="revisao" value={revisao} />
      {!aprovada && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Conferências para aprovar</legend>
          {itens.map(([campo, rotulo]) => (
            <label key={campo} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name={campo}
                checked={conferido[campo]}
                onChange={(e) => setConferido({ ...conferido, [campo]: e.target.checked })}
                className="mt-0.5 size-5 shrink-0 accent-laranja-escuro"
              />
              {rotulo}
            </label>
          ))}
          {!instagramValido && <p className="text-sm font-semibold text-aviso">Peça a correção do Instagram cadastrado antes de aprovar.</p>}
          {!whatsappConfirmado && <p className="text-sm font-semibold text-aviso">A aprovação exige que o responsável confirme o WhatsApp da conta.</p>}
        </fieldset>
      )}
      <label className="text-sm font-medium">
        Motivo para pedir correção ou {aprovada ? "revogar" : "recusar"}
        <select name="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={estiloCampo}>
          <option value="">Selecione o motivo</option>
          {motivos.map(({ valor, rotulo }) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {!aprovada && (
          <Botao type="submit" name="decisao" value="aprovar" onClick={() => setDecisao("aprovar")}
            disabled={pendente || !whatsappConfirmado || !instagramValido || !Object.values(conferido).every(Boolean)}
            carregando={pendente && decisao === "aprovar"} textoCarregando="Salvando...">
            Aprovar e conceder selo
          </Botao>
        )}
        <Botao type="submit" name="decisao" value="correcao" onClick={() => setDecisao("correcao")}
          variante="secundario" disabled={pendente || !motivo}
          carregando={pendente && decisao === "correcao"} textoCarregando="Salvando...">
          Pedir correção
        </Botao>
        <Botao type="submit" name="decisao" value="recusar" onClick={() => setDecisao("recusar")}
          variante="perigo" disabled={pendente || !motivo}
          carregando={pendente && decisao === "recusar"} textoCarregando="Salvando...">
          {aprovada ? "Revogar verificação" : "Recusar verificação"}
        </Botao>
      </div>
      <Retorno estado={estado} />
    </form>
  );
}

/** `podeAprovar` = false quando documento/selfie não tem arquivo para conferir (o banco também barra). */
export function FormVerificacao({ id, podeAprovar = true }: { id: string; podeAprovar?: boolean }) {
  const [estado, acao, pendente] = useActionState(analisarVerificacao, null);
  const [decisao, setDecisao] = useState<"aprovar" | "recusar">("aprovar");
  return (
    <form action={acao} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-sm font-medium">
        Motivo (obrigatório para recusar)
        <input name="motivo" maxLength={300} className={estiloCampo} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" variante="secundario" carregando={pendente && decisao === "aprovar"} textoCarregando="Salvando..." disabled={pendente || !podeAprovar} name="decisao" value="aprovar" onClick={() => setDecisao("aprovar")}>
          Aprovar
        </Botao>
        <Botao type="submit" variante="perigo" carregando={pendente && decisao === "recusar"} textoCarregando="Salvando..." disabled={pendente} name="decisao" value="recusar" onClick={() => setDecisao("recusar")}>
          Recusar
        </Botao>
      </div>
      <Retorno estado={estado} />
    </form>
  );
}

export function FormRevogarVendedorPf({ vitrine, nome }: { vitrine: string; nome: string }) {
  const [estado, acao, pendente] = useActionState(revogarVendedorPf, null);
  return (
    <form action={acao} className="mt-3 space-y-3">
      <input type="hidden" name="vitrine" value={vitrine} />
      <input type="hidden" name="nome" value={nome} />
      <p className="text-sm text-texto-suave">Ao revogar, o selo sai dos anúncios e o vendedor pode enviar os arquivos novamente.</p>
      <Botao type="submit" disabled={pendente} variante="secundario">Revogar verificação</Botao>
      <Retorno estado={estado} />
    </form>
  );
}

export function FormDecidirVerificacaoPf({ id, dadosAtuais }: { id: string; dadosAtuais: boolean }) {
  const [estadoAprovar, aprovar, aprovando] = useActionState(decidirVerificacaoPf.bind(null, true), null);
  const [estadoRecusar, recusar, recusando] = useActionState(decidirVerificacaoPf.bind(null, false), null);
  const pendente = aprovando || recusando;
  const [motivo, setMotivo] = useState("");
  const [conferidos, setConferidos] = useState<string[]>([]);
  const itens = [
    ["dados", "Os dados oficiais correspondem ao vendedor"],
    ["documento", "Conferi o documento oficial com foto"],
    ["endereco", "Conferi o comprovante de endereço"],
  ];
  return (
    <form className="mt-3 space-y-3">
      <input type="hidden" name="id" value={id} />
      {dadosAtuais ? (
        <fieldset className="space-y-2">
          <legend className="font-semibold">Conferências para aprovar</legend>
          {itens.map(([campo, texto]) => (
            <label key={campo} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name={campo} checked={conferidos.includes(campo)}
                onChange={(e) => setConferidos(e.target.checked ? [...conferidos, campo] : conferidos.filter((c) => c !== campo))}
                className="mt-0.5 size-5 shrink-0 accent-laranja-escuro" />
              {texto}
            </label>
          ))}
        </fieldset>
      ) : <p className="text-sm font-semibold text-aviso">Os dados do perfil mudaram. Peça um novo envio.</p>}
      <label className="block text-sm font-medium">
        Motivo para pedir novo envio
        <select name="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={estiloCampo}>
          <option value="">Selecione o motivo</option>
          {Object.entries(MOTIVOS_VERIFICACAO_PF).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" formAction={aprovar} disabled={pendente || !dadosAtuais || conferidos.length !== itens.length}>Aprovar identidade</Botao>
        <Botao type="submit" formAction={recusar} variante="secundario" disabled={pendente || !motivo}>Pedir novo envio</Botao>
      </div>
      <Retorno estado={estadoAprovar} />
      <Retorno estado={estadoRecusar} />
    </form>
  );
}

type DecisaoPedidoLoja = "aprovar" | "correcao" | "recusar" | "confirmar" | "tirar_selo";

/** Decisão da equipe sobre um pedido de verificação de loja. `equipe`: aprovar, pedir correção ou recusar; `revisao_amostra`: confirmar ou tirar o selo. */
export function FormDecidirVerificacaoLoja({ id, status }: { id: string; status: "equipe" | "revisao_amostra" }) {
  const [estado, acao, pendente] = useActionState(decidirVerificacaoLoja, null);
  const [decisao, setDecisao] = useState<DecisaoPedidoLoja>("aprovar");
  const [motivo, setMotivo] = useState("");
  const [conferido, setConferido] = useState(false);
  const amostra = status === "revisao_amostra";
  const botao = (valor: DecisaoPedidoLoja) => ({ name: "decisao", value: valor, onClick: () => setDecisao(valor), carregando: pendente && decisao === valor, textoCarregando: "Salvando..." });
  return (
    <form action={acao} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {!amostra && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Conferências para aprovar</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="conferido" checked={conferido} onChange={(e) => setConferido(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-laranja-escuro" />
            Conferi o comprovante de endereço e o CNPJ da loja.
          </label>
        </fieldset>
      )}
      <label className="text-sm font-medium">
        {amostra ? "Motivo para tirar o selo" : "Motivo para pedir correção ou recusar"}
        <select name="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={estiloCampo}>
          <option value="">Selecione o motivo</option>
          {Object.entries(MOTIVOS_VERIFICACAO_LOJA).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {amostra ? (
          <>
            <Botao type="submit" disabled={pendente} {...botao("confirmar")}>Confirmar aprovação</Botao>
            <Botao type="submit" variante="secundario" disabled={pendente || !motivo} {...botao("tirar_selo")}>Tirar o selo</Botao>
          </>
        ) : (
          <>
            <Botao type="submit" disabled={pendente || !conferido} {...botao("aprovar")}>Aprovar e conceder selo</Botao>
            <Botao type="submit" variante="secundario" disabled={pendente || !motivo} {...botao("correcao")}>Pedir correção</Botao>
            <Botao type="submit" variante="perigo" disabled={pendente || !motivo} {...botao("recusar")}>Recusar verificação</Botao>
          </>
        )}
      </div>
      <Retorno estado={estado} />
    </form>
  );
}

/** "Visto" num aviso da equipe sobre uma loja verificada. */
export function FormAvisoVerificacaoLoja({ id }: { id: string }) {
  const [estado, acao, pendente] = useActionState(resolverAvisoVerificacaoLoja, null);
  return (
    <form action={acao}>
      <input type="hidden" name="id" value={id} />
      <Botao type="submit" variante="texto" tamanho="pequeno" carregando={pendente}>Visto</Botao>
      {estado?.erro && <p role="alert" className="mt-1 text-legenda text-perigo">{estado.erro}</p>}
    </form>
  );
}
