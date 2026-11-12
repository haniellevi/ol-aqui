"use client";

import { useState } from "react";
import Link from "next/link";
import { ImagemGestao } from "@/components/admin/imagem-gestao";
import { Botao } from "@/components/ui/botao";
import { Cartao, estiloCampo } from "@/components/admin/ui";
import { useGestaoForm, CampoGestao, LocalidadeGestao, MotivoGestao, RetornoGestao, TextoGestao } from "@/components/admin/form-gestao";
import { DIAS_EM_ORDEM, NOME_DIA } from "@/components/vitrine/regras";
import type { LocalidadesGestao, LojaGestao } from "@/lib/admin/gestao";
import { excluirLojaAdmin, salvarLojaAdmin } from "./gestao-actions";

export function FormGestaoLoja({ loja: l, locais }: { loja: LojaGestao | null; locais: LocalidadesGestao }) {
  const [estado, acao, pendente] = useGestaoForm(salvarLojaAdmin);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  return <form onSubmit={acao} className="space-y-5">
    <input type="hidden" name="id" value={l?.id ?? ""} /><input type="hidden" name="versao" value={l?.atualizado_em ?? ""} />
    <fieldset disabled={pendente || enviandoFoto} className="space-y-5">
      <Cartao><h2 className="mb-4 text-lg font-semibold">Cadastro e titularidade</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoGestao rotulo="Nome da loja" name="nome" required minLength={2} maxLength={80} defaultValue={l?.nome} />
          <CampoGestao rotulo="Endereço público da loja" name="slug" required pattern="[a-z0-9-]{3,60}" maxLength={60} defaultValue={l?.slug} />
          <CampoGestao rotulo="ID do usuário titular" name="dono_id" required pattern="user_[A-Za-z0-9]+" defaultValue={l?.dono_id} />
          <label className="block text-sm font-semibold">Tipo<select name="tipo" defaultValue={l?.tipo ?? "loja"} className={estiloCampo}><option value="loja">Loja</option><option value="pf">Vendedor individual</option></select></label>
          <p className="text-sm text-texto-suave sm:col-span-2">Encontre o ID em <Link href="/admin/usuarios" className="font-semibold underline" target="_blank">Usuários</Link>. Cada titular pode ter uma loja ou cadastro de vendedor. Alterar o endereço público invalida os links antigos.</p>
          <LocalidadeGestao locais={locais} regiao={l?.microrregiao_id} cidade={l?.cidade} obrigatoria />
          <CampoGestao rotulo="Bairro" name="bairro" maxLength={80} defaultValue={l?.bairro ?? ""} />
          <CampoGestao rotulo="CNPJ" name="cnpj" maxLength={18} defaultValue={l?.cnpj ?? ""} />
          <CampoGestao rotulo="Categoria comercial" name="categoria_loja" maxLength={80} defaultValue={l?.categoria_loja ?? ""} />
        </div>
      </Cartao>
      <Cartao><h2 className="mb-4 text-lg font-semibold">Contatos e apresentação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoGestao rotulo="WhatsApp comercial" name="whatsapp" type="tel" maxLength={30} defaultValue={l?.whatsapp ?? ""} />
          <CampoGestao rotulo="Telefone público" name="telefone_publico" type="tel" maxLength={30} defaultValue={l?.telefone_publico ?? ""} />
          <CampoGestao rotulo="Site" name="site_url" type="url" maxLength={300} defaultValue={l?.site_url ?? ""} />
          <CampoGestao rotulo="Instagram" name="instagram" maxLength={100} defaultValue={l?.instagram ?? ""} />
          <TextoGestao rotulo="Descrição curta" name="descricao" maxLength={600} defaultValue={l?.descricao ?? ""} />
          <TextoGestao rotulo="Sobre a loja" name="sobre" maxLength={1500} defaultValue={l?.sobre ?? ""} />
        </div>
      </Cartao>
      <Cartao><h2 className="mb-4 text-lg font-semibold">Endereço, horários e entrega</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><CampoGestao rotulo="Endereço completo" name="endereco" maxLength={160} defaultValue={l?.endereco ?? ""} /></div>
          <CampoGestao rotulo="Latitude" name="lat" type="number" step="any" min={-90} max={90} defaultValue={l?.lat ?? ""} />
          <CampoGestao rotulo="Longitude" name="lng" type="number" step="any" min={-180} max={180} defaultValue={l?.lng ?? ""} />
          <p className="text-sm text-texto-suave sm:col-span-2">Horários: 08:00-12:00, 14:00-18:00. Deixe vazio nos dias fechados. Use 24:00 para encerrar à meia-noite.</p>
          {DIAS_EM_ORDEM.map(d => <CampoGestao key={d} rotulo={NOME_DIA[d]} name={`horario_${d}`} maxLength={200}
            defaultValue={l?.horarios?.[d]?.map(f => `${f.abre}-${f.fecha}`).join(", ") ?? ""} />)}
          <CampoGestao rotulo="Formas de pagamento, separadas por vírgula" name="formas_pagamento" maxLength={500} defaultValue={l?.formas_pagamento.join(", ") ?? ""} />
          <label className="block text-sm font-semibold">Faz entrega<select name="faz_entrega" defaultValue={l?.faz_entrega == null ? "" : l.faz_entrega ? "sim" : "nao"} className={estiloCampo}>
            <option value="">Não informado</option><option value="sim">Sim</option><option value="nao">Não</option>
          </select></label>
          <CampoGestao rotulo="Informações da entrega" name="entrega_obs" maxLength={200} defaultValue={l?.entrega_obs ?? ""} />
        </div>
      </Cartao>
      <Cartao><h2 className="mb-4 text-lg font-semibold">Imagens e banner</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImagemGestao tipo="loja" id={l?.id} campo="logo_url" rotulo="Logo" valor={l?.logo_url} onEnvio={setEnviandoFoto} />
          <ImagemGestao tipo="loja" id={l?.id} campo="capa_url" rotulo="Capa" valor={l?.capa_url} onEnvio={setEnviandoFoto} />
          <label className="block text-sm font-semibold">Tipo de banner<select name="banner_tipo" defaultValue={l?.banner_tipo ?? "modelo"} className={estiloCampo}><option value="modelo">Modelo</option><option value="foto">Foto</option></select></label>
          <ImagemGestao tipo="loja" id={l?.id} campo="banner_url" rotulo="Foto do banner" valor={l?.banner_url} onEnvio={setEnviandoFoto} />
          <label className="block text-sm font-semibold">Modelo<select name="banner_modelo" defaultValue={l?.banner_modelo ?? "liso"} className={estiloCampo}><option value="liso">Liso</option><option value="listras">Listras</option><option value="pontos">Pontos</option></select></label>
          <CampoGestao rotulo="Cor do banner" name="banner_cor" type="color" defaultValue={l?.banner_cor ?? "#4B1248"} />
          <CampoGestao rotulo="Posição vertical da foto (0 a 100)" name="banner_aki_posicao" type="number" min={0} max={100} defaultValue={l?.banner_aki_posicao ?? ""} />
        </div>
      </Cartao>
      <MotivoGestao /><Botao type="submit" carregando={pendente} textoCarregando="Salvando...">{l ? "Salvar loja" : "Criar loja"}</Botao>
    </fieldset>
    <RetornoGestao estado={estado} />
  </form>;
}

