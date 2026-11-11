"use client";

import { useState } from "react";
import { ImagemGestao } from "@/components/admin/imagem-gestao";
import { Botao } from "@/components/ui/botao";
import { Cartao, estiloCampo } from "@/components/admin/ui";
import { useGestaoForm, CampoGestao, LocalidadeGestao, MotivoGestao, RetornoGestao } from "@/components/admin/form-gestao";
import type { LocalidadesGestao, UsuarioAdmin } from "@/lib/admin/gestao";
import { alterarAcesso, bloquearUsuario, salvarUsuario } from "./actions";

export function FormUsuario({ usuario: u, locais }: { usuario: UsuarioAdmin; locais: LocalidadesGestao }) {
  const [estado, acao, pendente] = useGestaoForm(salvarUsuario);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  return <form onSubmit={acao} className="space-y-4">
    <input type="hidden" name="id" value={u.id} /><input type="hidden" name="versao" value={u.atualizado_em} />
    <fieldset disabled={pendente || enviandoFoto || u.revogado} className="grid gap-4 sm:grid-cols-2">
      <CampoGestao rotulo="Nome completo" name="nome" required minLength={2} maxLength={120} defaultValue={u.nome} />
      <label className="block text-sm font-semibold">Tipo de pessoa<select name="tipo_pessoa" defaultValue={u.tipo_pessoa} className={estiloCampo}>
        <option value="pf">Pessoa física</option><option value="pj">Pessoa jurídica</option>
      </select></label>
      <LocalidadeGestao locais={locais} regiao={u.microrregiao_id} cidade={u.cidade} />
      <CampoGestao rotulo="Bairro" name="bairro" maxLength={80} defaultValue={u.bairro ?? ""} />
      <CampoGestao rotulo="WhatsApp" name="whatsapp" type="tel" maxLength={30} defaultValue={u.whatsapp ?? ""} />
      <div className="sm:col-span-2"><ImagemGestao tipo="usuario" id={u.id} campo="avatar_url" rotulo="Foto do perfil" valor={u.avatar_url} onEnvio={setEnviandoFoto} /></div>
      <p className="text-sm text-texto-suave sm:col-span-2">Ao mudar o WhatsApp, a confirmação anterior e os códigos pendentes são cancelados. O titular confirma o novo número na conta.</p>
      <div className="sm:col-span-2"><MotivoGestao /></div>
      <Botao type="submit" carregando={pendente} textoCarregando="Salvando...">Salvar cadastro</Botao>
    </fieldset>
    <RetornoGestao estado={estado} />
  </form>;
}

export function FormAcessoUsuario({ id, email }: { id: string; email: string | null }) {
  const [emailEstado, emailAcao, emailPendente] = useGestaoForm(alterarAcesso);
  const [senhaEstado, senhaAcao, senhaPendente] = useGestaoForm(alterarAcesso);
  return <div className="mt-6 grid gap-4 lg:grid-cols-2">
    <Cartao><h2 className="mb-4 text-lg font-semibold">E-mail de acesso</h2>
      <form onSubmit={emailAcao} className="space-y-4">
        <input type="hidden" name="id" value={id} /><input type="hidden" name="operacao" value="email" />
        <CampoGestao rotulo="E-mail principal" name="email" type="email" required maxLength={254} defaultValue={email ?? ""} autoComplete="off" />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmar" required className="mt-1 size-5 shrink-0" />Conferi a identidade do titular e o novo e-mail. Este endereço poderá ser usado para entrar e recuperar a conta.</label>
        <MotivoGestao /><Botao type="submit" carregando={emailPendente}>Atualizar e-mail</Botao><RetornoGestao estado={emailEstado} />
      </form>
    </Cartao>
    <Cartao><h2 className="mb-4 text-lg font-semibold">Definir nova senha</h2>
      <form onSubmit={senhaAcao} className="space-y-4">
        <input type="hidden" name="id" value={id} /><input type="hidden" name="operacao" value="senha" />
        <CampoGestao rotulo="Nova senha" name="senha" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
        <CampoGestao rotulo="Repita a nova senha" name="repetir_senha" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
        <p className="text-sm text-texto-suave">A senha atual não pode ser consultada. Salvar uma nova encerra as sessões anteriores.</p>
        <MotivoGestao /><Botao type="submit" carregando={senhaPendente}>Atualizar senha</Botao><RetornoGestao estado={senhaEstado} />
      </form>
    </Cartao>
  </div>;
}

export function FormBloqueioUsuario({ id, bloqueado }: { id: string; bloqueado: boolean }) {
  const [estado, acao, pendente] = useGestaoForm(bloquearUsuario);
  return <Cartao className="mt-6"><h2 className="mb-2 text-lg font-semibold">Suspender conta</h2>
    <p className="mb-4 text-sm text-texto-suave">{bloqueado
      ? "Esta conta está suspensa. Reativar devolve o acesso, a loja e os anúncios que estavam no ar."
      : "Para golpe ou regra quebrada. A conta perde o acesso, a loja e os anúncios saem do ar, e tudo fica guardado como prova. O celular continua preso a esta conta."}</p>
    <form onSubmit={acao} className="space-y-4"><input type="hidden" name="id" value={id} />
      <input type="hidden" name="operacao" value={bloqueado ? "desbloquear" : "bloquear"} />
      <MotivoGestao /><Botao type="submit" variante={bloqueado ? "secundario" : "perigo"} carregando={pendente}>{bloqueado ? "Reativar conta" : "Suspender conta"}</Botao>
      <RetornoGestao estado={estado} />
    </form>
  </Cartao>;
}
