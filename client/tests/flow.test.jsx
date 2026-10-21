import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';

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
    await user.type(screen.getByLabelText(/qué quieres llevar a oración/i), 'Mañana tengo una entrevista de trabajo y estoy nervioso');
    await user.click(screen.getByRole('button', { name: 'Escribir mi oración' }));
    expect(await screen.findByText(/Oración escrita por una IA/)).toBeInTheDocument();
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
      await user.type(await screen.findByLabelText(/qué quieres llevar a oración/i), `Oración de prueba número ${i + 1}`);
      await user.click(screen.getByRole('button', { name: 'Escribir mi oración' }));
      await user.click(await screen.findByRole('button', { name: 'Escribir otra' }));
    }
    expect(await screen.findByText(/Has usado tus 3 oraciones gratuitas/)).toBeInTheDocument();
    expect(screen.getByLabelText(/qué quieres llevar a oración/i)).toBeDisabled();
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
    await user.type(screen.getByLabelText(/qué quieres llevar a oración/i), 'me quiero morir');
    await user.click(screen.getByRole('button', { name: 'Escribir mi oración' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/me importa que estés a salvo/);
    expect(alerta).toHaveTextContent(/no se ha guardado/);
    expect(screen.queryByText(/Oración escrita por una IA/)).not.toBeInTheDocument();
    await user.click(tab('Diario'));
    expect(await screen.findByText('Aquí se guardarán tus oraciones.')).toBeInTheDocument();
  });

  test('acompañante: responde, avisa de que es una IA y muestra ayuda ante riesgo alto', async () => {
    const user = userEvent.setup();
    await registrar(user);
    await user.click(tab('Hablar'));
    expect(await screen.findByText(/No es Dios, ni un pastor, ni un terapeuta/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Tu mensaje'), 'Me siento perdido con mi trabajo');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(/Versión de prueba/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Tu mensaje'), 'no quiero seguir viviendo');
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
    await user.type(screen.getByLabelText(/qué quieres llevar a oración/i), 'Quiero dar gracias por mi familia');
    await user.click(screen.getByRole('button', { name: 'Escribir mi oración' }));
    await screen.findByText(/Oración escrita por una IA/);
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
});
