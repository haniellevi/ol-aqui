"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Camera, Trash2, UserRound } from "lucide-react";
import { reduzirFoto } from "@/lib/fotos";
import { Botao } from "@/components/ui/botao";
import { atualizarPerfilClerk } from "@/app/(conta)/minha-conta/dados/actions";
import { Aviso } from "./aviso";

export function FotoPerfil({ foto }: { foto: string | null }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const arquivo = useRef<HTMLInputElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const trava = useRef(false);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pendente, setPendente] = useState<Blob | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [faltaSincronizar, setFaltaSincronizar] = useState(false);
  useEffect(() => {
    if (!pendente) { setPrevia(null); return; }
    const url = URL.createObjectURL(pendente);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [pendente]);
  const atual = user ? (user.hasImage ? user.imageUrl : null) : foto;
  const ocupada = preparando || enviando;

  async function sincronizar() {
    await user?.reload();
    const r = await atualizarPerfilClerk();
    if (!r?.ok) throw new Error("Sua foto foi alterada na conta, mas falta atualizar o Mercado da Região. Toque em Atualizar foto no site.");
    setFaltaSincronizar(false);
    setOk(true);
    if (r.whatsappVinculado) router.push("/confirmar-celular?aviso=numero_vinculado");
    router.refresh();
  }
  async function salvar(remover = false) {
    if (!user || trava.current || (!remover && !pendente && !faltaSincronizar)) return;
    trava.current = true;
    setEnviando(true); setErro(null); setOk(false);
    let alterou = faltaSincronizar;
    try {
      if (!faltaSincronizar || remover || pendente) {
        await user.setProfileImage({ file: remover ? null : pendente });
        alterou = true;
        setFaltaSincronizar(true);
        setPendente(null);
      }
      dialogo.current?.close();
      await sincronizar();
    } catch {
      setErro(alterou ? "Sua foto foi alterada na conta, mas falta atualizar o Mercado da Região. Toque em Atualizar foto no site."
        : "Não conseguimos salvar a foto. Tente novamente; a prévia foi mantida.");
    } finally { setEnviando(false); trava.current = false; }
  }
  return (
    <section aria-labelledby="titulo-foto" className="flex flex-col gap-4 rounded-card bg-cartao p-5 shadow-1">
      <h2 id="titulo-foto" className="text-lg font-bold">Sua foto</h2>
      <div className="flex items-center gap-4">
        {previa || atual ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local ou foto do Clerk
          <img src={previa || atual!} alt={previa ? "Prévia da nova foto" : "Sua foto de perfil"} width={80} height={80} className="size-20 shrink-0 rounded-full bg-fundo object-cover" />
        ) : <span className="grid size-20 shrink-0 place-items-center rounded-full bg-selecao text-beringela"><UserRound className="size-8" aria-hidden /><span className="sr-only">Sem foto de perfil</span></span>}
        <p className="text-sm text-texto-suave">{pendente ? "Confira a prévia e salve para trocar sua foto." : "Uma foto ajuda as pessoas a reconhecer você."}</p>
      </div>
      <input ref={arquivo} type="file" aria-label="Escolher foto de perfil" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" className="sr-only" disabled={!isLoaded || !user || ocupada}
        onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f || trava.current) return;
          trava.current = true; setPreparando(true); setErro(null); setOk(false);
          try {
            if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(f.type)) throw new Error("Escolha uma foto JPG, PNG, WebP, AVIF ou HEIC.");
            const r = await reduzirFoto(f, { ladoMaximo: 512 });
            setPendente(r.blob);
          } catch (e) { setErro(e instanceof Error ? e.message : "Essa foto não abriu. Tente outra."); }
          finally { setPreparando(false); trava.current = false; }
        }} />
      <Botao variante="secundario" larguraTotal icone={<Camera />} disabled={!isLoaded || !user || enviando} carregando={preparando} textoCarregando="Preparando..." onClick={() => arquivo.current?.click()}>Escolher foto</Botao>
      <p className="text-sm text-texto-suave">Até 20 MB. A imagem será reduzida antes do envio. A foto da loja é editada em Minha loja.</p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {ok && <Aviso tipo="ok">Foto atualizada.</Aviso>}
      {!user && isLoaded && <Aviso tipo="erro">Entre novamente na sua conta para trocar a foto.</Aviso>}
      {(pendente || faltaSincronizar) && <Botao larguraTotal disabled={preparando || !user} carregando={enviando} textoCarregando="Salvando..." onClick={() => salvar()}>{pendente ? "Salvar foto" : "Atualizar foto no site"}</Botao>}
      {pendente && <Botao variante="texto" disabled={ocupada} onClick={() => { setPendente(null); setErro(null); }}>Cancelar troca</Botao>}
      {atual && !pendente && !faltaSincronizar && <Botao variante="texto" className="text-perigo" icone={<Trash2 />} disabled={ocupada || !user} onClick={() => { setErro(null); dialogo.current?.showModal(); }}>Remover foto</Botao>}
      <dialog ref={dialogo} role="alertdialog" aria-labelledby="remover-foto-titulo" aria-describedby="remover-foto-texto" onCancel={(e) => { if (trava.current) e.preventDefault(); }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-folha bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50">
        <h2 id="remover-foto-titulo" className="text-xl font-semibold">Remover sua foto?</h2>
        <p id="remover-foto-texto" className="mt-2 text-texto-suave">Seu perfil ficará sem foto. Você pode escolher outra depois.</p>
        {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
        <div className="mt-4 flex flex-col gap-2">
          <Botao autoFocus variante="secundario" disabled={enviando} onClick={() => dialogo.current?.close()}>Manter foto</Botao>
          <Botao variante="perigo" carregando={enviando} textoCarregando="Removendo..." onClick={() => salvar(true)}>Remover foto</Botao>
        </div>
      </dialog>
    </section>
  );
}
