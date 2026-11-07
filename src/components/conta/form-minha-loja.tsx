"use client";

import { useActionState, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { reduzirFoto, enviarFoto } from "@/lib/fotos";
import { prepararEnvioImagemLoja, salvarLoja, type EstadoLojaConta } from "@/app/(conta)/minha-conta/loja/actions";
import { Seletor } from "./seletor";
import { Aviso } from "./aviso";

// T38 · Minha loja: dados da vitrine + logo e capa (reduzidas no aparelho antes de enviar).

/** "5589999990000" ou "89999990000" → "(89) 99999-0000" enquanto digita. */
function mascaraFone(t: string): string {
  let d = t.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export type DadosLoja = {
  nome: string;
  descricao: string | null;
  whatsapp: string | null;
  cidade: string;
  bairro: string | null;
  logo_url: string | null;
  capa_url: string | null;
};

export function FormMinhaLoja({ loja, cidades }: { loja: DadosLoja; cidades: { nome: string; uf: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoLojaConta, FormData>(salvarLoja, null);
  const [fone, setFone] = useState(mascaraFone(loja.whatsapp ?? ""));
  const [descricao, setDescricao] = useState(loja.descricao ?? "");
  const [logo, setLogo] = useState(loja.logo_url ?? "");
  const [capa, setCapa] = useState(loja.capa_url ?? "");
  const [subindo, setSubindo] = useState<"logo" | "capa" | null>(null);
  const campos = estado?.campos ?? {};
  const cidadeFora = loja.cidade && !cidades.some((c) => c.nome === loja.cidade);

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      <div aria-live="polite">
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tipo="ok">Loja salva. Sua vitrine já mostra as mudanças.</Aviso>}
      </div>

      <section aria-label="Capa e logo" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        <EnvioImagem
          qual="capa"
          rotulo="Capa da loja"
          dica="Foto larga da fachada ou dos produtos."
          url={capa}
          aoMudar={setCapa}
          ocupado={subindo !== null}
          aoSubir={setSubindo}
          erro={campos.capa_url}
        />
        <EnvioImagem
          qual="logo"
          rotulo="Logo"
          dica="Imagem quadrada fica melhor."
          url={logo}
          aoMudar={setLogo}
          ocupado={subindo !== null}
          aoSubir={setSubindo}
          erro={campos.logo_url}
        />
        <input type="hidden" name="logo_url" value={logo} />
        <input type="hidden" name="capa_url" value={capa} />
      </section>

      <section aria-label="Dados da loja" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        <Campo rotulo="Nome da loja" name="nome" defaultValue={loja.nome} required minLength={2} maxLength={80} erro={campos.nome} />
        <Campo
          rotulo="Sobre a loja"
          name="descricao"
          multilinha
          opcional
          maxLength={600}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          dica={`${descricao.length} de 600 letras. Conte o que vende, horário e entrega.`}
          erro={campos.descricao}
        />
        <Campo
          rotulo="WhatsApp da loja"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(89) 99999-0000"
          value={fone}
          onChange={(e) => setFone(mascaraFone(e.target.value))}
          dica="É para este número que os clientes vão chamar."
          erro={campos.whatsapp}
        />
        {cidades.length > 0 ? (
          <Seletor rotulo="Cidade" name="cidade" defaultValue={loja.cidade} erro={campos.cidade}>
            {cidadeFora && <option value={loja.cidade}>{loja.cidade}</option>}
            {cidades.map((c) => (
              <option key={`${c.nome}-${c.uf}`} value={c.nome}>
                {c.nome} - {c.uf}
              </option>
            ))}
          </Seletor>
        ) : (
          <Campo rotulo="Cidade" name="cidade" defaultValue={loja.cidade} erro={campos.cidade} />
        )}
        <Campo rotulo="Bairro ou endereço" name="bairro" opcional defaultValue={loja.bairro ?? ""} maxLength={80} erro={campos.bairro} />
      </section>

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
  qual: "logo" | "capa";
  rotulo: string;
  dica: string;
  url: string;
  aoMudar: (u: string) => void;
  ocupado: boolean;
  aoSubir: (q: "logo" | "capa" | null) => void;
  erro?: string;
}) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mensagem = erro ?? erroServidor ?? null;

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setSubindo(true);
    aoSubir(qual);
    try {
      const foto = await reduzirFoto(arquivo, { ladoMaximo: qual === "logo" ? 600 : 1600 });
      const envio = await prepararEnvioImagemLoja(qual, foto.formato);
      if (!envio.ok) throw new Error(envio.erro.mensagem);
      const foi = await enviarFoto(foto.blob, envio.dados.urlEnvio);
      if (!foi) throw new Error("Não deu para enviar a imagem. Confira a internet e tente de novo.");
      aoMudar(envio.dados.urlPublica);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não deu para usar esta imagem. Tente outra.");
    } finally {
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
        className={`relative overflow-hidden bg-fundo ${qual === "capa" ? "aspect-[3/1] w-full rounded-card" : "size-24 rounded-full"} border-2 border-dashed border-borda`}
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
            Tirar
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
