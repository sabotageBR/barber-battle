// Relogio real do servidor: monotonico em ms, com agendar/cancelar injetaveis no motor.
export function criarRelogio() {
  const inicio = Number(process.hrtime.bigint() / 1000000n);
  return {
    agora: () => Number(process.hrtime.bigint() / 1000000n) - inicio,
    agendar: (fn, ms) => setTimeout(fn, Math.max(0, ms)),
    cancelar: (id) => clearTimeout(id),
  };
}
