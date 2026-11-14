"use client";

import { useState } from "react";
import { Campo } from "@/components/ui/campo";
import { AvisoErro } from "./aviso-erro";
import { classesCampo } from "@/components/ui/input";

export type EntradaColetaLojaIa = {
  nome: string;
  cidade: string;
  site?: string;
  instagram?: string;
  facebook?: string;
  cnpj?: string;
  descricao?: string;
  materiais: string[];
  consultarWhatsapp: boolean;
  avisarWhatsapp: boolean;
};

type Props = {
  rascunho: { id: string; revisao: number; entrada: EntradaColetaLojaIa };
  cidades: { nome: string; uf: string }[];
  whatsappConfirmado: boolean;
  salvar: (id: string, revisao: number, entrada: EntradaColetaLojaIa) => Promise<{ revisao: number }>;
  enviarMaterial: (id: string, arquivo: File, tipo: "logo" | "foto") => Promise<string>;
  iniciar: (id: string, revisao: number) => Promise<void>;
};

export function etapaInicial(entrada: EntradaColetaLojaIa): number {
  if (!entrada.nome?.trim() || !entrada.cidade?.trim()) return 0;
  if (entrada.site || entrada.instagram || entrada.facebook || entrada.cnpj || entrada.descricao || entrada.materiais?.length || entrada.consultarWhatsapp || entrada.avisarWhatsapp) return 2;
  return 1;
}

const botao = "min-h-11 rounded-campo bg-laranja px-5 py-2 font-semibold text-beringela disabled:opacity-50";
const secundario = "min-h-11 rounded-campo border border-borda px-5 py-2 font-semibold text-beringela disabled:opacity-50";

