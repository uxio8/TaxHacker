import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const PDF_RUNTIME_COMMANDS = [
  "gm",
  "gs",
] as const

type CheckCommandAvailable = (command: string) => Promise<boolean>

async function commandExists(command: string) {
  try {
    await execFileAsync("which", [command])
    return true
  } catch {
    return false
  }
}

export async function getMissingPdfRuntimeCommands(checkCommandAvailable: CheckCommandAvailable = commandExists) {
  const missing: string[] = []

  for (const command of PDF_RUNTIME_COMMANDS) {
    if (!(await checkCommandAvailable(command))) {
      missing.push(command)
    }
  }

  return missing
}

export function getPdfRuntimeDependencyError(missingCommands: string[]) {
  if (missingCommands.length === 0) {
    return ""
  }

  const missingLabels = missingCommands.map((command) => {
    if (command === "gm") {
      return "GraphicsMagick (`gm`)"
    }

    if (command === "gs") {
      return "Ghostscript (`gs`)"
    }

    return `\`${command}\``
  })

  return `PDF previews and AI analysis require ${missingLabels.join(
    " and "
  )} on the server. Install them locally with \`brew install graphicsmagick ghostscript\`, or use the Docker setup that already includes them.`
}

export async function assertPdfRuntimeDependencies(checkCommandAvailable?: CheckCommandAvailable) {
  const missingCommands = await getMissingPdfRuntimeCommands(checkCommandAvailable)

  if (missingCommands.length > 0) {
    throw new Error(getPdfRuntimeDependencyError(missingCommands))
  }
}
