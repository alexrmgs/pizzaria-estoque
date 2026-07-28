// A Vercel roda os servidores em UTC, e reserva a variável de ambiente
// `TZ` (não deixa configurar pelo painel). Forçamos o fuso de Brasília
// aqui, no boot do servidor, pra todo `new Date()`/cálculo de horário do
// app (ponto, atraso, folga, prazos de pagamento) bater com o horário real.
export async function register() {
  process.env.TZ = "America/Sao_Paulo";
}
