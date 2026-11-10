"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Flag } from "lucide-react";
import { Botao, classesBotao } from "@/components/ui/botao";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { denunciarAnuncio, type EstadoDenuncia } from "./actions";

// F9 · Denunciar: motivos prontos em botões. Com várias denúncias o anúncio sai do ar
// até a revisão (regra do banco). Precisa estar logado (guardamos quem denunciou).

const MOTIVOS = [
  { valor: "pagamento", rotulo: "Pediu pagamento antecipado" },
  { valor: "falso", rotulo: "Produto falso" },
  { valor: "preco", rotulo: "Preço enganoso" },
  { valor: "proibido", rotulo: "Produto proibido" },
  { valor: "ofensivo", rotulo: "Ofensivo" },
  { valor: "repetido", rotulo: "Anúncio repetido" },
  { valor: "outro", rotulo: "Outro" },
];

const OPCAO =
  "flex min-h-10 cursor-pointer items-center gap-3 rounded-campo border-2 border-borda bg-cartao px-4 text-base " +
  "has-checked:border-beringela has-checked:bg-selecao has-checked:font-semibold " +
  "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-laranja-escuro";

export function Denunciar({ anuncioId, logado, entrarHref }: { anuncioId: string; logado: boolean; entrarHref: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoDenuncia, FormData>(async (anterior, form) => {
    try { return await denunciarAnuncio(anterior, form); }
    catch { return { ok: false, mensagem: "Não foi possível enviar a denúncia. Tente novamente." }; }
  }, null);

  return (
    <Dialog>
      <DialogTrigger
        id="denunciar"
        className="olaki-toque inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-campo px-2 text-sm text-perigo underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro"
      >
        <Flag className="size-4" aria-hidden /> Denunciar este anúncio
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Denunciar este anúncio</DialogTitle>
          <DialogDescription>A equipe do Mercado da Região revisa cada denúncia.</DialogDescription>
        </DialogHeader>
        {estado?.ok ? (
          <Alert variant="success" role="status">{estado.mensagem}</Alert>
        ) : !logado ? (
          <>
            <p className="text-base">Para denunciar, entre na sua conta. É rápido e depois você volta para cá.</p>
            <Link href={entrarHref} className={classesBotao("secundario", true)}>
              Entrar para denunciar
            </Link>
          </>
        ) : (
          <form action={enviar} className="flex flex-col gap-3">
            <input type="hidden" name="anuncio_id" value={anuncioId} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-base font-semibold">O que está errado?</legend>
              {MOTIVOS.map((m) => (
                <label key={m.valor} className={OPCAO}>
                  <input type="radio" name="motivo" value={m.valor} required className="size-5 accent-beringela" />
                  {m.rotulo}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="denuncia-detalhes" className="text-base font-semibold">
                Conte mais <span className="font-normal text-texto-suave">(opcional; obrigatório em “Outro”)</span>
              </label>
              <textarea
                id="denuncia-detalhes"
                name="detalhes"
                maxLength={900}
                rows={3}
                className="w-full rounded-campo border-2 border-borda bg-cartao px-3 py-3 text-base leading-6 focus:outline-none focus-visible:border-laranja-escuro focus-visible:ring-2 focus-visible:ring-laranja-escuro/30"
              />
            </div>
            {estado && !estado.ok && (
              <Alert variant="destructive" role="alert" className="block">
                {estado.mensagem}{" "}
                {estado.precisaEntrar && (
                  <Link href={entrarHref} className="underline">
                    Entrar
                  </Link>
                )}
              </Alert>
            )}
            <Botao type="submit" variante="perigo" larguraTotal carregando={enviando} textoCarregando="Enviando...">
              Enviar denúncia
            </Botao>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
