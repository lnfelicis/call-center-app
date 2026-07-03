import { ShieldCheck } from "lucide-react"

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
    <div className="permission-list">
      {Object.entries(permissionsByGroup).map(([groupName, groupPermissions]) => (
        <section className="permission-group" key={groupName}>
          <div className="permission-group-title">
            <ShieldCheck />
            <span>{groupName}</span>
          </div>
          <div className="permission-options">
            {groupPermissions.map((permission) => (
              <label className="permission-option" key={permission.id}>
                <input
                  type="checkbox"
                  checked={selectedPermissions.includes(permission.id)}
                  onChange={() => onToggle(permission.id)}
                />
                <span>
                  <strong>{permission.label}</strong>
                  <small>{permission.description}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
