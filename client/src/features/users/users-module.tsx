import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Check, Pencil, UserPlus, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPasswordValid, passwordRequirements } from "@/lib/password";
import type { ManagedUser, Role, UserForm } from "@/types";

type UsersModuleProps = {
  users: ManagedUser[];
  roles: Role[];
  userForm: UserForm;
  isLoading: boolean;
  onUserFormChange: (form: UserForm) => void;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateUser: (
    userId: string,
    payload: Pick<ManagedUser, "fullName" | "email" | "roleId" | "status">,
  ) => void;
};

export function UsersModule({
  users,
  roles,
  userForm,
  isLoading,
  onUserFormChange,
  onCreateUser,
  onUpdateUser,
}: UsersModuleProps) {
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const passwordIsValid = isPasswordValid(userForm.password);
  const userCanBeCreated =
    userForm.username.trim() &&
    userForm.fullName.trim() &&
    userForm.email.trim() &&
    userForm.roleId &&
    passwordIsValid;

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
                    onUserFormChange({
                      ...userForm,
                      username: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Ad soyad" htmlFor="new-full-name">
                <Input
                  id="new-full-name"
                  value={userForm.fullName}
                  onChange={(event) =>
                    onUserFormChange({
                      ...userForm,
                      fullName: event.target.value,
                    })
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
                  onChange={(event) =>
                    onUserFormChange({ ...userForm, email: event.target.value })
                  }
                />
              </Field>
              <div className="grid gap-2">
                <Label htmlFor="new-role">Rol</Label>
                <Select
                  value={userForm.roleId}
                  onValueChange={(roleId) =>
                    onUserFormChange({ ...userForm, roleId })
                  }
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
                onChange={(event) =>
                  onUserFormChange({
                    ...userForm,
                    password: event.target.value,
                  })
                }
              />
              <div
                className="flex flex-wrap gap-1.5"
                aria-label="Şifre gereksinimleri"
              >
                {passwordRequirements.map((requirement) => {
                  const passes = requirement.test(userForm.password);

                  return (
                    <Badge
                      key={requirement.id}
                      variant={passes ? "secondary" : "outline"}
                      className="gap-1"
                    >
                      {passes ? (
                        <Check className="size-3" />
                      ) : (
                        <X className="size-3" />
                      )}
                      {requirement.label}
                    </Badge>
                  );
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
                  <Avatar>
                    <AvatarFallback>
                      {user.fullName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-medium">
                      {user.fullName}
                    </strong>
                    <span className="block truncate text-sm text-muted-foreground">
                      {user.username} · {user.email}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{user.roleName}</Badge>
                  <Badge
                    variant={user.status === "active" ? "secondary" : "outline"}
                  >
                    {user.status === "active" ? "Aktif" : "Pasif"}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingUser(user)}
                  >
                    <Pencil />
                    Düzenle
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcıyı düzenle</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                onUpdateUser(editingUser.id, {
                  fullName: editingUser.fullName,
                  email: editingUser.email,
                  roleId: editingUser.roleId,
                  status: editingUser.status,
                });
                setEditingUser(null);
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ad soyad" htmlFor="edit-full-name">
                  <Input
                    id="edit-full-name"
                    value={editingUser.fullName}
                    onChange={(event) =>
                      setEditingUser((current) =>
                        current
                          ? { ...current, fullName: event.target.value }
                          : current,
                      )
                    }
                  />
                </Field>
                <Field label="E-posta" htmlFor="edit-email">
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingUser.email}
                    onChange={(event) =>
                      setEditingUser((current) =>
                        current
                          ? { ...current, email: event.target.value }
                          : current,
                      )
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Rol</Label>
                  <Select
                    value={editingUser.roleId}
                    onValueChange={(roleId) =>
                      setEditingUser((current) =>
                        current ? { ...current, roleId } : current,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
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
                <div className="grid gap-2">
                  <Label>Durum</Label>
                  <Select
                    value={editingUser.status}
                    onValueChange={(status) =>
                      setEditingUser((current) =>
                        current
                          ? {
                              ...current,
                              status:
                                status === "passive" ? "passive" : "active",
                            }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="passive">Pasif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                >
                  Vazgeç
                </Button>
                <Button type="submit" disabled={isLoading}>
                  Kaydet
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
