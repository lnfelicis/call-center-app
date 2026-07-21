import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Archive,
  Check,
  CircleCheck,
  CircleMinus,
  KeyRound,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import {
  PasswordFields,
} from "@/components/change-password-dialog";
import { FormErrorAlert } from "@/components/form-error-alert";
import { UserPermissionOverrides } from "@/components/user-permission-overrides";
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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  emptyPasswordForm,
  isPasswordValid,
  passwordFormIsValid,
  passwordRequirements,
  type PasswordFormValue,
} from "@/lib/password";
import type {
  ManagedUser,
  OperationError,
  OperationResult,
  Permission,
  Role,
  UserForm,
} from "@/types";

const superAdminUserId = "00000000-0000-4000-8000-000000000002";

type UsersModuleProps = {
  users: ManagedUser[];
  roles: Role[];
  permissionsByGroup: Record<string, Permission[]>;
  userForm: UserForm;
  isLoading: boolean;
  currentUserId: string;
  onUserFormChange: (form: UserForm) => void;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => Promise<OperationResult>;
  onUpdateUser: (
    userId: string,
    payload: Pick<
      ManagedUser,
      "fullName" | "email" | "roleId" | "status" | "permissionOverrides"
    >,
  ) => Promise<OperationResult>;
  onChangePassword: (
    userId: string,
    payload: { currentPassword?: string; newPassword: string },
  ) => Promise<OperationResult>;
  onArchiveUser: (userId: string) => Promise<OperationResult>;
  onRestoreUser: (userId: string) => Promise<OperationResult>;
  onRefresh: () => Promise<void>;
};

type ArchiveFilter = "current" | "archived";

