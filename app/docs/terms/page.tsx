import config from "@/lib/config"

export default async function Terms() {
  return (
    <div className="prose prose-slate max-w-none">
      <h1 className="text-3xl font-bold mb-6 text-slate-900 border-b pb-2">Términos del servicio</h1>
      <p className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
        <strong className="text-slate-700">Fecha de entrada en vigor:</strong> 22 de abril de 2025
        <br />
        <strong className="text-slate-700">Servicio:</strong>{" "}
        <a href="https://taxhacker.app" className="text-blue-600 hover:text-blue-800">
          https://taxhacker.app
        </a>
        <br />
        <strong className="text-slate-700">Contacto:</strong>{" "}
        <a href={`mailto:${config.app.supportEmail}`} className="text-blue-600 hover:text-blue-800">
          {config.app.supportEmail}
        </a>
      </p>

      <p className="text-slate-700 mb-6 leading-relaxed">
        Estos Términos del servicio (&quot;Términos&quot;) regulan tu acceso y uso de TaxHacker, un analizador de
        facturas y gestor de gastos automatizado impulsado por inteligencia artificial (IA). Al acceder o utilizar
        nuestros servicios, aceptas quedar vinculado por estos Términos.
      </p>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">1. Descripción del servicio</h2>
      <p className="text-slate-700 mb-3">TaxHacker ofrece:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          Una <strong className="text-slate-800">plataforma cloud</strong> con planes de suscripción de pago
          (mensuales o anuales)
        </li>
        <li>
          Una <strong className="text-slate-800">versión self-hosted</strong> disponible gratis y sin garantías de
          soporte
        </li>
      </ul>
      <p className="text-slate-700 mb-6 leading-relaxed">
        Los usuarios pueden subir facturas y tickets, analizar transacciones y gestionar gastos mediante herramientas
        impulsadas por IA. El servicio está pensado principalmente para autónomos y pequeños negocios.
      </p>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">2. Requisitos y uso de la cuenta</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          Debes tener al menos <strong className="text-slate-800">18 años</strong> para usar TaxHacker.
        </li>
        <li>
          Puedes registrar y mantener <strong className="text-slate-800">varias cuentas</strong>.
        </li>
        <li>
          Eres responsable de mantener la confidencialidad de tus credenciales y de toda la actividad realizada desde tu
          cuenta.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">3. Suscripciones y pagos</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          Los planes de pago se gestionan mediante <strong className="text-slate-800">Stripe</strong> y todas las
          suscripciones <strong className="text-slate-800">se renuevan automáticamente</strong> salvo cancelación.
        </li>
        <li>Puedes cancelar tu suscripción o eliminar tu cuenta en cualquier momento desde tu panel.</li>
        <li>
          Ofrecemos una <strong className="text-slate-800">política de reembolso sin preguntas</strong>, pero nos
          reservamos el derecho a <strong className="text-slate-800">descontar costes</strong> derivados del uso de la
          IA, como consumo de tokens, y de cargos de terceros ya incurridos.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">4. Responsabilidades del usuario</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          Puedes subir cualquier factura o ticket <strong className="text-slate-800">bajo tu criterio</strong>, pero{" "}
          <strong className="text-slate-800">eres el único responsable</strong> del contenido que subes.
        </li>
        <li>
          Queda terminantemente prohibido subir <strong className="text-slate-800">material ilegal, fraudulento o
          protegido por derechos de autor</strong> sin permiso. El incumplimiento puede implicar la suspensión o cierre
          inmediato de la cuenta.
        </li>
        <li>
          <strong className="text-slate-800">No puedes redistribuir, revender ni ofrecer a terceros nuestros análisis
          de IA o servicios</strong> sin nuestro consentimiento por escrito.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">5. Uso de IA e integraciones de terceros</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          TaxHacker utiliza <strong className="text-slate-800">OpenAI (ChatGPT)</strong> y otras APIs de terceros para
          procesar y analizar documentos.
        </li>
        <li>
          Al usar el servicio, nos autorizas a procesar tus datos a través de estos proveedores con las salvaguardas
          adecuadas conforme al RGPD.
        </li>
        <li>
          Podemos permitir <strong className="text-slate-800">plugins e integraciones</strong> desarrollados por la
          comunidad para ampliar funcionalidades.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">6. Propiedad intelectual</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          Conservas la <strong className="text-slate-800">plena titularidad</strong> de lo que subes y de cualquier
          análisis resultante.
        </li>
        <li>
          TaxHacker <strong className="text-slate-800">no reclama ningún derecho</strong> sobre tus datos.
        </li>
        <li>
          Eres libre de <strong className="text-slate-800">reutilizar, descargar, publicar o exportar</strong>
          cualquier dato procesado por el servicio.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">7. Limitación de responsabilidad</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          TaxHacker se ofrece <strong className="text-slate-800">&quot;tal cual&quot;</strong>, sin garantías de ningún
          tipo.
        </li>
        <li>
          <strong className="text-slate-800">No garantizamos</strong> la exactitud de los resultados generados por IA ni
          la idoneidad del servicio para contabilidad, presentación de impuestos o cumplimiento normativo.
        </li>
        <li className="bg-yellow-50 p-3 border-l-4 border-yellow-400">
          <strong className="text-slate-800">⚠️ Importante:</strong> TaxHacker <strong className="text-slate-800">no
          sustituye</strong> el asesoramiento fiscal o legal profesional. Usas el servicio{" "}
          <strong className="text-slate-800">bajo tu propia responsabilidad</strong>.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">8. Modificaciones del servicio y terminación</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          Nos reservamos el derecho a <strong className="text-slate-800">modificar o interrumpir</strong> el servicio
          en cualquier momento, con o sin previo aviso.
        </li>
        <li>Podemos suspender o cancelar tu cuenta si incumples estos Términos o haces un uso abusivo del servicio.</li>
      </ul>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">9. Ley aplicable y resolución de conflictos</h2>
      <p className="text-slate-700 mb-6 leading-relaxed">
        Estos Términos se rigen por las leyes de <strong className="text-slate-800">Alemania</strong>.<br />
        Cualquier conflicto se resolverá exclusivamente en los tribunales de{" "}
        <strong className="text-slate-800">Alemania</strong>, salvo que la legislación aplicable disponga otra cosa.
      </p>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">10. Cambios en estos Términos</h2>
      <p className="text-slate-700 mb-6 leading-relaxed">
        Podemos revisar estos Términos en cualquier momento. Si hacemos cambios relevantes, avisaremos por correo o con
        una notificación dentro de la app. El uso continuado del servicio tras esos cambios implica la aceptación de los
        nuevos Términos.
      </p>
    </div>
  )
}
