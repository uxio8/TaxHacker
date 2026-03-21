import config from "@/lib/config"

export default async function AI() {
  return (
    <div className="prose prose-slate max-w-none">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-6">Información sobre el uso de IA</h1>

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

      <p className="text-gray-700 leading-relaxed mb-6">
        En TaxHacker utilizamos inteligencia artificial (&quot;IA&quot;) para impulsar las funciones principales de la
        plataforma. Este documento explica cómo y por qué usamos tecnologías de IA, qué datos se procesan y cómo puede
        afectarte como usuario.
      </p>

      <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">1. Finalidad de la IA en TaxHacker</h2>
      <p className="text-gray-700 leading-relaxed mb-3">La IA es esencial en la experiencia de TaxHacker y se usa para:</p>
      <ul className="list-disc pl-6 space-y-2 mb-6 text-gray-700">
        <li>Reconocimiento óptico de caracteres (OCR) de facturas y tickets escaneados</li>
        <li>Categorización y etiquetado automático de transacciones financieras</li>
        <li>Resumen de gastos y descripciones de proveedores</li>
        <li>Relleno inteligente de campos dentro de formularios</li>
        <li>Flujos personalizados guiados por prompts</li>
      </ul>
      <p className="text-gray-700 leading-relaxed mb-6">
        Todo el contenido generado por IA es visible directamente en la interfaz y puede aplicarse a tus transacciones,
        proyectos e informes.
      </p>

      <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">2. Proveedores y modelos de IA</h2>
      <p className="text-gray-700 leading-relaxed mb-3">
        Nuestra versión cloud utiliza modelos proporcionados por <strong>OpenAI</strong>, entre ellos:
      </p>
      <ul className="list-disc pl-6 space-y-2 mb-6 text-gray-700">
        <li>
          <strong>gpt-4o-mini</strong> and <strong>gpt-4.1-mini</strong>
        </li>
      </ul>
      <p className="text-gray-700 leading-relaxed mb-6">
        En la <strong>versión self-hosted</strong>, los usuarios pueden conectar sus propios modelos de lenguaje o
        backends de IA. No auditamos ni supervisamos esas configuraciones y no asumimos responsabilidad por sus
        resultados.
      </p>

      <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">3. Datos enviados para procesamiento con IA</h2>
      <p className="text-gray-700 leading-relaxed mb-3">
        Para ofrecer funciones basadas en IA, enviamos determinados datos del usuario a la API de OpenAI, incluidos:
      </p>
      <ul className="list-disc pl-6 space-y-2 mb-6 text-gray-700">
        <li>Documentos subidos, como tickets y facturas</li>
        <li>Metadatos de transacciones asociados y campos aportados por el usuario</li>
        <li>Contexto histórico de transacciones anteriores, si hace falta para el análisis</li>
      </ul>
      <p className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-4">
        <strong className="text-amber-600">⚠️ Nota:</strong> Estos datos <strong>no se anonimizan ni se redactan</strong>{" "}
        antes de su envío. Al usar TaxHacker, reconoces y consientes esta transferencia.
      </p>
      <p className="text-gray-700 leading-relaxed mb-6">
        Guardamos en tu cuenta los <strong>resultados estructurados</strong> de la IA, como campos interpretados o
        categorizaciones, para futuros usos. <strong>No</strong> almacenamos prompts o respuestas en bruto más allá de
        lo necesario para completar tus datos.
      </p>

      <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">4. Intervención humana</h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        <strong>No</strong> revisamos manualmente el contenido generado por IA. Actualmente no existe un mecanismo de
        revisión humana, marcado de errores o corrección manual dentro del proceso.
      </p>
      <p className="text-gray-700 leading-relaxed mb-6">
        Los usuarios son los únicos responsables de verificar la exactitud de los resultados procesados por IA antes de
        utilizarlos con fines financieros o de reporting.
      </p>

      <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">5. Exclusión voluntaria y dependencia del sistema</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        El procesamiento con IA es un componente fundamental de TaxHacker y no puede desactivarse. Si no consientes que
        tus datos se procesen mediante IA, no deberías usar la plataforma.
      </p>

      <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">6. Toma de decisiones automatizada</h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        Nuestros sistemas de IA no toman decisiones legales o financieras vinculantes en tu nombre. Aun así, pueden
        sugerir categorías, valores o resúmenes a partir de los datos que facilitas.
      </p>
      <p className="text-gray-700 leading-relaxed mb-6">
        Aunque estos resultados pueden influir en cómo se estructuran o interpretan tus datos,{" "}
        <strong>no se usan para tomar decisiones automatizadas con efectos legales o significativos</strong> en el
        sentido del artículo 22 del RGPD.
      </p>

      <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">7. Riesgos y limitaciones</h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        Los resultados generados por IA son probabilísticos y pueden contener errores, omisiones o malas
        interpretaciones. <strong>No garantizamos</strong> su exactitud, integridad ni adecuación para fines fiscales,
        legales o financieros.
      </p>
      <p className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
        <strong className="text-red-600">⚠️ Importante:</strong> TaxHacker <strong>no sustituye</strong> a un contable,
        asesor fiscal o abogado. Úsalo bajo tu propia responsabilidad.
      </p>
    </div>
  )
}
