"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { salvarDados, type EstadoDados } from "@/app/(conta)/minha-conta/dados/actions";
import { Seletor } from "./seletor";
import { Aviso } from "./aviso";

export function FormDados({ nome, cidade, bairro, cidades }: {
  nome: string; cidade: string | null; bairro: string | null; cidades: { nome: string; uf: string }[];
}) {
  const [valores, setValores] = useState({ nome, cidade: cidade ?? "", bairro: bairro ?? "" });
  const [estado, setEstado] = useState<EstadoDados>(null);
  const [enviando, iniciar] = useTransition();
  const trava = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const campos = estado?.campos ?? {};
  const cidadeFora = valores.cidade && !cidades.some((c) => c.nome === valores.cidade);
  useEffect(() => { if (!enviando && estado?.campos) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [estado, enviando]);
  function editar(campo: keyof typeof valores, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setEstado(null);
  }
  return (
    <form ref={form} onSubmit={(e) => {
      e.preventDefault();
      if (trava.current) return;
      trava.current = true;
      const dados = new FormData(e.currentTarget);
      setEstado(null);
      iniciar(async () => {
        try {
          const r = await salvarDados(null, dados);
          setEstado(r);
          if (r?.ok) router.refresh();
        } catch { setEstado({ erro: "A conexão falhou. Seu preenchimento foi mantido; tente novamente." }); }
        finally { trava.current = false; }
      });
    }} className="flex flex-col gap-4 rounded-card bg-cartao p-5 shadow-1" noValidate aria-label="Editar perfil" aria-busy={enviando}>
      <div>
        <h2 className="text-lg font-bold">Seu perfil</h2>
        <p className="mt-1 text-sm text-texto-suave">Use o nome pelo qual você quer ser conhecido no Mercado da Região.</p>
      </div>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">Perfil salvo.</Aviso>}
      <fieldset disabled={enviando} className="flex min-w-0 flex-col gap-4">
        <Campo rotulo="Seu nome" name="nome" value={valores.nome} onChange={(e) => editar("nome", e.target.value)} autoComplete="name" required minLength={2} maxLength={120} erro={campos.nome} />
        <Seletor rotulo="Cidade (opcional)" name="cidade" value={valores.cidade} onChange={(e) => editar("cidade", e.target.value)} autoComplete="address-level2" erro={campos.cidade}
          dica={cidades.length ? "Cidades atendidas na sua região." : "Não há cidades disponíveis agora. Você pode salvar o nome e o bairro."}>
          <option value="">Não informar</option>
          {cidadeFora && <option value={valores.cidade} disabled>{valores.cidade} (indisponível)</option>}
          {cidades.map((c) => <option key={`${c.nome}-${c.uf}`} value={c.nome}>{c.nome} - {c.uf}</option>)}
        </Seletor>
        <Campo rotulo="Bairro" name="bairro" opcional value={valores.bairro} onChange={(e) => editar("bairro", e.target.value)} autoComplete="address-level3" maxLength={80} erro={campos.bairro} />
      </fieldset>
      <Botao type="submit" larguraTotal icone={<Save />} carregando={enviando} textoCarregando="Salvando...">Salvar perfil</Botao>
      <p className="text-sm text-texto-suave">A localização dos anúncios já publicados é editada em Meus anúncios.</p>
    </form>
  );
}
