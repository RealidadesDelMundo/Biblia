import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { toSecondPerson } from '../src/format.js';

beforeEach(() => { globalThis.__resetJar__(); });

const email = () => `ui${Date.now()}${Math.floor(Math.random() * 1e5)}@example.com`;

async function registrar(user) {
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await user.click(screen.getByRole('button', { name: 'Empezar' }));
  await user.type(await screen.findByLabelText('Correo'), email());
  await user.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  await screen.findByRole('heading', { name: 'Versículo del día' });
}
const tab = (name) => within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('button', { name });

describe('Recorrido completo de la interfaz', () => {
  test('presentación → registro exige consentimiento → Hoy con versículo real', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('Un rato de calma para orar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Saltar' }));
    await user.type(await screen.findByLabelText('Correo'), email());
    await user.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/necesitamos que aceptes/i);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('heading', { name: 'Versículo del día' })).toBeInTheDocument();
    expect(await screen.findByRole('figure')).toBeInTheDocument();
    expect(screen.getByText(/Versión de prueba/)).toBeInTheDocument();
  });

  test('escribir una oración, encender una vela desde ella, verla en el diario y en la capilla', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await user.type(screen.getByLabelText(/qué oración nace hoy de tu corazón/i), 'Mañana tengo una entrevista de trabajo y estoy nervioso');
    await user.click(screen.getByRole('button', { name: 'Escribir mi oración' }));
    expect(await screen.findByText(/Oración creada para ti por tu acompañante virtual/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Encender una vela/ }));
    const intention = await screen.findByLabelText('¿Cuál es tu intención?');
    expect(intention).toHaveValue('Mañana tengo una entrevista de trabajo y estoy nervioso');
    await user.click(screen.getByRole('button', { name: 'Encender vela' }));
    expect(await screen.findByText(/«Mañana tengo una entrevista/)).toBeInTheDocument();
    expect(screen.getByText(/Arde 24 h más/)).toBeInTheDocument();
    await user.click(tab('Diario'));
    expect(await screen.findByText(/Lo que escribiste:/)).toBeInTheDocument();
  });

  test('límite gratuito: a la 4.ª oración se invita a Premium y el diario conserva todo', async () => {
    const user = userEvent.setup();
    await registrar(user);
    for (let i = 0; i < 3; i++) {
      await user.type(await screen.findByLabelText(/qué oración nace hoy de tu corazón/i), `Oración de prueba número ${i + 1}`);
      await user.click(screen.getByRole('button', { name: 'Escribir mi oración' }));
      await user.click(await screen.findByRole('button', { name: 'Escribir otra' }));
    }
    expect(await screen.findByText(/Has usado tus 3 oraciones gratuitas/)).toBeInTheDocument();
    expect(screen.getByLabelText(/qué oración nace hoy de tu corazón/i)).toBeDisabled();
  });

  test('Premium (pagos simulados) desde la hoja de planes', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await user.click(await screen.findByRole('button', { name: 'Ver Premium' }));
    const dlg = await screen.findByRole('dialog', { name: 'Premium', hidden: true });
    expect(within(dlg).getByText(/Oraciones sin límite/)).toBeInTheDocument();
    await user.click(within(dlg).getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/Premium activado/)).toBeInTheDocument();
    await user.click(tab('Cuenta'));
    expect(await screen.findByText(/Premium/, { selector: 'b' })).toBeInTheDocument();
  });

  test('riesgo alto: se muestra ayuda, no hay oración y no se guarda nada', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await user.type(screen.getByLabelText(/qué oración nace hoy de tu corazón/i), 'me quiero morir');
    await user.click(screen.getByRole('button', { name: 'Escribir mi oración' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/me importa que estés a salvo/);
    expect(alerta).toHaveTextContent(/no se ha guardado/);
    expect(screen.queryByText(/Oración creada para ti por tu acompañante virtual/)).not.toBeInTheDocument();
    await user.click(tab('Diario'));
    expect(await screen.findByText('Aquí se guardarán tus oraciones.')).toBeInTheDocument();
  });

  test('acompañante: responde, deja claro que no es una persona y muestra ayuda ante riesgo alto', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await user.click(tab('Hablar'));
    expect(await screen.findByText(/Soy tu acompañante de vida y de fe/)).toBeInTheDocument();
    expect(screen.getByText(/Soy un acompañante virtual, no una persona/)).toBeInTheDocument();
    await user.type(await screen.findByLabelText('Tu mensaje'), 'Me siento perdido con mi trabajo');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(/Versión de prueba/)).toBeInTheDocument();
    await user.type(await screen.findByLabelText('Tu mensaje'), 'no quiero seguir viviendo');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/estés a salvo/);
  });

  test('cuenta: tamaño de texto, descarga de datos y borrado con contraseña', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await user.click(tab('Cuenta'));
    await user.click(await screen.findByRole('radio', { name: 'Tamaño grande' }));
    expect(document.documentElement.style.fontSize).toBe('112%');
    await user.click(screen.getByRole('button', { name: 'Borrar mi cuenta y mis datos' }));
    const dlg = await screen.findByRole('dialog', { name: 'Borrar mi cuenta', hidden: true });
    await user.type(within(dlg).getByLabelText(/contraseña para confirmar/i), 'clave-segura-1');
    await user.click(within(dlg).getByRole('button', { name: 'Borrar todo' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /Crea tu cuenta/ })).toBeInTheDocument());
  });

  test('páginas legales accesibles con aviso de borrador', async () => {
    window.history.replaceState({}, '', '/privacidad');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Política de privacidad' })).toBeInTheDocument();
    expect(screen.getByText(/Borrador sin revisar/)).toBeInTheDocument();
    expect(screen.getAllByText(/creencias religiosas/i).length).toBeGreaterThan(0);
  });

  test('iniciar sesión con una cuenta existente', async () => {
    const user = userEvent.setup();
    const mail = email();
    const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail, password: 'clave-segura-1', consent: true }) });
    expect(r.status).toBe(201);
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    localStorage.setItem('oracion.seen', '1');
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Ya tengo cuenta' }));
    await user.type(screen.getByLabelText('Correo'), mail);
    await user.type(screen.getByLabelText('Contraseña'), 'mala-clave-99');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrectos/);
    await user.clear(screen.getByLabelText('Contraseña'));
    await user.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Versículo del día' })).toBeInTheDocument();
  });

  test('pagos desactivados: lo de pago aparece como «próximamente» y no hay forma de comprar', async () => {
    const user = userEvent.setup();
    const real = globalThis.fetch;
    globalThis.fetch = async (u, i) => {
      const r = await real(u, i);
      if (String(u).endsWith('/api/config')) { const j = await r.json(); j.paymentsMode = 'off'; return new Response(JSON.stringify(j), { status: 200, headers: { 'content-type': 'application/json' } }); }
      return r;
    };
    try {
      await registrar(user);
      expect(screen.queryByRole('button', { name: 'Ver Premium' })).not.toBeInTheDocument();
      await user.click(tab('Capilla'));
      const mediana = await screen.findByRole('radio', { name: /Mediana/ });
      expect(mediana).toBeDisabled();
      expect(within(mediana).getByText('Próximamente')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Grande/ })).toBeDisabled();
      expect(screen.queryByText(/Pagar/)).not.toBeInTheDocument();
      await user.click(tab('Cuenta'));
      expect(await screen.findByText('Premium llegará pronto.')).toBeInTheDocument();
      expect(screen.queryByText(/Modo de pruebas/)).not.toBeInTheDocument();
    } finally { globalThis.fetch = real; }
  });

  test('registro cerrado: aparece el campo del código de invitación solo cuando el servidor lo exige', async () => {
    const user = userEvent.setup();
    const real = globalThis.fetch;
    globalThis.fetch = async (u, i) => {
      const r = await real(u, i);
      if (String(u).endsWith('/api/config')) { const j = await r.json(); j.inviteRequired = true; return new Response(JSON.stringify(j), { status: 200, headers: { 'content-type': 'application/json' } }); }
      return r;
    };
    try {
      localStorage.setItem('oracion.seen', '1');
      render(<App />);
      expect(await screen.findByLabelText('Código de invitación')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Ya tengo cuenta' }));
      expect(screen.queryByLabelText('Código de invitación')).not.toBeInTheDocument();
    } finally { globalThis.fetch = real; }
  });

  test('un usuario normal no ve el panel de administración ni puede abrirlo escribiendo /admin', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await user.click(tab('Cuenta'));
    expect(await screen.findByRole('heading', { name: 'Tus datos' })).toBeInTheDocument();
    expect(screen.queryByText('Administración')).not.toBeInTheDocument();
    expect(screen.queryByText('Ver personas registradas')).not.toBeInTheDocument();
    // intento de entrar directamente por la dirección
    window.history.pushState({}, '', '/admin');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Personas registradas' })).not.toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument(); // sigue en la app normal
  });

  test('contadores de uso mensual: 0/3 al empezar, 1/3 tras una oración y resumen en Cuenta', async () => {
    const user = userEvent.setup();
    await registrar(user);
    expect(await screen.findByRole('group', { name: 'Oraciones este mes: 0 de 3' })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/qué oración nace hoy de tu corazón/i), 'Quiero dar gracias por mi familia');
    await user.click(screen.getByRole('button', { name: 'Escribir mi oración' }));
    await screen.findByText(/Oración creada para ti por tu acompañante virtual/);
    await user.click(screen.getByRole('button', { name: 'Escribir otra' }));
    expect(await screen.findByRole('group', { name: 'Oraciones este mes: 1 de 3' })).toBeInTheDocument();
    await user.click(tab('Capilla'));
    expect(await screen.findByRole('group', { name: 'Velas pequeñas este mes: 0 de 3' })).toBeInTheDocument();
    await user.click(tab('Hablar'));
    expect(await screen.findByRole('group', { name: 'Mensajes este mes: 0 de 3' })).toBeInTheDocument();
    await user.click(tab('Cuenta'));
    expect(await screen.findByRole('heading', { name: 'Tu uso este mes' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Oraciones: 1 de 3' })).toBeInTheDocument();
  });

  // ───────── Recordatorios de oración ─────────
  /** Simula un navegador con notificaciones push (jsdom no las trae) y devuelve la función que lo restaura. */
  function mockPush({ permission = 'default', result = 'granted' } = {}) {
    const had = { sw: Object.getOwnPropertyDescriptor(navigator, 'serviceWorker'), pm: 'PushManager' in window, n: 'Notification' in window, pmV: window.PushManager, nV: window.Notification };
    const sub = { toJSON: () => ({ endpoint: `https://push.example/t-${Math.random().toString(36).slice(2)}`, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }), unsubscribe: async () => true };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => null, subscribe: async () => sub } }) } });
    window.PushManager = function PushManager() {};
    window.Notification = { permission, requestPermission: async () => { window.Notification.permission = result; return result; } };
    return () => {
      if (had.sw) Object.defineProperty(navigator, 'serviceWorker', had.sw); else delete navigator.serviceWorker;
      if (had.pm) window.PushManager = had.pmV; else delete window.PushManager;
      if (had.n) window.Notification = had.nV; else delete window.Notification;
    };
  }
  const reminders = async () => (await fetch('/api/reminders')).json();

  test('recordatorios: se activan con el permiso del navegador, se cambia la frecuencia y las horas, se prueba y se desactivan', async () => {
    const user = userEvent.setup();
    const restore = mockPush();
    try {
      await registrar(user);
      await user.click(tab('Cuenta'));
      expect(await screen.findByRole('heading', { name: 'Recordatorios de oración' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Cada 3 horas' })).toHaveAttribute('aria-checked', 'true'); // la que pidieron: cada 3 horas
      await user.click(screen.getByRole('button', { name: 'Activar recordatorios' }));
      expect(await screen.findByText('Recordatorios activados en este dispositivo.')).toBeInTheDocument();
      let s = await reminders();
      expect([s.enabled, s.devices]).toEqual([true, 1]);
      expect(s.times).toEqual(['08:00', '11:00', '14:00', '17:00', '20:00']);
      expect(s.tz).toBeTruthy();

      await user.click(screen.getByRole('radio', { name: '3 veces al día' }));
      await waitFor(async () => expect((await reminders()).times).toEqual(['08:00', '14:00', '21:00']));

      fireEvent.change(screen.getByLabelText('Añadir una hora'), { target: { value: '22:30' } });
      await user.click(screen.getByRole('button', { name: 'Añadir hora' }));
      await waitFor(async () => expect((await reminders()).times).toEqual(['08:00', '14:00', '21:00', '22:30']));
      expect(screen.getByRole('radio', { name: 'Personalizado' })).toHaveAttribute('aria-checked', 'true');

      await user.click(screen.getByRole('button', { name: 'Quitar las 22:30' }));
      await waitFor(async () => expect((await reminders()).times).toEqual(['08:00', '14:00', '21:00']));

      await user.click(screen.getByRole('button', { name: 'Enviar una prueba' }));
      expect(await screen.findByText(/Aviso enviado/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Desactivar' }));
      expect(await screen.findByRole('button', { name: 'Activar recordatorios' })).toBeInTheDocument();
      expect((await reminders()).enabled).toBe(false);
    } finally { restore(); }
  });

  test('recordatorios: si la persona no concede el permiso, no se activa nada y se le explica', async () => {
    const user = userEvent.setup();
    const restore = mockPush({ result: 'denied' });
    try {
      await registrar(user);
      await user.click(tab('Cuenta'));
      await user.click(await screen.findByRole('button', { name: 'Activar recordatorios' }));
      expect(await screen.findByText(/permite las notificaciones/i)).toBeInTheDocument();
      expect((await reminders()).enabled).toBe(false);
    } finally { restore(); }
  });

  test('recordatorios: con las notificaciones bloqueadas en el navegador se indica cómo desbloquearlas', async () => {
    const user = userEvent.setup();
    const restore = mockPush({ permission: 'denied' });
    try {
      await registrar(user);
      await user.click(tab('Cuenta'));
      expect(await screen.findByText(/notificaciones bloqueadas/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Activar recordatorios' })).not.toBeInTheDocument();
    } finally { restore(); }
  });

  test('recordatorios: en iPhone sin instalar la app se explica cómo instalarla; en navegadores sin soporte se avisa', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    try {
      await registrar(user);
      await user.click(tab('Cuenta'));
      expect(await screen.findByText(/En iPhone y iPad: pulsa Compartir/)).toBeInTheDocument();
    } finally { delete navigator.userAgent; }
    cleanup();
    globalThis.__resetJar__();
    localStorage.clear();
    const user2 = userEvent.setup();
    await registrar(user2);
    await user2.click(tab('Cuenta'));
    expect(await screen.findByText(/Este navegador no admite avisos/)).toBeInTheDocument();
  });

  test('apagar una vela: aviso de confirmación; «No» la deja encendida y «Sí» la quita de la capilla (sigue contando para el límite)', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await user.click(tab('Capilla'));
    await user.type(await screen.findByLabelText('¿Cuál es tu intención?'), 'por mi madre');
    await user.click(screen.getByRole('button', { name: 'Encender vela' }));
    expect(await screen.findByText(/«por mi madre»/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apagar' }));
    let dlg = await screen.findByRole('dialog', { name: '¿Apagar esta vela?', hidden: true });
    expect(within(dlg).getByText(/¿Seguro que quieres apagar la vela/)).toBeInTheDocument();
    expect(within(dlg).getByText(/no se puede volver a encender/)).toBeInTheDocument();
    await user.click(within(dlg).getByRole('button', { name: 'No, que siga encendida' }));
    expect(await screen.findByText(/«por mi madre»/)).toBeInTheDocument();         // sigue encendida

    await user.click(screen.getByRole('button', { name: 'Apagar' }));
    dlg = await screen.findByRole('dialog', { name: '¿Apagar esta vela?', hidden: true });
    await user.click(within(dlg).getByRole('button', { name: 'Sí, apagar' }));
    expect(await screen.findByText('Vela apagada.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/«por mi madre»/)).not.toBeInTheDocument());
    expect(await screen.findByRole('group', { name: 'Velas pequeñas este mes: 1 de 3' })).toBeInTheDocument();
  });

  test('capilla: primero las velas encendidas (con su recuento) y debajo el formulario para encender una nueva', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await user.click(tab('Capilla'));
    const lit = await screen.findByRole('heading', { name: 'Velas encendidas' });
    const nuevo = screen.getByRole('heading', { name: 'Encender una vela nueva' });
    expect(lit.compareDocumentPosition(nuevo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();   // «encendidas» va antes
    expect(screen.getByText(/Enciende tu primera vela aquí debajo/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('¿Cuál es tu intención?'), 'por mi familia');
    await user.click(screen.getByRole('button', { name: 'Encender vela' }));
    expect(await screen.findByRole('heading', { name: 'Velas encendidas (1)' })).toBeInTheDocument();
    const card = screen.getByText(/«por mi familia»/);
    expect(card.compareDocumentPosition(screen.getByRole('heading', { name: 'Encender una vela nueva' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // la vela sale encima del formulario
    expect(screen.queryByText(/Enciende tu primera vela/)).not.toBeInTheDocument();
  });

  // ───────── Aviso de recordatorios tras una oración ─────────
  const NUDGE = '¿Quieres que te recordemos orar?';
  async function escribirOracion(user, texto = 'Quiero dar gracias por mi familia') {
    await user.type(await screen.findByLabelText(/qué oración nace hoy de tu corazón/i), texto);
    await user.click(screen.getByRole('button', { name: 'Escribir mi oración' }));
    await screen.findByText(/Oración creada para ti/);
  }
  const sinAviso = async () => { await new Promise((r) => setTimeout(r, 350)); expect(screen.queryByText(NUDGE)).not.toBeInTheDocument(); };

  test('tras una oración se ofrece activar los recordatorios y el botón lleva a su tarjeta en Cuenta', async () => {
    const user = userEvent.setup(); const restore = mockPush(); const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      await registrar(user);
      await escribirOracion(user);
      expect(await screen.findByText(NUDGE)).toBeInTheDocument();
      expect(screen.getByText(/por ejemplo cada 3 horas/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Activar recordatorios' }));
      expect(await screen.findByRole('heading', { name: 'Recordatorios de oración' })).toBeInTheDocument();
      await waitFor(() => expect(spy).toHaveBeenCalled());                       // baja hasta la tarjeta
    } finally { spy.mockRestore(); restore(); }
  });

  test('«Ahora no» oculta el aviso y no vuelve a salir en la siguiente oración', async () => {
    const user = userEvent.setup(); const restore = mockPush();
    try {
      await registrar(user);
      await escribirOracion(user);
      await user.click(await screen.findByRole('button', { name: 'Ahora no' }));
      expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
      expect(Number(localStorage.getItem('oracion.remNudgeUntil'))).toBeGreaterThan(Date.now() + 20 * 86400000); // se pospone unas semanas
      await user.click(screen.getByRole('button', { name: 'Escribir otra' }));
      await escribirOracion(user, 'Otra oración para hoy');
      await sinAviso();
    } finally { restore(); }
  });

  test('si los recordatorios ya están activados, no se vuelve a ofrecer', async () => {
    const user = userEvent.setup(); const restore = mockPush();
    try {
      await registrar(user);
      const json = { 'content-type': 'application/json' };
      await fetch('/api/reminders/subscribe', { method: 'POST', headers: json, body: JSON.stringify({ subscription: { endpoint: 'https://push.example/ya-activado', keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } } }) });
      await fetch('/api/reminders', { method: 'PUT', headers: json, body: JSON.stringify({ enabled: true, times: ['08:00'], tz: 'Europe/Madrid' }) });
      await escribirOracion(user);
      await sinAviso();
    } finally { restore(); }
  });

  test('en un navegador sin soporte no se ofrece; en iPhone sin instalar sí, y lleva a las instrucciones', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await escribirOracion(user);
    await sinAviso();                                                            // sin soporte: nada que ofrecer
    cleanup(); globalThis.__resetJar__(); localStorage.clear();
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    try {
      const user2 = userEvent.setup();
      await registrar(user2);
      await escribirOracion(user2);
      await user2.click(await screen.findByRole('button', { name: 'Activar recordatorios' }));
      expect(await screen.findByText(/En iPhone y iPad: pulsa Compartir/)).toBeInTheDocument();
    } finally { delete navigator.userAgent; }
  });

  test('el aviso de apagar habla a la persona en segunda persona: «mi madre» se convierte en «tu madre»', async () => {
    expect(toSecondPerson('mi madre')).toBe('tu madre');
    expect(toSecondPerson('Mi abuela Rosa')).toBe('Tu abuela Rosa');
    expect(toSecondPerson('mis hijos y mi esposa')).toBe('tus hijos y tu esposa');
    expect(toSecondPerson('por mí y conmigo')).toBe('por ti y contigo');
    expect(toSecondPerson('Pablo')).toBe('Pablo');                 // un nombre propio no cambia
    expect(toSecondPerson('mimosa')).toBe('mimosa');               // no toca palabras que solo empiezan igual
    expect(toSecondPerson('')).toBe('');
    const user = userEvent.setup();
    await registrar(user);
    await user.click(tab('Capilla'));
    await user.type(await screen.findByLabelText(/Por quién la enciendes/), 'mi madre');
    await user.type(screen.getByLabelText('¿Cuál es tu intención?'), 'por su recuperación');
    await user.click(screen.getByRole('button', { name: 'Encender vela' }));
    await screen.findByText(/«por su recuperación»/);
    await user.click(screen.getByRole('button', { name: 'Apagar' }));
    const dlg = await screen.findByRole('dialog', { name: '¿Apagar esta vela?', hidden: true });
    expect(within(dlg).getByText('¿Seguro que quieres apagar la vela de tu madre?')).toBeInTheDocument();
  });
});

