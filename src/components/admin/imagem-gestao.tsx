"use client";

import { useState } from "react";
import { prepararFotoGestao } from "@/app/admin/imagens-actions";
import { enviarFoto, reduzirFoto } from "@/lib/fotos";
import { CampoArquivo } from "@/components/ui/campo-arquivo";
import { Aviso, estiloCampo } from "./ui";

export function ImagemGestao({ tipo, id, campo, rotulo, valor, onEnvio }: {
  tipo: "usuario" | "loja"; id?: string; campo: string; rotulo: string; valor?: string | null;
  onEnvio: (enviando: boolean) => void;
}) {
  const [url, setUrl] = useState(valor ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  return <div className="space-y-2">
    <label className="block text-sm font-semibold">{rotulo}
      <input name={campo} type="url" maxLength={500} value={url} onChange={e => setUrl(e.target.value)} className={estiloCampo} placeholder="URL HTTPS ou envie uma foto" />
    </label>
    {id ? <CampoArquivo
      rotulo="Enviar foto do computador" accept="image/jpeg,image/png,image/webp" disabled={enviando}
      textoBotao="Escolher foto" textoTrocar="Trocar foto" nome={nomeArquivo}
      onEscolher={async (arquivo) => {
        if (enviando) return;
        setErro(""); setEnviando(true); onEnvio(true);
        try {
          const foto = await reduzirFoto(arquivo);
          const envio = await prepararFotoGestao(tipo, id, campo, foto.formato);
          if (envio.erro || !envio.urlEnvio || !envio.urlPublica) throw new Error(envio.erro || "Não foi possível preparar a foto.");
          if (!(await enviarFoto(foto.blob, envio.urlEnvio))) throw new Error("O envio falhou. Tente novamente.");
          setUrl(envio.urlPublica);
          setNomeArquivo(arquivo.name);
        } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto."); }
        finally { setEnviando(false); onEnvio(false); }
      }} /> : <p className="text-sm text-texto-suave">Crie a loja para enviar fotos do computador.</p>}
    {url && /^https:\/\//.test(url) && (
      // eslint-disable-next-line @next/next/no-img-element -- prévia de imagem selecionada pelo administrador
      <img src={url} alt={`Prévia: ${rotulo}`} width={160} height={90} className="max-h-24 rounded-campo object-contain" />
    )}
    {erro && <Aviso tipo="erro">{erro}</Aviso>}
  </div>;
}
