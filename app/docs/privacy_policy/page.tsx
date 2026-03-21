import config from "@/lib/config"
import { createPageMetadata } from "@/lib/i18n"

export const metadata = createPageMetadata("docs.privacy.title")

export default async function PrivacyPolicy() {
  return (
    <div className="prose prose-slate max-w-none">
      <h2 className="text-3xl font-bold mb-6 text-slate-900 border-b pb-2">
        <strong>Política de privacidad</strong>
      </h2>

      <p className="text-slate-700 mb-6 leading-relaxed bg-yellow-50 p-3 border-l-4 border-yellow-400">
        <strong className="text-slate-800">Resumen:</strong> Si te importa de verdad la privacidad de tus datos, usa la
        versión self-hosted. Ninguna nube es infalible. Utilizas la plataforma bajo tu propia responsabilidad.
      </p>

      <p className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
        <strong className="text-slate-700">Fecha de entrada en vigor</strong>: 22 de abril de 2025
        <br />
        <strong className="text-slate-700">Correo de contacto</strong>:{" "}
        <a href={`mailto:${config.app.supportEmail}`} className="text-blue-600 hover:text-blue-800">
          {config.app.supportEmail}
        </a>
        <br />
        <strong className="text-slate-700">Dominio</strong>:{" "}
        <a href="https://taxhacker.app" className="text-blue-600 hover:text-blue-800">
          https://taxhacker.app
        </a>
      </p>

      <p className="text-slate-700 mb-6 leading-relaxed">
        TaxHacker (&quot;nosotros&quot;) se compromete a proteger tu privacidad. Esta Política de privacidad describe
        cómo recopilamos, usamos, almacenamos y protegemos tus datos personales cuando utilizas nuestros servicios en{" "}
        <a href="https://taxhacker.app" className="text-blue-600 hover:text-blue-800">
          taxhacker.app
        </a>
        .
      </p>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        1. <strong>Qué datos recopilamos</strong>
      </h3>
      <p className="text-slate-700 mb-3">Recopilamos los siguientes tipos de datos cuando usas TaxHacker:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>
          <strong className="text-slate-800">Datos de la cuenta</strong>: correo electrónico, nombre visible y avatar
          opcional. No almacenamos contraseñas.
        </li>
        <li>
          <strong className="text-slate-800">Datos de comunicación</strong>: correos que enviamos para verificación,
          novedades o newsletter.
        </li>
        <li>
          <strong className="text-slate-800">Archivos subidos</strong>: facturas, tickets y cualquier otro archivo que
          subas, que puede contener información personal o financiera sensible.
        </li>
        <li>
          <strong className="text-slate-800">Metadatos de sesión</strong>: dirección IP, tipo de navegador y marcas de
          tiempo relacionadas con la seguridad de la sesión.
        </li>
        <li>
          <strong className="text-slate-800">Datos de uso del servicio</strong>: metadatos relacionados con tu actividad
          dentro de la plataforma, como número de archivos subidos o consumo de tokens de IA.
        </li>
      </ul>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        2. <strong>Cómo usamos tus datos</strong>
      </h3>
      <p className="text-slate-700 mb-3">Usamos tus datos para:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700">
        <li>Crear y gestionar tu cuenta de TaxHacker</li>
        <li>Almacenar y analizar los archivos que subes</li>
        <li>Mejorar tu organización financiera mediante insights basados en IA</li>
        <li>Comunicarnos contigo sobre tu cuenta y sobre novedades del servicio</li>
        <li>Cumplir obligaciones legales</li>
      </ul>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        3. <strong>Procesamiento con IA</strong>
      </h3>
      <p className="text-slate-700 mb-3">
        Utilizamos servicios externos de IA, concretamente <strong className="text-slate-800">OpenAI (ChatGPT)</strong>,
        para:
      </p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-700">
        <li>Extraer e interpretar información de facturas mediante OCR</li>
        <li>Analizar datos financieros para ofrecer mejores insights</li>
      </ul>

      <p className="text-slate-700 mb-6 leading-relaxed">
        Al usar TaxHacker, consientes la transferencia de los datos necesarios a estos proveedores terceros para su
        procesamiento. Estos proveedores pueden operar fuera de la UE, con las salvaguardas adecuadas conforme al RGPD
        (por ejemplo, cláusulas contractuales tipo).
      </p>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        4. <strong>Cookies y seguimiento</strong>
      </h3>
      <p className="text-slate-700 mb-6 leading-relaxed">
        TaxHacker <strong className="text-slate-800">no usa cookies de seguimiento</strong> ni analítica de terceros.
        Solo recopilamos registros agregados de acceso y estadísticas de uso mediante{" "}
        <strong className="text-slate-800">Cloudflare</strong> para rendimiento y seguridad de la infraestructura.
      </p>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        5. <strong>Almacenamiento y seguridad de los datos</strong>
      </h3>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-700">
        <li>
          Todos los datos se almacenan en servidores de <strong className="text-slate-800">Alemania</strong> alojados en{" "}
          <strong className="text-slate-800">Hetzner Cloud</strong>.
        </li>
        <li>Los archivos y datos personales se almacenan sin cifrado.</li>
        <li>El acceso a datos personales se limita a miembros autorizados del equipo para depuración o soporte.</li>
      </ul>

      <p className="text-slate-700 mb-6 leading-relaxed bg-yellow-50 p-3 border-l-4 border-yellow-400">
        Aunque intentamos mantener salvaguardas razonables, ningún sistema es completamente seguro. Utiliza la
        plataforma bajo tu propia responsabilidad.
      </p>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        6. <strong>Base jurídica del tratamiento</strong>
      </h3>
      <p className="text-slate-700 mb-3">Tratamos datos personales sobre la base de:</p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-700">
        <li>
          <strong className="text-slate-800">Tu consentimiento</strong>, que otorgas al crear una cuenta o subir datos
        </li>
        <li>
          <strong className="text-slate-800">Nuestras obligaciones contractuales</strong> para prestar los servicios a
          los que te has apuntado
        </li>
      </ul>

      <p className="text-slate-700 mb-6 leading-relaxed">
        Puedes retirar el consentimiento en cualquier momento eliminando tu cuenta o contactando con nosotros.
      </p>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        7. <strong>Conservación de los datos</strong>
      </h3>
      <p className="text-slate-700 mb-3">Conservamos tus datos:</p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-700">
        <li>Mientras tu cuenta siga activa</li>
        <li>Hasta que solicites su eliminación</li>
      </ul>

      <p className="text-slate-700 mb-6 leading-relaxed">
        Una vez eliminados, tus datos se borran de nuestros sistemas, aunque algunos registros residuales pueden
        permanecer durante un tiempo limitado por copias de seguridad o necesidades operativas.
      </p>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        8. <strong>Tus derechos (RGPD y normativas similares)</strong>
      </h3>
      <p className="text-slate-700 mb-3">Como usuario, tienes derecho a:</p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-700">
        <li>Acceder y revisar tus datos personales</li>
        <li>Corregir o actualizar información inexacta</li>
        <li>Descargar una copia completa de tus datos</li>
        <li>Solicitar la eliminación permanente de tu cuenta y de los datos asociados</li>
        <li>Oponerte a determinadas formas de tratamiento</li>
        <li>Presentar una reclamación ante una autoridad de protección de datos</li>
      </ul>

      <p className="text-slate-700 mb-6 leading-relaxed">
        Para ejercer tus derechos, escríbenos a{" "}
        <a href={`mailto:${config.app.supportEmail}`} className="text-blue-600 hover:text-blue-800">
          {config.app.supportEmail}
        </a>
        .
      </p>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        9. <strong>Privacidad de menores</strong>
      </h3>
      <p className="text-slate-700 mb-6 leading-relaxed">
        TaxHacker <strong className="text-slate-800">no está dirigido a menores de 18 años</strong>. No recopilamos ni
        almacenamos conscientemente datos de menores.
      </p>

      <hr className="my-8 border-slate-200" />

      <h3 className="text-2xl font-semibold text-slate-800 mb-4">
        10. <strong>Cambios en esta política</strong>
      </h3>
      <p className="text-slate-700 mb-6 leading-relaxed">
        Podemos actualizar esta Política de privacidad de vez en cuando. Cualquier cambio se publicará en esta página con
        la &quot;Fecha de entrada en vigor&quot; actualizada. Te recomendamos revisarla periódicamente.
      </p>
    </div>
  )
}
