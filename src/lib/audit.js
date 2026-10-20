// Auditoria é feita por triggers SQL no Supabase, na mesma transação que os dados.
// Não há escrita direta de logs no browser: evita eventos falsificados ou divergências.
export async function logAudit() { return undefined; }
