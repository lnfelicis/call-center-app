import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { AuthUser, ModuleId } from "@/types";

type AppSidebarProps = {
  activeModule: ModuleId;
  currentUser: AuthUser;
  roleCount: number;
  permissionCount: number;
  userCount: number;
  isLoading: boolean;
  onNavigate: (moduleId: ModuleId) => void;
  onRefresh: () => void;
  onLogout: () => void;
};

const navigation = [
  {
    id: "dashboard",
    label: "Genel Bakış",
    icon: LayoutDashboard,
    enabled: true,
    permissions: [],
  },
  {
    id: "users",
    label: "Kullanıcılar",
    icon: Users,
    enabled: true,
    permissions: ["users.manage"],
  },
  {
    id: "roles",
    label: "Roller ve İzinler",
    icon: ShieldCheck,
    enabled: true,
    permissions: ["roles.manage"],
  },
  {
    id: "calls",
    label: "Çağrı Kayıtları",
    icon: ClipboardList,
    enabled: true,
    permissions: [
      "calls.view.own",
      "calls.view.all",
      "calls.create",
      "calls.edit",
      "calls.note.own",
      "calls.note.assigned",
      "calls.assign",
      "calls.resolve",
      "calls.reopen",
      "calls.archive",
    ],
  },
  {
    id: "reports",
    label: "Raporlar",
    icon: BarChart3,
    enabled: false,
    permissions: ["reports.view", "reports.export"],
  },
  {
    id: "settings",
    label: "Ayarlar",
    icon: Settings,
    enabled: true,
    permissions: ["settings.manage"],
  },
];

export function AppSidebar({
  activeModule,
  currentUser,
  roleCount,
  permissionCount,
  userCount,
  isLoading,
  onNavigate,
  onRefresh,
  onLogout,
}: AppSidebarProps) {
  const visibleNavigation = navigation.filter((item) => {
    if (item.id === "dashboard") {
      return true;
    }

    return item.permissions.some((permission) =>
      currentUser.permissions.includes(permission),
    );
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <Badge variant="outline" className="mb-2">
              Call Center
            </Badge>
            <h1 className="truncate text-lg font-semibold leading-tight">
              Yönetim Paneli
            </h1>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modüller</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === activeModule;

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isActive}
                      disabled={!item.enabled}
                      onClick={() =>
                        item.enabled && onNavigate(item.id as ModuleId)
                      }
                    >
                      <Icon />
                      <span>{item.label}</span>
                      {!item.enabled && (
                        <Badge
                          variant="outline"
                          className="ml-auto text-[0.68rem]"
                        >
                          Yakında
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Özet</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid grid-cols-3 gap-2 px-2">
              <Stat label="Rol" value={roleCount} />
              <Stat label="İzin" value={permissionCount} />
              <Stat label="Kullanıcı" value={userCount} />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-4">
        <div className="flex items-center gap-3 rounded-lg border bg-background p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <Avatar className="rounded-lg">
            <AvatarFallback className="rounded-lg bg-muted text-foreground">
              {currentUser.fullName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <strong className="block truncate text-sm font-medium">
              {currentUser.fullName}
            </strong>
            <span className="block truncate text-xs text-muted-foreground">
              {currentUser.roleName}
            </span>
          </div>
        </div>

        <div className="grid gap-2 group-data-[collapsible=icon]:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw />
            Yenile
          </Button>
          <Button type="button" variant="ghost" onClick={onLogout}>
            <LogOut />
            Çıkış
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-2">
      <strong className="block text-lg font-semibold leading-tight">
        {value}
      </strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
