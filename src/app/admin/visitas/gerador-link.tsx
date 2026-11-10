"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download } from "lucide-react";
import { Cartao, estiloCampo } from "@/components/admin/ui";
import { CampoBusca, type OpcaoBusca } from "@/components/admin/campo-busca";
import { Botao } from "@/components/ui/botao";

// Monta o link com a origem marcada (ex.: para o post do Instagram, o anúncio na rádio
// ou o QR colado no balcão da loja) e o QR code pronto para baixar.

type Destino = { valor: string; nome: string };

const campanhaDe = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").slice(0, 60);

export function GeradorLink({ site, origens, destinos, lojas }: { site: string; origens: OpcaoBusca[]; destinos: Destino[]; lojas: OpcaoBusca[] }) {
  const [origem, setOrigem] = useState(origens[0]?.valor ?? "");
  const [destino, setDestino] = useState(destinos[0]?.valor ?? "/");
  const [loja, setLoja] = useState("");
  const [campanha, setCampanha] = useState("");
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);

  const caminho = destino === "loja" ? (loja ? `/loja/${loja}` : "") : destino;
  const link = useMemo(() => {
    if (!caminho || !origem) return "";
    const q = new URLSearchParams({ origem });
    const c = campanhaDe(campanha);
    if (c) q.set("campanha", c);
    return `${site}${caminho}?${q.toString()}`;
  }, [site, caminho, origem, campanha]);

  useEffect(() => {
    let vivo = true;
    if (!link) {
      setQr("");
      return;
    }
    QRCode.toDataURL(link, { width: 512, margin: 2, color: { dark: "#4b1248", light: "#ffffff" } })
      .then((u) => vivo && setQr(u))
      .catch(() => vivo && setQr(""));
    return () => {
      vivo = false;
    };
  }, [link]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Cartao>
      <h2 className="text-xl font-semibold text-beringela">Criar link com origem</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 @2xl/painel:grid-cols-2">
        <label className="text-sm font-medium text-beringela">
          De onde a pessoa vai clicar
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className={estiloCampo}>
            {origens.map((o) => <option key={o.valor} value={o.valor}>{o.nome}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-beringela">
          Para onde o link leva
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className={estiloCampo}>
            {destinos.map((d) => <option key={d.valor} value={d.valor}>{d.nome}</option>)}
          </select>
        </label>
        {destino === "loja" && (
          <div className="text-sm font-medium text-beringela">
            Qual loja
            <div className="mt-1">
              <CampoBusca opcoes={lojas} onEscolher={setLoja} rotulo="Qual loja" placeholder="Digite o nome da loja" />
            </div>
          </div>
        )}
        <label className="text-sm font-medium text-beringela">
          Nome da campanha (opcional)
          <input value={campanha} onChange={(e) => setCampanha(e.target.value)} maxLength={60} placeholder="ex.: radio corrente novembro" className={estiloCampo} />
        </label>
      </div>

      {link ? (
        <div className="mt-4 flex flex-col gap-3 @2xl/painel:flex-row @2xl/painel:items-start">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code do link" width={160} height={160} className="size-40 shrink-0 rounded-campo border border-borda" />
          )}
          <div className="min-w-0 flex-1">
            <p className="break-all rounded-campo bg-fundo p-2 text-sm text-beringela">{link}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Botao onClick={copiar} variante="secundario" tamanho="pequeno" icone={<Copy className="size-4" aria-hidden />}>
                {copiado ? "Copiado" : "Copiar link"}
              </Botao>
              {qr && (
                <a href={qr} download={`qr-${origem}${campanhaDe(campanha) ? `-${campanhaDe(campanha)}` : ""}.png`}
                   className="olaki-acao olaki-controle-pequeno inline-flex min-h-8 items-center gap-1.5 rounded-campo px-2.5 text-legenda font-semibold text-laranja-escuro hover:underline">
                  <Download className="size-4" aria-hidden /> Baixar QR code
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-texto-suave">Escolha a loja para montar o link.</p>
      )}
    </Cartao>
  );
}
