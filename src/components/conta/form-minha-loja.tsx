"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { avisoComoVaiAparecer } from "@/lib/formatar-nome";
import { useCampoTelefone } from "@/components/ui/use-campo-telefone";
import { reduzirFoto, enviarFoto } from "@/lib/fotos";
import { prepararEnvioImagemLoja, salvarLoja, descartarLogo, type EstadoLojaConta } from "@/app/(conta)/minha-conta/loja/actions";
import { Seletor } from "./seletor";
import { Aviso } from "./aviso";

// T38 · Minha loja: dados da vitrine + logo (reduzida no aparelho antes de enviar).
// Banner, "Sobre nós", horários e as outras informações têm telas próprias (vitrine completa).

export type DadosLoja = {
  nome: string;
  whatsapp: string | null;
  cidade: string;
  bairro: string | null;
  logo_url: string | null;
};

/** `ajudante` (P5b-2b): nome e WhatsApp aparecem só para leitura, porque só o dono muda. */
export function FormMinhaLoja({ loja, cidades, ajudante = false }: { loja: DadosLoja; cidades: { nome: string; uf: string }[]; ajudante?: boolean }) {
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
  const [estado, acao, enviando] = useActionState<EstadoLojaConta, FormData>(async (anterior, form) => {
    setMostrarSucesso(true);
    try {
      return await salvarLoja(anterior, form);
    } catch {
      return { erro: "Confira a conexão e tente salvar de novo. Seus dados continuam preenchidos." };
    }
  }, null);
  const [nome, setNome] = useState(loja.nome);
  const [cidade, setCidade] = useState(loja.cidade);
  const [bairro, setBairro] = useState(loja.bairro ?? "");
  const pendente = useRef<string | null>(null);
  useEffect(() => { if (estado?.ok) pendente.current = null; }, [estado]);
  function mudarLogo(url: string) {
    if (pendente.current && pendente.current !== url) void descartarLogo(pendente.current).catch(() => undefined);
    pendente.current = url || null;
    setLogo(url);
  }
  const fone = useCampoTelefone(loja.whatsapp ?? "", { aceitaFixo: true });
  const [logo, setLogo] = useState(loja.logo_url ?? "");
  const [subindo, setSubindo] = useState<"logo" | null>(null);
  const campos = estado?.campos ?? {};
  const cidadeFora = loja.cidade && !cidades.some((c) => c.nome === loja.cidade);

  return (
    <form
      action={acao}
      onReset={(e) => e.preventDefault()}
      onChangeCapture={() => setMostrarSucesso(false)}
      onClickCapture={(e) => { if ((e.target as HTMLElement).closest('button[type="button"]')) setMostrarSucesso(false); }}
      className="flex flex-col gap-5" noValidate
    >
      <div aria-live="polite">
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {mostrarSucesso && !enviando && estado?.ok && <Aviso tipo="ok">Dados da loja salvos.</Aviso>}
      </div>

      <fieldset disabled={enviando || subindo !== null} className="flex min-w-0 flex-col gap-5">
      <section aria-label="Logo" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        <EnvioImagem
          qual="logo"
          rotulo="Logo"
          dica="Use uma imagem quadrada de até 20 MB. A troca ou remoção só aparece na vitrine depois de salvar."
          url={logo}
          aoMudar={mudarLogo}
          ocupado={enviando || subindo !== null}
          aoSubir={setSubindo}
          erro={campos.logo_url}
        />
        <input type="hidden" name="logo_url" value={logo} />
      </section>

      <section aria-label="Dados da loja" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        {ajudante ? (
          <p className="text-base break-words">
            <strong>{loja.nome}</strong>
            {loja.whatsapp && <span className="block text-texto-suave">WhatsApp: {fone.campo.value}</span>}
            <span className="block text-sm text-texto-suave">Só o dono da loja muda o nome e o WhatsApp.</span>
          </p>
        ) : (
          <>
            <Campo rotulo="Nome da loja" name="nome" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} maxLength={80} erro={campos.nome} dica={avisoComoVaiAparecer(nome)} />
            <Campo
              rotulo="WhatsApp da loja"
              name="whatsapp"
              {...fone.campo}
              dica="Se deixar vazio, a vitrine usa o WhatsApp confirmado da sua conta. Um número comercial diferente só aparece após conferência da equipe. Até lá, a vitrine usa o número confirmado."
              erro={fone.erro ?? campos.whatsapp}
            />
          </>
        )}
        {cidades.length > 0 ? (
          <Seletor rotulo="Cidade" name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} erro={campos.cidade}>
            {cidadeFora && <option value={loja.cidade}>{loja.cidade}</option>}
            {cidades.map((c) => (
              <option key={`${c.nome}-${c.uf}`} value={c.nome}>
                {c.nome} - {c.uf}
              </option>
            ))}
          </Seletor>
        ) : (
          <Campo rotulo="Cidade" name="cidade" value={cidade} readOnly dica="A lista de cidades está indisponível. Sua cidade atual será mantida." erro={campos.cidade} />
        )}
        <Campo rotulo="Bairro" name="bairro" opcional value={bairro} onChange={(e) => setBairro(e.target.value)} maxLength={80} erro={campos.bairro} />
      </section>

      </fieldset>
      {estado?.erro && <p role="alert" className="text-sm font-semibold text-perigo">{estado.erro}</p>}
      <Botao type="submit" larguraTotal icone={<Save />} carregando={enviando} textoCarregando="Salvando..." disabled={subindo !== null}>
        Salvar loja
      </Botao>
    </form>
  );
}

