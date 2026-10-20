import { useApp } from '../store.jsx';
import { APP_NAME } from '../brand.js';

function Page({ title, children }) {
  const { config, route } = useApp();
  return (
    <main className="shell bare legal stack">
      <button className="btn quiet" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => (window.history.length > 1 ? window.history.back() : route.navigate('/'))}>Volver</button>
      <h1 className="screen-title">{title}</h1>
      {config?.legalDraftBanner && <p className="legal-banner" role="note"><b>Borrador sin revisar.</b> Este texto es una base de trabajo y debe revisarlo un abogado antes de publicar la aplicación. Los datos entre corchetes están por completar.</p>}
      {children}
    </main>
  );
}

export function Privacy() {
  const { config } = useApp();
  const l = config?.legal || {};
  return (
    <Page title="Política de privacidad">
      <p>Última actualización: {config?.privacyVersion}.</p>
      <h2>1. Quién trata tus datos</h2>
      <p>{l.entity}, con domicilio en {l.address}. Contacto: <a href={`mailto:${config?.supportEmail}`}>{config?.supportEmail}</a>.</p>
      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>Tu correo y tu contraseña (guardada cifrada, nunca en claro).</li>
        <li>Lo que escribes: oraciones, intenciones de velas y conversaciones con el acompañante. Pueden revelar tus creencias religiosas y tu estado emocional, que son datos de categoría especial.</li>
        <li>Tu plan, tus compras y tu uso mensual. Los pagos los procesa Stripe: nosotros no vemos los datos de tu tarjeta.</li>
        <li>Tu dirección IP, solo en el momento de la petición, para deducir tu país y mostrarte el teléfono de ayuda correcto. No la guardamos.</li>
      </ul>
      <h2>3. Para qué y con qué base legal</h2>
      <ul>
        <li>Prestarte el servicio (oraciones, diario, velas, acompañante): ejecución del contrato.</li>
        <li>Tratar lo que escribes, que puede revelar creencias religiosas o salud emocional: tu consentimiento explícito, que das al crear la cuenta y puedes retirar en cualquier momento borrando tu cuenta.</li>
        <li>Facturación y obligaciones fiscales: obligación legal.</li>
        <li>Seguridad y prevención de abusos: interés legítimo.</li>
      </ul>
      <h2>4. Inteligencia artificial</h2>
      <p>Para escribir tu oración y responder en el acompañante, enviamos lo que escribes a un proveedor de IA (Anthropic), que actúa como encargado del tratamiento. Los versículos nunca los genera la IA: salen de una base de texto bíblico. Revisa las condiciones vigentes del proveedor sobre el uso de datos enviados por API. [Verificar antes de publicar.]</p>
      <h2>5. Detección de riesgo</h2>
      <p>Analizamos automáticamente lo que escribes para detectar señales de riesgo (por ejemplo, de suicidio o autolesión) y mostrarte ayuda. Es automático, puede equivocarse y no sustituye a un profesional. Si detectamos riesgo alto, no generamos la oración y no guardamos ese texto.</p>
      <h2>6. Con quién lo compartimos</h2>
      <p>Con proveedores que nos prestan servicio: IA (Anthropic), pagos (Stripe), alojamiento y base de datos (Railway) y correo (Resend). Algunos están en Estados Unidos; las transferencias se amparan en las garantías previstas por el RGPD (por ejemplo, cláusulas contractuales tipo). No vendemos tus datos ni los usamos para publicidad.</p>
      <h2>7. Cuánto tiempo los guardamos</h2>
      <p>Mientras tengas cuenta. Si la borras, eliminamos tu diario, velas y conversaciones. Conservaremos solo lo que la ley nos obligue (por ejemplo, datos de facturación) durante el plazo legal.</p>
      <h2>8. Tus derechos</h2>
      <p>Puedes acceder a tus datos, rectificarlos, borrarlos, limitar u oponerte a su tratamiento, y pedir su portabilidad. Desde Cuenta puedes descargar todos tus datos y borrar tu cuenta. También puedes escribirnos. Si crees que no tratamos bien tus datos, puedes reclamar ante la autoridad de protección de datos de tu país (en España, la AEPD; en Andorra, la APDA).</p>
      <h2>9. Cookies</h2>
      <p>Usamos una única cookie de sesión, necesaria para mantenerte conectado. No usamos cookies de publicidad ni de analítica de terceros.</p>
      <h2>10. Edad</h2>
      <p>{APP_NAME} es para mayores de 18 años.</p>
      <h2>11. Cambios</h2>
      <p>Si cambiamos esta política de forma relevante, te lo diremos en la aplicación.</p>
    </Page>
  );
}

export function Terms() {
  const { config } = useApp();
  const l = config?.legal || {};
  return (
    <Page title="Términos de uso">
      <p>Última actualización: {config?.privacyVersion}. Servicio ofrecido por {l.entity}.</p>
      <h2>1. Qué es {APP_NAME}</h2>
      <p>Una aplicación para orar y reflexionar: oraciones escritas por una IA, versículos bíblicos, un diario, velas virtuales y un acompañante conversacional.</p>
      <h2>2. Lo que no es</h2>
      <p>No somos Dios, ni un pastor, ni un terapeuta, ni un médico. La IA no habla en nombre de Dios y puede equivocarse. No uses la aplicación para decidir sobre tu salud, tus tratamientos, tu dinero o tu seguridad. Si estás en peligro, llama a emergencias o a una línea de ayuda.</p>
      <h2>3. Tu cuenta</h2>
      <p>Debes ser mayor de 18 años, dar datos veraces y cuidar tu contraseña.</p>
      <h2>4. Planes y pagos</h2>
      <p>Hay un plan gratuito con límites mensuales y un plan Premium de pago. Premium se renueva automáticamente cada mes o cada año hasta que lo canceles desde Cuenta. Al cancelar, conservas el acceso hasta el final del periodo pagado y tu diario no se borra. Los precios incluyen los impuestos aplicables.</p>
      <h2>5. Velas y créditos</h2>
      <p>Son contenido digital que se entrega de inmediato. Al comprarlos aceptas que pierdes el derecho de desistimiento de 14 días una vez comenzada la prestación. Una vela es un gesto de acompañamiento: no garantiza ningún resultado.</p>
      <h2>6. Uso aceptable</h2>
      <p>No uses el servicio para dañar a otras personas, para vulnerar la ley ni para intentar saltarte los límites o la seguridad.</p>
      <h2>7. Disponibilidad</h2>
      <p>Hacemos lo posible por que funcione siempre, pero puede haber interrupciones. Podemos cambiar o mejorar el servicio.</p>
      <h2>8. Responsabilidad</h2>
      <p>En lo que permita la ley, no respondemos de decisiones tomadas a partir de contenidos generados por la IA. Esto no limita los derechos que la ley reconoce a los consumidores.</p>
      <h2>9. Ley aplicable</h2>
      <p>[Por definir con el abogado: ley y tribunales aplicables.]</p>
    </Page>
  );
}
