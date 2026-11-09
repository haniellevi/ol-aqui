import type { Metadata } from "next";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { exigeCelularConfirmado } from "@/lib/dados/radar";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { FormDados } from "@/components/conta/form-dados";
import { FormWhatsapp } from "@/components/conta/form-whatsapp";
import { FotoPerfil } from "@/components/conta/foto-perfil";
import { Aviso } from "@/components/conta/aviso";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function PaginaMeusDados() {
  const conta = await meuPerfilEVitrine();
  if (!conta) {
    return <PaginaConta><TopoConta titulo="Editar perfil" />
      <Vazio titulo="Não conseguimos abrir seu perfil" texto="Seus dados continuam guardados. Tente carregar novamente.">
        <Botao href="/minha-conta/dados" larguraTotal>Tentar novamente</Botao>
      </Vazio>
    </PaginaConta>;
  }
  const { perfil } = conta;
  const [cidades, exigeCodigo] = await Promise.allSettled([listarCidades(perfil.microrregiao_id), exigeCelularConfirmado(perfil.microrregiao_id)]);
  return (
    <PaginaConta larga>
      <TopoConta titulo="Editar perfil" texto="Cuide dos seus dados e de como as pessoas encontram você." />
      <div className="grid items-start gap-5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <FotoPerfil foto={perfil.avatar_url} />
          {cidades.status === "fulfilled" ? <FormDados nome={perfil.nome} cidade={perfil.cidade} bairro={perfil.bairro} cidades={cidades.value} /> :
            <div className="flex flex-col gap-3 rounded-card bg-cartao p-5 shadow-1"><Aviso tipo="erro">Não conseguimos carregar as cidades e o formulário do perfil. Seus dados não foram alterados.</Aviso><Botao href="/minha-conta/dados" variante="secundario">Tentar novamente</Botao></div>}
        </div>
        <FormWhatsapp numero={perfil.whatsapp} confirmado={!!perfil.whatsapp && !!perfil.whatsapp_verificado_em}
          exigeCodigo={exigeCodigo.status !== "fulfilled" || exigeCodigo.value} ehLoja={conta.vitrine?.tipo === "loja"} />
      </div>
    </PaginaConta>
  );
}
