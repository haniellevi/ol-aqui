// Enquanto os relatórios carregam (ao trocar período ou região): caixas cinzas no lugar dos blocos.
export default function Carregando() {
  return (
    <div role="status" aria-label="Carregando os relatórios" className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-card bg-borda motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-card bg-cartao shadow-1 motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-card bg-cartao shadow-1 motion-reduce:animate-none" />
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
