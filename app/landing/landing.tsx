import { ColoredText } from "@/components/ui/colored-text"
import config from "@/lib/config"
import Image from "next/image"
import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      <header className="py-6 px-4 md:px-8 bg-white/90 backdrop-blur-xl shadow-lg border-b border-gradient-to-r from-pink-200 to-indigo-200 fixed w-full z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Image
                src="/logo/256.png"
                alt="Logo"
                width={32}
                height={32}
                className="h-8 group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-indigo-600 rounded-full opacity-20 blur-md group-hover:opacity-40 transition-opacity duration-300" />
            </div>
            <ColoredText className="text-2xl font-bold">TaxHacker</ColoredText>
          </Link>
          <Link
            href="/enter"
            className="cursor-pointer font-medium px-4 py-2 rounded-full border-2 border-gradient-to-r from-pink-300 to-indigo-300 hover:from-pink-400 hover:to-indigo-400 bg-white/80 hover:bg-white transition-all duration-300 hover:scale-105 text-xs md:text-sm"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-100/50 via-purple-100/30 to-indigo-100/50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-pink-400 to-indigo-400 rounded-full opacity-10 blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-indigo-400 to-pink-400 rounded-full opacity-10 blur-3xl animate-pulse" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-block px-6 py-3 rounded-full border-2 border-pink-600/50 text-sm font-medium mb-6 shadow-lg hover:shadow-xl transition-all duration-300">
              🚀 En desarrollo activo
            </div>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl mb-6 bg-gradient-to-r from-gray-900 via-pink-700 to-indigo-700 bg-clip-text text-transparent pb-2">
              Deja que la IA se ocupe de tus impuestos, escanee tus tickets y analice tus gastos
            </h1>
            <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto font-medium">
              App de contabilidad self-hosted pensada para autónomos, indies y pequeños negocios
            </p>
            <div className="flex gap-4 justify-center text-sm md:text-lg">
              <Link
                href="#start"
                className="px-8 py-4 bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-bold rounded-full hover:from-pink-700 hover:to-indigo-700 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-110 border-2 border-white/20"
              >
                Empezar ✨
              </Link>
              <Link
                href="mailto:me@vas3k.com"
                className="px-8 py-4 border-2 border-gradient-to-r from-pink-300 to-indigo-300 text-gray-800 font-bold rounded-full hover:bg-gradient-to-r hover:from-pink-50 hover:to-indigo-50 transition-all duration-300 hover:scale-105 bg-white/80"
              >
                Contactar 💌
              </Link>
            </div>
          </div>
          <div className="relative aspect-auto rounded-3xl overflow-hidden shadow-2xl ring-4 ring-gradient-to-r from-pink-200 to-indigo-200">
            <div className="absolute inset-0 bg-gradient-to-b from-pink-500/5 via-purple-500/5 to-indigo-500/10 z-10" />
            <video className="w-full h-auto" autoPlay loop muted playsInline poster="/landing/ai-scanner-big.webp">
              <source src="/landing/video.mp4" type="video/mp4" />
              <Image src="/landing/ai-scanner-big.webp" alt="Vista previa de TaxHacker" width={1728} height={1080} priority />
            </video>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-indigo-50/50" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="flex flex-col gap-3 mb-4">
              <span className="text-6xl font-bold bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text text-transparent">
                Que les den a los impuestos
              </span>
              <span className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                TaxHacker te ahorra tiempo, dinero y disgustos
              </span>
            </h2>
          </div>

          {/* AI Scanner Feature */}
          <div className="flex flex-wrap items-center gap-12 mb-20 bg-gradient-to-br from-white via-pink-50/30 to-indigo-50/30 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-pink-200 to-indigo-200 hover:shadow-2xl transition-all duration-500 group">
            <div className="flex-1 min-w-60">
              <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold mb-4 shadow-lg">
                🤖 Con LLM
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                Analiza fotos y facturas con IA
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-blue-600 mr-3 text-lg">✨</span>
                  Sube tus tickets o facturas en PDF para reconocerlos automáticamente
                </li>
                <li className="flex items-center">
                  <span className="text-blue-600 mr-3 text-lg">✨</span>
                  Extrae información clave como fechas, conceptos y proveedores
                </li>
                <li className="flex items-center">
                  <span className="text-blue-600 mr-3 text-lg">✨</span>
                  Funciona con cualquier idioma y con fotos de cualquier calidad
                </li>
                <li className="flex items-center">
                  <span className="text-blue-600 mr-3 text-lg">✨</span>
                  Organiza todo automáticamente en una base de datos estructurada
                </li>
                <li className="flex items-center">
                  <span className="text-blue-600 mr-3 text-lg">✨</span>
                  Sube y analiza varios archivos de golpe
                </li>
              </ul>
            </div>
            <div className="flex-1 relative aspect-auto rounded-3xl overflow-hidden shadow-2xl ring-4 ring-gradient-to-r from-blue-200 to-indigo-200 hover:scale-105 transition-all duration-500">
              <Image src="/landing/ai-scanner.webp" alt="Analizador de documentos con IA" width={1900} height={1524} />
            </div>
          </div>

          {/* Multi-currency Feature */}
          <div className="flex flex-wrap items-center gap-12 mb-20 bg-gradient-to-br from-white via-green-50/30 to-emerald-50/30 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-green-200 to-emerald-200 hover:shadow-2xl transition-all duration-500 group flex-row-reverse">
            <div className="flex-1 min-w-60">
              <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold mb-4 shadow-lg">
                💱 Conversor de divisas
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
                Convierte divisas automáticamente, incluso cripto
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-green-600 mr-3 text-lg">💰</span>
                  Detecta monedas extranjeras y las convierte a la tuya
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-3 text-lg">💰</span>
                  Conoce el tipo de cambio histórico en la fecha de la transacción
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-3 text-lg">💰</span>
                  Soporta más de 170 divisas del mundo
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-3 text-lg">💰</span>
                  Funciona con criptomonedas populares como BTC, ETH o LTC
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-3 text-lg">💰</span>
                  Y te deja rellenarlo a mano si lo prefieres
                </li>
              </ul>
            </div>
            <div className="flex-1 relative aspect-auto rounded-3xl overflow-hidden shadow-2xl ring-4 ring-gradient-to-r from-green-200 to-emerald-200 hover:scale-105 transition-all duration-500">
              <Image src="/landing/multi-currency.webp" alt="Conversor de divisas" width={1400} height={1005} />
            </div>
          </div>

          {/* Transaction Table Feature */}
          <div className="flex flex-wrap items-center gap-12 mb-20 bg-gradient-to-br from-white via-pink-50/30 to-rose-50/30 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-pink-200 to-rose-200 hover:shadow-2xl transition-all duration-500 group flex-row-reverse">
            <div className="flex-1 relative aspect-auto rounded-3xl overflow-hidden shadow-2xl ring-4 ring-gradient-to-r from-pink-200 to-rose-200 hover:scale-105 transition-all duration-500">
              <Image src="/landing/transactions.webp" alt="Tabla de transacciones" width={2000} height={1279} />
            </div>
            <div className="flex-1  min-w-60">
              <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-white text-sm font-bold mb-4 shadow-lg">
                🔍 Filtros y categorías
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-pink-700 to-rose-700 bg-clip-text text-transparent">
                Organiza tus transacciones con categorías, proyectos y campos totalmente personalizables
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-pink-600 mr-3 text-lg">📊</span>
                  Libertad total para crear categorías, proyectos y campos a medida
                </li>
                <li className="flex items-center">
                  <span className="text-pink-600 mr-3 text-lg">📊</span>
                  Añade, edita y gestiona tus transacciones
                </li>
                <li className="flex items-center">
                  <span className="text-pink-600 mr-3 text-lg">📊</span>
                  Filtra por cualquier columna, categoría o rango de fechas
                </li>
                <li className="flex items-center">
                  <span className="text-pink-600 mr-3 text-lg">📊</span>
                  Elige qué columnas quieres ver en la tabla
                </li>
                <li className="flex items-center">
                  <span className="text-pink-600 mr-3 text-lg">📊</span>
                  Importa transacciones desde CSV
                </li>
              </ul>
            </div>
          </div>

          {/* Invoice Generator */}
          <div className="flex flex-wrap items-center gap-12 mb-20 bg-gradient-to-br from-white via-purple-50/30 to-indigo-50/30 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-purple-200 to-indigo-200 hover:shadow-2xl transition-all duration-500 group">
            <div className="max-w-sm flex-1 relative aspect-auto rounded-3xl overflow-hidden shadow-2xl ring-4 ring-gradient-to-r from-purple-200 to-indigo-200 hover:scale-105 transition-all duration-500">
              <Image src="/landing/invoice-generator.webp" alt="Generador de facturas" width={1800} height={1081} />
            </div>
            <div className="flex-1 min-w-60">
              <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-bold mb-4 shadow-lg">
                📋 Generador de facturas
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent">
                Crea facturas personalizadas
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">📄</span>
                  Generador avanzado para crear cualquier factura en cualquier idioma
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">📄</span>
                  Edita cualquier campo, incluso etiquetas y títulos
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">📄</span>
                  Exporta facturas a PDF o conviértelas en transacciones
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">📄</span>
                  Guarda facturas como plantillas para reutilizarlas después
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">📄</span>
                  Soporte nativo para impuestos incluidos o excluidos, como IVA o GST
                </li>
              </ul>
            </div>
          </div>

          {/* Custom Fields & Categories */}
          <div className="flex flex-wrap items-center gap-12 mb-20 bg-gradient-to-br from-white via-violet-50/30 to-purple-50/30 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-violet-200 to-purple-200 hover:shadow-2xl transition-all duration-500 group">
            <div className="flex-1 min-w-60">
              <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold mb-4 shadow-lg">
                🎨 Control sobre la IA
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-violet-700 to-purple-700 bg-clip-text text-transparent">
                Ajusta cualquier prompt del LLM para extraer justo lo que necesitas
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-violet-600 mr-3 text-lg">🔧</span>
                  Amplía y mejora tu instancia de TaxHacker con prompts LLM personalizados
                </li>
                <li className="flex items-center">
                  <span className="text-violet-600 mr-3 text-lg">🔧</span>
                  Crea campos y categorías propias y dile a la IA cómo debe interpretarlos
                </li>
                <li className="flex items-center">
                  <span className="text-violet-600 mr-3 text-lg">🔧</span>
                  Extrae cualquier información adicional que necesites
                </li>
                <li className="flex items-center">
                  <span className="text-violet-600 mr-3 text-lg">🔧</span>
                  Clasifica automáticamente por proyecto o categoría
                </li>
                <li className="flex items-center">
                  <span className="text-violet-600 mr-3 text-lg">🔧</span>
                  Pide a la IA que evalúe el nivel de riesgo o cualquier otro criterio
                </li>
              </ul>
            </div>
            <div className="flex-1 relative aspect-auto rounded-3xl overflow-hidden shadow-2xl ring-4 ring-gradient-to-r from-violet-200 to-purple-200 hover:scale-105 transition-all duration-500">
              <Image src="/landing/custom-llm.webp" alt="Prompts LLM personalizados" width={1800} height={1081} />
            </div>
          </div>

          {/* Data Export */}
          <div className="flex flex-wrap items-center gap-12 mb-20 bg-gradient-to-br from-white via-orange-50/30 to-amber-50/30 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-orange-200 to-amber-200 hover:shadow-2xl transition-all duration-500 group flex-row-reverse">
            <div className="flex-1 min-w-60">
              <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm font-bold mb-4 shadow-lg">
                📦 Self-hosting y exportación de datos
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-orange-700 to-amber-700 bg-clip-text text-transparent">
                Tus datos, tus reglas
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-orange-600 mr-3 text-lg">📤</span>
                  Despliega tu propia instancia de TaxHacker con privacidad total
                </li>
                <li className="flex items-center">
                  <span className="text-orange-600 mr-3 text-lg">📤</span>
                  Exporta tus transacciones a CSV para preparar impuestos
                </li>
                <li className="flex items-center">
                  <span className="text-orange-600 mr-3 text-lg">📤</span>
                  Búsqueda de texto completo en documentos y facturas
                </li>
                <li className="flex items-center">
                  <span className="text-orange-600 mr-3 text-lg">📤</span>
                  Descarga un archivo completo con tus datos para migrarte a otro servicio. Nadie te limita lo que
                  puedes hacer con tu información
                </li>
              </ul>
            </div>
            <div className="flex-1 relative aspect-auto rounded-3xl overflow-hidden shadow-2xl ring-4 ring-gradient-to-r from-orange-200 to-amber-200 hover:scale-105 transition-all duration-500">
              <Image src="/landing/export.webp" alt="Exportación de datos" width={1200} height={1081} />
            </div>
          </div>
        </div>
      </section>

      {/* Deployment Options */}
      <section
        id="start"
        className="py-20 px-8 bg-gradient-to-br from-white via-pink-50/20 to-indigo-50/20 scroll-mt-20 relative"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-pink-100/20 to-indigo-100/20" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text text-transparent">
              Elige tu versión de TaxHacker
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-16">
            {/* Self-Hosted Version */}
            <div className="bg-gradient-to-br from-white via-violet-50/50 to-indigo-50/50 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-violet-200 to-indigo-200 hover:shadow-2xl transition-all duration-500 group">
              <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-bold mb-6 shadow-lg">
                🏠 Usa tu propio servidor
              </div>
              <h3 className="text-2xl font-bold mb-4">
                <ColoredText>Edición self-hosted</ColoredText>
              </h3>
              <ul className="space-y-3 text-gray-700 mb-8">
                <li className="flex items-center">
                  <span className="text-indigo-600 mr-3 text-lg">🆓</span>
                  Gratis y de código abierto
                </li>
                <li className="flex items-center">
                  <span className="text-indigo-600 mr-3 text-lg">🔒</span>
                  Control total sobre tus datos
                </li>
                <li className="flex items-center">
                  <span className="text-indigo-600 mr-3 text-lg">🏗️</span>
                  Despliega en tu propia infraestructura o en tu servidor de casa
                </li>
                <li className="flex items-center">
                  <span className="text-indigo-600 mr-3 text-lg">🔑</span>
                  Usa tus propias claves de OpenAI, Gemini, Mistral y compañía
                </li>
              </ul>
              <Link
                href="https://github.com/vas3k/TaxHacker"
                target="_blank"
                className="block w-full text-center px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-full hover:from-violet-700 hover:to-indigo-700 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-110"
              >
                GitHub + Docker Compose 🐳
              </Link>
            </div>

            {/* Cloud Version */}
            <div className="bg-gradient-to-br from-white via-pink-50/50 to-purple-50/50 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-pink-200 to-purple-200 hover:shadow-2xl transition-all duration-500 group relative">
              <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold mb-6 shadow-lg">
                ☁️ Nosotros te lo alojamos
              </div>
              <h3 className="text-2xl font-bold mb-4">
                <ColoredText>Edición cloud</ColoredText>
              </h3>
              <ul className="space-y-3 text-gray-700 mb-8">
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">🎯</span>
                  Versión SaaS si no quieres pelearte con servidores ni despliegues
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">🤖</span>
                  Nosotros ponemos las claves de IA y el almacenamiento
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">💳</span>
                  Planes de suscripción anual, sin costes ocultos
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">🚀</span>
                  Actualizaciones automáticas y nuevas funciones
                </li>
              </ul>
              <button
                type="button"
                disabled
                className="block w-full text-center px-6 py-4 bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700 font-bold rounded-full shadow-xl opacity-80 cursor-not-allowed"
              >
                Temporalmente no disponible
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Features */}
      <section className="py-20 px-8 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 mt-28 relative overflow-hidden">
        <div className="absolute top-10 left-10 w-64 h-64 bg-gradient-to-r from-pink-400 to-indigo-400 rounded-full opacity-5 blur-3xl" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-gradient-to-r from-indigo-400 to-pink-400 rounded-full opacity-5 blur-3xl" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text text-transparent">
              Próximas funciones
            </h2>
            <p className="text-gray-700 max-w-2xl mx-auto font-medium">
              Somos un proyecto pequeño e independiente que no para de mejorar. Esto es lo siguiente en lo que estamos
              trabajando.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {/* AI Improvements */}
            <div className="bg-gradient-to-br from-white via-purple-50/50 to-indigo-50/50 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-purple-200 to-indigo-200 hover:shadow-2xl transition-all duration-500 hover:scale-105">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🤖</span>
                <h3 className="text-xl font-bold bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent">
                  Mejor analítica y agentes de IA
                </h3>
              </div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">🔮</span>
                  Insights de ingresos y gastos
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">🔮</span>
                  Agentes de IA para automatizar tus flujos
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">🔮</span>
                  Recomendaciones para optimización fiscal
                </li>
                <li className="flex items-center">
                  <span className="text-purple-600 mr-3 text-lg">🔮</span>
                  Modelos LLM locales y personalizados
                </li>
              </ul>
            </div>

            {/* Smart Reports */}
            <div className="bg-gradient-to-br from-white via-pink-50/50 to-rose-50/50 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-pink-200 to-rose-200 hover:shadow-2xl transition-all duration-500 hover:scale-105">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📊</span>
                <h3 className="text-xl font-bold bg-gradient-to-r from-pink-700 to-rose-700 bg-clip-text text-transparent">
                  Informes y recordatorios inteligentes
                </h3>
              </div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-pink-600 mr-3 text-lg">📈</span>
                  Informes mensuales o trimestrales de IVA
                </li>
                <li className="flex items-center">
                  <span className="text-pink-600 mr-3 text-lg">📈</span>
                  Recordatorios fiscales
                </li>
                <li className="flex items-center">
                  <span className="text-pink-600 mr-3 text-lg">📈</span>
                  Informes anuales de ingresos y gastos
                </li>
              </ul>
            </div>

            {/* Transaction Review */}
            <div className="bg-gradient-to-br from-white via-green-50/50 to-emerald-50/50 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-green-200 to-emerald-200 hover:shadow-2xl transition-all duration-500 hover:scale-105">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📥</span>
                <h3 className="text-xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
                  Revisión múltiple de transacciones
                </h3>
              </div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-green-600 mr-3 text-lg">💳</span>
                  Análisis de extractos bancarios
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-3 text-lg">💳</span>
                  Comprobaciones automáticas de completitud
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-3 text-lg">💳</span>
                  Seguimiento de facturas impagadas
                </li>
              </ul>
            </div>

            {/* Custom Fields */}
            <div className="bg-gradient-to-br from-white via-orange-50/50 to-amber-50/50 p-8 rounded-3xl shadow-xl ring-2 ring-gradient-to-r from-orange-200 to-amber-200 hover:shadow-2xl transition-all duration-500 hover:scale-105">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🧩</span>
                <h3 className="text-xl font-bold bg-gradient-to-r from-orange-700 to-amber-700 bg-clip-text text-transparent">
                  Presets y plugins
                </h3>
              </div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="text-orange-600 mr-3 text-lg">🌍</span>
                  Presets para distintos países y sectores
                </li>
                <li className="flex items-center">
                  <span className="text-orange-600 mr-3 text-lg">🌍</span>
                  Informes personalizados para distintos casos de uso
                </li>
                <li className="flex items-center">
                  <span className="text-orange-600 mr-3 text-lg">🌍</span>
                  Plugins e informes creados por la comunidad
                </li>
              </ul>
            </div>
          </div>

          {/* Stay Tuned / GitHub CTA */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-8 rounded-2xl shadow-sm ring-1 ring-gray-100">
            <div className="max-w-2xl mx-auto text-center">
              <h3 className="text-2xl font-semibold mb-4">Sigue de cerca el proyecto</h3>
              <p className="text-gray-600 mb-6">
                Estamos trabajando a saco para que TaxHacker le resulte útil a cualquiera. Dale una estrella y sigue el
                repositorio en GitHub para enterarte de nuevas funciones y lanzamientos.
              </p>
              <div className="flex flex-col gap-4 max-w-md mx-auto">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <a
                    href="https://github.com/vas3k/TaxHacker"
                    target="_blank"
                    rel="noreferrer"
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-full hover:opacity-90 transition-all shadow-lg shadow-purple-500/20"
                  >
                    Abrir repositorio en GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 px-8 bg-gradient-to-r from-pink-50 to-indigo-50 border-t-2 border-gradient-to-r from-pink-200 to-indigo-200">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-600">
          Hecho con ❤️ en Berlín por{" "}
          <Link
            href="https://github.com/vas3k"
            className="underline font-semibold hover:text-pink-600 transition-colors"
          >
            @vas3k
          </Link>
        </div>

        <section className="py-12 px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href={`mailto:${config.app.supportEmail}`}
                className="text-sm text-gray-600 hover:text-pink-600 font-medium transition-colors"
              >
                Contacto
              </Link>
              <Link
                href="/docs/terms"
                className="text-sm text-gray-600 hover:text-pink-600 font-medium transition-colors"
              >
                Términos del servicio
              </Link>
              <Link
                href="/docs/privacy_policy"
                className="text-sm text-gray-600 hover:text-pink-600 font-medium transition-colors"
              >
                Política de privacidad
              </Link>
              <Link href="/docs/ai" className="text-sm text-gray-600 hover:text-pink-600 font-medium transition-colors">
                Uso de IA
              </Link>
              <Link
                href="/docs/cookie"
                className="text-sm text-gray-600 hover:text-pink-600 font-medium transition-colors"
              >
                Política de cookies
              </Link>
              <Link
                href="https://github.com/vas3k/TaxHacker"
                target="_blank"
                className="text-sm text-gray-600 hover:text-pink-600 font-medium transition-colors"
              >
                Código fuente
              </Link>
            </div>
          </div>
        </section>
      </footer>
    </div>
  )
}
