import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { Smartphone } from "lucide-react";
import { sincronizarPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { lerConfig } from "@/lib/dados/config";
import { PRAZOS_PADRAO, TITULO_MAX } from "@/lib/radar";
import { telefone } from "@/lib/formato";
import { exigeCelularConfirmado } from "@/app/radar/acoes-comprador";
import { FormPedido } from "@/components/radar/form-pedido";
import { ComoFuncionaRadar } from "@/components/radar/como-funciona";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";

export const metadata: Metadata = { title: "Pedir no Radar", robots: { index: false } };

// T27 · Fazer pedido no Radar (F4). O middleware já exige login e volta para cá depois.
// O texto pode vir da busca sem resultado (?pedido=...). Para pedir, o banco exige o celular
// confirmado (o Clerk confirma por código) ou, se o painel liberar (radar.exigir_celular_confirmado
// = false), o WhatsApp digitado aqui mesmo. Exigindo o código, a tela leva para confirmar e voltar.
export default async function PedirNoRadar({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const { pedido } = await searchParams;
  // Atualiza o perfil com o celular do Clerk antes de ler (quem acabou de confirmar já pode pedir).
  const usuario = await currentUser();
  if (usuario) await sincronizarPerfil(usuario).catch(() => undefined);
  const conta = await meuPerfilEVitrine();

  if (!conta) {
    return (
      <PaginaConta>
        <TopoConta titulo="Pedir no Radar" voltar="/radar" textoVoltar="Radar" />
        <Vazio titulo="Algo deu errado" texto="Não conseguimos abrir esta tela agora. Tente de novo.">
          <Botao href="/radar/pedir" larguraTotal>Tentar de novo</Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  const { perfil } = conta;
  const confirmado = !!perfil.whatsapp && !!perfil.whatsapp_verificado_em;
  // Enquanto o SMS do login não funciona, o painel pode liberar o WhatsApp digitado (sem código).
  const exigeCodigo = !confirmado && (await exigeCelularConfirmado(perfil.microrregiao_id));
  if (exigeCodigo) {
    return (
      <PaginaConta>
        <TopoConta titulo="Pedir no Radar" voltar="/radar" textoVoltar="Radar" />
        <Vazio
          icone={<Smartphone />}
          titulo="Falta confirmar seu celular"
          texto="As lojas te chamam pelo WhatsApp. Confirme seu número com o código que chega por SMS e volte aqui."
        >
          <Botao href="/minha-conta/dados/foto" larguraTotal icone={<Smartphone />}>
            Confirmar meu celular
          </Botao>
          <Botao href={`/radar/pedir${pedido ? `?pedido=${encodeURIComponent(pedido)}` : ""}`} variante="secundario" larguraTotal>
            Já confirmei
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  const [cidades, prazosConfig] = await Promise.all([
    listarCidades(perfil.microrregiao_id),
    lerConfig<unknown>("radar.prazos_horas", perfil.microrregiao_id, PRAZOS_PADRAO),
  ]);
  const prazos = Array.isArray(prazosConfig)
    ? prazosConfig.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const cidadeInicial = perfil.cidade && (!cidades.length || cidades.some((c) => c.nome === perfil.cidade)) ? perfil.cidade : "";

  return (
    <PaginaConta>
      <TopoConta
        titulo="Pedir no Radar"
        texto="As lojas e vendedores da região recebem seu pedido. Você só fala com quem tem o que você quer."
        voltar="/radar"
        textoVoltar="Radar"
      >
        <ComoFuncionaRadar compacto className="mt-2 rounded-card bg-laranja-claro p-3" />
      </TopoConta>
      <FormPedido
        textoInicial={(pedido ?? "").trim().slice(0, TITULO_MAX)}
        cidades={cidades}
        cidadeInicial={cidadeInicial}
        prazos={prazos.length ? prazos : PRAZOS_PADRAO}
        pedirWhatsapp={!confirmado}
        whatsappInicial={perfil.whatsapp ? telefone(perfil.whatsapp) : ""}
      />
    </PaginaConta>
  );
}
