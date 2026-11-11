import { MapPin } from "lucide-react";

// Mapa com o pino da loja (vitrine com IA, etapa 2): 3x3 peças de imagem do OpenStreetMap,
// sem chave, sem custo por visita, sem JavaScript e sem WebGL (o mapa embutido do OSM exige
// WebGL e some em celulares antigos). O pino fica sempre no centro. Tocar abre o mapa maior.
// Uso leve, com crédito visível, como pede a política de uso das peças do OSM.

const ZOOM = 16;
const PECA = 256;

export function coordenadasValidas(lat: number | null, lng: number | null): { lat: number; lng: number } | null {
  const la = Number(lat), lo = Number(lng);
  if (lat == null || lng == null || !Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 85 || Math.abs(lo) > 180) return null;
  return { lat: la, lng: lo };
}

/** Posição do ponto em "peças" no zoom dado (projeção do OSM). */
function emPecas(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return { x: ((lng + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}

export function MapaLoja({ lat, lng, nome }: { lat: number; lng: number; nome: string }) {
  const { x, y } = emPecas(lat, lng, ZOOM);
  const px = Math.floor(x), py = Math.floor(y);
  const max = 2 ** ZOOM;
  const pecas = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ dx, dy, tx: (((px + dx) % max) + max) % max, ty: py + dy })));
  // Deslocamento da grade 3x3 para o ponto cair no centro da caixa.
  const esquerda = Math.round((x - (px - 1)) * PECA);
  const topo = Math.round((y - (py - 1)) * PECA);
  const maior = `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=17/${lat.toFixed(6)}/${lng.toFixed(6)}`;
  return (
    <figure id="mapa-loja" className="flex scroll-mt-32 flex-col gap-1">
      <a
        href={maior}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ver ${nome} no mapa (abre em nova aba)`}
        className="relative block aspect-video w-full overflow-hidden rounded-card border border-borda bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
      >
        <span className="absolute top-1/2 left-1/2 block" style={{ width: PECA * 3, height: PECA * 3, marginLeft: -esquerda, marginTop: -topo }} aria-hidden>
          {pecas
            .filter((p) => p.ty >= 0 && p.ty < max)
            .map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- peça pública do OSM, sem otimização do Next
              <img
                key={`${p.dx}${p.dy}`}
                src={`https://tile.openstreetmap.org/${ZOOM}/${p.tx}/${p.ty}.png`}
                alt=""
                width={PECA}
                height={PECA}
                loading="lazy"
                decoding="async"
                className="absolute max-w-none"
                style={{ left: (p.dx + 1) * PECA, top: (p.dy + 1) * PECA }}
              />
            ))}
        </span>
        <MapPin className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-full fill-laranja text-beringela drop-shadow" aria-hidden />
      </a>
      <figcaption className="text-legenda text-texto-suave">Mapa: © colaboradores do OpenStreetMap</figcaption>
    </figure>
  );
}