export function FormExcluirLoja({ loja: l }: { loja: LojaGestao }) {
  const [estado, acao, pendente] = useGestaoForm(excluirLojaAdmin);
  const impedida = l.pagamentos_total > 0 || l.retencoes_total > 0;
  return <Cartao className="mt-6 border-perigo"><h2 className="text-lg font-semibold text-perigo">Excluir loja permanentemente</h2>
    <p className="mt-2 text-sm">Serão removidos a vitrine, {l.anuncios_total} anúncios, {l.propostas_total} propostas e as seções da loja. A conta do titular será mantida. Esta operação não pode ser desfeita.</p>
    <p className="mt-2 text-sm text-texto-suave">Pagamentos vinculados: {l.pagamentos_total}. Registros sob retenção: {l.retencoes_total}. O servidor confere os vínculos novamente antes de excluir.</p>
    {impedida ? <p className="mt-3 font-semibold text-perigo">A exclusão está impedida por vínculos financeiros ou retenções. Use a suspensão enquanto esses vínculos são tratados.</p> :
      <form onSubmit={acao} className="mt-4 space-y-4"><input type="hidden" name="id" value={l.id} /><input type="hidden" name="versao" value={l.atualizado_em} />
        <input type="hidden" name="anuncios_total" value={l.anuncios_total} /><input type="hidden" name="propostas_total" value={l.propostas_total} />
        <CampoGestao rotulo={`Digite ${l.slug} para confirmar`} name="confirmacao" required autoComplete="off" />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmar" required className="mt-1 size-5 shrink-0" />Li o efeito da exclusão e quero remover esta loja e os registros indicados.</label>
        <MotivoGestao /><Botao type="submit" variante="perigo" carregando={pendente}>Excluir loja permanentemente</Botao><RetornoGestao estado={estado} />
      </form>}
  </Cartao>;
}
