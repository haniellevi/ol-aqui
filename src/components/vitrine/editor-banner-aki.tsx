"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { CampoArquivo } from "@/components/ui/campo-arquivo";
import { BannerLoja } from "@/components/vitrine/banner-loja";
import { TextoSaldoAki, useImagemAki } from "@/components/aki/imagem-aki";
import { aplicarBannerAki } from "@/app/(conta)/minha-conta/loja/vitrine-actions";
import { prepararEnvioImagemLoja } from "@/app/(conta)/minha-conta/loja/actions";
import { enviarFoto } from "@/lib/fotos";
import { corDaLogo } from "@/lib/cor-logo";

export function EditorBannerAki({
  lojaId, nome, logo, corInicial, atual,
}: {
  lojaId: string;
  nome: string;
  logo: string | null;
  corInicial: string;
  atual: { url: string; posicao: number } | null;
}) {
  const router = useRouter();
  const aki = useImagemAki(`aki:banner:${lojaId}`, "tipo=banner");
  const [estilo, setEstilo] = useState("");
  const [cor, setCor] = useState(/^#[0-9a-f]{6}$/i.test(corInicial) ? corInicial : "#4b1248");
  const [posicao, setPosicao] = useState(atual?.posicao ?? 50);
  const [arquivo, setArquivo] = useState<{ blob: Blob; formato: "webp" | "jpg" | "png"; previa: string } | null>(null);
  const [logoEnviada, setLogoEnviada] = useState<string | null>(null);
  const [corVeioDaLogo, setCorVeioDaLogo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [preparandoLogo, setPreparandoLogo] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const arte = aki.imagem?.url ?? atual?.url ?? null;
  const geracaoId = aki.imagem?.id ?? atual?.url.match(/\/aki-([a-f0-9-]{36})\.webp$/)?.[1];
  const ocupado = salvando || aki.ocupado || preparandoLogo;

  useEffect(() => () => { if (arquivo) URL.revokeObjectURL(arquivo.previa); }, [arquivo]);

  async function escolherLogo(novo: File | undefined) {
    if (!novo) return;
    setErro("");
    setMensagem("");
    const formato = novo.type === "image/png" ? "png" : novo.type === "image/webp" ? "webp" : novo.type === "image/jpeg" ? "jpg" : null;
    if (!formato || !novo.size || novo.size > 5 * 1024 * 1024) {
      setErro("Escolha um logo PNG, WebP ou JPEG de até 5 MB.");
      return;
    }
    setPreparandoLogo(true);
    const previa = URL.createObjectURL(novo);
    try {
      const imagem = new Image();
      imagem.src = previa;
      await imagem.decode();
      setArquivo({ blob: novo, formato, previa });
      setLogoEnviada(null);
      // A cor da arte nasce da logo; a pessoa pode trocar em seguida.
      const daLogo = await corDaLogo(previa).catch(() => null);
      if (daLogo) { setCor(daLogo); setCorVeioDaLogo(true); }
    } catch {
      URL.revokeObjectURL(previa);
      setErro("Não foi possível abrir esse logo. Escolha outra imagem.");
    } finally {
      setPreparandoLogo(false);
    }
  }

  async function salvar() {
    if (!geracaoId || ocupado) return;
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      let url = logoEnviada;
      if (arquivo && !url) {
        const envio = await prepararEnvioImagemLoja("logo", arquivo.formato);
        if (!envio.ok) throw new Error(envio.erro.mensagem);
        if (!await enviarFoto(arquivo.blob, envio.dados.urlEnvio)) throw new Error("Não deu para enviar o logo. Tente de novo.");
        url = envio.dados.urlPublica;
        setLogoEnviada(url);
      }
      const resultado = await aplicarBannerAki(geracaoId, posicao, url);
      if (!resultado.ok) throw new Error(resultado.erro.mensagem);
      setMensagem("Banner do Merc salvo na loja.");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar o banner. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section aria-labelledby="banner-aki-titulo" className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
      <h2 id="banner-aki-titulo" className="text-lg font-semibold text-beringela">Criar banner com o Merc</h2>
      <TextoSaldoAki saldo={aki.saldo} />
      <Campo name="estilo_aki" rotulo="Pedido extra para o Merc" opcional placeholder="Ex.: mais alegre, com cara de feira"
        value={estilo} onChange={(e) => setEstilo(e.target.value)} maxLength={400} disabled={ocupado || aki.pendente} />
      <CampoArquivo
        rotulo="Logo da loja" opcional accept="image/png,image/webp,image/jpeg" disabled={ocupado}
        textoBotao="Escolher logo" textoTrocar="Trocar logo" textoRemover={logo ? "Voltar ao logo atual" : "Tirar o logo"}
        nome={arquivo ? (arquivo.blob as File).name || "logo escolhido" : logo ? "logo atual da loja" : null}
        previa={arquivo?.previa ?? logo}
        dica="PNG, WebP ou JPEG, até 5 MB."
        onEscolher={(f) => { void escolherLogo(f); }}
        onRemover={arquivo ? () => { setArquivo(null); setLogoEnviada(null); } : undefined} />
      <label className="flex items-center gap-3 font-semibold">
        <input type="color" value={cor} onChange={(e) => { setCor(e.target.value); setCorVeioDaLogo(false); }}
          disabled={ocupado || aki.pendente} className="size-12 rounded-campo" />
        <span className="flex flex-col">Cor da arte
          <span className="text-sm font-normal text-texto-suave">{corVeioDaLogo ? `Tirada da sua logo (${cor}). Pode mudar.` : cor}</span>
        </span>
      </label>
      <Botao type="button" variante="secundario"
        disabled={ocupado || (!aki.pendente && (aki.saldo?.disponivel === false || aki.saldo?.restantes === 0))}
        carregando={aki.ocupado} textoCarregando="O Merc está criando a arte..."
        onClick={() => { setMensagem(""); void aki.gerar({ tipo: "banner", id: crypto.randomUUID(), estilo, cor }); }}>
        {aki.pendente ? "Conferir pedido" : arte ? "Criar outra arte · usa 1 crédito" : "Gerar banner · usa 1 crédito"}
      </Botao>
      {(erro || aki.erro) && <p role="alert" className="text-sm text-perigo">{erro || aki.erro}</p>}
      {arte && (
        <>
          <div className="overflow-hidden rounded-campo">
            <BannerLoja tipo="foto" url={arte} modelo="liso" cor={cor} nome={nome} logo={arquivo?.previa ?? logo} posicaoAki={posicao} />
          </div>
          {(arquivo || logo) && (
            <label className="flex flex-col gap-1 font-semibold">
              Posição horizontal do logo
              <input type="range" min={0} max={100} value={posicao} disabled={ocupado} onChange={(e) => setPosicao(Number(e.target.value))}
                className="h-12 w-full accent-laranja-escuro" />
            </label>
          )}
          <Botao type="button" disabled={ocupado || !geracaoId} carregando={salvando} textoCarregando="Salvando..."
            onClick={salvar}>Salvar banner na loja</Botao>
        </>
      )}
      {mensagem && <p role="status" className="text-sm text-verde-escuro">{mensagem}</p>}
    </section>
  );
}
