"use client"

import { fieldsToJsonSchema } from "@/ai/schema"
import { saveSettingsAction } from "@/app/(app)/settings/actions"
import { FormError } from "@/components/forms/error"
import { FormTextarea } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n"
import { getDefaultProviderOrder, PROVIDERS, type ProviderMetadata } from "@/lib/llm-providers"
import { Field } from "@/prisma/client"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { CircleCheckBig, Edit, GripVertical } from "lucide-react"
import Link from "next/link"
import { useActionState, useState } from "react"

type ProviderValues = {
  apiKey: string
  model: string
}

function getAvailableProviders(isPoolCloudEnabled: boolean) {
  return PROVIDERS.filter((provider) => isPoolCloudEnabled || !provider.managedByEnvironment)
}

function normalizeProviderOrder(providerOrder: string[], providers: ProviderMetadata[]) {
  const allowedProviderKeys = new Set(providers.map((provider) => provider.key))
  const normalizedOrder = providerOrder.filter(
    (providerKey, index) => allowedProviderKeys.has(providerKey as ProviderMetadata["key"]) && providerOrder.indexOf(providerKey) === index
  )

  const missingProviders = providers
    .map((provider) => provider.key)
    .filter((providerKey) => !normalizedOrder.includes(providerKey))

  return [...normalizedOrder, ...missingProviders]
}

function getInitialProviderOrder(settings: Record<string, string>, providers: ProviderMetadata[], isPoolCloudEnabled: boolean) {
  const providerOrder = settings.llm_providers
    ? settings.llm_providers.split(",").map((provider) => provider.trim()).filter(Boolean)
    : getDefaultProviderOrder(isPoolCloudEnabled)

  return normalizeProviderOrder(providerOrder, providers)
}

function getInitialProviderValues(settings: Record<string, string>, providers: ProviderMetadata[]) {
  const values: Record<string, ProviderValues> = {}

  for (const provider of providers) {
    values[provider.key] = {
      apiKey: provider.apiKeyName ? settings[provider.apiKeyName] || "" : "",
      model: provider.modelName ? settings[provider.modelName] || provider.defaultModelName || "" : "",
    }
  }

  return values
}

export default function LLMSettingsForm({
  settings,
  fields,
  isPoolCloudEnabled,
  showApiKey = false,
}: {
  settings: Record<string, string>
  fields: Field[]
  isPoolCloudEnabled: boolean
  showApiKey?: boolean
}) {
  const { t } = useI18n()
  const providers = getAvailableProviders(isPoolCloudEnabled)
  const [saveState, saveAction, pending] = useActionState(saveSettingsAction, null)
  const [providerOrder, setProviderOrder] = useState<string[]>(() =>
    getInitialProviderOrder(settings, providers, isPoolCloudEnabled)
  )
  const [providerValues, setProviderValues] = useState<Record<string, ProviderValues>>(() =>
    getInitialProviderValues(settings, providers)
  )

  function handleProviderValueChange(providerKey: string, field: "apiKey" | "model", value: string) {
    setProviderValues((prev) => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        [field]: value,
      },
    }))
  }

  const providerOrderDescription = isPoolCloudEnabled
    ? t("settings.llm.providerOrderDescription.poolCloud")
    : showApiKey
      ? t("settings.llm.providerOrderDescription.selfHosted")
      : t("settings.llm.providerOrderDescription.default")

  return (
    <>
      <form action={saveAction} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("settings.llm.providerOrderTitle")}</label>
          <p className="text-sm text-muted-foreground">{providerOrderDescription}</p>
          <DndProviderBlocks
            providers={providers}
            providerOrder={providerOrder}
            setProviderOrder={setProviderOrder}
            providerValues={providerValues}
            handleProviderValueChange={handleProviderValueChange}
            showApiKey={showApiKey}
          />
          <small className="text-muted-foreground">{t("settings.llm.providerOrderHint")}</small>
        </div>
        <input type="hidden" name="llm_providers" value={providerOrder.join(",")} />

        <FormTextarea
          title={t("settings.llm.promptTitle")}
          name="prompt_analyse_new_file"
          defaultValue={settings.prompt_analyse_new_file}
          className="h-96"
        />

        <div className="flex flex-row items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? t("settings.feedback.saving") : t("settings.general.saveSettings")}
          </Button>
          {saveState?.success && (
            <p className="text-green-500 flex flex-row items-center gap-2">
              <CircleCheckBig />
              {t("settings.feedback.saved")}
            </p>
          )}
        </div>

        {saveState?.error && <FormError>{saveState.error}</FormError>}
      </form>

      <Card className="flex flex-col gap-4 p-4 bg-accent mt-20">
        <CardTitle className="flex flex-row justify-between items-center gap-2">
          <span className="text-md font-medium">
            {t("settings.llm.schemaTitle")}{" "}
            <a
              href="https://platform.openai.com/docs/guides/structured-outputs?api-mode=responses&lang=javascript"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {t("settings.llm.structuredOutput")}
            </a>
          </span>
          <Link
            href="/settings/fields"
            className="text-xs underline inline-flex flex-row items-center gap-1 text-muted-foreground"
          >
            <Edit className="w-4 h-4" /> {t("settings.llm.editFields")}
          </Link>
        </CardTitle>
        <pre className="text-xs overflow-hidden text-ellipsis">
          {JSON.stringify(fieldsToJsonSchema(fields), null, 2)}
        </pre>
      </Card>
    </>
  )
}

