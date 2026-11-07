'use client'

import type React from 'react'
import { Check as CheckIcon, Clock, Flame, MapPin, Send, Users } from 'lucide-react'
import { Bar, Button, Check, Collapse, Phone, Roll, Row, Spinner, Stage, type Act } from '../kit'
import './radar-demo.css'

// OLAKI · Radar de Negócios, visto pela loja. Um celular Android (o público
// da região usa Android de entrada), a tela real do Radar: cabeçalho, chips
// de categoria e os pedidos dos compradores. A história em quatro batidas:
// um pedido novo chega no topo ("Precisa hoje"), a loja toca em Propor
// Produto, uma folha sobe com dois anúncios da vitrine, ela escolhe a moto e
// envia; a folha desce e o pedido mostra "Proposta enviada". Depois de ler, o
// pedido sai da lista de pedidos abertos (foi para Minhas propostas) e a lista
// volta ao começo, pronta para o próximo pedido.
//
// Palavras de verdade: o título da tela, o pedido novo, o pedido vizinho
// (geladeira), os dois anúncios da vitrine e os botões. O resto é barra.

type S = { novo: boolean; sheet: boolean; pick: number | null; sending: boolean; sent: boolean }

const START: S = { novo: false, sheet: false, pick: null, sending: false, sent: false }
// Reduzir movimento mostra o resultado: o pedido com a proposta enviada
const POSTER: S = { novo: true, sheet: false, pick: 0, sending: false, sent: true }

const REST = { wide: { x: 400, y: 486 }, compact: { x: 332, y: 492 } }

async function script(a: Act<S>) {
  const rest = a.layout === 'compact' ? REST.compact : REST.wide
  await a.wait(900)

  // 1. Um pedido novo chega no topo; os de baixo abrem espaço
  a.mark('novo')
  a.put({ novo: true })
  await a.wait(2300)

  // 2. A loja toca em Propor Produto; a folha sobe com a vitrine
  a.mark('propor')
  await a.click({ at: 'propor', x: 0.82, y: 0.5 })
  a.put({ sheet: true })
  await a.wait(1400)

  // 3. Escolhe a moto que combina com o pedido
  a.mark('escolher')
  await a.click({ at: 'item1', x: 0.72, y: 0.5 })
  a.put({ pick: 0 })
  await a.wait(900)

  // 4. Envia: o botão confirma em si mesmo, a folha desce
  a.mark('enviar')
  await a.click({ at: 'enviar', x: 0.8, y: 0.5 })
  a.put({ sending: true })
  await a.wait(900)
  a.put({ sheet: false })
  await a.wait(420)

  // Resultado: o pedido mostra a proposta enviada e a contagem rola
  a.mark('enviada')
  a.put({ sent: true })
  await a.wait(2700)

  // O pedido respondido sai dos pedidos abertos; a lista volta ao começo
  a.mark('sai')
  a.put({ novo: false })
  await a.wait(1000)
  // Escondido dentro do cartão fechado: volta ao estado inicial sem ninguém ver
  await a.snap({ pick: null, sending: false, sent: false })
  await a.move(rest)
  await a.wait(200)
}

const ICON = { size: 14, strokeWidth: 2 } as const

// Dois glifos num só espaço do botão: um some enquanto o outro cresce, o
// botão continua o mesmo objeto
function IconSwap({ on, a, b }: { on: boolean; a: React.ReactNode; b: React.ReactNode }) {
  return (
    <span className="ol-swap" aria-hidden>
      <span className="ol-swap__i" data-on={!on || undefined}>{a}</span>
      <span className="ol-swap__i" data-on={on || undefined}>{b}</span>
    </span>
  )
}

