import { Bell, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppNotification } from "@/types";

export function NotificationCenter({
  notifications,
  unreadCount,
  onNotificationClick,
  onViewAll,
}: {
  notifications: AppNotification[];
  unreadCount: number;
  onNotificationClick: (notification: AppNotification) => void;
  onViewAll: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative"
          aria-label={`Bildirimler: ${unreadCount} okunmamış`}
        >
          <Bell />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 tabular-nums">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>Bildirimler</span>
          <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
            {unreadCount} okunmamış
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {notifications.length === 0 ? (
            <DropdownMenuItem disabled>Bildirim bulunmuyor.</DropdownMenuItem>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="items-start py-2"
                onSelect={() => onNotificationClick(notification)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2 font-medium">
                    {!notification.isRead && (
                      <span className="size-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <span className="truncate">{notification.title}</span>
                  </span>
                  <span className="line-clamp-2 whitespace-normal text-xs text-muted-foreground">
                    {notification.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(notification.createdAt)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onViewAll}>
            <ExternalLink className="size-4" />
            Tüm bildirimleri gör
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
