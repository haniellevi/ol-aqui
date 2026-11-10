// Frases fixas da interface do Aki (avisos de sistema). Serve no servidor e no navegador.
// Boas-vindas, sugestões, aviso de IA e limites vêm do painel (configuracoes "robo.*").
import type { MotivoBloqueio } from "@/lib/aki/tipos";

export const DESCANSANDO = "O Aki está descansando agora. O resto do site funciona normal.";
export const CODIGO_NAO_CHEGOU = "Confira o DDD e se o número recebe mensagens no WhatsApp. Aguarde 1 minuto após o último pedido e solicite outro código. Use apenas o código mais recente na tela de confirmação. Se ainda precisar de ajuda, toque em Não ajudou para falar com a equipe por aqui.";

export function mensagemBloqueio(motivo: MotivoBloqueio | null): string {
  switch (motivo) {
    case "sem_login":
      return "Entre na sua conta para conversar com o Aki.";
    case "limite_diario":
      return "Você já usou suas mensagens de hoje. Amanhã o Aki volta a conversar com você.";
    case "orcamento":
      return "O Aki já atendeu muita gente este mês e está descansando. O resto do site funciona normal.";
    case "sem_perfil":
      return "Termine seu cadastro para conversar com o Aki.";
    case "desligado":
    case "sem_modelo":
    case "sem_cotacao":
    case "sem_chave":
    default:
      return DESCANSANDO;
  }
}

export const ERROS_PROVEDOR = {
  limite: "O Aki está atendendo muita gente agora. Tente de novo em um minutinho.",
  sobrecarga: "O Aki está atendendo muita gente agora. Tente de novo em um minutinho.",
  tempo: "O Aki demorou demais para responder. Tente de novo.",
  rede: "A conexão caiu no meio da resposta. Tente de novo.",
  requisicao: "O Aki não conseguiu responder agora. Tente de novo.",
  sem_chave: DESCANSANDO,
} as const;

export const RESPOSTA_BLOQUEADA = "Desculpe, não posso responder isso. Posso ajudar você a procurar alguma coisa ou a anunciar?";
export const RESPOSTA_RECUSA = "Não posso ajudar com isso. Posso procurar algo à venda na região ou ajudar você a anunciar?";
export const RESPOSTA_SEM_FIM = "Não consegui terminar agora. Pode me perguntar de outro jeito?";
