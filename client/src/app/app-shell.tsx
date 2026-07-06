import { Loader2 } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { LoginScreen } from "@/components/login-screen";
import { Badge } from "@/components/ui/badge";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CallsModule } from "@/features/calls/calls-module";
import { DashboardModule } from "@/features/dashboard/dashboard-module";
import { LogsModule } from "@/features/logs/logs-module";
import { RolesModule } from "@/features/roles/roles-module";
import { SettingsModule } from "@/features/settings/settings-module";
import { UsersModule } from "@/features/users/users-module";
import { useAdminPanel } from "@/hooks/use-admin-panel";
import type { ModuleId } from "@/types";

export function AppShell() {
  const panel = useAdminPanel();

  if (panel.isSessionRestoring) {
    return <SessionRestoreScreen />;
  }

  if (!panel.isAuthenticated || !panel.currentUser) {
    return (
      <LoginScreen
        form={panel.loginForm}
        message={panel.message}
        isLoading={panel.isLoading}
        onChange={panel.setLoginForm}
        onSubmit={panel.handleLogin}
      />
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        activeModule={panel.activeModule}
        currentUser={panel.currentUser}
        roleCount={panel.roles.length}
        permissionCount={panel.permissions.length}
        userCount={panel.users.length}
        isLoading={panel.isLoading}
        onNavigate={panel.setActiveModule}
        onRefresh={() => void panel.loadPanelData()}
        onLogout={panel.handleLogout}
      />

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-16 items-start justify-between gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="mt-0.5" />
            <div className="min-w-0">
              <h2 className="mt-1 truncate text-xl font-semibold leading-tight md:text-2xl">
                {getModuleTitle(panel.activeModule)}
              </h2>
            </div>
          </div>
          {panel.message && (
            <Badge
              variant="secondary"
              className="max-w-[48vw] whitespace-normal text-left"
            >
              {panel.message}
            </Badge>
          )}
        </header>

        <main className="min-w-0 p-4 md:p-7">
          {panel.activeModule === "dashboard" && (
            <DashboardModule
              userPermissions={panel.currentUser.permissions}
              roleCount={panel.roles.length}
              permissionCount={panel.permissions.length}
              userCount={panel.users.length}
              request={panel.request}
            />
          )}

          {panel.activeModule === "users" && (
            <UsersModule
              users={panel.users}
              roles={panel.roles}
              userForm={panel.userForm}
              isLoading={panel.isLoading}
              onUserFormChange={panel.setUserForm}
              onCreateUser={panel.createUser}
              onUpdateUser={(userId, payload) => void panel.updateUser(userId, payload)}
            />
          )}

          {panel.activeModule === "roles" && (
            <RolesModule
              permissionsByGroup={panel.permissionsByGroup}
              roles={panel.roles}
              selectedRole={panel.selectedRole}
              selectedRoleId={panel.selectedRole?.id ?? ""}
              roleForm={panel.roleForm}
              isLoading={panel.isLoading}
              onRoleFormChange={panel.setRoleForm}
              onSelectRole={panel.setSelectedRoleId}
              onCreateRole={panel.createRole}
              onToggleNewRolePermission={panel.toggleNewRolePermission}
              onToggleSelectedRolePermission={
                panel.toggleSelectedRolePermission
              }
              onSaveSelectedRolePermissions={() =>
                void panel.saveSelectedRolePermissions()
              }
            />
          )}

          {panel.activeModule === "calls" && (
            <CallsModule
              currentUser={panel.currentUser}
              request={panel.request}
            />
          )}

          {panel.activeModule === "logs" && (
            <LogsModule request={panel.request} />
          )}

          {panel.activeModule === "settings" && (
            <SettingsModule request={panel.request} />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SessionRestoreScreen() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Oturum kontrol ediliyor
      </div>
    </main>
  );
}

function getModuleTitle(moduleId: ModuleId) {
  if (moduleId === "users") {
    return "Kullanıcı Yönetimi";
  }

  if (moduleId === "roles") {
    return "Roller ve İzinler";
  }

  if (moduleId === "calls") {
    return "Çağrı Kayıtları";
  }

  if (moduleId === "logs") {
    return "Log Kayıtları";
  }

  if (moduleId === "settings") {
    return "Ayarlar";
  }

  return "Genel Bakış";
}
