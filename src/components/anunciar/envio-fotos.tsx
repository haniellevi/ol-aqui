"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Loader2, RotateCw, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { reduzirFoto, enviarFoto } from "@/lib/fotos";
import { apagarFoto, criarUrlEnvioFoto } from "@/lib/dados/fotos";
import { salvarFotos } from "@/app/(conta)/anunciar/actions";
import { AvisoErro } from "./aviso-erro";
import { BarraContinuar } from "./barra-continuar";
import { urlPasso } from "./passos";

// Passo 1 · Fotos. Reduz cada foto no celular, envia uma por vez (com progresso e "Tentar de novo")
// e salva a lista no rascunho a cada mudança. A primeira foto é a capa.

type EstadoFoto = "fila" | "enviando" | "pronta" | "erro";

type Item = {
  chave: string;
  estado: EstadoFoto;
  url?: string; // endereço público (depois de enviada)
  previa?: string; // objectURL local para mostrar enquanto envia
  arquivo?: Blob; // original (para tentar de novo)
  erro?: string;
};

const BOTAO_FOTO =
  "flex min-h-24 flex-1 flex-col items-center justify-center gap-2 rounded-card border-2 border-beringela bg-cartao px-3 py-4 " +
  "text-base font-semibold text-beringela hover:bg-fundo active:bg-borda disabled:cursor-not-allowed disabled:opacity-60 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

const BOTAO_MINI =
  "grid min-h-12 flex-1 place-items-center rounded-campo border border-borda bg-cartao text-beringela hover:bg-fundo " +
  "disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-laranja-escuro";

let contador = 0;
const novaChave = () => `f${Date.now()}-${contador++}`;

