"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Smartphone } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { telefone } from "@/lib/formato";
import { salvarWhatsapp, type EstadoDados } from "@/app/(conta)/minha-conta/dados/actions";
import { Aviso } from "./aviso";

export function FormWhatsapp({ numero, confirmado, exigeCodigo, ehLoja }: {
  numero: string | null; confirmado: boolean; exigeCodigo: boolean; ehLoja: boolean;
}) {
  const [valor, setValor] = useState(telefone(numero));
  const [estado, setEstado] = useState<EstadoDados>(null);
  const [pendente, iniciar] = useTransition();
  const trava = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => { if (!pendente && estado?.campos?.whatsapp) input.current?.focus(); }, [estado, pendente]);
  return (
    <section aria-labelledby="titulo-whatsapp" className="flex flex-col gap-4 rounded-card bg-cartao p-5 shadow-1">
      <div>
        <h2 id="titulo-whatsapp" className="flex items-center gap-2 text-lg font-bold"><Smartphone className="size-5 text-laranja-escuro" aria-hidden />Seu WhatsApp</h2>
        <p className="mt-1 text-sm text-texto-suave">Contato usado nos seus pedidos do Radar e nas vendas como pessoa física.</p>
      </div>
      <div className="rounded-campo bg-fundo p-3">
        <p className="text-sm text-texto-suave">Número atual</p>
        <p className="break-words text-lg font-bold tabular-nums">{numero ? telefone(numero) : "Não informado"}</p>
        {confirmado ? <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-verde-escuro"><CheckCircle2 className="size-4" aria-hidden />Celular confirmado por código</p>
          : numero && <p className="mt-1 text-sm text-texto-suave">Cadastrado sem confirmação por código</p>}
      </div>
      {!confirmado && !exigeCodigo && (
        <form aria-label="Editar WhatsApp" noValidate onSubmit={(e) => {
          e.preventDefault();
          if (trava.current) return;
          trava.current = true;
          const dados = new FormData(e.currentTarget);
          setEstado(null);
          iniciar(async () => {
            try {
              const r = await salvarWhatsapp(null, dados);
              setEstado(r);
              if (r?.ok) router.refresh();
            } catch { setEstado({ erro: "A conexão falhou. O número digitado foi mantido; tente novamente." }); }
            finally { trava.current = false; }
          });
        }} className="flex flex-col gap-3">
          <Campo ref={input} rotulo="WhatsApp com DDD" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" value={valor}
            onChange={(e) => { setValor(e.target.value); setEstado(null); }} maxLength={30} required disabled={pendente} erro={estado?.campos?.whatsapp}
            dica="Informe um número seu que receba mensagens no WhatsApp. Isso não altera seu login." />
          {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
          {estado?.ok && <Aviso tipo="ok">WhatsApp salvo. Os próximos contatos usarão este número.</Aviso>}
          <Botao type="submit" variante="secundario" larguraTotal carregando={pendente} textoCarregando="Salvando...">Salvar WhatsApp</Botao>
        </form>
      )}
      {(confirmado || exigeCodigo) && <p className="text-sm text-texto-suave">Para trocar o contato, confirme o novo celular por código e escolha-o como principal na tela seguinte.</p>}
      <Botao href="/minha-conta/dados/foto" variante="texto" larguraTotal>Confirmar ou trocar celular</Botao>
      <p className="text-sm text-texto-suave">O código confirma o celular, mas não verifica se há uma conta de WhatsApp nesse número.</p>
      {ehLoja && <p className="text-sm text-texto-suave">O WhatsApp da sua loja é separado. Altere-o em <a href="/minha-conta/loja" className="font-semibold text-laranja-escuro underline">Minha loja</a>.</p>}
    </section>
  );
}