export default function OlakiRadar() {
  return (
    <Stage<S>
      width={440}
      height={520}
      compact={{ below: 440, width: 358, height: 478 }}
      initial={START}
      poster={POSTER}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="ol look-olaki"
    >
      {(s, _rect, layout) => (
        <>
          <div className="ol-wash" />
          <Phone frame="android" width={layout === 'compact' ? 326 : 340} className="ol-phone">
            <div className="ol-app">
              <header className="ol-head">
                <div className="ol-head__title">Radar de Negócios</div>
                <div className="ol-head__sub">12 compradores procurando em Corrente e região</div>
                <div className="ol-chips">
                  <span className="ol-chip" data-on>Tudo</span>
                  <span className="ol-chip">Veículos</span>
                  <span className="ol-chip">Imóveis</span>
                  <span className="ol-chip">Móveis</span>
                </div>
              </header>

              <div className="ol-list">
                {/* O pedido novo: chega inteiro, os de baixo descem com ele */}
                <Collapse open={s.novo} reveal="drop">
                  <div className="ol-slot">
                    <article className="ol-card">
                      <div className="ol-card__body">
                        <div className="ol-tags">
                          <span className="ol-tag"><Flame {...ICON} aria-hidden />Precisa hoje</span>
                          <span className="ol-when"><Clock {...ICON} aria-hidden />agora</span>
                        </div>
                        <div className="ol-card__title">Moto Honda Titan 160, até 2019</div>
                        <div className="ol-price-row">
                          <span className="ol-price">até R$ 9.000</span>
                          <span className="ol-city"><MapPin size={16} strokeWidth={2} aria-hidden />Corrente</span>
                        </div>
                        <div className="ol-details">
                          <p>Pra trabalhar na roça. Pago à vista.</p>
                          <p className="ol-details__buyer">Comprador: Josimar</p>
                        </div>
                        <div className="ol-count">
                          <Users {...ICON} aria-hidden />
                          <Roll delay={260}>{s.sent ? '1 de 5 propostas enviadas' : 'Nenhuma proposta ainda. Seja o primeiro!'}</Roll>
                        </div>
                      </div>
                      <Button
                        className="ol-cta"
                        variant="primary"
                        data-target="propor"
                        data-sent={s.sent || undefined}
                        icon={<IconSwap on={s.sent} a={<Send size={20} strokeWidth={2} />} b={<CheckIcon size={20} strokeWidth={2.5} />} />}
                      >
                        {s.sent ? 'Proposta enviada' : 'Propor Produto'}
                      </Button>
                    </article>
                  </div>
                </Collapse>

                {/* O vizinho: palavras onde o olho passa, barras nos detalhes */}
                <div className="ol-slot">
                  <article className="ol-card">
                    <div className="ol-card__body">
                      <div className="ol-tags">
                        <span className="ol-tag"><Flame {...ICON} aria-hidden />Esta semana</span>
                        <span className="ol-when"><Clock {...ICON} aria-hidden />há 20 min</span>
                      </div>
                      <div className="ol-card__title">Geladeira frost free, 300 a 400 litros</div>
                      <div className="ol-price-row">
                        <span className="ol-price">até R$ 2.000</span>
                        <span className="ol-city"><MapPin size={16} strokeWidth={2} aria-hidden />Corrente</span>
                      </div>
                      <div className="ol-details">
                        <p>Pode ser usada, funcionando bem.</p>
                        <p className="ol-details__buyer">Compradora: Lúcia</p>
                      </div>
                      <div className="ol-count">
                        <Users {...ICON} aria-hidden />
                        <span>2 de 5 propostas enviadas</span>
                      </div>
                    </div>
                    <Button className="ol-cta" variant="primary" icon={<Send size={20} strokeWidth={2} aria-hidden />}>
                      Propor Produto
                    </Button>
                  </article>
                </div>

                {/* Só barras: corre para fora do corte */}
                <div className="ol-slot">
                  <article className="ol-card ol-card--filler">
                    <div className="ol-card__body">
                      <div className="ol-tags">
                        <Bar w={92} h={24} r={12} tone={2} />
                        <span className="ol-when"><Bar w={54} h={8} r={4} tone={2} /></span>
                      </div>
                      <div className="ol-card__title ol-card__title--bars">
                        <Bar w={248} h={11} r={5.5} tone={4} />
                        <Bar w={152} h={11} r={5.5} tone={4} />
                      </div>
                      <div className="ol-price-row">
                        <Bar w={108} h={14} r={7} tone={5} />
                        <Bar w={76} h={9} r={4.5} tone={2} />
                      </div>
                      <div className="ol-details ol-details--bars">
                        <Bar w={212} h={8} r={4} tone={3} />
                        <Bar w={132} h={7} r={3.5} tone={2} />
                      </div>
                    </div>
                  </article>
                </div>
              </div>

              {/* A folha da vitrine, sobre a lista escurecida */}
              <div className="ol-scrim" data-show={s.sheet || undefined} />
              <div className="ol-sheet" data-open={s.sheet || undefined}>
                <span className="ol-sheet__grab" aria-hidden />
                <div className="ol-sheet__title">Oferecer da sua vitrine</div>
                <div className="ol-sheet__sub">Escolha o anúncio que combina com o pedido</div>
                <div className="ol-items">
                  <Row
                    className="ol-item"
                    data-target="item1"
                    data-cursor="pointer"
                    selected={s.pick === 0}
                    lead={<span className="ol-thumb ol-thumb--a" aria-hidden />}
                    title="Honda CG Titan 160 · 2019"
                    subtitle="R$ 8.500 · 12.300 km"
                  >
                    <Check on={s.pick === 0} size={24} />
                  </Row>
                  <Row
                    className="ol-item"
                    data-target="item2"
                    data-cursor="pointer"
                    selected={s.pick === 1}
                    lead={<span className="ol-thumb ol-thumb--b" aria-hidden />}
                    title="Honda CG 150 Fan · 2016"
                    subtitle="R$ 6.900 · 31.000 km"
                  >
                    <Check on={s.pick === 1} size={24} />
                  </Row>
                </div>
                <Button
                  className="ol-cta ol-cta--sheet"
                  variant="primary"
                  data-target="enviar"
                  icon={<IconSwap on={s.sending} a={<Send size={20} strokeWidth={2} />} b={<Spinner size={20} />} />}
                >
                  {s.sending ? 'Enviando…' : 'Enviar proposta'}
                </Button>
              </div>
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
