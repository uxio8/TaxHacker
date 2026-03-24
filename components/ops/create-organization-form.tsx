"use client"

import { createOrganizationFromOpsAction } from "@/app/(app)/ops/actions"
import { FormError } from "@/components/forms/error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MEMBERSHIP_ROLE } from "@/lib/membership-roles"
import { Building2, Plus, Trash2 } from "lucide-react"
import { useActionState, useState } from "react"

type InitialUserRow = {
  id: number
  email: string
  role: typeof MEMBERSHIP_ROLE.ADMIN | typeof MEMBERSHIP_ROLE.MEMBER
}

function createEmptyInitialUserRow(id: number): InitialUserRow {
  return {
    id,
    email: "",
    role: MEMBERSHIP_ROLE.MEMBER,
  }
}

export function CreateOrganizationForm() {
  const [createState, createAction, createPending] = useActionState(createOrganizationFromOpsAction, null)
  const [initialUsers, setInitialUsers] = useState<InitialUserRow[]>([createEmptyInitialUserRow(1)])

  function updateInitialUser(id: number, field: keyof Omit<InitialUserRow, "id">, value: string) {
    setInitialUsers((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== id) {
          return row
        }

        if (field === "role") {
          return {
            ...row,
            role: value === MEMBERSHIP_ROLE.ADMIN ? MEMBERSHIP_ROLE.ADMIN : MEMBERSHIP_ROLE.MEMBER,
          }
        }

        return {
          ...row,
          email: value,
        }
      })
    )
  }

  function addInitialUserRow() {
    setInitialUsers((currentRows) => {
      const nextId = currentRows.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1
      return [...currentRows, createEmptyInitialUserRow(nextId)]
    })
  }

  function removeInitialUserRow(id: number) {
    setInitialUsers((currentRows) => currentRows.filter((row) => row.id !== id))
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">Crear empresa</h3>
        <p className="text-sm text-muted-foreground">
          Alta rápida desde superadmin. El owner queda creado y asignado al momento con el email indicado.
        </p>
      </div>

      <form action={createAction} className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input name="name" required placeholder="Nombre de la empresa" aria-label="Nombre de la empresa" />
          <Input name="ownerEmail" required type="email" placeholder="Email del owner" aria-label="Email del owner" />
          <Button type="submit" disabled={createPending} className="lg:self-start">
            <Building2 className="h-4 w-4" />
            {createPending ? "Creando..." : "Crear empresa"}
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-900">Usuarios iniciales</h4>
              <p className="text-sm text-muted-foreground">
                Añade emails con rol individual. Si aún no existen, se quedan como invitación pendiente.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addInitialUserRow}>
              <Plus className="h-4 w-4" />
              Añadir usuario
            </Button>
          </div>

          <div className="space-y-2">
            {initialUsers.map((row, index) => (
              <div key={row.id} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                <Input
                  name="initialUserEmail"
                  type="email"
                  value={row.email}
                  onChange={(event) => updateInitialUser(row.id, "email", event.target.value)}
                  placeholder={`usuario${index + 1}@empresa.com`}
                  aria-label={`Email del usuario inicial ${index + 1}`}
                />
                <select
                  name="initialUserRole"
                  value={row.role}
                  onChange={(event) => updateInitialUser(row.id, "role", event.target.value)}
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  aria-label={`Rol del usuario inicial ${index + 1}`}
                >
                  <option value={MEMBERSHIP_ROLE.MEMBER}>Miembro</option>
                  <option value={MEMBERSHIP_ROLE.ADMIN}>Admin</option>
                </select>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeInitialUserRow(row.id)}>
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Quitar usuario {index + 1}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </form>

      {createState?.error ? <FormError>{createState.error}</FormError> : null}
    </section>
  )
}
