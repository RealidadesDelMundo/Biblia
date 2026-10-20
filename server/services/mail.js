// Envío de correo con Resend (https://resend.com) por HTTP. Sin RESEND_API_KEY: en desarrollo se imprime en consola.
export function createMailer(config) {
  return {
    async send({ to, subject, text }) {
      if (!config.mail.resendKey) {
        if (!config.isProd) console.log(`\n[correo simulado] Para: ${to}\nAsunto: ${subject}\n${text}\n`);
        else console.warn('[mail] RESEND_API_KEY no configurada: no se pudo enviar un correo a', to);
        return { ok: false, simulated: true };
      }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.mail.resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.mail.from, to: [to], subject, text }),
      });
      if (!res.ok) {
        console.error('[mail] Resend respondió', res.status, await res.text().catch(() => ''));
        return { ok: false };
      }
      return { ok: true };
    },
  };
}