export function FormLojaIa({ rascunho, cidades, whatsappConfirmado, salvar, enviarMaterial, iniciar }: Props) {
  const [entrada, setEntrada] = useState<EntradaColetaLojaIa>({ ...rascunho.entrada, materiais: rascunho.entrada.materiais ?? [] });
  const [etapa, setEtapa] = useState(() => etapaInicial(rascunho.entrada));
  const [revisao, setRevisao] = useState(rascunho.revisao);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [iniciado, setIniciado] = useState(false);
  const atualizar = (mudanca: Partial<EntradaColetaLojaIa>) => setEntrada((anterior) => ({ ...anterior, ...mudanca }));

  async function avancar(destino: number, gerar = false) {
    if (ocupado) return;
    if (destino > etapa && etapa === 0 && (!entrada.nome.trim() || !entrada.cidade.trim())) {
      setErro("Informe o nome e a cidade da loja para continuar.");
      return;
    }
    if (gerar && ![entrada.site, entrada.instagram, entrada.facebook, entrada.cnpj, entrada.descricao].some((valor) => valor?.trim()) && !entrada.materiais.length && !(whatsappConfirmado && entrada.consultarWhatsapp)) {
      setErro("Conte um pouco sobre sua loja para ajudar a montar o rascunho.");
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      const dados = whatsappConfirmado ? entrada : { ...entrada, consultarWhatsapp: false, avisarWhatsapp: false };
      const salvo = await salvar(rascunho.id, revisao, dados);
      setRevisao(salvo.revisao);
      if (gerar) {
        await iniciar(rascunho.id, salvo.revisao);
        setIniciado(true);
      } else setEtapa(destino);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setOcupado(false);
    }
  }

  async function adicionar(arquivo: File | undefined, tipo: "logo" | "foto") {
    if (!arquivo || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const id = await enviarMaterial(rascunho.id, arquivo, tipo);
      const atualizada = { ...entrada, materiais: [...entrada.materiais, id] };
      setEntrada(atualizada);
      const salvo = await salvar(rascunho.id, revisao, atualizada);
      setRevisao(salvo.revisao);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível enviar o arquivo. Tente novamente.");
    } finally {
      setOcupado(false);
    }
  }

  if (iniciado) return <div role="status" className="flex flex-col gap-3"><h1 className="text-xl font-semibold text-beringela">Estamos preparando seu rascunho</h1><p>Você pode sair e acompanhar o andamento em Minhas lojas.</p><a className="font-semibold text-laranja-escuro underline" href="/minha-conta/lojas">Ir para Minhas lojas</a></div>;

  return (
    <section className="flex flex-col gap-4 md:gap-5" aria-busy={ocupado}>
      <p className="text-sm font-semibold text-texto-suave">Passo {etapa + 1} de 3</p>
      <h1 className="text-xl font-semibold text-beringela">{["Conte sobre sua loja", "Onde encontramos sua loja?", "Mais informações para seu rascunho"][etapa]}</h1>
      <AvisoErro mensagem={erro} />
      {etapa === 0 && <div className="flex flex-col gap-4">
        <Campo rotulo="Nome da loja" name="nome" value={entrada.nome} onChange={(e) => atualizar({ nome: e.target.value })} required />
        <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor="coleta-cidade">Cidade
          <select id="coleta-cidade" className={classesCampo} value={entrada.cidade} onChange={(e) => atualizar({ cidade: e.target.value })} required>
            <option value="">Escolha a cidade</option>
            {cidades.map((cidade) => <option key={`${cidade.nome}-${cidade.uf}`} value={cidade.nome}>{cidade.nome} - {cidade.uf}</option>)}
          </select>
        </label>
        {!cidades.length && <p className="text-sm text-perigo">Não há cidades disponíveis agora. Tente novamente mais tarde.</p>}
      </div>}
      {etapa === 1 && <div className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">Informe os links ou nomes dos perfis que quiser compartilhar.</p>
        <Campo rotulo="Site" name="site" value={entrada.site ?? ""} onChange={(e) => atualizar({ site: e.target.value })} opcional />
        <Campo rotulo="Instagram" name="instagram" value={entrada.instagram ?? ""} onChange={(e) => atualizar({ instagram: e.target.value })} opcional />
        <Campo rotulo="Facebook" name="facebook" value={entrada.facebook ?? ""} onChange={(e) => atualizar({ facebook: e.target.value })} opcional />
      </div>}
      {etapa === 2 && <div className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">Você pode enviar imagens próprias ou autorizadas para uso. Se não tiver fontes, escreva uma descrição curta da loja.</p>
        <Campo rotulo="CNPJ" name="cnpj" value={entrada.cnpj ?? ""} onChange={(e) => atualizar({ cnpj: e.target.value })} opcional />
        <Campo rotulo="Descrição da loja" name="descricao" value={entrada.descricao ?? ""} onChange={(e) => atualizar({ descricao: e.target.value })} multilinha opcional />
        <div className="grid gap-4 sm:grid-cols-2">{([['logo', 'Logo'], ['foto', 'Foto']] as const).map(([tipo, rotulo]) => <label key={tipo} className="flex flex-col gap-1 text-sm font-semibold">{rotulo} (opcional)<input type="file" accept="image/*" disabled={ocupado} onChange={(e) => { const arquivo = e.target.files?.[0]; e.target.value = ''; void adicionar(arquivo, tipo); }} className="block min-h-11 w-full text-sm" /></label>)}</div>
        {entrada.materiais.length > 0 && <p className="text-sm text-texto-suave">{entrada.materiais.length} arquivo(s) adicionado(s).</p>}
        {!whatsappConfirmado && <p className="text-sm text-texto-suave">Confirme seu WhatsApp para autorizar a consulta do perfil ou receber o aviso.</p>}
        <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" disabled={!whatsappConfirmado} checked={whatsappConfirmado && entrada.consultarWhatsapp} onChange={(e) => atualizar({ consultarWhatsapp: e.target.checked })} />Autorizo consultar os dados comerciais do meu WhatsApp Business confirmado.</label>
        <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" disabled={!whatsappConfirmado} checked={whatsappConfirmado && entrada.avisarWhatsapp} onChange={(e) => atualizar({ avisarWhatsapp: e.target.checked })} />Me avise quando ficar pronto pelo meu WhatsApp confirmado.</label>
      </div>}
      <div className="flex flex-wrap gap-3">
        {etapa > 0 && <button type="button" className={secundario} disabled={ocupado} onClick={() => void avancar(etapa - 1)}>Voltar</button>}
        {etapa === 1 && <button type="button" className={secundario} disabled={ocupado} onClick={() => void avancar(2)}>Agora não</button>}
        {etapa < 2 ? <button type="button" className={botao} disabled={ocupado || (etapa === 0 && !cidades.length)} onClick={() => void avancar(etapa + 1)}>Continuar</button> : <button type="button" className={botao} disabled={ocupado} onClick={() => void avancar(2, true)}>Gerar rascunho</button>}
      </div>
    </section>
  );
}
