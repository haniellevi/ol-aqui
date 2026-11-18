interface CloudflareEnv {
  IMAGENS_TRATAMENTO?: { fetch(input: string, init: RequestInit): Promise<Response> };
}