export function UsersModule({
  users,
  roles,
  permissionsByGroup,
  userForm,
  isLoading,
  currentUserId,
  onUserFormChange,
  onCreateUser,
  onUpdateUser,
  onChangePassword,
  onArchiveUser,
  onRestoreUser,
  onRefresh,
}: UsersModuleProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [archivedUser, setArchivedUser] = useState<ManagedUser | null>(null);
  const [archiveCandidate, setArchiveCandidate] = useState<ManagedUser | null>(
    null,
  );
  const [archiveError, setArchiveError] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("current");

  const visibleUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesArchive =
          archiveFilter === "archived"
            ? Boolean(user.archivedAt)
            : !user.archivedAt;
        const matchesRole = roleFilter === "all" || user.roleId === roleFilter;
        const matchesStatus =
          statusFilter === "all" || user.status === statusFilter;
        return matchesArchive && matchesRole && matchesStatus;
      }),
    [archiveFilter, roleFilter, statusFilter, users],
  );

  const userSummary = useMemo(() => {
    const currentUsers = users.filter((user) => !user.archivedAt);

    return {
      total: currentUsers.length,
      active: currentUsers.filter((user) => user.status === "active").length,
      passive: currentUsers.filter((user) => user.status === "passive").length,
      archived: users.filter((user) => Boolean(user.archivedAt)).length,
    };
  }, [users]);

  const columns: Array<DataTableColumn<ManagedUser>> = [
    {
      id: "user",
      header: "Kullanıcı",
      accessor: (user) => `${user.fullName} ${user.username}`,
      size: 260,
      minSize: 220,
      maxSize: 340,
      cell: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <strong className="block truncate text-sm font-medium text-foreground">
              {user.fullName}
            </strong>
            <span className="block truncate text-xs">@{user.username}</span>
          </div>
        </div>
      ),
    },
    {
      id: "email",
      header: "E-posta",
      accessor: (user) => user.email,
      size: 260,
      minSize: 210,
      cell: (user) => <span className="block truncate">{user.email}</span>,
    },
    {
      id: "role",
      header: "Rol",
      accessor: (user) => user.roleName,
      size: 180,
      minSize: 140,
      cell: (user) => <Badge variant="outline">{user.roleName}</Badge>,
    },
    {
      id: "status",
      header: "Durum",
      accessor: (user) => (user.archivedAt ? "silinmiş" : user.status),
      size: 140,
      minSize: 110,
      cell: (user) =>
        user.archivedAt ? (
          <Badge variant="outline">Silinmiş</Badge>
        ) : (
          <Badge variant={user.status === "active" ? "secondary" : "outline"}>
            {user.status === "active" ? "Aktif" : "Pasif"}
          </Badge>
        ),
    },
    {
      id: "last-login",
      header: "Son giriş",
      size: 190,
      minSize: 150,
      cell: (user) => (
        <span className="truncate">{formatDate(user.lastLoginAt)}</span>
      ),
    },
    {
      id: "permissions",
      header: "Özel izinler",
      size: 180,
      minSize: 150,
      cell: (user) =>
        user.permissionOverrides.length > 0 ? (
          <Badge variant="secondary">
            {user.permissionOverrides.length} özel ayar
          </Badge>
        ) : (
          <span>Rol varsayılanı</span>
        ),
    },
  ];

  const passwordIsValid = isPasswordValid(userForm.password);
  const userCanBeCreated = Boolean(
    userForm.username.trim() &&
    userForm.fullName.trim() &&
    userForm.email.trim() &&
    userForm.roleId &&
    passwordIsValid,
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Stat icon={<Users />} label={`${userSummary.total} kullanıcı`} />
          <Stat icon={<CircleCheck />} label={`${userSummary.active} aktif`} />
          <Stat icon={<CircleMinus />} label={`${userSummary.passive} pasif`} />
          <Stat icon={<Archive />} label={`${userSummary.archived} silinen`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border bg-background p-1">
            <Button
              type="button"
              size="sm"
              variant={archiveFilter === "current" ? "secondary" : "ghost"}
              onClick={() => setArchiveFilter("current")}
            >
              Mevcut Kullanıcılar
            </Button>
            <Button
              type="button"
              size="sm"
              variant={archiveFilter === "archived" ? "secondary" : "ghost"}
              onClick={() => setArchiveFilter("archived")}
            >
              Silinen Kullanıcılar
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => void onRefresh()}
          >
            <RefreshCw data-icon="inline-start" />
            Yenile
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <UserPlus data-icon="inline-start" />
            Yeni Kullanıcı
          </Button>
        </div>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            {archiveFilter === "archived"
              ? "Silinmiş kullanıcılar"
              : "Kullanıcılar"}
          </CardTitle>
          <CardDescription>
            {archiveFilter === "archived"
              ? "Silinmiş hesapları filtreleyin ve satıra tıklayarak detaylarını açın."
              : "Kullanıcıları filtreleyin ve satıra tıklayarak hesap detaylarını düzenleyin."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <UserFilters
            roles={roles}
            roleFilter={roleFilter}
            statusFilter={statusFilter}
            onRoleFilterChange={setRoleFilter}
            onStatusFilterChange={setStatusFilter}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {visibleUsers.length} kayıt gösteriliyor
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={roleFilter === "all" && statusFilter === "all"}
              onClick={() => {
                setRoleFilter("all");
                setStatusFilter("all");
              }}
            >
              Filtreleri temizle
            </Button>
          </div>
          <DataTable
            columns={columns}
            data={visibleUsers}
            getRowId={(user) => user.id}
            emptyText={
              archiveFilter === "archived"
                ? "Silinmiş kullanıcı bulunmuyor."
                : "Kullanıcı bulunamadı."
            }
            searchPlaceholder="Ad, kullanıcı adı veya e-posta ara..."
            onRowClick={(user) =>
              user.archivedAt ? setArchivedUser(user) : setEditingUser(user)
            }
            getRowClassName={(user) => {
              const selectedId = editingUser?.id ?? archivedUser?.id;
              return user.id === selectedId
                ? "bg-primary/5 hover:bg-primary/10"
                : user.archivedAt
                  ? "opacity-70"
                  : undefined;
            }}
          />
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        permissionsByGroup={permissionsByGroup}
        userForm={userForm}
        isLoading={isLoading}
        userCanBeCreated={userCanBeCreated}
        onUserFormChange={onUserFormChange}
        onCreateUser={onCreateUser}
      />

      <EditUserDialog
        user={editingUser}
        roles={roles}
        permissionsByGroup={permissionsByGroup}
        isLoading={isLoading}
        onUserChange={setEditingUser}
        onUpdateUser={onUpdateUser}
        onChangePassword={onChangePassword}
        currentUserId={currentUserId}
        canArchive={Boolean(
          editingUser &&
          editingUser.id !== superAdminUserId &&
          editingUser.id !== currentUserId,
        )}
        onArchive={(user) => {
          setEditingUser(null);
          setArchiveError("");
          setArchiveCandidate(user);
        }}
      />

      <ArchivedUserDialog
        user={archivedUser}
        isLoading={isLoading}
        onUserChange={setArchivedUser}
        onRestoreUser={onRestoreUser}
      />

      <Dialog
        open={Boolean(archiveCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveCandidate(null);
            setArchiveError("");
          }
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kullanıcı silinsin mi?</DialogTitle>
            <DialogDescription>
              <strong className="text-foreground">
                {archiveCandidate?.fullName}
              </strong>{" "}
              giriş yapamayacak ve kullanıcı listelerinden kaldırılacak. Çağrı,
              not ve denetim geçmişi korunacak.
            </DialogDescription>
          </DialogHeader>
          <FormErrorAlert message={archiveError} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveCandidate(null)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isLoading}
              onClick={async () => {
                if (!archiveCandidate) return;
                setArchiveError("");
                const result = await onArchiveUser(archiveCandidate.id);
                if (result.ok) {
                  setArchiveCandidate(null);
                } else setArchiveError(result.error.message);
              }}
            >
              <Trash2 data-icon="inline-start" />
              Kullanıcıyı sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-primary">
      {icon}
      {label}
    </span>
  );
}

