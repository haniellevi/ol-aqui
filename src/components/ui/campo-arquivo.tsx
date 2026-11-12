"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Paperclip, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";

// Campo de arquivo do Mercado da Região: o campo nativo do navegador fica escondido (continua valendo
// para formulário, teclado e leitor de tela) e a pessoa vê um botão de verdade. Depois de escolher,
// aparece um aviso com o nome do arquivo (e a prévia, se for imagem), para ela saber que deu certo.

type Props = {
  rotulo: ReactNode;
  name?: string;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  /** Mostra "(opcional)" ao lado do rótulo. */
  opcional?: boolean;
  dica?: ReactNode;
  erro?: string | null;
  /** Texto do botão antes de escolher. */
  textoBotao?: string;
  /** Texto do botão depois de escolher. */
  textoTrocar?: string;
  /** Chamado com o arquivo escolhido. Use para validar e guardar o arquivo. */
  onEscolher?: (arquivo: File) => void;
  /** Chamado ao tirar o arquivo. Sem isso, não aparece o botão de tirar. */
  onRemover?: () => void;
  /** Texto do botão de tirar. */
  textoRemover?: string;
  /** Quando o pai guarda o arquivo, informe o nome aqui (null = nada escolhido). Sem isso, o campo guarda sozinho. */
  nome?: string | null;
  /** Endereço da prévia (imagem escolhida ou já salva). */
  previa?: string | null;
  /** "grande" = Modo fácil: rótulo, avisos e botões em 18px e 48px. Sem isso, o visual de sempre. */
  tamanho?: "normal" | "grande";
  className?: string;
};

function tamanhoLegivel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function CampoArquivo({
  rotulo, name, accept, required, disabled, opcional, dica, erro,
  textoBotao = "Escolher arquivo", textoTrocar = "Trocar arquivo", onEscolher, onRemover, textoRemover = "Tirar arquivo",
  nome, previa, tamanho: porte = "normal", className = "",
}: Props) {
  const grande = porte === "grande";
  const letra = grande ? "text-facil" : "text-sm";
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<{ nome: string; tamanho: number } | null>(null);
  const controlado = nome !== undefined;
  const nomeAtual = controlado ? nome : local?.nome ?? null;
  const tamanho = !controlado && local ? tamanhoLegivel(local.tamanho) : null;

  function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!controlado) setLocal({ nome: arquivo.name, tamanho: arquivo.size });
    onEscolher?.(arquivo);
    // Se o pai guarda o arquivo, limpa o campo nativo para a pessoa poder escolher o mesmo arquivo de novo.
    if (controlado && entrada.current) entrada.current.value = "";
  }

  function tirar() {
    if (entrada.current) entrada.current.value = "";
    setLocal(null);
    onRemover?.();
  }

  const idErro = erro ? `${id}-erro` : undefined;

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span id={`${id}-rotulo`} className={`${grande ? "text-facil" : "text-rotulo"} font-semibold text-texto`}>
        {rotulo}
        {opcional && <span className="ml-1 font-normal text-texto-suave">(opcional)</span>}
      </span>
      <input
        ref={entrada}
        id={id}
        type="file"
        name={name}
        accept={accept}
        required={required}
        disabled={disabled}
        className="sr-only"
        aria-labelledby={`${id}-rotulo`}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idErro}
        onChange={(e) => aoEscolher(e.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="secundario" tamanho={grande ? "grande" : "normal"} icone={<Paperclip />} disabled={disabled} onClick={() => entrada.current?.click()}>
          {nomeAtual ? textoTrocar : textoBotao}
        </Botao>
        {nomeAtual && onRemover && (
          <Botao variante="texto" tamanho={grande ? "grande" : "normal"} icone={<Trash2 />} disabled={disabled} onClick={tirar}>
            {textoRemover}
          </Botao>
        )}
      </div>
      <div aria-live="polite">
        {nomeAtual ? (
          <p role="status" className={`flex min-w-0 items-center gap-2 rounded-campo bg-sucesso-fundo px-3 py-2 ${letra} font-semibold text-verde-escuro`}>
            <CheckCircle2 className={grande ? "size-5 shrink-0" : "size-4 shrink-0"} aria-hidden />
            {previa && (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local de arquivo escolhido
              <img src={previa} alt="" width={32} height={32} className="size-8 shrink-0 rounded-campo bg-cartao object-contain" />
            )}
            <span className="min-w-0 truncate">Escolhido: {nomeAtual}{tamanho ? ` (${tamanho})` : ""}</span>
          </p>
        ) : (
          <p className={`${letra} text-texto-suave`}>{required ? "Nenhum arquivo escolhido ainda." : "Nenhum arquivo escolhido."}</p>
        )}
      </div>
      {dica && !erro && <p className={`${letra} text-texto-suave`}>{dica}</p>}
      {erro && <p id={idErro} role="alert" className={`${letra} font-semibold text-perigo`}>{erro}</p>}
    </div>
  );
}
