import Link from "next/link";
import type { ReactNode } from "react";

// Markdown simples e SEGURO para termos, privacidade e ajuda. Nada de HTML: cada trecho vira
// elemento React (o React escapa o texto), então "<script>" digitado aparece como texto.
// Aceita: # / ## / ### títulos, parágrafos, listas com "-" ou "*", listas "1.", **negrito** e
// [texto](link). Links só para caminho interno ("/..."), https://, http:// e mailto:.

type Bloco =
  | { tipo: "titulo"; nivel: 1 | 2 | 3; texto: string }
  | { tipo: "paragrafo"; linhas: string[] }
  | { tipo: "lista"; ordenada: boolean; itens: string[] };

/** "Quem pode usar" → "quem-pode-usar" (âncora dos títulos). */
export function ancora(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function separar(md: string): Bloco[] {
  const blocos: Bloco[] = [];
  let atual: Bloco | null = null;
  const fechar = () => {
    if (atual) blocos.push(atual);
    atual = null;
  };
  for (const bruta of md.replace(/\r\n?/g, "\n").split("\n")) {
    const linha = bruta.trim();
    if (!linha) {
      fechar();
      continue;
    }
    const titulo = /^(#{1,3})\s+(.+)$/.exec(linha);
    if (titulo) {
      fechar();
      blocos.push({ tipo: "titulo", nivel: titulo[1].length as 1 | 2 | 3, texto: titulo[2].trim() });
      continue;
    }
    const item = /^[-*]\s+(.+)$/.exec(linha);
    const numerado = /^\d{1,3}[.)]\s+(.+)$/.exec(linha);
    if (item || numerado) {
      const ordenada = !item;
      const texto = (item ?? numerado)![1];
      const a = atual as Bloco | null;
      if (a?.tipo === "lista" && a.ordenada === ordenada) {
        a.itens.push(texto);
      } else {
        fechar();
        atual = { tipo: "lista", ordenada, itens: [texto] };
      }
      continue;
    }
    const a = atual as Bloco | null;
    if (a?.tipo === "paragrafo") {
      a.linhas.push(linha);
    } else if (a?.tipo === "lista") {
      a.itens[a.itens.length - 1] += ` ${linha}`; // continuação do item
    } else {
      fechar();
      atual = { tipo: "paragrafo", linhas: [linha] };
    }
  }
  fechar();
  return blocos;
}

/** Link aceito: caminho interno, https/http ou mailto. Qualquer outro (javascript:, data:...) vira texto. */
export function linkSeguro(url: string): string | null {
  const u = url.trim();
  if (/^\/(?!\/)[^\s]*$/.test(u)) return u;
  if (/^https?:\/\/[^\s/]+[^\s]*$/i.test(u)) return u;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(u)) return u;
  return null;
}

const CLASSE_LINK = "font-semibold text-laranja-escuro underline underline-offset-4";

function emLinha(texto: string, chave: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const k = `${chave}-${i++}`;
    if (m[1] !== undefined) {
      partes.push(<strong key={k} className="font-semibold">{m[1]}</strong>);
    } else {
      const href = linkSeguro(m[3]);
      if (!href) partes.push(m[2]);
      else if (href.startsWith("/"))
        partes.push(
          <Link key={k} href={href} className={CLASSE_LINK}>
            {m[2]}
          </Link>,
        );
      else
        partes.push(
          <a key={k} href={href} className={CLASSE_LINK} {...(href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer nofollow" })}>
            {m[2]}
          </a>,
        );
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** Títulos de nível 1 e 2 do texto (para o "Nesta página"). */
export function titulosDoTexto(md: string): { id: string; texto: string }[] {
  return separar(md)
    .filter((b): b is Extract<Bloco, { tipo: "titulo" }> => b.tipo === "titulo" && b.nivel <= 2)
    .map((b) => ({ id: ancora(b.texto), texto: b.texto.replace(/\*\*/g, "") }));
}

/** Texto sem marcação (busca da ajuda). */
export function textoPuro(md: string) {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function Markdown({ texto, className = "" }: { texto: string; className?: string }) {
  const blocos = separar(texto);
  return (
    <div className={`flex flex-col gap-3 text-base leading-6 text-texto ${className}`}>
      {blocos.map((b, i) => {
        const k = `b${i}`;
        if (b.tipo === "titulo") {
          const conteudo = emLinha(b.texto, k);
          const id = ancora(b.texto);
          if (b.nivel === 3)
            return (
              <h3 key={k} id={id} className="mt-1 scroll-mt-20 text-base font-semibold">
                {conteudo}
              </h3>
            );
          return (
            <h2 key={k} id={id} className="mt-3 scroll-mt-20 text-lg font-semibold leading-6">
              {conteudo}
            </h2>
          );
        }
        if (b.tipo === "lista") {
          const Tag = b.ordenada ? "ol" : "ul";
          return (
            <Tag key={k} className={`flex flex-col gap-1.5 pl-6 ${b.ordenada ? "list-decimal" : "list-disc"}`}>
              {b.itens.map((it, j) => (
                <li key={`${k}-${j}`}>{emLinha(it, `${k}-${j}`)}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={k}>
            {b.linhas.map((l, j) => (
              <span key={`${k}-${j}`}>
                {j > 0 && <br />}
                {emLinha(l, `${k}-${j}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
