import { Info, RotateCcw, ShieldCheck } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import type { Permission, PermissionOverride, Role } from "@/types"

type UserPermissionOverridesProps = {
  permissionsByGroup: Record<string, Permission[]>
  role: Role | undefined
  overrides: PermissionOverride[]
  onChange: (overrides: PermissionOverride[]) => void
  disabled?: boolean
  idPrefix: string
}

export function UserPermissionOverrides({
  permissionsByGroup,
  role,
  overrides,
  onChange,
  disabled = false,
  idPrefix,
}: UserPermissionOverridesProps) {
  const overrideByPermission = new Map(
    overrides.map((override) => [override.permissionId, override.effect]),
  )

  function togglePermission(permissionId: string) {
    const roleIncludesPermission = role?.permissions.includes(permissionId) ?? false
    const effect = overrideByPermission.get(permissionId)
    const isChecked = effect === "allow" || (roleIncludesPermission && effect !== "deny")
    const remaining = overrides.filter((override) => override.permissionId !== permissionId)

    if (isChecked) {
      onChange(
        roleIncludesPermission
          ? [...remaining, { permissionId, effect: "deny" }]
          : remaining,
      )
      return
    }

    onChange(
      roleIncludesPermission
        ? remaining
        : [...remaining, { permissionId, effect: "allow" }],
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertTitle>Kullanıcıya özel izinler</AlertTitle>
        <AlertDescription>
          {disabled
            ? "Ana Süper Admin hesabının izinleri özelleştirilemez."
            : "Rol izinleri varsayılandır. Seçimi değiştirmeniz yalnızca bu kullanıcı için izin verir veya engeller."}
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {overrides.length} özel ayar
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || overrides.length === 0}
          onClick={() => onChange([])}
        >
          <RotateCcw data-icon="inline-start" />
          Rol varsayılanlarına dön
        </Button>
      </div>

      {Object.entries(permissionsByGroup).map(([groupName, groupPermissions]) => (
        <FieldSet key={groupName} className="gap-3">
          <FieldLegend className="flex items-center gap-2" variant="label">
            <ShieldCheck />
            {groupName}
          </FieldLegend>
          <FieldGroup className="gap-3">
            {groupPermissions.map((permission) => {
              const roleIncludesPermission = role?.permissions.includes(permission.id) ?? false
              const effect = overrideByPermission.get(permission.id)
              const checked = effect === "allow" || (roleIncludesPermission && effect !== "deny")
              const fieldId = `${idPrefix}-${permission.id}`

              return (
                <FieldLabel key={permission.id} htmlFor={fieldId}>
                  <Field orientation="horizontal" data-disabled={disabled}>
                    <Checkbox
                      id={fieldId}
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => togglePermission(permission.id)}
                    />
                    <FieldContent>
                      <FieldTitle>
                        {permission.label}
                        {effect === "allow" ? (
                          <Badge variant="secondary">Özel verildi</Badge>
                        ) : effect === "deny" ? (
                          <Badge variant="outline">Özel engellendi</Badge>
                        ) : roleIncludesPermission ? (
                          <Badge variant="outline">Rolden geliyor</Badge>
                        ) : null}
                      </FieldTitle>
                      <FieldDescription>{permission.description}</FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldLabel>
              )
            })}
          </FieldGroup>
        </FieldSet>
      ))}
    </div>
  )
}
