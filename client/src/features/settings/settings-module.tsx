import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  Bell,
  Database,
  GripVertical,
  Plus,
  Save,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CallFormFieldSetting,
  CallFormOption,
  CallOptionType,
  NotificationSettings,
  PrivacySettings,
  RequestFn,
  SecuritySettings,
} from "@/types";

type SettingsModuleProps = {
  request: RequestFn;
};

type EditableOptionType = Exclude<CallOptionType, "issue_sub_category">;
type DropPlacement = "before" | "after";

type DragState = {
  id: string;
  type: EditableOptionType;
};

const editableOptionTypes: EditableOptionType[] = [
  "interaction_type",
  "issue_category",
  "status",
  "priority",
  "resolution_category",
];

const optionTypeLabels: Record<EditableOptionType, string> = {
  interaction_type: "Görüşme Tipleri",
  issue_category: "Sorun Kategorileri",
  status: "Durum Seçenekleri",
  priority: "Öncelik Seçenekleri",
  resolution_category: "Çözüm Kategorileri",
};

const defaultSecuritySettings: SecuritySettings = {
  sessionDurationMinutes: 480,
  failedLoginLimit: 5,
  ipAllowlist: [],
};

const defaultNotificationSettings: NotificationSettings = {
  panelEnabled: true,
  emailEnabled: false,
  followUpReminderEnabled: true,
  urgentNotificationEnabled: true,
  staleCallNotificationEnabled: true,
  staleCallHours: 24,
};

const defaultPrivacySettings: PrivacySettings = {
  retentionDays: 1095,
  archiveResolvedAfterDays: 180,
  anonymizeArchivedAfterDays: 365,
};

