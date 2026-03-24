import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readWorkflow(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

function expectIncludes(source, snippet, message) {
  assert.ok(source.includes(snippet), message ?? `Missing snippet: ${snippet}`)
}

function expectMatches(source, pattern, message) {
  assert.match(source, pattern, message)
}

test("docker-latest publica latest, sha y labels OCI mínimas sin cambiar su trigger principal", async () => {
  const workflow = await readWorkflow(".github/workflows/docker-latest.yml")

  expectIncludes(workflow, "branches:")
  expectIncludes(workflow, "- main")
  expectIncludes(workflow, "images: ghcr.io/${{ github.repository_owner }}/ledgerflow")
  expectIncludes(workflow, "type=raw,value=latest")
  expectMatches(workflow, /type=sha,[^\n]*prefix=sha-/)
  expectIncludes(workflow, "org.opencontainers.image.revision=${{ github.sha }}")
  expectIncludes(workflow, "org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}")
  expectIncludes(workflow, "tags: ${{ steps.meta.outputs.tags }}")
  expectIncludes(workflow, "labels: ${{ steps.meta.outputs.labels }}")
})

test("docker-release publica semver, major.minor, sha y labels OCI mínimas sin cambiar el trigger por tags", async () => {
  const workflow = await readWorkflow(".github/workflows/docker-release.yml")

  expectIncludes(workflow, "tags:")
  expectIncludes(workflow, '- "v*"')
  expectIncludes(workflow, "images: ghcr.io/${{ github.repository_owner }}/ledgerflow")
  expectIncludes(workflow, "type=semver,pattern={{version}}")
  expectIncludes(workflow, "type=semver,pattern={{major}}.{{minor}}")
  expectMatches(workflow, /type=sha,[^\n]*prefix=sha-/)
  expectIncludes(workflow, "org.opencontainers.image.revision=${{ github.sha }}")
  expectIncludes(workflow, "org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}")
  expectIncludes(workflow, "tags: ${{ steps.meta.outputs.tags }}")
  expectIncludes(workflow, "labels: ${{ steps.meta.outputs.labels }}")
})
