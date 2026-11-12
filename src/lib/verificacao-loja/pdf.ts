import "server-only";

const LIMITE_CARACTERES = 20_000;
const LIMITE_BYTES = 10_000_000;

// Extrai o texto no nosso servidor: o PDF nunca sai daqui para a IA nem para motores de PDF de terceiros.
// `unpdf` é importado só na hora do uso (exige Node >= 22), para não quebrar o carregamento de outros módulos.
export async function extrairTextoPdf(base64: string): Promise<string> {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > LIMITE_BYTES) throw new Error("pdf_invalido");
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(doc, { mergePages: true });
  const unido = Array.isArray(text) ? text.join("\n") : String(text ?? "");
  return unido.slice(0, LIMITE_CARACTERES);
}