type DndProviderBlocksProps = {
  providers: ProviderMetadata[]
  providerOrder: string[]
  setProviderOrder: React.Dispatch<React.SetStateAction<string[]>>
  providerValues: Record<string, ProviderValues>
  handleProviderValueChange: (providerKey: string, field: "apiKey" | "model", value: string) => void
  showApiKey: boolean
}

function DndProviderBlocks({
  providers,
  providerOrder,
  setProviderOrder,
  providerValues,
  handleProviderValueChange,
  showApiKey,
}: DndProviderBlocksProps) {
  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = providerOrder.indexOf(active.id as string)
    const newIndex = providerOrder.indexOf(over.id as string)
    setProviderOrder(arrayMove(providerOrder, oldIndex, newIndex))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={providerOrder} strategy={verticalListSortingStrategy}>
        {providerOrder.map((providerKey, idx) => (
          <SortableProviderBlock
            key={providerKey}
            id={providerKey}
            idx={idx}
            provider={providers.find((provider) => provider.key === providerKey)}
            value={providerValues[providerKey] || { apiKey: "", model: "" }}
            handleValueChange={handleProviderValueChange}
            showApiKey={showApiKey}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

type SortableProviderBlockProps = {
  id: string
  idx: number
  provider?: ProviderMetadata
  value: ProviderValues
  handleValueChange: (providerKey: string, field: "apiKey" | "model", value: string) => void
  showApiKey: boolean
}

function SortableProviderBlock({ id, idx, provider, value, handleValueChange, showApiKey }: SortableProviderBlockProps) {
  const { t } = useI18n()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  if (!provider) return null

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translateY(${transform.y}px)` : undefined,
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className={`bg-muted rounded-lg p-4 shadow flex flex-col gap-2 mb-2`}
    >
      <div className="flex flex-row items-center gap-2 mb-2">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab p-1 rounded hover:bg-accent transition inline-flex items-center"
          aria-label={t("settings.llm.dragHandle")}
        >
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </span>
        <span className="font-semibold">{provider.label}</span>
        <span className="text-xs text-muted-foreground">#{idx + 1}</span>
      </div>

      {provider.managedByEnvironment ? (
        <div className="rounded-md border border-dashed bg-background/70 p-3 text-sm text-muted-foreground">
          <p>{t("settings.llm.providerManagedByEnvironment")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              name={provider.apiKeyName}
              value={value.apiKey}
              onChange={(event) => handleValueChange(provider.key, "apiKey", event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder={provider.placeholder || t("settings.llm.providersApiKeyPlaceholder")}
            />
            <input
              type="text"
              name={provider.modelName}
              value={value.model}
              onChange={(event) => handleValueChange(provider.key, "model", event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder={provider.defaultModelName || t("settings.llm.providerModelPlaceholder")}
            />
          </div>
          <small className="text-muted-foreground">
            {showApiKey
              ? t("settings.llm.providerConfiguredForAccount")
              : t("settings.llm.providerSetCredentials")}
          </small>
        </div>
      )}

      {provider.help && (
        <small className="text-muted-foreground">
          {provider.managedByEnvironment ? t("settings.llm.setupGuide") : t("settings.llm.setup")}{" "}
          <a
            href={provider.help.url}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {provider.help.label}
          </a>
        </small>
      )}
    </div>
  )
}