export function EnvioFotos({
  id,
  editar,
  fotosIniciais,
  maximo,
  minimo,
}: {
  id: string;
  editar: boolean;
  fotosIniciais: string[];
  maximo: number;
  minimo: number;
}) {
  const router = useRouter();
  const [itens, setItens] = useState<Item[]>(() => fotosIniciais.map((url) => ({ chave: novaChave(), estado: "pronta", url })));
  const [aviso, setAviso] = useState(""); // lido pelo leitor de tela (aria-live)
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const itensRef = useRef(itens);
  itensRef.current = itens;
  const fila = useRef<Promise<unknown>>(Promise.resolve()); // salva na ordem em que mudou
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const prontas = itens.filter((i) => i.estado === "pronta");
  const ocupado = itens.some((i) => i.estado === "enviando" || i.estado === "fila");
  const vagas = maximo - itens.length;

  /** Salva no rascunho a lista de fotos prontas, na ordem da tela. */
  const salvar = useCallback(
    (lista: Item[]) => {
      const urls = lista.filter((i) => i.estado === "pronta" && i.url).map((i) => i.url as string);
      const p = fila.current.then(async () => {
        const r = await salvarFotos(id, urls);
        if (!r.ok) setErro(r.erro.mensagem);
        return r.ok;
      });
      fila.current = p.catch(() => false);
      return p;
    },
    [id],
  );

  const mudar = useCallback(
    (fn: (atual: Item[]) => Item[], salvarDepois = false) => {
      const nova = fn(itensRef.current);
      itensRef.current = nova;
      setItens(nova);
      if (salvarDepois) return salvar(nova);
      return Promise.resolve(true);
    },
    [salvar],
  );

  // Envia a próxima foto da fila (uma por vez: internet fraca).
  useEffect(() => {
    const atual = itensRef.current; // a ref já tem a última mudança (evita enviar a mesma foto 2 vezes)
    if (atual.some((i) => i.estado === "enviando")) return;
    const proxima = atual.find((i) => i.estado === "fila");
    if (!proxima?.arquivo) return;
    const pendentes = atual.filter((i) => i.estado === "fila").length;
    const feitas = atual.filter((i) => i.estado === "pronta").length;
    setAviso(`Enviando foto ${feitas + 1}. Faltam ${pendentes}.`);
    mudar((l) => l.map((i) => (i.chave === proxima.chave ? { ...i, estado: "enviando", erro: undefined } : i)));

    (async () => {
      try {
        const reduzida = await reduzirFoto(proxima.arquivo as Blob);
        const previa = URL.createObjectURL(reduzida.blob);
        mudar((l) => l.map((i) => (i.chave === proxima.chave ? { ...i, previa } : i)));
        const envio = await criarUrlEnvioFoto(id, reduzida.formato);
        if (!envio.ok) throw new Error(envio.erro.mensagem);
        const ok = await enviarFoto(reduzida.blob, envio.dados.urlEnvio);
        if (!ok) throw new Error("A foto não foi enviada. Confira a internet e toque em Tentar de novo.");
        await mudar(
          (l) => l.map((i) => (i.chave === proxima.chave ? { ...i, estado: "pronta", url: envio.dados.urlPublica, arquivo: undefined } : i)),
          true,
        );
        setAviso("Foto enviada.");
      } catch (e) {
        const msg = e instanceof Error && e.message ? e.message : "Não deu para enviar a foto. Tente de novo.";
        mudar((l) => l.map((i) => (i.chave === proxima.chave ? { ...i, estado: "erro", erro: msg } : i)));
        setAviso(`Uma foto não foi enviada. ${msg}`);
      }
    })();
  }, [itens, id, mudar]);

  // Libera a memória das prévias ao sair da tela.
  useEffect(() => () => itensRef.current.forEach((i) => i.previa && URL.revokeObjectURL(i.previa)), []);

  function escolher(arquivos: FileList | null) {
    setErro(null);
    if (!arquivos?.length) return;
    const lista = Array.from(arquivos).filter((a) => a.type.startsWith("image/") || a.type === "");
    if (!lista.length) {
      setErro("Escolha um arquivo de foto.");
      return;
    }
    const cabe = lista.slice(0, Math.max(0, vagas));
    if (cabe.length < lista.length) setErro(`Cabem só ${maximo} fotos. Enviamos as primeiras ${cabe.length}.`);
    mudar((l) => [...l, ...cabe.map<Item>((arquivo) => ({ chave: novaChave(), estado: "fila", arquivo }))]);
  }

  function tentarDeNovo(chave: string) {
    setErro(null);
    mudar((l) => l.map((i) => (i.chave === chave ? { ...i, estado: "fila", erro: undefined } : i)));
  }

  async function tirar(chave: string) {
    setErro(null);
    const item = itensRef.current.find((i) => i.chave === chave);
    if (!item) return;
    const ok = await mudar((l) => l.filter((i) => i.chave !== chave), item.estado === "pronta");
    if (!ok) {
      mudar((l) => (l.some((i) => i.chave === chave) ? l : [...l, item])); // não salvou: devolve a foto
      return;
    }
    if (item.previa) URL.revokeObjectURL(item.previa);
    if (item.url) void apagarFoto(item.url); // limpa o arquivo do Storage (se falhar, não atrapalha)
    setAviso("Foto tirada.");
  }

  function mover(chave: string, passo: -1 | 1) {
    const l = [...itensRef.current];
    const i = l.findIndex((x) => x.chave === chave);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    mudar(() => l, true);
    setAviso(`Foto movida para a posição ${j + 1}${j === 0 ? ", agora é a capa" : ""}.`);
  }

  async function continuar() {
    setErro(null);
    if (ocupado) {
      setErro("Espere as fotos terminarem de enviar.");
      return;
    }
    if (prontas.length < minimo) {
      setErro(minimo === 1 ? "Coloque pelo menos 1 foto." : `Coloque pelo menos ${minimo} fotos.`);
      return;
    }
    setIndo(true);
    const ok = await salvar(itensRef.current);
    if (!ok) {
      setIndo(false);
      return;
    }
    router.push(urlPasso("categoria", id, editar));
  }

  return (
    <>
      <div className="flex gap-3">
        <button type="button" className={BOTAO_FOTO} onClick={() => camera.current?.click()} disabled={vagas <= 0}>
          <Camera className="size-8" aria-hidden />
          Tirar foto
        </button>
        <button type="button" className={BOTAO_FOTO} onClick={() => galeria.current?.click()} disabled={vagas <= 0}>
          <ImagePlus className="size-8" aria-hidden />
          Escolher da galeria
        </button>
      </div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          escolher(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          escolher(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="text-base text-texto-suave">
        {itens.length} de {maximo} fotos. A primeira é a capa. Dica: foto de dia, com o produto inteiro, vende mais rápido.
      </p>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {aviso}
      </p>
      <AvisoErro mensagem={erro} />

      {itens.length > 0 && (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Fotos do anúncio">
          {itens.map((item, i) => {
            const src = item.previa ?? item.url;
            const nome = `Foto ${i + 1}${i === 0 ? " (capa)" : ""}`;
            return (
              <li key={item.chave} className="flex flex-col gap-1.5 rounded-card bg-cartao p-1.5 shadow-1">
                <div className="relative aspect-square overflow-hidden rounded-campo bg-borda">
                  {src && (
                    // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou foto do Storage
                    <img src={src} alt={nome} className="absolute inset-0 size-full object-cover" />
                  )}
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-beringela px-2 py-0.5 text-[13px] font-bold text-white">Capa</span>
                  )}
                  {(item.estado === "enviando" || item.estado === "fila") && (
                    <span className="absolute inset-0 grid place-items-center bg-beringela/50 text-center text-sm font-semibold text-white">
                      <span className="flex flex-col items-center gap-1">
                        <Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden />
                        {item.estado === "fila" ? "Na fila" : "Enviando..."}
                      </span>
                    </span>
                  )}
                  {item.estado === "erro" && (
                    <span className="absolute inset-0 grid place-items-center bg-cartao/90 p-2">
                      <button
                        type="button"
                        onClick={() => tentarDeNovo(item.chave)}
                        className="inline-flex min-h-12 items-center gap-1.5 rounded-card bg-laranja px-3 text-sm font-bold text-beringela focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
                      >
                        <RotateCw className="size-4" aria-hidden />
                        Tentar de novo
                      </button>
                    </span>
                  )}
                </div>
                {item.erro && <p className="px-1 text-sm font-semibold text-perigo">{item.erro}</p>}
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={BOTAO_MINI}
                    onClick={() => mover(item.chave, -1)}
                    disabled={i === 0}
                    aria-label={`Mover ${nome} para antes`}
                  >
                    <ArrowLeft className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`${BOTAO_MINI} text-perigo`}
                    onClick={() => tirar(item.chave)}
                    disabled={item.estado === "enviando"}
                    aria-label={`Tirar ${nome}`}
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={BOTAO_MINI}
                    onClick={() => mover(item.chave, 1)}
                    disabled={i === itens.length - 1}
                    aria-label={`Mover ${nome} para depois`}
                  >
                    <ArrowRight className="size-5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <BarraContinuar aviso="Seu anúncio fica salvo se a internet cair">
        <Botao larguraTotal onClick={continuar} carregando={indo} textoCarregando="Salvando..." disabled={ocupado}>
          {ocupado ? "Enviando fotos..." : "Continuar"}
        </Botao>
      </BarraContinuar>
    </>
  );
}
