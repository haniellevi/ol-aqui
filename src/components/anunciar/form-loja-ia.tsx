"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Campo } from "@/components/ui/campo";
import { Botao, classesBotao } from "@/components/ui/botao";
import { AvisoErro } from "./aviso-erro";
import { classesCampo } from "@/components/ui/input";
import { enviarFoto } from "@/lib/fotos";
import { dadosLojaIa, type RespostaLojaIa } from "@/lib/loja-ia/tipos";

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
  redesConcluidas?: boolean;
};

type Props = {
  andamento?: string;
  rascunho: { id: string; revisao: number; entrada: EntradaColetaLojaIa };
  cidades: { nome: string; uf: string }[];
  whatsappConfirmado: boolean;
  whatsappConsultaDisponivel: boolean;
  cnpjDisponivel: boolean;
  imagens?: Record<string, string>;
  salvar: (id: string, revisao: number, entrada: EntradaColetaLojaIa) => Promise<RespostaLojaIa<{ revisao: number }>>;
  prepararEnvio: (id: string, arquivo: { nome: string; tipo: string; tamanho: number }, tipo: "logo" | "foto") => Promise<RespostaLojaIa<{ id: string; urlEnvio: string; token: string }>>;
  finalizarEnvio: (id: string, imagemId: string) => Promise<RespostaLojaIa<{ id: string }>>;
  iniciar: (id: string, revisao: number) => Promise<RespostaLojaIa<void>>;
};

export function etapaInicial(entrada: EntradaColetaLojaIa): number {
  if (!entrada.nome?.trim() || !entrada.cidade?.trim()) return 0;
  if (entrada.redesConcluidas || entrada.site || entrada.instagram || entrada.facebook || entrada.cnpj || entrada.descricao || entrada.materiais?.length || entrada.consultarWhatsapp || entrada.avisarWhatsapp) return 2;
  return 1;
}

