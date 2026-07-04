import { ShieldCheck } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import type { Permission } from "@/types"

type PermissionChecklistProps = {
  permissionsByGroup: Record<string, Permission[]>
  selectedPermissions: string[]
  onToggle: (permissionId: string) => void
}

export function PermissionChecklist({
  permissionsByGroup,
  selectedPermissions,
  onToggle,
}: PermissionChecklistProps) {
  return (
    <div className="grid gap-4">
      {Object.entries(permissionsByGroup).map(([groupName, groupPermissions]) => (
        <section className="border-t pt-4" key={groupName}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4" />
            <span>{groupName}</span>
          </div>
          <div className="grid gap-2">
            {groupPermissions.map((permission) => {
              const checked = selectedPermissions.includes(permission.id)

              return (
                <label
                  className="grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)] items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                  key={permission.id}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggle(permission.id)}
                    className="mt-1"
                  />
                  <span>
                    <strong className="block text-sm font-medium">{permission.label}</strong>
                    <small className="mt-1 block text-sm leading-5 text-muted-foreground">
                      {permission.description}
                    </small>
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
