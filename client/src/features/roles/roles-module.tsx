import { useState, type FormEvent } from "react"
import { Check, Plus } from "lucide-react"

import { PermissionChecklist } from "@/components/permission-checklist"
import { FormErrorAlert } from "@/components/form-error-alert"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OperationResult, Permission, Role, RoleForm } from "@/types"

type RolesModuleProps = {
  permissionsByGroup: Record<string, Permission[]>
  roles: Role[]
  selectedRole: Role | undefined
  selectedRoleId: string
  roleForm: RoleForm
  isLoading: boolean
  onRoleFormChange: (form: RoleForm) => void
  onSelectRole: (roleId: string) => void
  onCreateRole: (event: FormEvent<HTMLFormElement>) => Promise<OperationResult>
  onToggleNewRolePermission: (permissionId: string) => void
  onToggleSelectedRolePermission: (permissionId: string) => void
  onSaveSelectedRolePermissions: () => Promise<OperationResult>
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
  const [createError, setCreateError] = useState("")
  const [permissionsError, setPermissionsError] = useState("")
  const roleCanBeCreated = roleForm.name.trim().length >= 2 && roleForm.permissions.length > 0

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Yeni rol oluştur</CardTitle>
          <CardDescription>
            Rol adını belirleyin ve en az bir izin seçin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              setCreateError("")
              const result = await onCreateRole(event)
              if (!result.ok) setCreateError(result.error.message)
            }}
          >
            <FormErrorAlert message={createError} />
            <div className="grid gap-2">
              <Label htmlFor="role-name">Rol adı</Label>
              <Input
                id="role-name"
                placeholder="Örn. Personal Manager"
                value={roleForm.name}
                onChange={(event) => {
                  setCreateError("")
                  onRoleFormChange({ ...roleForm, name: event.target.value })
                }}
              />
            </div>
            <div className="grid gap-2">
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
            <p className="text-sm text-muted-foreground">
              Rol oluşturmak için en az bir izin seçilmelidir.
            </p>
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
          <div className="grid gap-4">
            <FormErrorAlert message={permissionsError} />
            <div className="grid gap-2">
              <Label htmlFor="selected-role">Rol</Label>
              <Select
                value={selectedRoleId}
                onValueChange={(roleId) => {
                  setPermissionsError("")
                  onSelectRole(roleId)
                }}
              >
                <SelectTrigger id="selected-role" className="w-full">
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRole && (
              <>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-medium">{selectedRole.name}</strong>
                    <span className="block truncate text-sm text-muted-foreground">
                      {selectedRole.description ?? "Açıklama eklenmemiş"}
                    </span>
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
                  onClick={async () => {
                    setPermissionsError("")
                    const result = await onSaveSelectedRolePermissions()
                    if (!result.ok) setPermissionsError(result.error.message)
                  }}
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