export function FormLojaIa({ andamento = "/quero-vender/loja/criar-com-ia", rascunho, cidades, whatsappConfirmado, whatsappConsultaDisponivel, cnpjDisponivel, imagens: imagensIniciais = {}, salvar, prepararEnvio, finalizarEnvio, iniciar }: Props) {
  const [entrada, setEntrada] = useState<EntradaColetaLojaIa>({ ...rascunho.entrada, materiais: rascunho.entrada.materiais ?? [] });
  const [etapa, setEtapa] = useState(() => etapaInicial(rascunho.entrada));
  const [revisao, setRevisao] = useState(rascunho.revisao);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [iniciado, setIniciado] = useState(false);
  const [imagens, setImagens] = useState(imagensIniciais);
  const [enviandoImagem, setEnviandoImagem] = useState<"logo" | "foto" | null>(null);
  const seletores = useRef<Record<string, HTMLInputElement | null>>({});
  const atualizar = (mudanca: Partial<EntradaColetaLojaIa>) => setEntrada((anterior) => ({ ...anterior, ...mudanca }));

  async function avancar(destino: number, gerar = false) {
    if (ocupado) return;
    if (destino > etapa && etapa === 0 && (!entrada.nome.trim() || !entrada.cidade.trim())) {
      setErro("Informe o nome e a cidade da loja para continuar.");
      return;
    }
    if (gerar && ![entrada.site, entrada.instagram, entrada.facebook, cnpjDisponivel ? entrada.cnpj : "", (entrada.descricao?.trim().length ?? 0) >= 10 ? entrada.descricao : ""].some((valor) => valor?.trim()) && !entrada.materiais.length && !(whatsappConfirmado && whatsappConsultaDisponivel && entrada.consultarWhatsapp)) {
      setErro("Conte em pelo menos 10 caracteres o que sua loja faz ou informe uma fonte.");
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      const dados = { ...entrada, redesConcluidas: entrada.redesConcluidas || (etapa === 1 && destino > etapa), consultarWhatsapp: whatsappConfirmado && whatsappConsultaDisponivel && entrada.consultarWhatsapp, avisarWhatsapp: whatsappConfirmado && entrada.avisarWhatsapp };
      const salvo = dadosLojaIa(await salvar(rascunho.id, revisao, dados));
      setRevisao(salvo.revisao);
      setEntrada(dados);
      if (gerar) {
        dadosLojaIa(await iniciar(rascunho.id, salvo.revisao));
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
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type) || !arquivo.size || arquivo.size > 20 * 1024 * 1024) {
      setErro("Escolha uma imagem JPEG, PNG ou WebP de até 20 MB.");
      return;
    }
    setOcupado(true);
    setEnviandoImagem(tipo);
    setErro("");
    try {
      const envio = dadosLojaIa(await prepararEnvio(rascunho.id, { nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size }, tipo));
      if (!await enviarFoto(arquivo, envio.urlEnvio)) throw new Error("Não foi possível enviar a imagem. Tente novamente.");
      const { id } = dadosLojaIa(await finalizarEnvio(rascunho.id, envio.id));
      const atualizada = { ...entrada, materiais: [...entrada.materiais, id] };
      setEntrada(atualizada);
      setImagens((anteriores) => ({ ...anteriores, [id]: `/api/loja/imagem/${id}/revisao?rascunho=${rascunho.id}` }));
      const salvo = dadosLojaIa(await salvar(rascunho.id, revisao, atualizada));
      setRevisao(salvo.revisao);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível enviar o arquivo. Tente novamente.");
    } finally {
      setOcupado(false);
      setEnviandoImagem(null);
    }
  }

  if (iniciado) return (
    <section className="flex flex-col gap-3">
      <div role="status">
        <h1 className="text-titulo font-semibold text-beringela">Estamos preparando seu rascunho</h1>
        <p className="mt-1 text-sm text-texto-suave">Acompanhe o rascunho aqui ou em Minhas lojas.</p>
      </div>
      <div className="flex flex-wrap gap-2 [&>*]:flex-1">
        <a href={andamento} className={classesBotao("primario", false, "", "toque")}>Atualizar andamento</a>
        <Botao href="/minha-conta/lojas" variante="secundario" tamanho="toque">Ir para Minhas lojas</Botao>
      </div>
    </section>
  );

  return (
    <section className="flex flex-col gap-3" aria-busy={ocupado}>
      <header>
        <h1 className="text-titulo leading-tight font-semibold text-beringela">{["Conte sobre sua loja", "Onde encontramos sua loja?", "Mais informações para seu rascunho"][etapa]}</h1>
        <p className="mt-1 text-sm text-texto-suave" aria-live="polite">Passo {etapa + 1} de 3</p>
      </header>
      <AvisoErro mensagem={erro} />
      <fieldset disabled={ocupado} className="min-w-0 rounded-card border border-borda bg-cartao p-3 sm:p-4">
      {etapa === 0 && <div className="flex flex-col gap-3">
        <Campo tamanho="toque" rotulo="Nome da loja" name="nome" value={entrada.nome} onChange={(e) => atualizar({ nome: e.target.value })} required />
        <div className="flex flex-col gap-1">
          <label className="text-rotulo font-semibold" htmlFor="coleta-cidade">Cidade</label>
          <select id="coleta-cidade" className={`${classesCampo} h-toque!`} value={entrada.cidade} onChange={(e) => atualizar({ cidade: e.target.value })} required>
            <option value="">Escolha a cidade</option>
            {cidades.map((cidade) => <option key={`${cidade.nome}-${cidade.uf}`} value={cidade.nome}>{cidade.nome} - {cidade.uf}</option>)}
          </select>
        </div>
        {!cidades.length && <p className="text-sm text-perigo">Não há cidades disponíveis agora. Tente novamente mais tarde.</p>}
      </div>}
      {etapa === 1 && <div className="flex flex-col gap-3">
        <p className="text-sm text-texto-suave">Informe os links ou nomes dos perfis que quiser compartilhar.</p>
        <Campo tamanho="toque" rotulo="Site" name="site" value={entrada.site ?? ""} onChange={(e) => atualizar({ site: e.target.value })} opcional />
        <Campo tamanho="toque" rotulo="Instagram" name="instagram" value={entrada.instagram ?? ""} onChange={(e) => atualizar({ instagram: e.target.value })} opcional />
        <Campo tamanho="toque" rotulo="Facebook" name="facebook" value={entrada.facebook ?? ""} onChange={(e) => atualizar({ facebook: e.target.value })} opcional />
      </div>}
      {etapa === 2 && <div className="flex flex-col gap-3">
        <p className="text-sm text-texto-suave">Você pode enviar imagens próprias ou autorizadas para uso. Se não tiver fontes, escreva uma descrição curta da loja.</p>
        <Campo tamanho="toque" rotulo="CNPJ" name="cnpj" value={entrada.cnpj ?? ""} onChange={(e) => atualizar({ cnpj: e.target.value })} opcional />
        <Campo tamanho="toque" rotulo="Descrição da loja" name="descricao" value={entrada.descricao ?? ""} onChange={(e) => atualizar({ descricao: e.target.value })} multilinha opcional />
        <div className="grid grid-cols-2 gap-2">
          {([['logo', 'Logo'], ['foto', 'Foto']] as const).map(([tipo, rotulo]) => (
            <div key={tipo} className="flex min-w-0 flex-col items-stretch gap-1">
              <span className="text-sm font-semibold">{rotulo} <span className="font-normal text-texto-suave">(opcional)</span></span>
              <input ref={(elemento) => { seletores.current[tipo] = elemento; }} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Selecionar ${tipo}`} aria-describedby="coleta-imagens-dica" tabIndex={-1} disabled={ocupado} onChange={(e) => { const arquivo = e.target.files?.[0]; e.target.value = ''; void adicionar(arquivo, tipo); }} className="sr-only" />
              <Botao variante="secundario" tamanho="toque" icone={<ImagePlus />} disabled={ocupado} carregando={enviandoImagem === tipo} textoCarregando="Enviando..." onClick={() => seletores.current[tipo]?.click()}>Enviar {tipo}</Botao>
            </div>
          ))}
        </div>
        <p id="coleta-imagens-dica" className="text-sm text-texto-suave">JPEG, PNG ou WebP de até 20 MB.</p>
        {entrada.materiais.length > 0 && <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm text-texto-suave">{entrada.materiais.length} {entrada.materiais.length === 1 ? "imagem adicionada" : "imagens adicionadas"}.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {entrada.materiais.filter((id) => imagens[id]).map((id, indice) => (
              // eslint-disable-next-line @next/next/no-img-element -- prévia privada do material já normalizado no Storage
              <img key={id} src={imagens[id]} alt={`Imagem enviada ${indice + 1}`} width={128} height={128} className="aspect-square w-full rounded-campo border border-borda bg-cartao object-contain" />
            ))}
          </div>
        </div>}
        {!whatsappConsultaDisponivel && <p className="text-sm text-texto-suave">A importação do perfil do WhatsApp Business ainda não está habilitada. Use site, redes sociais, imagens ou descrição para gerar seu rascunho.</p>}
        {!whatsappConfirmado && <p className="text-sm text-texto-suave">{whatsappConsultaDisponivel ? "Confirme seu WhatsApp para autorizar a consulta do perfil ou receber o aviso." : "Confirme seu WhatsApp para receber o aviso."}</p>}
        {whatsappConsultaDisponivel && <label className="flex min-h-toque items-start gap-2 rounded-campo bg-fundo px-3 py-2 text-sm"><input className="mt-0.5 size-4 shrink-0 accent-beringela" type="checkbox" disabled={!whatsappConfirmado} checked={whatsappConfirmado && entrada.consultarWhatsapp} onChange={(e) => atualizar({ consultarWhatsapp: e.target.checked })} />Autorizo importar os dados comerciais e a foto do perfil do meu WhatsApp Business confirmado para sugerir o logo da loja.</label>}
        <label className="flex min-h-toque items-start gap-2 rounded-campo bg-fundo px-3 py-2 text-sm"><input className="mt-0.5 size-4 shrink-0 accent-beringela" type="checkbox" disabled={!whatsappConfirmado} checked={whatsappConfirmado && entrada.avisarWhatsapp} onChange={(e) => atualizar({ avisarWhatsapp: e.target.checked })} />Me avise quando ficar pronto pelo meu WhatsApp confirmado.</label>
      </div>}
      </fieldset>
      <div className="flex flex-wrap gap-2 [&>*]:grow">
        {etapa > 0 && <Botao type="button" tamanho="toque" variante="secundario" disabled={ocupado} onClick={() => void avancar(etapa - 1)}>Voltar</Botao>}
        {etapa === 1 && <Botao type="button" tamanho="toque" variante="texto" disabled={ocupado} onClick={() => void avancar(2)}>Agora não</Botao>}
        {etapa < 2 ? <Botao type="button" tamanho="toque" disabled={ocupado || (etapa === 0 && !cidades.length)} onClick={() => void avancar(etapa + 1)}>Continuar</Botao> : <Botao type="button" tamanho="toque" disabled={ocupado} onClick={() => void avancar(2, true)}>Gerar rascunho</Botao>}
      </div>
    </section>
  );
}