export function SettingsModule({ request }: SettingsModuleProps) {
  const [options, setOptions] = useState<CallFormOption[]>([]);
  const [fields, setFields] = useState<CallFormFieldSetting[]>([]);
  const [activeOptionType, setActiveOptionType] =
    useState<EditableOptionType>("interaction_type");
  const [form, setForm] = useState({
    label: "",
    sortOrder: 0,
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [security, setSecurity] = useState<SecuritySettings>(
    defaultSecuritySettings,
  );
  const [notifications, setNotifications] = useState<NotificationSettings>(
    defaultNotificationSettings,
  );
  const [privacy, setPrivacy] =
    useState<PrivacySettings>(defaultPrivacySettings);
  const [ipAllowlistText, setIpAllowlistText] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [hasSecurityChanges, setHasSecurityChanges] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const dragState = useRef<DragState | null>(null);
  const lastMoveKey = useRef("");
  const optionsRef = useRef<CallFormOption[]>([]);
  const pendingRects = useRef<Map<string, DOMRect> | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const activeOptions = options
    .filter((option) => option.type === activeOptionType)
    .sort((first, second) => first.sortOrder - second.sortOrder);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!draggingId) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      event.preventDefault();
      moveDraggedItem(event.clientY);
    }

    function handlePointerEnd() {
      endDrag();
    }

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [draggingId]);

  useLayoutEffect(() => {
    const previousRects = pendingRects.current;

    if (!previousRects) {
      return;
    }

    pendingRects.current = null;

    rowRefs.current.forEach((element, optionId) => {
      const previous = previousRects.get(optionId);

      if (!previous) {
        return;
      }

      const current = element.getBoundingClientRect();
      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      element.animate(
        [
          { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: 170,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        },
      );
    });
  }, [options]);

  const loadOptions = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const [data, securityData] = await Promise.all([
        request<{ options: CallFormOption[]; fields: CallFormFieldSetting[] }>(
          "/settings",
        ),
        request<{
          security: SecuritySettings;
          notifications: NotificationSettings;
          privacy: PrivacySettings;
        }>("/settings/security"),
      ]);
      setOptions(
        data.options.filter((option) =>
          editableOptionTypes.includes(option.type as EditableOptionType),
        ),
      );
      setFields(data.fields);
      setSecurity(securityData.security);
      setNotifications(securityData.notifications);
      setPrivacy(securityData.privacy);
      setIpAllowlistText(securityData.security.ipAllowlist.join("\n"));
      setHasChanges(false);
      setHasSecurityChanges(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seçenekler yüklenemedi.");
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  async function createOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      await request(`/settings/options/${activeOptionType}`, {
        method: "POST",
        body: JSON.stringify({
          label: form.label,
          sortOrder: form.sortOrder,
        }),
      });
      setForm((current) => ({
        ...current,
        label: "",
        sortOrder: current.sortOrder + 10,
      }));
      setMessage("Seçenek eklendi.");
      await loadOptions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seçenek eklenemedi.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveAllOptions() {
    setIsLoading(true);
    setMessage("");

    try {
      await request("/settings", {
        method: "PATCH",
        body: JSON.stringify({ options, fields }),
      });
      setMessage("Tüm değişiklikler kaydedildi.");
      await loadOptions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seçenekler kaydedilemedi.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveSecuritySettings() {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await request<{
        security: SecuritySettings;
        notifications: NotificationSettings;
        privacy: PrivacySettings;
      }>("/settings/security", {
        method: "PATCH",
        body: JSON.stringify({
          security: {
            ...security,
            ipAllowlist: ipAllowlistText
              .split(/\r?\n|,/)
              .map((item) => item.trim())
              .filter(Boolean),
          },
          notifications,
          privacy,
        }),
      });
      setSecurity(data.security);
      setNotifications(data.notifications);
      setPrivacy(data.privacy);
      setIpAllowlistText(data.security.ipAllowlist.join("\n"));
      setHasSecurityChanges(false);
      setMessage("Güvenlik ve bildirim ayarları kaydedildi.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Güvenlik ayarları kaydedilemedi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function patchLocalOption(optionId: string, patch: Partial<CallFormOption>) {
    setOptions((current) =>
      current.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option,
      ),
    );
    setHasChanges(true);
  }

  function patchLocalField(
    fieldKey: string,
    patch: Partial<CallFormFieldSetting>,
  ) {
    setFields((current) =>
      current.map((field) =>
        field.key === fieldKey ? { ...field, ...patch } : field,
      ),
    );
    setHasChanges(true);
  }

  function captureRowRects() {
    pendingRects.current = new Map(
      [...rowRefs.current.entries()].map(([optionId, element]) => [
        optionId,
        element.getBoundingClientRect(),
      ]),
    );
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    type: EditableOptionType,
    optionId: string,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.userSelect = "none";
    dragState.current = { id: optionId, type };
    lastMoveKey.current = "";
    setDraggingId(optionId);
  }

  function moveDraggedItem(clientY: number) {
    const currentDrag = dragState.current;

    if (!currentDrag) {
      return;
    }

    const candidates = optionsRef.current
      .filter(
        (option) =>
          option.type === currentDrag.type && option.id !== currentDrag.id,
      )
      .sort((first, second) => first.sortOrder - second.sortOrder);

    if (candidates.length === 0) {
      return;
    }

    let targetId = candidates[candidates.length - 1].id;
    let placement: DropPlacement = "after";

    for (const option of candidates) {
      const element = rowRefs.current.get(option.id);

      if (!element) {
        continue;
      }

      const rect = element.getBoundingClientRect();

      if (clientY < rect.top + rect.height / 2) {
        targetId = option.id;
        placement = "before";
        break;
      }
    }

    scheduleReorder(currentDrag.id, currentDrag.type, targetId, placement);
  }

  function endDrag(event?: ReactPointerEvent<HTMLButtonElement>) {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    document.body.style.userSelect = "";
    dragState.current = null;
    lastMoveKey.current = "";
    pendingRects.current = null;
    setDraggingId(null);
  }

  function scheduleReorder(
    draggedId: string,
    type: EditableOptionType,
    targetId: string,
    placement: DropPlacement,
  ) {
    if (draggedId === targetId) {
      return;
    }

    const moveKey = `${draggedId}:${targetId}:${placement}`;

    if (lastMoveKey.current === moveKey) {
      return;
    }

    lastMoveKey.current = moveKey;
    reorderOption(draggedId, type, targetId, placement);
  }

  function reorderOption(
    draggedId: string,
    type: EditableOptionType,
    targetId: string,
    placement: DropPlacement,
  ) {
    captureRowRects();
    setHasChanges(true);

    setOptions((current) => {
      const sameType = current
        .filter((option) => option.type === type)
        .sort((first, second) => first.sortOrder - second.sortOrder);
      const others = current.filter((option) => option.type !== type);
      const draggingIndex = sameType.findIndex((option) => option.id === draggedId);
      const targetIndex = sameType.findIndex((option) => option.id === targetId);

      if (draggingIndex === -1 || targetIndex === -1) {
        pendingRects.current = null;
        return current;
      }

      let insertionIndex = targetIndex + (placement === "after" ? 1 : 0);

      if (draggingIndex < insertionIndex) {
        insertionIndex -= 1;
      }

      if (draggingIndex === insertionIndex) {
        pendingRects.current = null;
        return current;
      }

      const reordered = [...sameType];
      const [dragged] = reordered.splice(draggingIndex, 1);
      reordered.splice(insertionIndex, 0, dragged);

      return [
        ...others,
        ...reordered.map((option, index) => ({
          ...option,
          sortOrder: (index + 1) * 10,
        })),
      ].sort((first, second) => {
        if (first.type === second.type) {
          return first.sortOrder - second.sortOrder;
        }

        return first.type.localeCompare(second.type);
      });
    });
  }

  function changeActiveOptionType(type: string) {
    setActiveOptionType(type as EditableOptionType);
    setForm((current) => ({ ...current, label: "" }));
  }

  return (
    <div className="grid gap-4">
      {message && (
        <p className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <Tabs defaultValue="options">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="options">Form Seçenekleri</TabsTrigger>
          <TabsTrigger value="fields">Form Alanları</TabsTrigger>
          <TabsTrigger value="security">Güvenlik ve KVKK</TabsTrigger>
        </TabsList>

        <TabsContent value="options">
          <Card>
            <CardHeader>
              <CardTitle>Çağrı Formu Seçenekleri</CardTitle>
              <CardDescription>
                Seçenek türünü sekmeden seçin, listeyi sürükle bırak ile sıralayın
                ve tüm değişiklikleri tek seferde kaydedin.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Tabs value={activeOptionType} onValueChange={changeActiveOptionType}>
                <TabsList className="w-full justify-start overflow-x-auto">
                  {editableOptionTypes.map((type) => (
                    <TabsTrigger key={type} value={type}>
                      {optionTypeLabels[type]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <form
                className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end"
                onSubmit={createOption}
              >
                <div className="grid gap-2">
                  <Label>{optionTypeLabels[activeOptionType]} seçeneği</Label>
                  <Input
                    value={form.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                    placeholder="Örn. Telefon dönüşü"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || form.label.trim().length < 2}
                >
                  <Plus />
                  Ekle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void saveAllOptions()}
                  disabled={isLoading || !hasChanges}
                >
                  <Save />
                  Tümünü Kaydet
                </Button>
              </form>

              <div className="grid gap-2">
                {activeOptions.length === 0 && (
                  <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Bu türde henüz seçenek yok.
                  </p>
                )}
                {activeOptions.map((option) => (
                  <div
                    className="grid grid-cols-[1.75rem_minmax(180px,1fr)_auto] items-center gap-2 rounded-lg border bg-background p-2 shadow-xs transition-[background-color,border-color,box-shadow,opacity] duration-150 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5 data-[dragging=true]:opacity-70 data-[dragging=true]:shadow-md max-sm:grid-cols-1"
                    key={option.id}
                    ref={(node) => {
                      if (node) {
                        rowRefs.current.set(option.id, node);
                      } else {
                        rowRefs.current.delete(option.id);
                      }
                    }}
                    data-dragging={draggingId === option.id}
                  >
                    <button
                      type="button"
                      className="grid size-7 cursor-grab touch-none place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing max-sm:hidden"
                      onPointerDown={(event) =>
                        beginDrag(event, activeOptionType, option.id)
                      }
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      title="Sırala"
                    >
                      <GripVertical className="size-4" />
                    </button>
                    <Input
                      value={option.label}
                      onChange={(event) =>
                        patchLocalOption(option.id, {
                          label: event.target.value,
                        })
                      }
                    />
                    <Flag
                      label="Aktif"
                      checked={option.isActive}
                      onChange={(isActive) =>
                        patchLocalOption(option.id, { isActive })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <CardTitle>Form Alanları</CardTitle>
              <CardDescription>
                Alanların aktiflik, zorunluluk, görünürlük, düzenlenebilirlik
                ve maskeleme davranışlarını yönetin.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {fields
                .sort((first, second) => first.sortOrder - second.sortOrder)
                .map((field) => (
                  <div
                    key={field.key}
                    className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(180px,1fr)_repeat(5,auto)] lg:items-center"
                  >
                    <div className="grid gap-1">
                      <Input
                        value={field.label}
                        onChange={(event) =>
                          patchLocalField(field.key, {
                            label: event.target.value,
                          })
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {field.key}
                      </span>
                    </div>
                    <Flag
                      label="Aktif"
                      checked={field.isActive}
                      onChange={(isActive) =>
                        patchLocalField(field.key, { isActive })
                      }
                    />
                    <Flag
                      label="Görünür"
                      checked={field.isVisible}
                      onChange={(isVisible) =>
                        patchLocalField(field.key, { isVisible })
                      }
                    />
                    <Flag
                      label="Zorunlu"
                      checked={field.isRequired}
                      onChange={(isRequired) =>
                        patchLocalField(field.key, { isRequired })
                      }
                    />
                    <Flag
                      label="Düzenlenebilir"
                      checked={field.isEditable}
                      onChange={(isEditable) =>
                        patchLocalField(field.key, { isEditable })
                      }
                    />
                    <Flag
                      label="Maskeli"
                      checked={field.isMasked}
                      onChange={(isMasked) =>
                        patchLocalField(field.key, { isMasked })
                      }
                    />
                  </div>
                ))}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void saveAllOptions()}
                  disabled={isLoading || !hasChanges}
                >
                  <Save />
                  Form Alanlarını Kaydet
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" />
                Güvenlik, Bildirim ve KVKK Ayarları
              </CardTitle>
              <CardDescription>
                Oturum, hatalı giriş limiti, bildirim kanalları ve veri saklama
                davranışlarını yönetin.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="grid gap-3 rounded-lg border p-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="size-4 text-primary" />
                    Güvenlik
                  </h3>
                  <NumberSetting
                    label="Oturum süresi (dk)"
                    min={15}
                    max={1440}
                    value={security.sessionDurationMinutes}
                    onChange={(sessionDurationMinutes) => {
                      setSecurity((current) => ({
                        ...current,
                        sessionDurationMinutes,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                  <NumberSetting
                    label="Hatalı giriş limiti"
                    min={1}
                    max={20}
                    value={security.failedLoginLimit}
                    onChange={(failedLoginLimit) => {
                      setSecurity((current) => ({
                        ...current,
                        failedLoginLimit,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                  <div className="grid gap-2">
                    <Label>IP izin listesi</Label>
                    <Input
                      value={ipAllowlistText}
                      onChange={(event) => {
                        setIpAllowlistText(event.target.value);
                        setHasSecurityChanges(true);
                      }}
                      placeholder="Boşsa tüm IP adresleri"
                    />
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border p-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Bell className="size-4 text-primary" />
                    Bildirimler
                  </h3>
                  <Flag
                    label="Panel içi bildirim"
                    checked={notifications.panelEnabled}
                    onChange={(panelEnabled) => {
                      setNotifications((current) => ({
                        ...current,
                        panelEnabled,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                  <Flag
                    label="E-posta kanalı"
                    checked={notifications.emailEnabled}
                    onChange={(emailEnabled) => {
                      setNotifications((current) => ({
                        ...current,
                        emailEnabled,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                  <Flag
                    label="Takip tarihi bildirimi"
                    checked={notifications.followUpReminderEnabled}
                    onChange={(followUpReminderEnabled) => {
                      setNotifications((current) => ({
                        ...current,
                        followUpReminderEnabled,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                  <Flag
                    label="Acil çağrı bildirimi"
                    checked={notifications.urgentNotificationEnabled}
                    onChange={(urgentNotificationEnabled) => {
                      setNotifications((current) => ({
                        ...current,
                        urgentNotificationEnabled,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                  <Flag
                    label="Çözüm süresi uyarısı"
                    checked={notifications.staleCallNotificationEnabled}
                    onChange={(staleCallNotificationEnabled) => {
                      setNotifications((current) => ({
                        ...current,
                        staleCallNotificationEnabled,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                  <NumberSetting
                    label="Çözüm süresi eşiği (saat)"
                    min={1}
                    max={720}
                    value={notifications.staleCallHours}
                    onChange={(staleCallHours) => {
                      setNotifications((current) => ({
                        ...current,
                        staleCallHours,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                </div>

                <div className="grid gap-3 rounded-lg border p-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Database className="size-4 text-primary" />
                    Veri Saklama
                  </h3>
                  <NumberSetting
                    label="Genel saklama süresi (gün)"
                    min={30}
                    value={privacy.retentionDays}
                    onChange={(retentionDays) => {
                      setPrivacy((current) => ({ ...current, retentionDays }));
                      setHasSecurityChanges(true);
                    }}
                  />
                  <NumberSetting
                    label="Çözülenleri arşivleme (gün)"
                    min={1}
                    value={privacy.archiveResolvedAfterDays}
                    onChange={(archiveResolvedAfterDays) => {
                      setPrivacy((current) => ({
                        ...current,
                        archiveResolvedAfterDays,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                  <NumberSetting
                    label="Arşiv anonimleştirme (gün)"
                    min={1}
                    value={privacy.anonymizeArchivedAfterDays}
                    onChange={(anonymizeArchivedAfterDays) => {
                      setPrivacy((current) => ({
                        ...current,
                        anonymizeArchivedAfterDays,
                      }));
                      setHasSecurityChanges(true);
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void saveSecuritySettings()}
                  disabled={isLoading || !hasSecurityChanges}
                >
                  <Save />
                  Güvenlik Ayarlarını Kaydet
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Flag({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      {label}
    </label>
  );
}

function NumberSetting({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
