import { Check, Loader2, Monitor, Moon, Sun } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { LoginScreen } from "@/components/login-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CallsModule } from "@/features/calls/calls-module";
import { DashboardModule } from "@/features/dashboard/dashboard-module";
import { LogsModule } from "@/features/logs/logs-module";
import { NotificationsModule } from "@/features/notifications/notifications-module";
import { ReportsModule } from "@/features/reports/reports-module";
import { RolesModule } from "@/features/roles/roles-module";
import { SettingsModule } from "@/features/settings/settings-module";
import { UsersModule } from "@/features/users/users-module";
import { useAdminPanel } from "@/hooks/use-admin-panel";
import { useTheme } from "@/hooks/use-theme";
import type { ModuleId, ThemeMode } from "@/types";

const themeOptions: Array<{
  mode: ThemeMode;
  label: string;
  icon: typeof Monitor;
}> = [
  { mode: "system", label: "Sistem", icon: Monitor },
  { mode: "light", label: "Açık", icon: Sun },
  { mode: "dark", label: "Koyu", icon: Moon },
];

export function AppShell() {
  const panel = useAdminPanel();
  const theme = useTheme();

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
          <ThemeSwitcher
            themeMode={theme.themeMode}
            onThemeModeChange={theme.setThemeMode}
          />
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

          {panel.activeModule === "reports" && (
            <ReportsModule
              request={panel.request}
              users={panel.users}
              canExport={panel.currentUser.permissions.includes("reports.export")}
              canViewAllCalls={panel.currentUser.permissions.includes("calls.view.all")}
            />
          )}

          {panel.activeModule === "notifications" && (
            <NotificationsModule request={panel.request} />
          )}

          {panel.activeModule === "settings" && (
            <SettingsModule request={panel.request} />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ThemeSwitcher({
  themeMode,
  onThemeModeChange,
}: {
  themeMode: ThemeMode;
  onThemeModeChange: (themeMode: ThemeMode) => void;
}) {
  const activeTheme = themeOptions.find((option) => option.mode === themeMode) ?? themeOptions[0];
  const ActiveIcon = activeTheme.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Tema: ${activeTheme.label}`}
          title={`Tema: ${activeTheme.label}`}
        >
          <ActiveIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isActive = option.mode === themeMode;

          return (
            <DropdownMenuItem
              key={option.mode}
              onClick={() => onThemeModeChange(option.mode)}
            >
              <Icon />
              <span>{option.label}</span>
              {isActive && <Check className="ml-auto" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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

  if (moduleId === "reports") {
    return "Raporlar";
  }

  if (moduleId === "notifications") {
    return "Bildirimler";
  }

  if (moduleId === "settings") {
    return "Ayarlar";
  }

  return "Genel Bakış";
}
