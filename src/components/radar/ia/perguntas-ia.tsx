import { Botao } from "@/components/ui/botao";
import type { PerguntaIA } from "@/lib/radar-ia/tipos";

// Pergunta da IA para pedido vago (Modo fácil): o título da tela é a própria pergunta (no formulário);
// aqui só as respostas, uma por botão grande, e "Pular".
export function PerguntasIA({ pergunta, onResponder, onPular }: { pergunta: PerguntaIA; onResponder: (opcao: string) => void; onPular: () => void }) {
  return (
    <div role="group" aria-labelledby="pergunta-passo" className="flex flex-col gap-3">
      {pergunta.opcoes.map((o) => (
        <Botao key={o} variante="secundario" tamanho="grande" larguraTotal className="sm:max-w-none" onClick={() => onResponder(o)}>
          {o}
        </Botao>
      ))}
      <Botao variante="texto" tamanho="grande" onClick={onPular}>
        Pular
      </Botao>
    </div>
  );
}
