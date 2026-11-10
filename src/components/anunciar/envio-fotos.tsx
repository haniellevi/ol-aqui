"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Loader2, RotateCw, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { reduzirFoto, enviarFoto, MAX_FOTO_ORIGINAL } from "@/lib/fotos";
import { apagarFoto, criarUrlEnvioFoto } from "@/lib/dados/fotos";
import { salvarFotos } from "@/app/(conta)/anunciar/actions";
import { AvisoErro } from "./aviso-erro";
import { BarraContinuar } from "./barra-continuar";
import { DESTINO_SAIR, urlPasso } from "./passos";
import { EVENTO_FOTO_AKI, type FotoGuardadaAki } from "@/components/aki/abrir";

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
  "grid min-h-11 flex-1 place-items-center rounded-campo border border-borda bg-cartao text-beringela hover:bg-fundo active:bg-borda " +
  "disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-laranja-escuro";

let contador = 0;
const novaChave = () => `f${Date.now()}-${contador++}`;

export function EnvioFotos({
  id,
  editar,
  fotosIniciais,
  maximo,
  minimo,
  formId = "form-fotos",
}: {
  id: string;
  editar: boolean;
  fotosIniciais: string[];
  maximo: number;
  minimo: number;
  formId?: string;
}) {
  const router = useRouter();
  const [itens, setItens] = useState<Item[]>(() => fotosIniciais.map((url) => ({ chave: novaChave(), estado: "pronta", url })));
  const [aviso, setAviso] = useState(""); // lido pelo leitor de tela (aria-live)
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const itensRef = useRef(itens);
  itensRef.current = itens;
  const confirmadas = useRef(fotosIniciais);
  const operacao = useRef(false);
  const [salvando, setSalvando] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const prontas = itens.filter((i) => i.estado === "pronta");
  const ocupado = itens.some((i) => i.estado === "enviando" || i.estado === "fila");
  const travado = ocupado || salvando || indo;
  const vagas = maximo - itens.length;

  const mudar = useCallback((fn: (atual: Item[]) => Item[]) => {
    const nova = fn(itensRef.current);
    itensRef.current = nova;
    setItens(nova);
  }, []);

  const salvar = useCallback(async (lista: Item[]) => {
    try {
      const urls = lista.filter((i) => i.estado === "pronta" && i.url).map((i) => i.url as string);
      const resultado = await salvarFotos(id, urls, confirmadas.current);
      if (resultado.ok) confirmadas.current = urls;
      else {
        setErro(resultado.erro.mensagem);
        if (resultado.fotosAtuais) {
          const atuais = resultado.fotosAtuais;
          confirmadas.current = atuais;
          mudar((l) => [
            ...atuais.map<Item>((url) => ({ ...l.find((i) => i.url === url), chave: l.find((i) => i.url === url)?.chave ?? novaChave(), url, estado: "pronta" })),
            ...l.filter((i) => i.estado !== "pronta" && (!i.url || !atuais.includes(i.url))),
          ]);
        }
      }
      return resultado.ok;
    } catch {
      setErro("Não conseguimos confirmar o salvamento das fotos. Confira a conexão e tente de novo.");
      return false;
    }
  }, [id, mudar]);

  // Só confirma uma foto depois de guardar o arquivo E a referência no anúncio.
  // Se apenas o salvamento falha, repetir reaproveita o arquivo que já foi enviado.
  useEffect(() => {
    if (operacao.current) return;
    const proxima = itensRef.current.find((i) => i.estado === "fila");
    if (!proxima) return;
    operacao.current = true;
    setSalvando(true);
    mudar((l) => l.map((i) => i.chave === proxima.chave ? { ...i, estado: "enviando", erro: undefined } : i));
    setAviso("Enviando e salvando a foto...");
    (async () => {
      try {
        let url = proxima.url;
        if (!url) {
          if (!proxima.arquivo) throw new Error("Escolha esta foto novamente.");
          const reduzida = await reduzirFoto(proxima.arquivo);
          if (proxima.previa) URL.revokeObjectURL(proxima.previa);
          const previa = URL.createObjectURL(reduzida.blob);
          mudar((l) => l.map((i) => i.chave === proxima.chave ? { ...i, previa } : i));
          const envio = await criarUrlEnvioFoto(id, reduzida.formato);
          if (!envio.ok) throw new Error(envio.erro.mensagem);
          if (!await enviarFoto(reduzida.blob, envio.dados.urlEnvio)) {
            throw new Error("A foto não foi enviada. Confira a internet e tente de novo.");
          }
          url = envio.dados.urlPublica;
          mudar((l) => l.map((i) => i.chave === proxima.chave ? { ...i, url } : i));
        }
        const pronta: Item = { ...itensRef.current.find((i) => i.chave === proxima.chave)!, estado: "pronta", url, arquivo: undefined };
        const lista = itensRef.current.map((i) => i.chave === proxima.chave ? pronta : i);
        if (!await salvar(lista)) throw new Error("A foto foi enviada, mas falta salvá-la no anúncio. Toque em Tentar de novo.");
        mudar(() => lista);
        setAviso("Foto salva no rascunho.");
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : "Não foi possível salvar esta foto. Tente de novo.";
        mudar((l) => l.map((i) => i.chave === proxima.chave ? { ...i, estado: "erro", erro: mensagem } : i));
        setAviso(mensagem);
      } finally {
        operacao.current = false;
        setSalvando(false);
      }
    })();
  }, [itens, salvando, id, mudar, salvar]);

  // Evita sair sem perceber que ainda há arquivos sem confirmação de salvamento.
  const pendente = travado || itens.some((i) => i.estado === "erro");
  useEffect(() => {
    if (!pendente) return;
    const antesDeSair = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const aoNavegar = (e: MouseEvent) => {
      const link = (e.target as Element)?.closest?.("a[href]");
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      setErro("Antes de sair, espere o envio terminar e tente novamente ou remova as fotos com erro.");
    };
    window.addEventListener("beforeunload", antesDeSair);
    document.addEventListener("click", aoNavegar, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeSair);
      document.removeEventListener("click", aoNavegar, true);
    };
  }, [pendente]);

  // O Aki guardou no rascunho a foto que a pessoa mandou para ele: mostra aqui sem salvar de novo.
  useEffect(() => {
    const ouvir = (e: Event) => {
      const { anuncioId, url } = (e as CustomEvent<FotoGuardadaAki>).detail ?? {};
      if (anuncioId !== id || !url) return;
      if (operacao.current) return; // a comparação no servidor reconcilia o envio em andamento
      confirmadas.current = confirmadas.current.includes(url) ? confirmadas.current : [...confirmadas.current, url];
      mudar((l) => (l.some((i) => i.url === url) ? l : [...l, { chave: novaChave(), estado: "pronta", url }]));
    };
    window.addEventListener(EVENTO_FOTO_AKI, ouvir);
    return () => window.removeEventListener(EVENTO_FOTO_AKI, ouvir);
  }, [id, mudar]);

  // Libera a memória das prévias ao sair da tela.
  useEffect(() => () => itensRef.current.forEach((i) => i.previa && URL.revokeObjectURL(i.previa)), []);

  function escolher(arquivos: FileList | null) {
    if (operacao.current || indo) return;
    setErro(null);
    if (!arquivos?.length) return;
    const lista = Array.from(arquivos).filter((a) => (a.type.startsWith("image/") || a.type === "") && a.size > 0 && a.size <= MAX_FOTO_ORIGINAL);
    const cabe = lista.slice(0, Math.max(0, maximo - itensRef.current.length));
    if (lista.length < arquivos.length) setErro("Alguns arquivos não foram incluídos. Escolha fotos de até 20 MB cada.");
    else if (cabe.length < lista.length) setErro(`Cabem no máximo ${maximo} fotos. Foram incluídas ${cabe.length}.`);
    mudar((l) => [...l, ...cabe.map<Item>((arquivo) => ({ chave: novaChave(), estado: "fila", arquivo }))]);
  }

  function tentarDeNovo(chave: string) {
    if (operacao.current || indo) return;
    setErro(null);
    mudar((l) => l.map((i) => i.chave === chave ? { ...i, estado: "fila", erro: undefined } : i));
  }

  async function alterar(lista: Item[], mensagem: string) {
    if (operacao.current || indo || ocupado) return false;
    operacao.current = true;
    setSalvando(true);
    setErro(null);
    try {
      if (!await salvar(lista)) return false;
      mudar(() => lista);
      setAviso(mensagem);
      return true;
    } finally {
      operacao.current = false;
      setSalvando(false);
    }
  }

  async function tirar(chave: string) {
    const item = itensRef.current.find((i) => i.chave === chave);
    if (!item) return;
    if (!await alterar(itensRef.current.filter((i) => i.chave !== chave), "Foto removida do anúncio.")) return;
    if (item.previa) URL.revokeObjectURL(item.previa);
    if (item.url) void apagarFoto(item.url).catch(() => undefined);
  }

  async function mover(chave: string, passo: -1 | 1) {
    const lista = [...itensRef.current];
    const i = lista.findIndex((x) => x.chave === chave);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    await alterar(lista, `Foto movida para a posição ${j + 1}${j === 0 ? ", agora é a capa" : ""}.`);
  }

  async function continuar(sair: boolean) {
    if (operacao.current || indo) return;
    setErro(null);
    if (ocupado || itens.some((i) => i.estado === "erro")) {
      setErro("Espere o envio terminar. Tente novamente ou remova as fotos com erro antes de continuar.");
      return;
    }
    if (!sair && prontas.length < minimo) {
      setErro(`Coloque pelo menos ${minimo} ${minimo === 1 ? "foto" : "fotos"}.`);
      return;
    }
    operacao.current = true;
    setIndo(true);
    if (!await salvar(itensRef.current)) {
      operacao.current = false;
      setIndo(false);
      return;
    }
    router.push(sair ? DESTINO_SAIR : urlPasso("categoria", id, editar));
  }

  return (
    <form id={formId} action={async (dados) => continuar(dados.get("acao") === "sair")} onSubmit={(e) => {
      e.preventDefault();
      const botao = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      void continuar(botao?.value === "sair");
    }} aria-busy={travado} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <button type="button" className={BOTAO_FOTO} onClick={() => camera.current?.click()} disabled={vagas <= 0 || travado}>
          <Camera className="size-8" aria-hidden />
          Tirar foto
        </button>
        <button type="button" className={BOTAO_FOTO} onClick={() => galeria.current?.click()} disabled={vagas <= 0 || travado}>
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
        {itens.length} de {maximo} fotos. A primeira é a capa. Use fotos nítidas, de até 20 MB cada. Você pode mudar a ordem abaixo.
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
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-beringela px-2 py-0.5 text-legenda font-bold text-white">Capa</span>
                  )}
                  {(item.estado === "enviando" || item.estado === "fila") && (
                    <span className="absolute inset-0 grid place-items-center bg-beringela/70 text-center text-sm font-semibold text-white">
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
                        disabled={travado}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-card border-2 border-beringela bg-cartao px-3 text-sm font-semibold text-beringela hover:bg-fundo active:bg-borda focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
                      >
                        <RotateCw className="size-4" aria-hidden />
                        Tentar de novo
                      </button>
                    </span>
                  )}
                </div>
                {item.erro && <p className="px-1 text-sm font-semibold text-perigo">{item.erro}</p>}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    className={BOTAO_MINI}
                    onClick={() => mover(item.chave, -1)}
                    disabled={i === 0 || travado || item.estado !== "pronta"}
                    aria-label={`Mover ${nome} para antes`}
                  >
                    <ArrowLeft className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={BOTAO_MINI}
                    onClick={() => mover(item.chave, 1)}
                    disabled={i === itens.length - 1 || travado || item.estado !== "pronta"}
                    aria-label={`Mover ${nome} para depois`}
                  >
                    <ArrowRight className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`${BOTAO_MINI} col-span-2 flex items-center justify-center gap-1 text-perigo`}
                    onClick={() => tirar(item.chave)}
                    disabled={travado}
                    aria-label={`Tirar ${nome}`}
                  >
                    <X className="size-5" aria-hidden /> Remover
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <BarraContinuar aviso="Fotos confirmadas ficam salvas no seu rascunho.">
        <Botao type="submit" name="acao" value="seguir" larguraTotal carregando={indo} textoCarregando="Salvando..." disabled={travado}>
          {ocupado ? "Enviando fotos..." : "Continuar"}
        </Botao>
      </BarraContinuar>
    </form>
  );
}
