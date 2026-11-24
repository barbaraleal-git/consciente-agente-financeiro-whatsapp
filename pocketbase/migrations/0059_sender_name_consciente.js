/// <reference path="../pb_data/types.d.ts" />

// v0.0.164 — Nome de exibição do remetente = "Consciente" (a marca oficial;
// razão social BFL Soluções em Tecnologia NÃO vai no display dos e-mails).
//
// Contexto: os e-mails pelo caminho plataforma chegam como
// "agente-financeiro-whatsapp-37fd3 • noreply@mail.goskip.dev" — o nome vem do
// settings.meta.senderName, que a migração 0055 populou com o identificador do
// app e a 0058 só regravou se o SMTP estivesse ligado. Esta migração corrige o
// meta incondicionalmente (idempotente — pode rodar N vezes). O From ADDRESS
// continua noreply@mail.goskip.dev (retransmissor da plataforma; só muda quando
// o domínio próprio for verificado via Resend). O Reply-To
// (contato@consciente.net.br) é aplicado por mensagem, nos hooks (v0.0.164).

migrate(
  (app) => {
    var s = app.settings()
    if (!s.meta) s.meta = {}
    s.meta.senderName = 'Consciente'
    s.meta.senderAddress = 'noreply@mail.goskip.dev' // From inalterado — garantia explícita
    app.save(s)
    console.log(
      '[0059] meta.senderName="Consciente" aplicado; senderAddress mantido noreply@mail.goskip.dev',
    )
  },
  (app) => {
    // rollback: nenhum estado a restaurar (valor anterior era lixo de provisionamento)
    console.log('[0059] rollback: nada a restaurar')
  },
)
