import type { FormEvent, ReactNode } from "react"
import { Check, UserPlus, X } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Yeni kullanıcı oluştur</CardTitle>
          <CardDescription>
            Kullanıcıya tek rol atanır; yetkiler bu rolden gelir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onCreateUser}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kullanıcı adı" htmlFor="new-username">
                <Input
                  id="new-username"
                  value={userForm.username}
                  onChange={(event) =>
                    onUserFormChange({ ...userForm, username: event.target.value })
                  }
                />
              </Field>
              <Field label="Ad soyad" htmlFor="new-full-name">
                <Input
                  id="new-full-name"
                  value={userForm.fullName}
                  onChange={(event) =>
                    onUserFormChange({ ...userForm, fullName: event.target.value })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-posta" htmlFor="new-email">
                <Input
                  id="new-email"
                  type="email"
                  value={userForm.email}
                  onChange={(event) => onUserFormChange({ ...userForm, email: event.target.value })}
                />
              </Field>
              <div className="grid gap-2">
                <Label htmlFor="new-role">Rol</Label>
                <Select
                  value={userForm.roleId}
                  onValueChange={(roleId) => onUserFormChange({ ...userForm, roleId })}
                >
                  <SelectTrigger id="new-role" className="w-full">
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">Geçici şifre</Label>
              <Input
                id="new-password"
                type="password"
                value={userForm.password}
                onChange={(event) => onUserFormChange({ ...userForm, password: event.target.value })}
              />
              <div className="flex flex-wrap gap-1.5" aria-label="Şifre gereksinimleri">
                {passwordRequirements.map((requirement) => {
                  const passes = requirement.test(userForm.password)

                  return (
                    <Badge
                      key={requirement.id}
                      variant={passes ? "secondary" : "outline"}
                      className="gap-1"
                    >
                      {passes ? <Check className="size-3" /> : <X className="size-3" />}
                      {requirement.label}
                    </Badge>
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
          <div className="grid gap-2">
            {users.map((user) => (
              <div
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                key={user.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {user.fullName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-medium">{user.fullName}</strong>
                    <span className="block truncate text-sm text-muted-foreground">
                      {user.username} · {user.email}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
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

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
