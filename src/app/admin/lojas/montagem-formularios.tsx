"use client";
// Etapa P5c: formulários do super admin para montar a loja e convidar o dono.

import { useActionState, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Aviso, Cartao } from "@/components/admin/ui";
import { useGestaoForm, CampoGestao, LocalidadeGestao, RetornoGestao } from "@/components/admin/form-gestao";
import type { LocalidadesGestao } from "@/lib/admin/gestao";
import { cancelarConviteDono, convidarDono, montarLoja } from "./montagem-actions";

export function FormMontarLoja({ locais }: { locais: LocalidadesGestao }) {
  const [estado, acao, pendente] = useGestaoForm(montarLoja);
  return <form onSubmit={acao} className="space-y-5">
    <fieldset disabled={pendente} className="space-y-5">
      <Cartao><h2 className="mb-4 text-lg font-semibold">Dados da loja</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoGestao rotulo="Nome da loja" name="nome" required minLength={2} maxLength={80} />
          <CampoGestao rotulo="Endereço público da loja" name="slug" required pattern="[a-z0-9-]{3,60}" maxLength={60} />
          <LocalidadeGestao locais={locais} obrigatoria />
          <p className="text-sm text-texto-suave sm:col-span-2">Use letras minúsculas, números e hífen no endereço. O WhatsApp da loja será o do dono, confirmado quando ele aceitar.</p>
        </div>
      </Cartao>
      <Botao type="submit" carregando={pendente} textoCarregando="Montando...">Montar loja</Botao>
    </fieldset>
    <RetornoGestao estado={estado} />
  </form>;
}

export function FormConvidarDono({ loja, nome }: { loja: string; nome: string }) {
  const [estado, acao, pendente] = useActionState(convidarDono.bind(null, loja), null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [copiaManual, setCopiaManual] = useState<string | null>(null);
  const link = estado?.link;
  const mensagem = link && `Olá! Montamos a loja *${nome}* no Mercado da Região para você. Abra o link para receber sua loja: ${link}`;

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(url);
    } catch {
      setCopiaManual(url);
    }
  }

  return <div className="space-y-3">
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <CampoGestao rotulo="WhatsApp do dono" name="whatsapp" type="tel" inputMode="tel" autoComplete="off" required maxLength={30} placeholder="(89) 99999-0000" />
      <Botao type="submit" carregando={pendente} textoCarregando="Gerando...">Gerar convite</Botao>
    </form>
    {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    {link && estado?.whatsapp && mensagem && (
      <div className="space-y-2">
        <Aviso tipo="ok">Convite criado. Envie o link agora: ele vale por sete dias e só abre com esse WhatsApp confirmado.</Aviso>
        <div className="flex flex-wrap gap-2">
          <Botao href={`https://wa.me/${estado.whatsapp}?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer" variante="whatsapp">
            Enviar pelo WhatsApp
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => copiar(link)}>{copiado === link ? "Link copiado" : "Copiar link"}</Botao>
        </div>
        {copiaManual === link && (
          <CampoGestao rotulo="Link do convite" value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
        )}
      </div>
    )}
  </div>;
}

export function FormCancelarConviteDono({ loja }: { loja: string }) {
  const [estado, acao, pendente] = useActionState(cancelarConviteDono.bind(null, loja), null);
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) return <Botao type="button" variante="texto" onClick={() => setConfirmando(true)}>Cancelar convite</Botao>;
  return <form action={acao} className="flex flex-wrap items-center gap-2">
    <Botao type="submit" variante="perigo" carregando={pendente}>Confirmar cancelamento</Botao>
    <Botao type="button" variante="texto" onClick={() => setConfirmando(false)} disabled={pendente}>Voltar</Botao>
    <RetornoGestao estado={estado} />
  </form>;
}
