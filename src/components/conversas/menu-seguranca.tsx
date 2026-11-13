"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Flag } from "lucide-react";
import { Botao, classesBotao } from "@/components/ui/botao";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmar } from "@/components/ui/confirmar";
import { Folha, FolhaContent, FolhaDescription, FolhaHeader, FolhaTitle, FolhaTrigger } from "@/components/ui/folha";
import { DETALHES_MAX, MOTIVOS_DENUNCIA } from "@/components/conversas/validacao";
import { bloquear, denunciar } from "@/app/(conta)/conversas/actions";

// Mesmo desenho da denúncia do anúncio (denunciar.tsx): motivos em botões de rádio grandes.
const OPCAO =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-campo border border-borda bg-cartao px-4 text-facil " +
  "has-checked:border-beringela has-checked:bg-selecao has-checked:font-semibold " +
  "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-laranja-escuro";

// Bloquear / Desbloquear e Denunciar (denunciar já bloqueia). Vale para a pessoa ou loja inteira.
export function MenuSeguranca({ conversaId, eu_bloqueei, nomeOutro }: { conversaId: string; eu_bloqueei: boolean; nomeOutro: string }) {
  const router = useRouter();
  const confirmar = useConfirmar();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [denunciando, iniciarDenuncia] = useTransition();
  const [motivo, setMotivo] = useState<string>("");
  const [detalhes, setDetalhes] = useState("");
  const [erroDenuncia, setErroDenuncia] = useState<string | null>(null);
  const [denunciado, setDenunciado] = useState(false);

  async function alternarBloqueio() {
    const novo = !eu_bloqueei;
    if (novo && !(await confirmar({ titulo: `Bloquear ${nomeOutro}?`, texto: "Ninguém dos dois lados consegue mandar mensagem até você desbloquear.", acao: "Bloquear", perigo: true }))) return;
    setErro(null);
    iniciar(async () => {
      try {
        const r = await bloquear(conversaId, novo);
        if (!r.ok) { setErro(r.erro.mensagem); return; }
        router.refresh();
      } catch { setErro("Não foi possível mudar o bloqueio. Tente novamente."); }
    });
  }

  function enviarDenuncia() {
    if (!motivo) { setErroDenuncia("Escolha o que aconteceu."); return; }
    setErroDenuncia(null);
    iniciarDenuncia(async () => {
      try {
        const r = await denunciar(conversaId, motivo, detalhes || null);
        if (!r.ok) { setErroDenuncia(r.erro.mensagem); return; }
        setDenunciado(true);
        router.refresh();
      } catch { setErroDenuncia("Não foi possível enviar a denúncia. Tente novamente."); }
    });
  }

  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2">
      <Botao type="button" variante="secundario" tamanho="grande" onClick={() => void alternarBloqueio()} carregando={pendente} textoCarregando="Salvando..." icone={<Ban />}>
        {eu_bloqueei ? "Desbloquear" : "Bloquear"}
      </Botao>
      <Folha>
        <FolhaTrigger className={classesBotao("perigo", false, "cursor-pointer", "grande")}>
          <Flag className="size-5" aria-hidden /> Denunciar
        </FolhaTrigger>
        <FolhaContent>
          <FolhaHeader>
            <FolhaTitle>Denunciar esta conversa</FolhaTitle>
            <FolhaDescription>A equipe do Mercado da Região lê a conversa para decidir. Ao denunciar, a conversa também fica bloqueada.</FolhaDescription>
          </FolhaHeader>
          {denunciado ? <Alert variant="success" role="status">Denúncia enviada. Obrigado por avisar.</Alert> : <div className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-facil font-semibold">O que aconteceu?</legend>
              {MOTIVOS_DENUNCIA.map((m) => <label key={m.valor} className={OPCAO}>
                <input type="radio" name="motivo-conversa" value={m.valor} checked={motivo === m.valor} onChange={() => setMotivo(m.valor)} className="size-5 accent-beringela" />
                {m.nome}
              </label>)}
            </fieldset>
            <div className="flex flex-col gap-2">
              <label htmlFor="denuncia-conversa-detalhes" className="text-facil font-semibold">Conte mais <span className="font-normal text-texto-suave">(opcional)</span></label>
              <Textarea id="denuncia-conversa-detalhes" value={detalhes} maxLength={DETALHES_MAX} rows={3} onChange={(e) => setDetalhes(e.target.value)} />
            </div>
            {erroDenuncia && <Alert variant="destructive" role="alert" className="block">{erroDenuncia}</Alert>}
            <Botao type="button" variante="perigo" tamanho="grande" larguraTotal onClick={enviarDenuncia} carregando={denunciando} textoCarregando="Enviando...">Enviar denúncia</Botao>
          </div>}
        </FolhaContent>
      </Folha>
    </div>
    {erro && <p role="alert" className="text-sm font-semibold text-perigo">{erro}</p>}
  </div>;
}
