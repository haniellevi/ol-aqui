import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { Camera, CheckCircle2, Smartphone } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { telefone } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { FormDados } from "@/components/conta/form-dados";

export const metadata: Metadata = { title: "Meus dados" };

// Meus dados: nome, cidade e bairro (perfil); foto e celular ficam no Clerk (só leitura aqui).
export default async function PaginaMeusDados() {
  const [conta, usuario] = await Promise.all([meuPerfilEVitrine(), currentUser()]);
  if (!conta) {
    return (
      <PaginaConta>
        <TopoConta titulo="Meus dados" />
        <Vazio titulo="Algo deu errado" texto="Não conseguimos abrir seus dados agora. Tente de novo.">
          <Botao href="/minha-conta/dados" larguraTotal>Tentar de novo</Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const { perfil } = conta;
  const cidades = await listarCidades(perfil.microrregiao_id);
  const foto = usuario?.imageUrl ?? perfil.avatar_url;
  const confirmado = !!perfil.whatsapp && !!perfil.whatsapp_verificado_em;

  return (
    <PaginaConta>
      <TopoConta titulo="Meus dados" />

      <section aria-label="Foto e celular" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        <div className="flex items-center gap-3">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto do Clerk, host externo
            <img src={foto} alt="Sua foto" width={64} height={64} className="size-16 shrink-0 rounded-full bg-borda object-cover" />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-laranja-claro text-beringela" aria-hidden>
              <Camera className="size-7" />
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-texto-suave">Celular</span>
            <span className="flex items-center gap-1.5 text-lg font-bold">
              <Smartphone className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
              {perfil.whatsapp ? telefone(perfil.whatsapp) : "Não informado"}
            </span>
            {confirmado && (
              <span className="flex items-center gap-1 text-sm font-semibold text-verde-escuro">
                <CheckCircle2 className="size-4" aria-hidden />
                Confirmado
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-texto-suave">O celular é o seu login. Para trocar a foto ou o número, use o botão abaixo.</p>
        <Botao href="/minha-conta/dados/foto" variante="secundario" larguraTotal icone={<Camera />}>
          Mudar foto ou celular
        </Botao>
      </section>

      <FormDados nome={perfil.nome} cidade={perfil.cidade} bairro={perfil.bairro} cidades={cidades} />
    </PaginaConta>
  );
}
