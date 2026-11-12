import { createCn } from "cn/config"

// O cn junta classes e tira as repetidas, mas só conhece os nomes padrão do
// Tailwind. Sem esta lista, "text-legenda text-texto-suave" virava só
// "text-texto-suave" (achava que eram duas cores) e o texto perdia o tamanho;
// e "rounded-card" ao lado de "rounded-lg" ficavam os dois brigando.
// Nomes próprios do projeto: ver --text-*, --radius-*, --spacing-* e --shadow-*
// em src/app/globals.css. Ao criar um token novo, coloque-o aqui também.
export const cn = createCn({
  extend: {
    theme: {
      text: ["titulo", "legenda", "rotulo", "facil", "facil-titulo"],
      radius: ["card", "campo", "folha"],
      spacing: ["controle", "controle-pequeno", "toque"],
      shadow: ["1", "2"],
    },
  },
})
