export type FonteLoja = 'site' | 'instagram' | 'facebook' | 'cnpj' | 'whatsapp' | 'materiais' | 'informado'
export type OrigemCampo = { fonte: FonteLoja; rotulo: string; url?: string }
export type CampoRascunho = {
  valor: string | null
  editado: boolean
  origem: OrigemCampo | null
  sugestao: { valor: string; origem: OrigemCampo } | null
}
export type CamposRascunho = Record<'nome' | 'cidade' | 'slug' | 'categoria' | 'sobre' | 'whatsapp' | 'endereco' | 'site' | 'instagram' | 'logo' | 'capa', CampoRascunho>
export type EntradaRascunho = {
  nome: string
  cidade: string
  site?: string
  instagram?: string
  facebook?: string
  cnpj?: string
  descricao?: string
  materiais: string[]
  consultarWhatsapp: boolean
  avisarWhatsapp: boolean
}
export type RascunhoLoja = {
  id: string
  revisao: number
  estado: 'coleta' | 'processando' | 'pronto' | 'publicado'
  entrada: EntradaRascunho
  fontes: Partial<Record<FonteLoja, unknown>>
  campos: CamposRascunho
  vitrineId: string | null
}