function UserFilters({
  roles,
  roleFilter,
  statusFilter,
  onRoleFilterChange,
  onStatusFilterChange,
}: {
  roles: Role[];
  roleFilter: string;
  statusFilter: string;
  onRoleFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
}) {
  return (
    <FieldGroup className="grid gap-3 lg:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="user-role-filter">Rol</FieldLabel>
        <Select value={roleFilter} onValueChange={onRoleFilterChange}>
          <SelectTrigger id="user-role-filter" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Tümü</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="user-status-filter">Durum</FieldLabel>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger id="user-status-filter" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="passive">Pasif</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  roles,
  permissionsByGroup,
  userForm,
  isLoading,
  userCanBeCreated,
  onUserFormChange,
  onCreateUser,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  permissionsByGroup: Record<string, Permission[]>;
  userForm: UserForm;
  isLoading: boolean;
  userCanBeCreated: boolean;
  onUserFormChange: (form: UserForm) => void;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => Promise<OperationResult>;
}) {
  const [error, setError] = useState<OperationError | null>(null);

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  const changeForm = (form: UserForm) => {
    setError(null);
    onUserFormChange(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Yeni kullanıcı oluştur</DialogTitle>
          <DialogDescription>
            Hesap bilgilerini, rolü ve gerekiyorsa özel izinleri belirleyin.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={async (event) => {
            setError(null);
            const result = await onCreateUser(event);
            if (result.ok) onOpenChange(false);
            else setError(result.error);
          }}
        >
          <FormErrorAlert message={error && !error.field ? error.message : undefined} />
          <DialogBody>
            <Tabs defaultValue="account">
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="account">
                  Hesap ve rol
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="permissions">
                  Özel yetkiler
                </TabsTrigger>
              </TabsList>
              <TabsContent value="account">
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="new-username"
                    label="Kullanıcı adı"
                    value={userForm.username}
                    onChange={(username) =>
                      changeForm({ ...userForm, username })
                    }
                  />
                  <TextField
                    id="new-full-name"
                    label="Ad soyad"
                    value={userForm.fullName}
                    onChange={(fullName) =>
                      changeForm({ ...userForm, fullName })
                    }
                  />
                  <TextField
                    id="new-email"
                    label="E-posta"
                    type="email"
                    value={userForm.email}
                    onChange={(email) =>
                      changeForm({ ...userForm, email })
                    }
                  />
                  <RoleField
                    id="new-role"
                    roles={roles}
                    value={userForm.roleId}
                    onChange={(roleId) =>
                      changeForm({
                        ...userForm,
                        roleId,
                        permissionOverrides: [],
                      })
                    }
                  />
                  <Field
                    className="sm:col-span-2"
                    data-invalid={error?.field === "password" || undefined}
                  >
                    <FieldLabel htmlFor="new-password">Geçici şifre</FieldLabel>
                    <Input
                      id="new-password"
                      type="password"
                      aria-invalid={error?.field === "password" || undefined}
                      value={userForm.password}
                      onChange={(event) =>
                        changeForm({
                          ...userForm,
                          password: event.target.value,
                        })
                      }
                    />
                    <FieldError>
                      {error?.field === "password" ? error.message : undefined}
                    </FieldError>
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
                  </Field>
                </FieldGroup>
              </TabsContent>
              <TabsContent value="permissions">
                <UserPermissionOverrides
                  idPrefix="new-user-permission"
                  permissionsByGroup={permissionsByGroup}
                  role={roles.find((role) => role.id === userForm.roleId)}
                  overrides={userForm.permissionOverrides}
                  onChange={(permissionOverrides) =>
                    changeForm({ ...userForm, permissionOverrides })
                  }
                />
              </TabsContent>
            </Tabs>
          </DialogBody>
          <DialogFooter alignWithBody>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={isLoading || !userCanBeCreated}>
              <UserPlus data-icon="inline-start" />
              Kullanıcı ekle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  roles,
  permissionsByGroup,
  isLoading,
  onUserChange,
  onUpdateUser,
  onChangePassword,
  currentUserId,
  canArchive,
  onArchive,
}: {
  user: ManagedUser | null;
  roles: Role[];
  permissionsByGroup: Record<string, Permission[]>;
  isLoading: boolean;
  onUserChange: (user: ManagedUser | null) => void;
  onUpdateUser: UsersModuleProps["onUpdateUser"];
  onChangePassword: UsersModuleProps["onChangePassword"];
  currentUserId: string;
  canArchive: boolean;
  onArchive: (user: ManagedUser) => void;
}) {
  const [activeTab, setActiveTab] = useState("account");
  const [passwordForm, setPasswordForm] = useState<PasswordFormValue>(emptyPasswordForm);
  const [error, setError] = useState<OperationError | null>(null);
  const isSelf = user?.id === currentUserId;
  const passwordChangeAllowed = Boolean(
    user && (user.id !== superAdminUserId || isSelf),
  );
  const passwordCanBeSaved = passwordFormIsValid(passwordForm, isSelf);

  useEffect(() => {
    setActiveTab("account");
    setPasswordForm(emptyPasswordForm);
    setError(null);
  }, [user?.id]);

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => !open && onUserChange(null)}
    >
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kullanıcıyı düzenle</DialogTitle>
          <DialogDescription>
            {user?.fullName} hesabının bilgilerini ve yetkilerini güncelleyin.
          </DialogDescription>
        </DialogHeader>
        {user && (
          <form
            className="flex min-h-0 flex-1 flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              if (activeTab === "password") {
                if (!passwordCanBeSaved) return;
                const result = await onChangePassword(user.id, {
                  ...(isSelf ? { currentPassword: passwordForm.currentPassword } : {}),
                  newPassword: passwordForm.newPassword,
                });
                if (result.ok) onUserChange(null);
                else setError(result.error);
                return;
              }

              const result = await onUpdateUser(user.id, {
                fullName: user.fullName,
                email: user.email,
                roleId: user.roleId,
                status: user.status,
                permissionOverrides: user.permissionOverrides,
              });
              if (result.ok) onUserChange(null);
              else setError(result.error);
            }}
          >
            <FormErrorAlert message={error && !error.field ? error.message : undefined} />
            <DialogBody>
              <Tabs
                value={activeTab}
                onValueChange={(tab) => {
                  setError(null);
                  setActiveTab(tab);
                }}
              >
                <TabsList className="w-full">
                  <TabsTrigger className="flex-1" value="account">
                    Hesap ve rol
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="permissions">
                    Özel yetkiler
                  </TabsTrigger>
                  {passwordChangeAllowed && (
                    <TabsTrigger className="flex-1" value="password">
                      Şifre
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="account">
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id="edit-full-name"
                      label="Ad soyad"
                      value={user.fullName}
                      onChange={(fullName) =>
                        onUserChange({ ...user, fullName })
                      }
                    />
                    <TextField
                      id="edit-email"
                      label="E-posta"
                      type="email"
                      value={user.email}
                      onChange={(email) => onUserChange({ ...user, email })}
                    />
                    <RoleField
                      id="edit-role"
                      roles={roles}
                      value={user.roleId}
                      onChange={(roleId) =>
                        onUserChange({
                          ...user,
                          roleId,
                          permissionOverrides: [],
                        })
                      }
                    />
                    <Field>
                      <FieldLabel htmlFor="edit-status">Durum</FieldLabel>
                      <Select
                        value={user.status}
                        onValueChange={(status) =>
                          onUserChange({
                            ...user,
                            status: status === "passive" ? "passive" : "active",
                          })
                        }
                      >
                        <SelectTrigger id="edit-status" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="active">Aktif</SelectItem>
                            <SelectItem value="passive">Pasif</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>
                </TabsContent>
                <TabsContent value="permissions">
                  <UserPermissionOverrides
                    idPrefix={`edit-user-permission-${user.id}`}
                    permissionsByGroup={permissionsByGroup}
                    role={roles.find((role) => role.id === user.roleId)}
                    overrides={user.permissionOverrides}
                    disabled={user.id === superAdminUserId}
                    onChange={(permissionOverrides) =>
                      onUserChange({ ...user, permissionOverrides })
                    }
                  />
                </TabsContent>
                {passwordChangeAllowed && (
                  <TabsContent value="password">
                    <PasswordFields
                      value={passwordForm}
                      requireCurrentPassword={isSelf}
                      errors={{
                        currentPassword:
                          error?.field === "currentPassword" ? error.message : undefined,
                        newPassword: error?.field === "newPassword" ? error.message : undefined,
                      }}
                      onChange={(value) => {
                        setError(null);
                        setPasswordForm(value);
                      }}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </DialogBody>
            <DialogFooter alignWithBody>
              {canArchive && activeTab !== "password" && (
                <Button
                  type="button"
                  variant="destructive"
                  className="sm:mr-auto"
                  onClick={() => onArchive(user)}
                >
                  <Trash2 data-icon="inline-start" />
                  Kullanıcıyı sil
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onUserChange(null)}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={isLoading || (activeTab === "password" && !passwordCanBeSaved)}
              >
                {activeTab === "password" && <KeyRound data-icon="inline-start" />}
                {activeTab === "password" ? "Şifreyi değiştir" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ArchivedUserDialog({
  user,
  isLoading,
  onUserChange,
  onRestoreUser,
}: {
  user: ManagedUser | null;
  isLoading: boolean;
  onUserChange: (user: ManagedUser | null) => void;
  onRestoreUser: UsersModuleProps["onRestoreUser"];
}) {
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
  }, [user?.id]);

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => !open && onUserChange(null)}
    >
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Silinmiş kullanıcı detayı</DialogTitle>
          <DialogDescription>
            Hesap salt okunur gösteriliyor. Geri yüklendiğinde önceki durumu
            korunur.
          </DialogDescription>
        </DialogHeader>
        <FormErrorAlert message={error} />
        {user && (
          <>
            <DialogBody>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  id="archived-full-name"
                  label="Ad soyad"
                  value={user.fullName}
                />
                <ReadOnlyField
                  id="archived-username"
                  label="Kullanıcı adı"
                  value={user.username}
                />
                <ReadOnlyField
                  id="archived-email"
                  label="E-posta"
                  value={user.email}
                />
                <ReadOnlyField
                  id="archived-role"
                  label="Rol"
                  value={user.roleName}
                />
                <ReadOnlyField
                  id="archived-status"
                  label="Silinmeden önceki durum"
                  value={user.status === "active" ? "Aktif" : "Pasif"}
                />
                <ReadOnlyField
                  id="archived-last-login"
                  label="Son giriş"
                  value={formatDate(user.lastLoginAt)}
                />
                <ReadOnlyField
                  id="archived-permissions"
                  label="Özel izinler"
                  value={
                    user.permissionOverrides.length > 0
                      ? `${user.permissionOverrides.length} özel ayar`
                      : "Rol varsayılanı"
                  }
                />
              </FieldGroup>
            </DialogBody>
            <DialogFooter alignWithBody>
              <Button
                type="button"
                variant="outline"
                onClick={() => onUserChange(null)}
              >
                Kapat
              </Button>
              <Button
                type="button"
                disabled={isLoading}
                onClick={async () => {
                  setError("");
                  const result = await onRestoreUser(user.id);
                  if (result.ok) onUserChange(null);
                  else setError(result.error.message);
                }}
              >
                Geri yükle
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function ReadOnlyField({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  return (
    <Field data-disabled>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value} disabled />
    </Field>
  );
}

function RoleField({
  id,
  roles,
  value,
  onChange,
}: {
  id: string;
  roles: Role[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>Rol</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Rol seçin" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function getInitials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
    .join("");
}

function formatDate(value: string | null) {
  if (!value) return "Henüz giriş yok";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