function EnvioImagem({
  qual,
  rotulo,
  dica,
  url,
  aoMudar,
  ocupado,
  aoSubir,
  erro: erroServidor,
}: {
  qual: "logo";
  rotulo: string;
  dica: string;
  url: string;
  aoMudar: (u: string) => void;
  ocupado: boolean;
  aoSubir: (q: "logo" | null) => void;
  erro?: string;
}) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const emCurso = useRef(false);
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mensagem = erro ?? erroServidor ?? null;

  async function escolher(arquivo: File | undefined) {
    if (!arquivo || ocupado || emCurso.current) return;
    emCurso.current = true;
    setErro(null);
    setSubindo(true);
    aoSubir(qual);
    try {
      const foto = await reduzirFoto(arquivo, { ladoMaximo: 600 });
      const envio = await prepararEnvioImagemLoja(qual, foto.formato);
      if (!envio.ok) throw new Error(envio.erro.mensagem);
      const foi = await enviarFoto(foto.blob, envio.dados.urlEnvio);
      if (!foi) throw new Error("Não deu para enviar a imagem. Confira a internet e tente de novo.");
      aoMudar(envio.dados.urlPublica);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não deu para usar esta imagem. Tente outra.");
    } finally {
      emCurso.current = false;
      setSubindo(false);
      aoSubir(null);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-rotulo`} className="text-base font-semibold">
        {rotulo} <span className="font-normal text-texto-suave">(opcional)</span>
      </span>
      <div
        className="relative size-24 overflow-hidden rounded-full border-2 border-dashed border-borda bg-fundo"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia da imagem enviada ao Storage
          <img src={url} alt={`${rotulo} atual`} className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-texto-suave">
            <ImagePlus className="size-7" aria-hidden />
          </span>
        )}
        {subindo && (
          <span className="absolute inset-0 grid place-items-center bg-cartao/70">
            <Loader2 className="size-7 animate-spin text-beringela motion-reduce:animate-none" aria-hidden />
          </span>
        )}
      </div>
      <p id={`${id}-dica`} className="text-sm text-texto-suave">
        {dica}
      </p>
      <input
        ref={entrada}
        id={`${id}-arquivo`}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-labelledby={`${id}-rotulo`}
        aria-describedby={`${id}-dica`}
        onChange={(e) => escolher(e.target.files?.[0])}
        tabIndex={-1}
      />
      <div className="flex flex-wrap gap-2">
        <Botao
          variante="secundario"
          icone={<ImagePlus />}
          carregando={subindo}
          textoCarregando="Enviando..."
          disabled={ocupado}
          onClick={() => entrada.current?.click()}
        >
          {url ? `Trocar ${qual}` : `Pôr ${qual}`}
        </Botao>
        {url && !subindo && (
          <Botao variante="texto" icone={<Trash2 />} disabled={ocupado} onClick={() => aoMudar("")}>
            Remover logo
          </Botao>
        )}
      </div>
      <div aria-live="polite">
        {mensagem && (
          <p role="alert" className="text-sm font-semibold text-perigo">
            {mensagem}
          </p>
        )}
      </div>
    </div>
  );
}
