"use client";

import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/admin/ui";
import { useGestaoForm, CampoGestao, MotivoGestao, RetornoGestao } from "@/components/admin/form-gestao";
import { apagarDeVez, lixeiraConta, lixeiraLoja } from "./actions";

type Tipo = "conta" | "loja";

/** Restaurar um item da lixeira: volta como estava, com loja e anúncios. */
export function FormRestaurar({ tipo, id }: { tipo: Tipo; id: string }) {
  const [estado, acao, pendente] = useGestaoForm(tipo === "conta" ? lixeiraConta : lixeiraLoja);
  return <form onSubmit={acao} className="space-y-3">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="operacao" value="restaurar" />
    <MotivoGestao /><Botao type="submit" variante="secundario" carregando={pendente}>Restaurar</Botao>
    <RetornoGestao estado={estado} />
  </form>;
}

/** Apagar de vez agora, sem esperar os 30 dias. Exige o nome exato. */
export function FormApagarDeVez({ tipo, id, nome }: { tipo: Tipo; id: string; nome: string }) {
  const [estado, acao, pendente] = useGestaoForm(apagarDeVez);
  return <details className="rounded-card border border-perigo p-3">
    <summary className="cursor-pointer text-sm font-semibold text-perigo">Apagar de vez agora</summary>
    <p className="mt-2 text-sm">Não dá para desfazer. Registros de pagamento e provas congeladas ficam guardados, sem dados pessoais.</p>
    <form onSubmit={acao} className="mt-3 space-y-3">
      <input type="hidden" name="tipo" value={tipo} /><input type="hidden" name="alvo" value={id} />
      <CampoGestao rotulo={`Digite ${nome} para confirmar`} name="confirmacao" required autoComplete="off" />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmar" required className="mt-1 size-5 shrink-0" />Li o efeito e quero apagar de vez.</label>
      <MotivoGestao /><Botao type="submit" variante="perigo" carregando={pendente}>Apagar de vez</Botao>
      <RetornoGestao estado={estado} />
    </form>
  </details>;
}

/** Ficha do usuário: mover a conta para a lixeira ou restaurar. */
export function FormLixeiraConta({ id, naLixeira, apagarApos }: { id: string; naLixeira: boolean; apagarApos: string | null }) {
  const [estado, acao, pendente] = useGestaoForm(lixeiraConta);
  return <Cartao className="mt-6"><h2 className="mb-2 text-lg font-semibold">Excluir conta</h2>
    <p className="mb-4 text-sm text-texto-suave">{naLixeira
      ? `Esta conta está na lixeira e será apagada de vez em ${apagarApos ? new Date(apagarApos).toLocaleDateString("pt-BR") : "30 dias"}. Restaurar devolve a conta, a loja e os anúncios.`
      : "A conta, a loja e os anúncios saem do ar e ficam 30 dias na lixeira. Depois são apagados de vez. Use para pedidos de exclusão (LGPD). Para punição, use Suspender."}</p>
    <form onSubmit={acao} className="space-y-4"><input type="hidden" name="id" value={id} />
      <input type="hidden" name="operacao" value={naLixeira ? "restaurar" : "excluir"} />
      <MotivoGestao /><Botao type="submit" variante={naLixeira ? "secundario" : "perigo"} carregando={pendente}>{naLixeira ? "Restaurar conta" : "Mover conta para a lixeira"}</Botao>
      <RetornoGestao estado={estado} />
    </form>
  </Cartao>;
}

/** Ficha da loja: mover a loja para a lixeira ou restaurar. */
export function FormLixeiraLoja({ id, naLixeira, comConta }: { id: string; naLixeira: boolean; comConta: boolean }) {
  const [estado, acao, pendente] = useGestaoForm(lixeiraLoja);
  return <Cartao className="mt-6 border-perigo"><h2 className="text-lg font-semibold text-perigo">Excluir loja</h2>
    <p className="mt-2 text-sm">{naLixeira
      ? comConta ? "Esta loja saiu junto com a conta do titular. Para devolver, restaure a conta na ficha do titular." : "Esta loja está na lixeira. Restaurar devolve a vitrine e os anúncios."
      : "A vitrine e os anúncios saem do ar e ficam 30 dias na lixeira. Depois são apagados de vez. A conta do titular continua. Anúncios congelados ficam guardados."}</p>
    {!(naLixeira && comConta) && <form onSubmit={acao} className="mt-4 space-y-4"><input type="hidden" name="id" value={id} />
      <input type="hidden" name="operacao" value={naLixeira ? "restaurar" : "excluir"} />
      <MotivoGestao /><Botao type="submit" variante={naLixeira ? "secundario" : "perigo"} carregando={pendente}>{naLixeira ? "Restaurar loja" : "Mover loja para a lixeira"}</Botao>
      <RetornoGestao estado={estado} />
    </form>}
  </Cartao>;
}
