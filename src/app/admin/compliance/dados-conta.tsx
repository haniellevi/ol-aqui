import { quando, reais } from "@/lib/admin/formato";
import { telefone } from "@/lib/formato";
import { NOME_ACAO, NOME_PAPEL, NOME_TABELA, type DadosCompliance } from "@/lib/tipos-equipe";

// Dados de uma conta para o Compliance (tela e relatório impresso). Só mostra: quem lê e grava o
// acesso é o banco (compliance_conta / compliance_relatorio).

const CAMPOS_PERFIL: [string, string][] = [
  ["id", "Código da conta"],
  ["nome", "Nome"],
  ["whatsapp", "Celular"],
  ["whatsapp_verificado_em", "Celular confirmado em"],
  ["tipo_pessoa", "Tipo"],
  ["cidade", "Cidade"],
  ["bairro", "Bairro"],
  ["criado_em", "Conta criada em"],
  ["criado_ip", "IP gravado no cadastro*"],
  ["aceitou_termos_em", "Aceitou os termos em"],
  ["versao_termos", "Versão dos termos"],
  ["atualizado_em", "Última mudança no cadastro"],
];
const CONHECIDOS = new Set([...CAMPOS_PERFIL.map(([k]) => k), "avatar_url"]);
const DATA_ISO = /^\d{4}-\d{2}-\d{2}T/;

function valor(chave: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "string" && DATA_ISO.test(v)) return quando(v);
  if (chave === "whatsapp" && typeof v === "string") return `${telefone(v)} (${v})`;
  if (chave === "tipo_pessoa") return v === "pj" ? "Empresa (PJ)" : "Pessoa física";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="@container/dados mt-6 min-w-0 break-inside-avoid-page">
      <h3 className="mb-2 border-b border-borda pb-1 text-lg font-semibold text-beringela">{titulo}</h3>
      {children}
    </section>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 py-2 @xl/dados:grid-cols-[12rem_minmax(0,1fr)]">
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="min-w-0 text-sm text-texto [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Campos({ campos }: { campos: Record<string, [string | null, string | null]> }) {
  return (
    <ul className="mt-1 flex flex-col gap-1 text-sm text-beringela">
      {Object.entries(campos).map(([campo, [antes, depois]]) => (
        <li key={campo} className="min-w-0 [overflow-wrap:anywhere]">
          <span className="font-semibold">{campo}</span>: {antes ?? "vazio"} → {depois ?? "vazio"}
        </li>
      ))}
    </ul>
  );
}

const Nada = ({ children }: { children: React.ReactNode }) => <p className="text-base text-texto-suave">{children}</p>;

/**
 * Os IPs vêm de logs_atividade e de criado_ip, gravados pelo banco com o IP de quem chamou o banco.
 * Quase toda ação passa antes pelo servidor do site (Vercel), então esse IP costuma ser o do servidor.
 * Enquanto o IP da pessoa não for gravado em cada ação, o relatório diz isso com todas as letras.
 */
function AvisoIp() {
  return (
    <p className="mt-3 rounded-card border border-aviso bg-aviso-fundo p-3 text-sm text-beringela">
      <span className="font-semibold">* Sobre os IPs e o navegador:</span> quase todo cadastro e mudança passa pelo servidor do site do
      OLAKI antes de chegar ao banco. Por isso o IP e o navegador gravados costumam ser os do servidor do OLAKI, e não os da pessoa.
      Não use estes dados para dizer de onde a pessoa acessou.
    </p>
  );
}

function Emails({ emails }: { emails: string[] | null }) {
  if (emails === null) return <>Não deu para ver agora (o login está fora do ar)</>;
  if (emails.length === 0) return <>Nenhum (a conta não existe mais no login)</>;
  return <>{emails.join(", ")}</>;
}

/**
 * `relatorio`: versão para imprimir (campos alterados sempre abertos).
 * `emails`: e-mails do login (Clerk), lidos no servidor. `null` = não deu para ver; ausente = não buscado.
 */
