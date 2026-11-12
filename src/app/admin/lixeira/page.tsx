import Link from "next/link";
import { eSuperAdmin, exigirAdmin } from "@/lib/admin/auth";
import { quando } from "@/lib/admin/formato";
import { Aviso, Cartao, Titulo } from "@/components/admin/ui";
import type { Lixeira } from "@/lib/admin/lixeira";
import { FormApagarDeVez, FormRestaurar } from "./formularios";

export const metadata = { title: "Lixeira" };

const ORIGEM: Record<string, string> = { usuario: "Pedido do titular", dono: "Pedido do dono", admin: "Equipe", conta: "Junto com a conta" };

/** Mesmo texto que o banco pede para confirmar o "apagar de vez" de um anúncio sem título. */
const nomeAnuncio = (titulo: string | null) => titulo?.trim() || "Anúncio sem título";

function diasRestantes(iso: string) {
  const dias = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return dias <= 0 ? "Será apagado na próxima limpeza" : dias === 1 ? "Falta 1 dia" : `Faltam ${dias} dias`;
}

export default async function PaginaLixeira() {
  const { supabase } = await exigirAdmin();
  const [{ data, error }, superAdmin] = await Promise.all([supabase.rpc("admin_lixeira"), eSuperAdmin(supabase)]);
  const l = data as Lixeira | null;
  return <>
    <Titulo sub="Contas, lojas e anúncios excluídos ficam 30 dias aqui. Depois são apagados de vez, menos pagamentos e provas congeladas.">Lixeira</Titulo>
    {!superAdmin && <p className="mb-4 text-sm text-texto-suave">Só o super admin pode apagar de vez antes dos 30 dias.</p>}
    {error || !l ? <Aviso tipo="erro">Não foi possível abrir a lixeira. Recarregue para tentar novamente.</Aviso> : <div className="grid gap-6">
      <section aria-labelledby="lixeira-contas">
        <h2 id="lixeira-contas" className="mb-3 text-lg font-semibold">Contas ({l.contas.length})</h2>
        {!l.contas.length ? <Cartao>Nenhuma conta na lixeira.</Cartao> : <ul className="grid gap-3">
          {l.contas.map(c => <li key={c.id}><Cartao className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><h3 className="font-semibold">{c.nome}</h3>
                <p className="text-sm text-texto-suave">{ORIGEM[c.origem] ?? c.origem} · {diasRestantes(c.apagar_apos)}{c.motivo ? ` · ${c.motivo}` : ""}</p>
              </div><Link href={`/admin/usuarios/${c.id}`} className="text-sm font-semibold text-laranja-escuro hover:underline">Abrir ficha</Link>
            </div>
            <FormRestaurar tipo="conta" id={c.id} />
            {superAdmin && <FormApagarDeVez tipo="conta" id={c.id} nome={c.nome} />}
          </Cartao></li>)}
        </ul>}
      </section>
      <section aria-labelledby="lixeira-lojas">
        <h2 id="lixeira-lojas" className="mb-3 text-lg font-semibold">Lojas ({l.lojas.length})</h2>
        {!l.lojas.length ? <Cartao>Nenhuma loja na lixeira.</Cartao> : <ul className="grid gap-3">
          {l.lojas.map(v => <li key={v.id}><Cartao className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><h3 className="font-semibold">{v.nome}</h3>
                <p className="text-sm text-texto-suave">{ORIGEM[v.origem] ?? v.origem} · {v.anuncios} anúncios · {diasRestantes(v.apagar_apos)}{v.motivo ? ` · ${v.motivo}` : ""}</p>
              </div><Link href={`/admin/lojas/${v.id}`} className="text-sm font-semibold text-laranja-escuro hover:underline">Abrir ficha</Link>
            </div>
            {v.origem === "conta" ? <p className="text-sm text-texto-suave">Volta ou é apagada junto com a conta do titular.</p> : <>
              <FormRestaurar tipo="loja" id={v.id} />
              {superAdmin && <FormApagarDeVez tipo="loja" id={v.id} nome={v.nome} />}
            </>}
          </Cartao></li>)}
        </ul>}
      </section>
      <section aria-labelledby="lixeira-anuncios">
        <h2 id="lixeira-anuncios" className="mb-1 text-lg font-semibold">Anúncios ({l.anuncios.length})</h2>
        <p className="mb-3 text-sm text-texto-suave">Anúncios mandados para a lixeira pelo anunciante ou pela equipe. O anunciante restaura em Meus anúncios.</p>
        {!l.anuncios.length ? <Cartao>Nenhum anúncio na lixeira.</Cartao> : <ul className="grid gap-3">
          {l.anuncios.map(a => <li key={a.id}><Cartao className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><h3 className="font-semibold">{nomeAnuncio(a.titulo)}</h3>
                <p className="text-sm text-texto-suave">{a.loja} · excluído em {quando(a.excluido_em)} · {diasRestantes(a.apagar_apos)}</p>
              </div><Link href={`/admin/anuncios/${a.id}`} className="text-sm font-semibold text-laranja-escuro hover:underline">Abrir anúncio</Link>
            </div>
            {superAdmin && <FormApagarDeVez tipo="anuncio" id={a.id} nome={nomeAnuncio(a.titulo)} />}
          </Cartao></li>)}
        </ul>}
      </section>
    </div>}
  </>;
}
