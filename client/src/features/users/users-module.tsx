import type { FormEvent } from "react"
import { Check, UserPlus, X } from "lucide-react"

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
import { isPasswordValid, passwordRequirements } from "@/lib/password"
import type { ManagedUser, Role, UserForm } from "@/types"

type UsersModuleProps = {
  users: ManagedUser[]
  roles: Role[]
  userForm: UserForm
  isLoading: boolean
  onUserFormChange: (form: UserForm) => void
  onCreateUser: (event: FormEvent<HTMLFormElement>) => void
}

export function UsersModule({
  users,
  roles,
  userForm,
  isLoading,
  onUserFormChange,
  onCreateUser,
}: UsersModuleProps) {
  const passwordIsValid = isPasswordValid(userForm.password)
  const userCanBeCreated =
    userForm.username.trim() &&
    userForm.fullName.trim() &&
    userForm.email.trim() &&
    userForm.roleId &&
    passwordIsValid

  return (
    <div className="module-grid">
      <Card>
        <CardHeader>
          <CardTitle>Yeni kullanıcı oluştur</CardTitle>
          <CardDescription>
            Kullanıcıya tek rol atanır; yetkiler bu rolden gelir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="stack" onSubmit={onCreateUser}>
            <div className="two-column">
              <div className="field">
                <Label htmlFor="new-username">Kullanıcı adı</Label>
                <Input
                  id="new-username"
                  value={userForm.username}
                  onChange={(event) =>
                    onUserFormChange({ ...userForm, username: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <Label htmlFor="new-full-name">Ad soyad</Label>
                <Input
                  id="new-full-name"
                  value={userForm.fullName}
                  onChange={(event) =>
                    onUserFormChange({ ...userForm, fullName: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="two-column">
              <div className="field">
                <Label htmlFor="new-email">E-posta</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={userForm.email}
                  onChange={(event) => onUserFormChange({ ...userForm, email: event.target.value })}
                />
              </div>
              <div className="field">
                <Label htmlFor="new-role">Rol</Label>
                <select
                  id="new-role"
                  className="select-control"
                  value={userForm.roleId}
                  onChange={(event) => onUserFormChange({ ...userForm, roleId: event.target.value })}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <Label htmlFor="new-password">Geçici şifre</Label>
              <Input
                id="new-password"
                type="password"
                value={userForm.password}
                onChange={(event) => onUserFormChange({ ...userForm, password: event.target.value })}
              />
              <div className="password-requirements" aria-label="Şifre gereksinimleri">
                {passwordRequirements.map((requirement) => {
                  const passes = requirement.test(userForm.password)

                  return (
                    <span key={requirement.id} data-valid={passes}>
                      {passes ? <Check /> : <X />}
                      {requirement.label}
                    </span>
                  )
                })}
              </div>
            </div>
            <Button type="submit" disabled={isLoading || !userCanBeCreated}>
              <UserPlus />
              Kullanıcı ekle
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kullanıcılar</CardTitle>
          <CardDescription>Rol atamaları ve hesap durumları.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="user-list">
            {users.map((user) => (
              <div className="user-row" key={user.id}>
                <div className="user-main">
                  <div className="avatar small">{user.fullName.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{user.fullName}</strong>
                    <span>{user.username} · {user.email}</span>
                  </div>
                </div>
                <div className="user-meta">
                  <Badge variant="outline">{user.roleName}</Badge>
                  <Badge variant={user.status === "active" ? "secondary" : "outline"}>
                    {user.status === "active" ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
