import config from "@/lib/config"
import { createPageMetadata } from "@/lib/i18n"

export const metadata = createPageMetadata("docs.cookie.title")

export default async function Cookie() {
  return (
    <div className="prose prose-slate max-w-none">
      <h1 className="text-3xl font-bold mb-6 text-slate-900 border-b pb-2">Política de cookies</h1>
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
        Esta Política de cookies explica cómo TaxHacker utiliza cookies y tecnologías similares cuando visitas nuestra
        web o utilizas nuestros servicios.
      </p>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">1. ¿Qué son las cookies?</h2>
      <p className="text-slate-700 mb-6 leading-relaxed">
        Las cookies son pequeños archivos de texto que el navegador guarda en tu dispositivo cuando visitas sitios web.
        Se usan ampliamente para que las webs funcionen de forma más eficiente y para proporcionar información a sus
        propietarios.
      </p>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">2. Cómo usamos las cookies</h2>
      <p className="text-slate-700 mb-3">
        Usamos cookies <strong className="text-slate-800">únicamente para fines esenciales</strong>, entre ellos:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          Mantener las <strong className="text-slate-800">sesiones y la autenticación</strong> del usuario
        </li>
        <li>
          Habilitar <strong className="text-slate-800">caché y mejoras de rendimiento</strong>
        </li>
        <li>
          Garantizar la <strong className="text-slate-800">seguridad</strong>, incluida la protección frente a DDoS y
          bots a través de Cloudflare
        </li>
      </ul>
      <p className="text-slate-700 mb-3">
        <strong className="text-slate-800">No</strong> usamos cookies para:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>Publicidad o seguimiento del comportamiento</li>
        <li>Analítica o perfilado</li>
        <li>Servicios publicitarios de terceros</li>
      </ul>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">3. Infraestructura de terceros</h2>
      <p className="text-slate-700 mb-6 leading-relaxed">
        Dependemos de un número limitado de servicios de terceros que pueden establecer sus propias cookies o usar
        tecnologías relacionadas:
      </p>

      <div className="overflow-x-auto mb-6">
        <table className="min-w-full border-collapse border border-slate-200 rounded-lg">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-200 px-6 py-3 text-left text-sm font-semibold text-slate-700">
                Proveedor
              </th>
              <th className="border border-slate-200 px-6 py-3 text-left text-sm font-semibold text-slate-700">
                Finalidad
              </th>
              <th className="border border-slate-200 px-6 py-3 text-left text-sm font-semibold text-slate-700">
                Uso de cookies
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">
                <strong className="text-slate-800">Cloudflare</strong>
              </td>
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">
                CDN, caché, seguridad y protección frente a bots
              </td>
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">Sí, esenciales</td>
            </tr>
            <tr className="bg-slate-50">
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">
                <strong className="text-slate-800">Stripe</strong>
              </td>
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">
                Procesamiento de pagos, suscripciones y facturación
              </td>
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">Sí, esenciales</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">
                <strong className="text-slate-800">GitHub</strong>
              </td>
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">
                Recursos embebidos u OAuth, si se utiliza
              </td>
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">Posiblemente, si se incrusta</td>
            </tr>
            <tr className="bg-slate-50">
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">
                <strong className="text-slate-800">Sentry</strong>
              </td>
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">Monitorización de errores</td>
              <td className="border border-slate-200 px-6 py-4 text-sm text-slate-700">
                No usa cookies, pero puede recopilar metadatos del navegador
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">4. Tus opciones respecto a las cookies</h2>
      <p className="text-slate-700 mb-4 leading-relaxed">
        Actualmente no mostramos un banner de cookies porque solo utilizamos cookies estrictamente necesarias para el
        funcionamiento del sitio.
      </p>
      <p className="text-slate-700 mb-6 leading-relaxed">
        Si lo prefieres, puedes bloquear o eliminar las cookies desde la configuración del navegador. Eso sí, puede
        afectar a funciones esenciales de la web, como el inicio de sesión o la persistencia de la sesión.
      </p>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">5. Cambios en esta política</h2>
      <p className="text-slate-700 mb-6 leading-relaxed">
        Podemos actualizar esta Política de cookies de vez en cuando. La versión más reciente estará siempre disponible
        en esta página con la fecha de entrada en vigor actualizada.
      </p>

      <h2 className="text-2xl font-semibold text-slate-800 mb-4">6. Contacto</h2>
      <p className="text-slate-700 mb-6 leading-relaxed">
        Si tienes dudas sobre nuestro uso de cookies, escríbenos a{" "}
        <a href={`mailto:${config.app.supportEmail}`} className="text-blue-600 hover:text-blue-800">
          {config.app.supportEmail}
        </a>
        .
      </p>
    </div>
  )
}