export function DadosConta({ d, relatorio = false, emails }: { d: DadosCompliance; relatorio?: boolean; emails?: string[] | null }) {
  // conta apagada: mostra o último cadastro guardado no histórico
  const perfil = d.perfil ?? d.perfil_apagado?.dados ?? null;
  const outros = perfil ? Object.entries(perfil).filter(([k]) => !CONHECIDOS.has(k)) : [];
  return (
    <div>
      <AvisoIp />
      <Secao titulo="Cadastro">
        {!d.perfil && d.perfil_apagado && (
          <p className="mb-2 text-base font-semibold text-perigo">
            Conta apagada em {quando(d.perfil_apagado.apagado_em)}
            {d.perfil_apagado.apagado_por ? ` (por ${d.perfil_apagado.apagado_por === d.usuario_id ? "a própria pessoa" : d.perfil_apagado.apagado_por})` : ""}.
            Abaixo, o último cadastro guardado.
          </p>
        )}
        {perfil ? (
          <dl>
            {CAMPOS_PERFIL.map(([k, rotulo]) => (
              <Linha key={k} rotulo={rotulo}>
                {valor(k, perfil[k])}
              </Linha>
            ))}
            {emails !== undefined && (
              <Linha rotulo="E-mail do login">
                <Emails emails={emails} />
              </Linha>
            )}
            {d.equipe && (
              <Linha rotulo="Equipe OLAKI">
                {NOME_PAPEL[d.equipe.papel]}
                {d.equipe.ativo ? "" : " (saiu)"}
              </Linha>
            )}
            {outros.map(([k, v]) => (
              <Linha key={k} rotulo={k}>
                {valor(k, v)}
              </Linha>
            ))}
          </dl>
        ) : (
          <Nada>
            Esta conta não existe mais no cadastro (código {d.usuario_id}). O histórico abaixo é o que ficou guardado.
          </Nada>
        )}
      </Secao>

      <Secao titulo="Aceite dos termos e da privacidade">
        {d.aceites.length === 0 ? (
          <Nada>Nenhum aceite registrado.</Nada>
        ) : (
          <ul className="flex flex-col gap-1">
            {d.aceites.map((a, i) => (
              <li key={i} className="text-base text-beringela">
                {a.tipo === "termos" ? "Termos de uso" : "Privacidade"} versão {a.versao} · {quando(a.aceito_em)}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Lojas e vitrines">
        {d.lojas.length === 0 ? (
          <Nada>Nenhuma loja.</Nada>
        ) : (
          d.lojas.map((l) => (
            <dl key={l.id} className="mb-3 rounded-card border border-borda p-3">
              <Linha rotulo="Nome">{l.nome}</Linha>
              <Linha rotulo="Endereço no site">/loja/{l.slug}</Linha>
              <Linha rotulo="Tipo">{l.tipo === "loja" ? "Loja" : "Pessoa física"}</Linha>
              <Linha rotulo="CNPJ">{l.cnpj ?? "—"}</Linha>
              <Linha rotulo="WhatsApp da loja">{l.whatsapp ? `${telefone(l.whatsapp)} (${l.whatsapp})` : "—"}</Linha>
              <Linha rotulo="Cidade">{l.cidade ?? "—"}</Linha>
              <Linha rotulo="Situação">{l.status}</Linha>
              <Linha rotulo="Criada em">{quando(l.criado_em)}</Linha>
              <Linha rotulo="IP gravado na criação*">{l.criado_ip ?? "—"}</Linha>
            </dl>
          ))
        )}
      </Secao>

      {d.lojas_apagadas.length > 0 && (
        <Secao titulo={`Lojas apagadas (${d.lojas_apagadas.length})`}>
          {d.lojas_apagadas.map((l) => (
            <dl key={l.id} className="mb-3 rounded-card border border-borda p-3">
              <Linha rotulo="Nome">{l.nome ?? "—"}</Linha>
              <Linha rotulo="Endereço no site">{l.slug ? `/loja/${l.slug}` : "—"}</Linha>
              <Linha rotulo="Tipo">{l.tipo === "loja" ? "Loja" : "Pessoa física"}</Linha>
              <Linha rotulo="CNPJ">{l.cnpj ?? "—"}</Linha>
              <Linha rotulo="WhatsApp da loja">{l.whatsapp ? `${telefone(l.whatsapp)} (${l.whatsapp})` : "—"}</Linha>
              <Linha rotulo="Cidade">{l.cidade ?? "—"}</Linha>
              <Linha rotulo="Criada em">{l.criado_em ? quando(l.criado_em) : "—"}</Linha>
              <Linha rotulo="IP gravado na criação*">{l.criado_ip ?? "—"}</Linha>
              <Linha rotulo="Apagada em">
                {quando(l.apagado_em)} · por {l.apagado_por ?? "sistema (conta apagada)"}
              </Linha>
              <p className="font-mono text-legenda text-texto-suave">{l.id}</p>
            </dl>
          ))}
        </Secao>
      )}

      <Secao titulo={`Anúncios (${d.anuncios.length})`}>
        {d.anuncios.length === 0 ? (
          <Nada>Nenhum anúncio.</Nada>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.anuncios.map((a) => (
              <li key={a.id} className="rounded-card border border-borda p-3">
                <p className="text-base font-semibold text-beringela">{a.titulo}</p>
                <p className="text-sm text-texto-suave">
                  {a.status} · {a.preco_centavos != null ? reais(a.preco_centavos) : "a combinar"} · {a.cidade ?? "—"}
                </p>
                <p className="text-sm text-texto-suave">
                  Criado {quando(a.criado_em)} · IP gravado* {a.criado_ip ?? "—"} · mudou {quando(a.atualizado_em)}
                </p>
                {a.congelado_motivo && <p className="text-sm font-semibold text-perigo">Congelado: {a.congelado_motivo}</p>}
                <p className="font-mono text-legenda text-texto-suave">{a.id}</p>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {d.anuncios_apagados.length > 0 && (
        <Secao titulo={`Anúncios apagados (${d.anuncios_apagados.length})`}>
          <ul className="flex flex-col gap-2">
            {d.anuncios_apagados.map((a) => (
              <li key={a.id} className="rounded-card border border-borda p-3">
                <p className="text-base font-semibold text-beringela">{a.titulo ?? "Sem título"}</p>
                <p className="text-sm text-texto-suave">
                  Apagado {quando(a.apagado_em)} · por {a.apagado_por ?? "sistema"} · IP gravado* {a.ip ?? "—"}
                </p>
                <p className="font-mono text-legenda text-texto-suave">{a.id}</p>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo={`Histórico: IPs, datas e alterações (${d.historico.length})`}>
        <p className="mb-3 text-sm text-texto-suave">
          Desde {quando(d.desde)} (últimos {d.meses_historico} meses), mais novo primeiro.
          {d.historico.length >= d.historico_limite
            ? ` Lista cortada: mostrando só as ${d.historico_limite} linhas mais novas (a mais antiga é de ${quando(d.historico[d.historico.length - 1].criado_em)}).`
            : ""}
        </p>
        {d.historico.length === 0 ? (
          <Nada>Nenhum registro no período.</Nada>
        ) : (
          <ol className="flex flex-col gap-2">
            {d.historico.map((h, i) => (
              <li key={i} className="break-inside-avoid rounded-card border border-borda p-3">
                <p className="text-base font-semibold text-beringela">
                  {quando(h.criado_em)} · {NOME_ACAO[h.acao] ?? h.acao} · {NOME_TABELA[h.tabela] ?? h.tabela}
                </p>
                <p className="text-sm text-texto-suave">
                  IP gravado* {h.ip ?? "—"} · quem fez: {h.quem ? (h.quem === d.usuario_id ? "a própria pessoa" : h.quem) : "sistema"}
                </p>
                {h.user_agent && <p className="break-words text-legenda text-texto-suave">Navegador gravado*: {h.user_agent}</p>}
                <p className="font-mono text-legenda text-texto-suave">Registro {h.registro_id}</p>
                {h.campos && Object.keys(h.campos).length > 0 && (
                  relatorio ? (
                    <Campos campos={h.campos} />
                  ) : (
                    <details className="mt-1" open={h.acao !== "INSERT"}>
                      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-laranja-escuro">
                        Ver campos ({Object.keys(h.campos).length})
                      </summary>
                      <Campos campos={h.campos} />
                    </details>
                  )
                )}
              </li>
            ))}
          </ol>
        )}
      </Secao>
    </div>
  );
}
