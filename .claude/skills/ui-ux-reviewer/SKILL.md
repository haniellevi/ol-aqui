# SKILL: Especialista em Revisão de Design System, UI/UX e Organização Visual
meta:
  name: "UI/UX & Design System Auditor"
  description: "Skill voltada para analisar layouts, organização de componentes, tipografia e consistência visual de interfaces."
  version: "1.1"

## 1. DIRETRIZES DE ORGANIZAÇÃO VISUAL
Ao avaliar layouts e estilos Tailwind/CSS, aplique as regras do repositório oficial da Anthropic para eliminar padrões previsíveis e desorganizados:
- **Hierarquia Visual & Grids:** Identificar e auditar conflitos de margens (`m-`, `mx-`, `my-`) ou paddings (`p-`) inconsistentes que quebrem o alinhamento visual (priorizar estruturas baseadas em grids múltiplos de 4px ou 8px).
- **Consistência de Tokens:** Checar se paletas de cores e espaçamentos estão reutilizando as classes utilitárias ou variáveis globais de forma lógica, sem redundâncias (evitar classes conflitantes aplicadas ao mesmo elemento).
- **Organização do Código:** Avaliar se o agrupamento de classes Tailwind ou CSS puro segue uma ordem lógica (ex: Display > Posicionamento > Espaçamento > Cores).
