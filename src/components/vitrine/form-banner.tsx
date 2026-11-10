"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, Save } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Aviso } from "@/components/conta/aviso";
import { BannerLoja } from "@/components/vitrine/banner-loja";
import { UpsellPlano } from "@/components/vitrine/upsell-plano";
import { abrirFoto, areaDoCorte, cortarBanner, type FotoAberta } from "@/components/vitrine/cortar-banner";
import { enviarFoto } from "@/lib/fotos";
import {
  descartarFotoBanner,
  prepararEnvioBanner,
  salvarBanner,
  type EstadoVitrine,
} from "@/app/(conta)/minha-conta/loja/vitrine-actions";
import { BANNER_MODELOS, type BannerModelo, type BannerTipo } from "@/lib/tipos-vitrine";

// Banner da vitrine: foto da fachada (cortada aqui no aparelho no tamanho do banner) ou modelo
// pronto (cor + desenho + logo + nome). A prévia mostra como fica antes de salvar.

const NOME_MODELO: Record<BannerModelo, string> = { liso: "Liso", listras: "Listras", pontos: "Pontinhos" };

export function FormBanner({
  inicial,
  nome,
  logo,
  cores,
  podeFoto,
  disponivelFoto,
}: {
  inicial: { tipo: BannerTipo; url: string | null; modelo: BannerModelo; cor: string };
  nome: string;
  logo: string | null;
  cores: string[];
  podeFoto: boolean;
  /** "Disponível no Slim e no Full" (da tabela de planos). */
  disponivelFoto: string | null;
}) {
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
  const [estado, acao, salvando] = useActionState<EstadoVitrine, FormData>(async (anterior, form) => {
    setMostrarSucesso(true);
    try {
      return await salvarBanner(anterior, form);
    } catch {
      return { erro: "Confira a conexão e tente salvar a capa de novo." };
    }
  }, null);
  const [tipo, setTipo] = useState<BannerTipo>(podeFoto ? inicial.tipo : "modelo");
  const [url, setUrl] = useState(inicial.url ?? "");
  const [modelo, setModelo] = useState<BannerModelo>(inicial.modelo);
  const corInicial = inicial.cor.toUpperCase();
  const listaCores = cores.includes(corInicial) || !corInicial ? cores : [corInicial, ...cores];
  const [cor, setCor] = useState(corInicial || listaCores[0] || "#4B1248");

  const entrada = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<FotoAberta | null>(null);
  const [posicao, setPosicao] = useState(0.5);
  const [enviando, setEnviando] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const emCurso = useRef(false);
  const pendente = useRef<string | null>(null); // foto enviada e ainda não salva

  useEffect(() => () => foto?.liberar(), [foto]);
  useEffect(() => {
    if (estado?.ok) pendente.current = null;
  }, [estado]);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo || salvando || emCurso.current) return;
    emCurso.current = true;
    setEnviando(true);
    setErroFoto(null);
    try {
      const aberta = await abrirFoto(arquivo);
      setFoto(aberta);
      setPosicao(0.5);
    } catch (e) {
      setErroFoto(e instanceof Error ? e.message : "Essa foto não abriu. Tente outra.");
    } finally {
      emCurso.current = false;
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function usarFoto() {
    if (!foto || salvando || emCurso.current) return;
    emCurso.current = true;
    setErroFoto(null);
    setEnviando(true);
    try {
      const cortada = await cortarBanner(foto, posicao);
      const envio = await prepararEnvioBanner(cortada.formato);
      if (!envio.ok) throw new Error(envio.erro.mensagem);
      const foi = await enviarFoto(cortada.blob, envio.dados.urlEnvio);
      if (!foi) throw new Error("Não deu para enviar a foto. Confira a internet e tente de novo.");
      if (pendente.current) void descartarFotoBanner(pendente.current).catch(() => undefined);
      pendente.current = envio.dados.urlPublica;
      setUrl(envio.dados.urlPublica);
      setTipo("foto");
      setFoto(null);
    } catch (e) {
      setErroFoto(e instanceof Error && e.message ? e.message : "Não deu para usar esta foto. Tente outra.");
    } finally {
      emCurso.current = false;
      setEnviando(false);
    }
  }

  const area = foto ? areaDoCorte(foto.largura, foto.altura, posicao) : null;
  const ocupado = enviando || salvando;
  const erroCampo = estado?.campos?.banner ?? estado?.campos?.banner_cor;

  return (
    <form
      action={acao}
      onReset={(e) => e.preventDefault()}
      onChangeCapture={() => setMostrarSucesso(false)}
      onClickCapture={(e) => { if ((e.target as HTMLElement).closest('button[type="button"]')) setMostrarSucesso(false); }}
      className="flex flex-col gap-5" noValidate
    >
      <input type="hidden" name="banner_tipo" value={tipo} />
      {/* a foto fica guardada mesmo com o modelo escolhido (plano menor não apaga nada) */}
      <input type="hidden" name="banner_url" value={url} />
      <input type="hidden" name="banner_cor" value={cor} />
      <input type="hidden" name="banner_modelo" value={modelo} />

      <div aria-live="polite">
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {mostrarSucesso && !salvando && estado?.ok && <Aviso tipo="ok">Capa da loja salva.</Aviso>}
      </div>

      <section aria-labelledby="titulo-previa" className="flex flex-col gap-2">
        <h2 id="titulo-previa" className="text-base font-semibold">
          Como fica
        </h2>
        <div className="overflow-hidden rounded-card shadow-1">
          <BannerLoja tipo={tipo} url={url || null} modelo={modelo} cor={cor} nome={nome} logo={logo} />
        </div>
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-semibold">Tipo de capa</legend>
        <div className="flex flex-wrap gap-2">
          <Chip ativo={tipo === "modelo"} onClick={() => setTipo("modelo")} disabled={ocupado}>
            Modelo pronto
          </Chip>
          <Chip ativo={tipo === "foto"} onClick={() => setTipo("foto")} disabled={ocupado}>
            Foto da fachada
          </Chip>
        </div>
      </fieldset>

      {tipo === "modelo" && (
        <section aria-label="Modelo pronto" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-semibold">Cor</legend>
            <div className="flex flex-wrap gap-3">
              {listaCores.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  aria-pressed={cor === c}
                  aria-label={`Cor ${c}`}
                  disabled={ocupado}
                  className={`grid size-12 place-items-center rounded-full border-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro ${
                    cor === c ? "border-laranja-escuro" : "border-cartao ring-1 ring-borda"
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {cor === c && <Check className="size-5 rounded-full bg-cartao p-0.5 text-beringela" aria-hidden />}
                </button>
              ))}
            </div>
            {estado?.campos?.banner_cor && (
              <p role="alert" className="text-sm font-semibold text-perigo">
                {estado.campos.banner_cor}
              </p>
            )}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-semibold">Desenho</legend>
            <div className="flex flex-wrap gap-2">
              {BANNER_MODELOS.map((m) => (
                <Chip key={m} ativo={modelo === m} onClick={() => setModelo(m)} disabled={ocupado}>
                  {NOME_MODELO[m]}
                </Chip>
              ))}
            </div>
          </fieldset>
          <p className="text-sm text-texto-suave">O banner modelo usa o nome e a logo da loja.</p>
        </section>
      )}

      {tipo === "foto" && !podeFoto && (
        <UpsellPlano
          titulo="Foto da fachada no banner"
          texto="Mostre a frente da sua loja de verdade no topo da vitrine."
          disponivel={disponivelFoto}
        />
      )}

      {tipo === "foto" && podeFoto && (
        <section aria-label="Foto da fachada" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
          {foto && area ? (
            <>
              <p className="text-base font-semibold">Escolha a parte da foto que aparece</p>
              <div className="relative aspect-[3/1] w-full overflow-hidden rounded-campo bg-borda">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local do corte */}
                <img
                  src={foto.url}
                  alt="Prévia do corte da foto"
                  className="absolute inset-0 size-full object-cover"
                  style={{ objectPosition: area.eixo === "x" ? `${posicao * 100}% 50%` : `50% ${posicao * 100}%` }}
                />
                {enviando && (
                  <span className="absolute inset-0 grid place-items-center bg-cartao/70">
                    <Loader2 className="size-7 animate-spin text-beringela motion-reduce:animate-none" aria-hidden />
                  </span>
                )}
              </div>
              <label className="flex flex-col gap-1 text-base font-semibold">
                {area.eixo === "x" ? "Mover para os lados" : "Mover para cima ou para baixo"}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(posicao * 100)}
                  onChange={(e) => setPosicao(Number(e.target.value) / 100)}
                  disabled={enviando}
                  className="h-11 w-full accent-laranja-escuro"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Botao variante="secundario" icone={<Check />} carregando={enviando} textoCarregando="Enviando..." onClick={usarFoto}>
                  Usar esta parte
                </Botao>
                <Botao variante="texto" disabled={enviando} onClick={() => setFoto(null)}>
                  Escolher outra
                </Botao>
              </div>
            </>
          ) : (
            <>
              <p className="text-base text-texto-suave">
                Escolha uma foto de até 20 MB. Ajuste o corte para destacar a fachada ou a identidade da loja.
              </p>
              <input
                ref={entrada}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-label="Escolher foto da fachada"
                onChange={(e) => escolher(e.target.files?.[0])}
              />
              <Botao variante="secundario" icone={<Camera />} disabled={ocupado} onClick={() => entrada.current?.click()} className="sm:w-fit">
                {url ? "Trocar foto" : "Escolher foto"}
              </Botao>
            </>
          )}
          <div aria-live="polite">
            {(erroFoto ?? erroCampo) && (
              <p role="alert" className="text-sm font-semibold text-perigo">
                {erroFoto ?? erroCampo}
              </p>
            )}
          </div>
          <p className="text-sm text-texto-suave">A foto passa pelas mesmas regras das fotos dos anúncios. Foto fora das regras é tirada pela equipe.</p>
        </section>
      )}

      {estado?.erro && <p role="alert" className="text-sm font-semibold text-perigo">{estado.erro}</p>}
      <p className="text-sm text-texto-suave">A capa só muda na vitrine depois de salvar. Escolher um modelo mantém sua foto guardada.</p>
      <Botao
        type="submit"
        larguraTotal
        icone={<Save />}
        carregando={salvando}
        textoCarregando="Salvando..."
        disabled={enviando || !!foto || (tipo === "foto" && (!podeFoto || !url))}
      >
        Salvar capa
      </Botao>
    </form>
  );
}
