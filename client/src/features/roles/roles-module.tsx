import type { FormEvent } from "react"
import { Check, Plus } from "lucide-react"

import { PermissionChecklist } from "@/components/permission-checklist"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Permission, Role, RoleForm } from "@/types"

type RolesModuleProps = {
  permissionsByGroup: Record<string, Permission[]>
  roles: Role[]
  selectedRole: Role | undefined
  selectedRoleId: string
  roleForm: RoleForm
  isLoading: boolean
  onRoleFormChange: (form: RoleForm) => void
  onSelectRole: (roleId: string) => void
  onCreateRole: (event: FormEvent<HTMLFormElement>) => void
  onToggleNewRolePermission: (permissionId: string) => void
  onToggleSelectedRolePermission: (permissionId: string) => void
  onSaveSelectedRolePermissions: () => void
}

export function RolesModule({
  permissionsByGroup,
  roles,
  selectedRole,
  selectedRoleId,
  roleForm,
  isLoading,
  onRoleFormChange,
  onSelectRole,
  onCreateRole,
  onToggleNewRolePermission,
  onToggleSelectedRolePermission,
  onSaveSelectedRolePermissions,
}: RolesModuleProps) {
  const roleCanBeCreated = roleForm.name.trim().length >= 2 && roleForm.permissions.length > 0

  return (
    <div className="module-grid">
      <Card>
        <CardHeader>
          <CardTitle>Yeni rol oluştur</CardTitle>
          <CardDescription>
            Rol adını belirleyin ve en az bir izin seçin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="stack" onSubmit={onCreateRole}>
            <div className="field">
              <Label htmlFor="role-name">Rol adı</Label>
              <Input
                id="role-name"
                placeholder="Örn. Personel Manager"
                value={roleForm.name}
                onChange={(event) => onRoleFormChange({ ...roleForm, name: event.target.value })}
              />
            </div>
            <div className="field">
              <Label htmlFor="role-description">Açıklama</Label>
              <Input
                id="role-description"
                placeholder="Bu rolün kapsamı"
                value={roleForm.description}
                onChange={(event) =>
                  onRoleFormChange({ ...roleForm, description: event.target.value })
                }
              />
            </div>
            <p className="form-hint">Rol oluşturmak için en az bir izin seçilmelidir.</p>
            <PermissionChecklist
              permissionsByGroup={permissionsByGroup}
              selectedPermissions={roleForm.permissions}
              onToggle={onToggleNewRolePermission}
            />
            <Button type="submit" disabled={isLoading || !roleCanBeCreated}>
              <Plus />
              Rol ekle
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rol izinlerini düzenle</CardTitle>
          <CardDescription>
            Seçili rolün hangi işlemleri yapabileceğini belirleyin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="stack">
            <div className="field">
              <Label htmlFor="selected-role">Rol</Label>
              <select
                id="selected-role"
                className="select-control"
                value={selectedRoleId}
                onChange={(event) => onSelectRole(event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedRole && (
              <>
                <div className="role-summary">
                  <div>
                    <strong>{selectedRole.name}</strong>
                    <span>{selectedRole.description ?? "Açıklama eklenmemiş"}</span>
                  </div>
                  <Badge variant={selectedRole.isActive ? "default" : "outline"}>
                    {selectedRole.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
                <PermissionChecklist
                  permissionsByGroup={permissionsByGroup}
                  selectedPermissions={selectedRole.permissions}
                  onToggle={onToggleSelectedRolePermission}
                />
                <Button
                  type="button"
                  onClick={onSaveSelectedRolePermissions}
                  disabled={isLoading || selectedRole.permissions.length === 0}
                >
                  <Check />
                  İzinleri kaydet
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
