import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquarePlus,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { OptionBadge } from "@/components/option-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type {
  AuthUser,
  CallDetail,
  CallForm,
  CallFormFieldSetting,
  CallMatches,
  CallFormOption,
  CallPriority,
  CallRecord,
  CallStatus,
  RequestFn,
} from "@/types";

type CallsModuleProps = {
  currentUser: AuthUser;
  request: RequestFn;
};

type CallFormKey = keyof CallForm;
type CallFormErrors = Partial<Record<CallFormKey, string>>;
type CallListFilters = {
  status: string;
  priority: string;
  category: string;
  followUp: "all" | "needed" | "none";
};

const emptyCallForm: CallForm = {
  phoneNumber: "",
  studentTc: "",
  studentName: "",
  interactionType: "Gelen çağrı",
  category: "Bilgi talebi",
  issue: "",
  initialNote: "",
  priority: "normal",
  needsFollowUp: false,
  followUpAt: "",
};

const statusLabels: Record<CallStatus, string> = {
  open: "Açık",
  in_progress: "İşlemde",
  waiting: "Yanıt bekliyor",
  follow_up: "Takip edilecek",
  transferred: "Yetkiliye aktarıldı",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
  cancelled: "İptal",
  duplicate: "Mükerrer",
  archived: "Arşiv",
};

const priorityLabels: Record<CallPriority, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

const noteTypeLabels = {
  personnel: "Personel Notu",
  follow_up: "Takip Notu",
  assigned_personnel: "Atanan Personel Notu",
  internal: "İç Not",
  manager: "Yönetici Notu",
};

export function CallsModule({ currentUser, request }: CallsModuleProps) {
  const toast = useToast();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [callOptions, setCallOptions] = useState<CallFormOption[]>([]);
  const [fieldSettings, setFieldSettings] = useState<CallFormFieldSetting[]>(
    [],
  );
  const [selectedCallId, setSelectedCallId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<CallDetail | null>(null);
  const [callForm, setCallForm] = useState<CallForm>(emptyCallForm);
  const [editForm, setEditForm] = useState<CallForm>(emptyCallForm);
  const [noteForm, setNoteForm] = useState({
    noteType: "personnel",
    content: "",
  });
  const [resolutionForm, setResolutionForm] = useState({
    resolutionCategory: "Bilgi verildi",
    resolutionDescription: "",
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [createFieldErrors, setCreateFieldErrors] = useState<CallFormErrors>(
    {},
  );
  const [editFieldErrors, setEditFieldErrors] = useState<CallFormErrors>({});
  const [callMatches, setCallMatches] = useState<CallMatches>({
    phoneMatches: [],
    tcMatches: [],
  });
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [activeScope, setActiveScope] = useState<"own" | "all">("own");
  const [listFilters, setListFilters] = useState<CallListFilters>({
    status: "all",
    priority: "all",
    category: "all",
    followUp: "all",
  });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedCall =
    selectedDetail?.call ?? calls.find((call) => call.id === selectedCallId);
  const canCreate = currentUser.permissions.includes("calls.create");
  const canEdit = currentUser.permissions.includes("calls.edit");
  const canViewAll = currentUser.permissions.includes("calls.view.all");
  const canResolve = currentUser.permissions.includes("calls.resolve");
  const canReopen = currentUser.permissions.includes("calls.reopen");
  const canAddAnyNote =
    currentUser.permissions.includes("calls.note.own") ||
    currentUser.permissions.includes("calls.note.assigned") ||
    canEdit;

  const visibleCalls = useMemo(() => {
    if (activeScope === "own") {
      return calls.filter((call) => call.openedByUserId === currentUser.id);
    }

    return calls;
  }, [activeScope, calls, currentUser.id]);

  const listSummary = useMemo(() => {
    return {
      open: visibleCalls.filter(
        (call) => call.status !== "resolved" && call.status !== "closed",
      ).length,
      resolved: visibleCalls.filter((call) => call.status === "resolved")
        .length,
      followUp: visibleCalls.filter((call) => call.needsFollowUp).length,
    };
  }, [visibleCalls]);

  const interactionTypes = callOptions.filter(
    (option) => option.type === "interaction_type" && option.isActive,
  );
  const issueCategories = callOptions.filter(
    (option) => option.type === "issue_category" && option.isActive,
  );
  const statusOptions = callOptions.filter(
    (option) => option.type === "status" && option.isActive,
  );
  const priorityOptions = callOptions.filter(
    (option) => option.type === "priority" && option.isActive,
  );
  const resolutionCategories = callOptions.filter(
    (option) => option.type === "resolution_category" && option.isActive,
  );

  function optionLabel(type: CallFormOption["type"], value: string) {
    return (
      callOptions.find(
        (option) => option.type === type && option.value === value,
      )?.label ?? value
    );
  }

  function optionColor(type: CallFormOption["type"], value: string) {
    return (
      callOptions.find(
        (option) => option.type === type && option.value === value,
      )?.color ?? null
    );
  }

  function fieldSetting(key: CallFormFieldSetting["key"]) {
    return fieldSettings.find((field) => field.key === key);
  }

  function fieldIsVisible(key: CallFormFieldSetting["key"]) {
    const field = fieldSetting(key);
    return !field || (field.isActive && field.isVisible);
  }

  function fieldIsRequired(key: CallFormFieldSetting["key"]) {
    const field = fieldSetting(key);
    return fieldIsVisible(key) && Boolean(field?.isRequired);
  }

  function fieldDisplayLabel(key: CallFormKey) {
    return fieldSetting(key)?.label || fieldLabel(key);
  }

  function fieldCanEdit(key: CallFormFieldSetting["key"]) {
    const field = fieldSetting(key);
    const canViewMaskedValue =
      !field?.isMasked ||
      currentUser.permissions.includes("sensitive.view_unmasked");

    return (
      fieldIsVisible(key) &&
      Boolean(field?.isEditable ?? true) &&
      canViewMaskedValue
    );
  }

  const filteredCalls = useMemo(() => {
    return visibleCalls.filter((call) => {
      if (listFilters.status !== "all" && call.status !== listFilters.status) {
        return false;
      }

      if (
        listFilters.priority !== "all" &&
        call.priority !== listFilters.priority
      ) {
        return false;
      }

      if (
        listFilters.category !== "all" &&
        call.category !== listFilters.category
      ) {
        return false;
      }

      if (listFilters.followUp === "needed" && !call.needsFollowUp) {
        return false;
      }

      if (listFilters.followUp === "none" && call.needsFollowUp) {
        return false;
      }

      return true;
    });
  }, [listFilters, visibleCalls]);

  const callTableColumns: Array<DataTableColumn<CallRecord>> = [
    {
      id: "record",
      header: "Kayıt",
      size: 190,
      minSize: 150,
      accessor: (call) => `${call.recordNumber} ${call.createdAt}`,
      cell: (call) => (
        <span className="truncate font-medium text-foreground">
          {call.recordNumber}
        </span>
      ),
    },
    {
      id: "student",
      header: "Kişi",
      size: 240,
      minSize: 180,
      accessor: (call) =>
        `${call.studentName ?? ""} ${call.phoneNumber} ${call.studentTc ?? ""}`,
      cell: (call) => (
        <div className="grid gap-1">
          <span className="truncate font-medium text-foreground">
            {call.studentName || call.phoneNumber || "-"}
          </span>
          <span className="truncate text-xs">
            {[
              fieldIsVisible("phoneNumber") ? call.phoneNumber : null,
              fieldIsVisible("studentTc") ? call.studentTc : null,
            ]
              .filter(Boolean)
              .join(" · ") || "-"}
          </span>
        </div>
      ),
    },
    {
      id: "category",
      header: "Kategori",
      size: 220,
      minSize: 160,
      accessor: (call) => `${call.category} ${call.interactionType}`,
      cell: (call) => (
        <div className="grid gap-1">
          <span className="truncate text-foreground">{call.category}</span>
          <span className="truncate text-xs">{call.interactionType}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Durum",
      size: 150,
      minSize: 120,
      accessor: (call) => optionLabel("status", call.status),
      cell: (call) => (
        <OptionBadge
          label={optionLabel("status", call.status)}
          color={optionColor("status", call.status)}
          fallbackVariant={call.status === "resolved" ? "default" : "outline"}
        />
      ),
    },
    {
      id: "priority",
      header: "Öncelik",
      size: 140,
      minSize: 110,
      accessor: (call) => optionLabel("priority", call.priority),
      cell: (call) => (
        <OptionBadge
          label={optionLabel("priority", call.priority)}
          color={optionColor("priority", call.priority)}
          fallbackVariant={call.priority === "urgent" ? "default" : "secondary"}
        />
      ),
    },
    {
      id: "followUp",
      header: "Takip",
      size: 170,
      minSize: 130,
      accessor: (call) =>
        call.needsFollowUp ? `Takip ${call.followUpAt ?? ""}` : "Takip yok",
      cell: (call) =>
        call.needsFollowUp ? (
          <div className="grid gap-1">
            <Badge variant="outline">Takip var</Badge>
            {call.followUpAt && (
              <span className="truncate text-xs">
                {formatDate(call.followUpAt)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "openedBy",
      header: "Açan",
      size: 180,
      minSize: 140,
      accessor: (call) => call.openedByName,
      cell: (call) => <span className="truncate">{call.openedByName}</span>,
    },
    {
      id: "createdAt",
      header: "Oluşturulma",
      size: 180,
      minSize: 140,
      accessor: (call) => formatDate(call.createdAt),
      cell: (call) => (
        <span className="truncate">{formatDate(call.createdAt)}</span>
      ),
    },
  ];

  function validateCallForm(form: CallForm, mode: "create" | "edit") {
    const errors: CallFormErrors = {};
    const editable = (key: CallFormKey) =>
      mode === "create" || fieldCanEdit(key);
    const requiredKeys: CallFormKey[] = [
      "phoneNumber",
      "studentTc",
      "studentName",
      "interactionType",
      "category",
      "issue",
      "initialNote",
      "priority",
      "followUpAt",
    ];

    for (const key of requiredKeys) {
      if (
        fieldIsRequired(key) &&
        editable(key) &&
        !String(form[key] ?? "").trim()
      ) {
        errors[key] = `${fieldDisplayLabel(key)} zorunludur.`;
      }
    }

    if (
      editable("phoneNumber") &&
      form.phoneNumber.trim() &&
      !/^[0-9+\s()-]{7,20}$/.test(form.phoneNumber.trim())
    ) {
      errors.phoneNumber =
        "Telefon numarası 7-20 karakter olmalı ve sadece rakam, boşluk, +, -, ( ) içermelidir.";
    }

    if (
      editable("studentTc") &&
      form.studentTc.trim() &&
      !isValidTurkishIdentityNumber(form.studentTc.trim())
    ) {
      errors.studentTc = "Geçerli bir TC Kimlik No girin.";
    }

    if (
      form.needsFollowUp &&
      fieldIsVisible("followUpAt") &&
      editable("followUpAt") &&
      !form.followUpAt.trim()
    ) {
      errors.followUpAt = "Takip gerekiyorsa takip tarihi zorunludur.";
    }

    return errors;
  }

  function buildEditableCallPayload(form: CallForm) {
    const payload: Partial<CallForm> = {};

    for (const key of Object.keys(form) as CallFormKey[]) {
      if (fieldCanEdit(key)) {
        payload[key] = form[key] as never;
      }
    }

    return payload;
  }

  function setCreateFieldValue<K extends CallFormKey>(
    key: K,
    value: CallForm[K],
  ) {
    setCallForm((current) => ({ ...current, [key]: value }));
    setCreateFieldErrors((current) => ({ ...current, [key]: undefined }));
    setCreateError("");
  }

  function setEditFieldValue<K extends CallFormKey>(
    key: K,
    value: CallForm[K],
  ) {
    setEditForm((current) => ({ ...current, [key]: value }));
    setEditFieldErrors((current) => ({ ...current, [key]: undefined }));
    setEditError("");
  }

  function applyServerErrorToForm(
    error: unknown,
    setFormError: (message: string) => void,
    setFieldErrors: (errors: CallFormErrors) => void,
    fallback: string,
  ) {
    const message = error instanceof Error ? error.message : fallback;
    const field = fieldFromServerMessage(message);

    setFormError(message);
    setFieldErrors(field ? { [field]: message } : {});
  }

  async function loadCalls() {
    setIsLoading(true);
    setMessage("");

    try {
      const [callData, optionData] = await Promise.all([
        request<{ calls: CallRecord[] }>("/calls"),
        canCreate || canResolve || canEdit
          ? request<{
              options: CallFormOption[];
              fields: CallFormFieldSetting[];
            }>("/call-options")
          : Promise.resolve({ options: [], fields: [] }),
      ]);

      setCalls(callData.calls);
      setCallOptions(optionData.options);
      setFieldSettings("fields" in optionData ? optionData.fields : []);
      setSelectedCallId((current) => current || callData.calls[0]?.id || "");
      const activeInteractionTypes = optionData.options.filter(
        (option) => option.type === "interaction_type" && option.isActive,
      );
      const activeIssueCategories = optionData.options.filter(
        (option) => option.type === "issue_category" && option.isActive,
      );
      const activePriorityOptions = optionData.options.filter(
        (option) => option.type === "priority" && option.isActive,
      );
      setCallForm((current) => ({
        ...current,
        interactionType: activeInteractionTypes.some(
          (option) =>
            option.value === current.interactionType ||
            option.label === current.interactionType,
        )
          ? current.interactionType
          : activeInteractionTypes[0]?.value ||
            activeInteractionTypes[0]?.label ||
            "",
        category: activeIssueCategories.some(
          (option) =>
            option.value === current.category ||
            option.label === current.category,
        )
          ? current.category
          : activeIssueCategories[0]?.value ||
            activeIssueCategories[0]?.label ||
            "",
        priority: (activePriorityOptions.some(
          (option) => option.value === current.priority,
        )
          ? current.priority
          : activePriorityOptions[0]?.value || "normal") as CallPriority,
      }));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Çağrı kayıtları yüklenemedi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCallDetail(callId: string) {
    if (!callId) {
      setSelectedDetail(null);
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const detail = await request<CallDetail>(`/calls/${callId}`);
      setSelectedDetail(detail);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Çağrı detayı yüklenemedi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const loadCallMatches = useCallback(
    async (signal?: AbortSignal) => {
      const phoneDigits = callForm.phoneNumber.replace(/\D/g, "");
      const studentTc = callForm.studentTc.trim();

      if (
        !isCreateOpen ||
        (phoneDigits.length < 7 && studentTc.length !== 11)
      ) {
        setCallMatches({ phoneMatches: [], tcMatches: [] });
        setIsLoadingMatches(false);
        return;
      }

      setIsLoadingMatches(true);

      try {
        const params = new URLSearchParams();

        if (phoneDigits.length >= 7) {
          params.set("phoneNumber", callForm.phoneNumber);
        }

        if (studentTc.length === 11) {
          params.set("studentTc", studentTc);
        }

        const data = await request<CallMatches>(
          `/calls/matches?${params.toString()}`,
          { signal },
        );
        setCallMatches(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCallMatches({ phoneMatches: [], tcMatches: [] });
      } finally {
        setIsLoadingMatches(false);
      }
    },
    [callForm.phoneNumber, callForm.studentTc, isCreateOpen, request],
  );

  useEffect(() => {
    void loadCalls();
  }, []);

  useEffect(() => {
    void loadCallDetail(selectedCallId);
  }, [selectedCallId]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadCallMatches(controller.signal);
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadCallMatches]);

  useEffect(() => {
    if (!canViewAll && activeScope === "all") {
      setActiveScope("own");
    }
  }, [activeScope, canViewAll]);

  useEffect(() => {
    if (filteredCalls.length === 0) {
      setSelectedCallId("");
      return;
    }

    if (!filteredCalls.some((call) => call.id === selectedCallId)) {
      setSelectedCallId(filteredCalls[0].id);
    }
  }, [filteredCalls, selectedCallId]);

  useEffect(() => {
    if (!isDetailOpen || !selectedCall) {
      return;
    }

    setEditForm(callToForm(selectedCall));
    setEditError("");
    setEditFieldErrors({});
  }, [isDetailOpen, selectedCall]);

  function callToForm(call: CallRecord): CallForm {
    return {
      phoneNumber: call.phoneNumber,
      studentTc: call.studentTc ?? "",
      studentName: call.studentName ?? "",
      interactionType: call.interactionType,
      category: call.category,
      issue: call.issue,
      initialNote: call.initialNote ?? "",
      priority: call.priority,
      needsFollowUp: call.needsFollowUp,
      followUpAt: call.followUpAt ? toDateTimeInputValue(call.followUpAt) : "",
    };
  }

  function openCallDetailDialog(call: CallRecord) {
    setSelectedCallId(call.id);
    setEditError("");
    setEditFieldErrors({});
    setEditForm(callToForm(call));
    setIsDetailOpen(true);
  }

  function setCreateDialogOpen(open: boolean) {
    setIsCreateOpen(open);

    if (open) {
      setCreateError("");
      setCreateFieldErrors({});
    } else {
      setCallMatches({ phoneMatches: [], tcMatches: [] });
      setIsLoadingMatches(false);
    }
  }

  function openMatchedCall(callId: string) {
    setCreateDialogOpen(false);

    if (canViewAll) {
      setActiveScope("all");
    }

    setSelectedCallId(callId);
    setIsDetailOpen(true);
    void loadCallDetail(callId);
  }

  async function updateCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!selectedCall) {
      return;
    }

    const errors = validateCallForm(editForm, "edit");
    if (Object.keys(errors).length > 0) {
      setEditFieldErrors(errors);
      setEditError("Lütfen işaretlenen alanları kontrol edin.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setEditError("");
    setEditFieldErrors({});

    try {
      await request(`/calls/${selectedCall.id}`, {
        method: "PATCH",
        body: JSON.stringify(buildEditableCallPayload(editForm)),
      });
      setMessage("Çağrı bilgileri güncellendi.");
      toast.success("Başarıyla kaydedildi.");
      await loadCalls();
      await loadCallDetail(selectedCall.id);
      setIsDetailOpen(false);
    } catch (error) {
      applyServerErrorToForm(
        error,
        setEditError,
        setEditFieldErrors,
        "Çağrı bilgileri güncellenemedi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function createCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const errors = validateCallForm(callForm, "create");
    if (Object.keys(errors).length > 0) {
      setCreateFieldErrors(errors);
      setCreateError("Lütfen işaretlenen alanları kontrol edin.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setCreateError("");
    setCreateFieldErrors({});

    try {
      const data = await request<{ call: CallRecord; warnings: string[] }>(
        "/calls",
        {
          method: "POST",
          body: JSON.stringify(callForm),
        },
      );
      setCallForm(emptyCallForm);
      setIsCreateOpen(false);
      setSelectedCallId(data.call.id);
      setMessage(
        data.warnings.length > 0
          ? `Kayıt oluşturuldu. Uyarı: ${data.warnings.join(" ")}`
          : "Çağrı kaydı oluşturuldu.",
      );
      toast.success("Çağrı kaydı oluşturuldu.");
      await loadCalls();
    } catch (error) {
      applyServerErrorToForm(
        error,
        setCreateError,
        setCreateFieldErrors,
        "Çağrı kaydı oluşturulamadı.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCall) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      await request(`/calls/${selectedCall.id}/notes`, {
        method: "POST",
        body: JSON.stringify(noteForm),
      });
      setNoteForm({ noteType: "personnel", content: "" });
      setMessage("Not eklendi.");
      toast.success("Not eklendi.");
      await loadCallDetail(selectedCall.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Not eklenemedi.");
    } finally {
      setIsLoading(false);
    }
  }

  async function updateStatus(status: CallStatus) {
    if (!selectedCall) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      await request(`/calls/${selectedCall.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage("Durum güncellendi.");
      toast.success("Durum güncellendi.");
      await loadCalls();
      await loadCallDetail(selectedCall.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Durum güncellenemedi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function resolveCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCall) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      await request(`/calls/${selectedCall.id}/resolve`, {
        method: "POST",
        body: JSON.stringify(resolutionForm),
      });
      setResolutionForm({
        resolutionCategory: resolutionCategories[0]?.value || "Bilgi verildi",
        resolutionDescription: "",
      });
      setMessage("Çağrı çözüldü.");
      toast.success("Çağrı çözüldü.");
      await loadCalls();
      await loadCallDetail(selectedCall.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Çağrı çözülemedi.");
    } finally {
      setIsLoading(false);
    }
  }

  async function reopenCall() {
    if (!selectedCall) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      await request(`/calls/${selectedCall.id}/reopen`, { method: "POST" });
      setMessage("Çağrı yeniden açıldı.");
      toast.success("Çağrı yeniden açıldı.");
      await loadCalls();
      await loadCallDetail(selectedCall.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Çağrı yeniden açılamadı.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Stat
            icon={<ClipboardList />}
            label={`${visibleCalls.length} kayıt`}
          />
          <Stat icon={<Phone />} label={`${listSummary.open} açık`} />
          <Stat
            icon={<CheckCircle2 />}
            label={`${listSummary.resolved} çözüldü`}
          />
          <Stat icon={<FileText />} label={`${listSummary.followUp} takip`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border bg-background p-1">
            <Button
              type="button"
              size="sm"
              variant={activeScope === "own" ? "secondary" : "ghost"}
              onClick={() => setActiveScope("own")}
            >
              Kendi Çağrılarım
            </Button>
            {canViewAll && (
              <Button
                type="button"
                size="sm"
                variant={activeScope === "all" ? "secondary" : "ghost"}
                onClick={() => setActiveScope("all")}
              >
                Tüm Çağrılar
              </Button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadCalls()}
            disabled={isLoading}
          >
            <RefreshCw />
            Yenile
          </Button>
          {canCreate && (
            <Button type="button" onClick={() => setCreateDialogOpen(true)}>
              <Plus />
              Yeni Çağrı
            </Button>
          )}
        </div>
      </div>

      {message && (
        <p className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Çağrı Kayıtları</CardTitle>
          <CardDescription>
            Yetkiniz kapsamındaki kayıtları arayın, filtreleyin ve satıra
            tıklayarak detayları açın.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <CallFilterSelect
              label="Durum"
              value={listFilters.status}
              onChange={(status) =>
                setListFilters((current) => ({ ...current, status }))
              }
              options={
                statusOptions.length > 0
                  ? statusOptions
                  : Object.entries(statusLabels).map(([value, label]) => ({
                      id: value,
                      value,
                      label,
                      color: null,
                    }))
              }
            />
            <CallFilterSelect
              label="Öncelik"
              value={listFilters.priority}
              onChange={(priority) =>
                setListFilters((current) => ({ ...current, priority }))
              }
              options={
                priorityOptions.length > 0
                  ? priorityOptions
                  : Object.entries(priorityLabels).map(([value, label]) => ({
                      id: value,
                      value,
                      label,
                      color: null,
                    }))
              }
            />
            <CallFilterSelect
              label="Kategori"
              value={listFilters.category}
              onChange={(category) =>
                setListFilters((current) => ({ ...current, category }))
              }
              options={issueCategories}
            />
            <div className="grid gap-2">
              <Label>Takip</Label>
              <Select
                value={listFilters.followUp}
                onValueChange={(followUp) =>
                  setListFilters((current) => ({
                    ...current,
                    followUp: followUp as CallListFilters["followUp"],
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="needed">Takip var</SelectItem>
                  <SelectItem value="none">Takip yok</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {filteredCalls.length} kayıt gösteriliyor
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setListFilters({
                  status: "all",
                  priority: "all",
                  category: "all",
                  followUp: "all",
                })
              }
            >
              Filtreleri temizle
            </Button>
          </div>
          <DataTable
            columns={callTableColumns}
            data={filteredCalls}
            getRowId={(call) => call.id}
            emptyText="Filtrelere uygun çağrı kaydı bulunamadı."
            searchPlaceholder="Kayıt no, öğrenci, telefon veya kategoride ara..."
            onRowClick={openCallDetailDialog}
            getRowClassName={(call) =>
              call.id === selectedCallId
                ? "bg-primary/5 hover:bg-primary/10"
                : undefined
            }
          />
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent
          className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-5xl"
        >
          <DialogHeader>
            <DialogTitle>
              {selectedCall?.recordNumber ?? "Çağrı Detayı"}
            </DialogTitle>
            <DialogDescription>
              Çağrı bilgilerini görüntüleyin; yetkili ve düzenlenebilir alanları
              doğrudan güncelleyin.
            </DialogDescription>
          </DialogHeader>
          {selectedCall ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {selectedCall.category} · {selectedCall.interactionType} ·{" "}
                  {formatDate(selectedCall.createdAt)}
                </span>
                <OptionBadge
                  label={optionLabel("status", selectedCall.status)}
                  color={optionColor("status", selectedCall.status)}
                  fallbackVariant={
                    selectedCall.status === "resolved" ? "default" : "outline"
                  }
                />
              </div>

              <Tabs defaultValue="summary">
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="summary">Özet ve Bilgiler</TabsTrigger>
                  <TabsTrigger value="notes">Notlar</TabsTrigger>
                  <TabsTrigger value="resolution">Çözüm</TabsTrigger>
                  <TabsTrigger value="history">Geçmiş</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <form className="grid gap-4" onSubmit={updateCall} noValidate>
                    {editError && (
                      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {editError}
                      </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <Info label="Açan" value={selectedCall.openedByName} />
                      <Info
                        label="Oluşturulma"
                        value={formatDate(selectedCall.createdAt)}
                      />
                      <Info
                        label="Durum"
                        value={optionLabel("status", selectedCall.status)}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fieldIsVisible("phoneNumber") && (
                        <Field
                          label={fieldDisplayLabel("phoneNumber")}
                          error={editFieldErrors.phoneNumber}
                        >
                          <Input
                            value={editForm.phoneNumber}
                            onChange={(event) =>
                              setEditFieldValue(
                                "phoneNumber",
                                event.target.value,
                              )
                            }
                            disabled={
                              !canEdit ||
                              selectedCall.isLocked ||
                              !fieldCanEdit("phoneNumber")
                            }
                            aria-invalid={Boolean(editFieldErrors.phoneNumber)}
                            required={fieldIsRequired("phoneNumber")}
                          />
                        </Field>
                      )}
                      {fieldIsVisible("studentTc") && (
                        <Field
                          label={fieldDisplayLabel("studentTc")}
                          error={editFieldErrors.studentTc}
                        >
                          <Input
                            value={editForm.studentTc}
                            onChange={(event) =>
                              setEditFieldValue("studentTc", event.target.value)
                            }
                            disabled={
                              !canEdit ||
                              selectedCall.isLocked ||
                              !fieldCanEdit("studentTc")
                            }
                            aria-invalid={Boolean(editFieldErrors.studentTc)}
                            maxLength={11}
                            required={fieldIsRequired("studentTc")}
                          />
                        </Field>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fieldIsVisible("studentName") && (
                        <Field
                          label={fieldDisplayLabel("studentName")}
                          error={editFieldErrors.studentName}
                        >
                          <Input
                            value={editForm.studentName}
                            onChange={(event) =>
                              setEditFieldValue(
                                "studentName",
                                event.target.value,
                              )
                            }
                            disabled={
                              !canEdit ||
                              selectedCall.isLocked ||
                              !fieldCanEdit("studentName")
                            }
                            aria-invalid={Boolean(editFieldErrors.studentName)}
                            required={fieldIsRequired("studentName")}
                          />
                        </Field>
                      )}
                      {fieldIsVisible("interactionType") && (
                        <div className="grid gap-2">
                          <Label>{fieldDisplayLabel("interactionType")}</Label>
                          <Select
                            value={editForm.interactionType}
                            onValueChange={(interactionType) =>
                              setEditFieldValue(
                                "interactionType",
                                interactionType,
                              )
                            }
                            disabled={
                              !canEdit ||
                              selectedCall.isLocked ||
                              !fieldCanEdit("interactionType")
                            }
                          >
                            <SelectTrigger
                              className="w-full"
                              aria-invalid={Boolean(
                                editFieldErrors.interactionType,
                              )}
                            >
                              <SelectValue placeholder="Görüşme tipi seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {interactionTypes.map((option) => (
                                <SelectItem
                                  key={option.id}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {editFieldErrors.interactionType && (
                            <p className="text-xs text-destructive">
                              {editFieldErrors.interactionType}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fieldIsVisible("category") && (
                        <div className="grid gap-2">
                          <Label>{fieldDisplayLabel("category")}</Label>
                          <Select
                            value={editForm.category}
                            onValueChange={(category) =>
                              setEditFieldValue("category", category)
                            }
                            disabled={
                              !canEdit ||
                              selectedCall.isLocked ||
                              !fieldCanEdit("category")
                            }
                          >
                            <SelectTrigger
                              className="w-full"
                              aria-invalid={Boolean(editFieldErrors.category)}
                            >
                              <SelectValue placeholder="Sorun kategorisi seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {issueCategories.map((option) => (
                                <SelectItem
                                  key={option.id}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {editFieldErrors.category && (
                            <p className="text-xs text-destructive">
                              {editFieldErrors.category}
                            </p>
                          )}
                        </div>
                      )}
                      {fieldIsVisible("priority") && (
                        <div className="grid gap-2">
                          <Label>{fieldDisplayLabel("priority")}</Label>
                          <Select
                            value={editForm.priority}
                            onValueChange={(priority) =>
                              setEditFieldValue(
                                "priority",
                                priority as CallPriority,
                              )
                            }
                            disabled={
                              !canEdit ||
                              selectedCall.isLocked ||
                              !fieldCanEdit("priority")
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(priorityOptions.length > 0
                                ? priorityOptions
                                : Object.entries(priorityLabels).map(
                                    ([value, label]) => ({
                                      id: value,
                                      value,
                                      label,
                                      color: null,
                                    }),
                                  )
                              ).map((option) => (
                                <SelectItem
                                  key={option.id}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    {fieldIsVisible("issue") && (
                      <Field
                        label={fieldDisplayLabel("issue")}
                        error={editFieldErrors.issue}
                      >
                        <Textarea
                          value={editForm.issue}
                          onChange={(event) =>
                            setEditFieldValue("issue", event.target.value)
                          }
                          disabled={
                            !canEdit ||
                            selectedCall.isLocked ||
                            !fieldCanEdit("issue")
                          }
                          aria-invalid={Boolean(editFieldErrors.issue)}
                          required={fieldIsRequired("issue")}
                        />
                      </Field>
                    )}
                    {fieldIsVisible("initialNote") && (
                      <Field
                        label={fieldDisplayLabel("initialNote")}
                        error={editFieldErrors.initialNote}
                      >
                        <Textarea
                          value={editForm.initialNote}
                          onChange={(event) =>
                            setEditFieldValue("initialNote", event.target.value)
                          }
                          disabled={
                            !canEdit ||
                            selectedCall.isLocked ||
                            !fieldCanEdit("initialNote")
                          }
                          aria-invalid={Boolean(editFieldErrors.initialNote)}
                          required={fieldIsRequired("initialNote")}
                        />
                      </Field>
                    )}
                    {fieldIsVisible("needsFollowUp") && (
                      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[max-content_minmax(260px,1fr)] sm:items-end">
                        <label className="flex min-h-8 items-center gap-2 text-sm font-medium">
                          <Checkbox
                            checked={editForm.needsFollowUp}
                            disabled={
                              !canEdit ||
                              selectedCall.isLocked ||
                              !fieldCanEdit("needsFollowUp")
                            }
                            onCheckedChange={(checked) =>
                              setEditFieldValue(
                                "needsFollowUp",
                                checked === true,
                              )
                            }
                          />
                          {fieldDisplayLabel("needsFollowUp")}
                        </label>
                        {editForm.needsFollowUp &&
                          fieldIsVisible("followUpAt") && (
                            <Field
                              label={fieldDisplayLabel("followUpAt")}
                              error={editFieldErrors.followUpAt}
                            >
                              <Input
                                type="datetime-local"
                                value={editForm.followUpAt}
                                onChange={(event) =>
                                  setEditFieldValue(
                                    "followUpAt",
                                    event.target.value,
                                  )
                                }
                                disabled={
                                  !canEdit ||
                                  selectedCall.isLocked ||
                                  !fieldCanEdit("followUpAt")
                                }
                                aria-invalid={Boolean(
                                  editFieldErrors.followUpAt,
                                )}
                                required={fieldIsRequired("followUpAt")}
                              />
                            </Field>
                          )}
                      </div>
                    )}
                    {canEdit && !selectedCall.isLocked && (
                      <DialogFooter>
                        <Button type="submit" disabled={isLoading}>
                          Kaydet
                        </Button>
                      </DialogFooter>
                    )}
                  </form>
                </TabsContent>

                <TabsContent value="notes" className="grid gap-4">
                  {canAddAnyNote && !selectedCall.isLocked && (
                    <form
                      className="grid gap-3 rounded-lg border p-3"
                      onSubmit={addNote}
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(180px,0.35fr)_minmax(260px,1fr)]">
                        <div className="grid gap-2">
                          <Label>Not türü</Label>
                          <Select
                            value={noteForm.noteType}
                            onValueChange={(noteType) =>
                              setNoteForm((current) => ({
                                ...current,
                                noteType,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(noteTypeLabels).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Not</Label>
                          <Textarea
                            value={noteForm.content}
                            onChange={(event) =>
                              setNoteForm((current) => ({
                                ...current,
                                content: event.target.value,
                              }))
                            }
                            placeholder="Not içeriği"
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        disabled={isLoading || !noteForm.content.trim()}
                      >
                        <MessageSquarePlus />
                        Not ekle
                      </Button>
                    </form>
                  )}
                  <div className="grid gap-2">
                    {selectedDetail?.notes.map((note) => (
                      <TimelineItem
                        key={note.id}
                        title={note.authorName}
                        meta={`${noteTypeLabels[note.noteType as keyof typeof noteTypeLabels] ?? note.noteType} · ${formatDate(note.createdAt)}`}
                      >
                        {note.content}
                      </TimelineItem>
                    ))}
                    {selectedDetail?.notes.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Ek not yok.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="resolution" className="grid gap-4">
                  {canEdit && !selectedCall.isLocked && (
                    <div className="grid gap-2 sm:max-w-xs">
                      <Label>Durum</Label>
                      <Select
                        value={selectedCall.status}
                        onValueChange={(status) =>
                          void updateStatus(status as CallStatus)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(statusOptions.length > 0
                            ? statusOptions
                            : Object.entries(statusLabels).map(
                                ([value, label]) => ({
                                  id: value,
                                  value,
                                  label,
                                  color: null,
                                }),
                              )
                          )
                            .filter((option) => option.value !== "resolved")
                            .map((option) => (
                              <SelectItem key={option.id} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {canResolve && !selectedCall.isLocked && (
                    <form
                      className="grid gap-3 rounded-lg border p-3"
                      onSubmit={resolveCall}
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(180px,0.35fr)_minmax(260px,1fr)]">
                        <div className="grid gap-2">
                          <Label>Çözüm kategorisi</Label>
                          <Select
                            value={resolutionForm.resolutionCategory}
                            onValueChange={(resolutionCategory) =>
                              setResolutionForm((current) => ({
                                ...current,
                                resolutionCategory,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Çözüm kategorisi seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {resolutionCategories.map((option) => (
                                <SelectItem
                                  key={option.id}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Çözüm açıklaması</Label>
                          <Textarea
                            value={resolutionForm.resolutionDescription}
                            onChange={(event) =>
                              setResolutionForm((current) => ({
                                ...current,
                                resolutionDescription: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        disabled={
                          isLoading ||
                          !resolutionForm.resolutionDescription.trim()
                        }
                      >
                        <CheckCircle2 />
                        Çözüldü yap
                      </Button>
                    </form>
                  )}

                  {canReopen && selectedCall.isLocked && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void reopenCall()}
                    >
                      <RotateCcw />
                      Yeniden aç
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="history" className="grid gap-2">
                  {selectedDetail?.events.map((event) => (
                    <TimelineItem
                      key={event.id}
                      title={event.actorName ?? "Sistem"}
                      meta={formatDate(event.createdAt)}
                    >
                      {event.description}
                    </TimelineItem>
                  ))}
                  {selectedDetail?.events.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      İşlem geçmişi yok.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Detay görmek için bir çağrı kaydı seçin.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent
          className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>Yeni Çağrı Kaydı</DialogTitle>
            <DialogDescription>
              Kayıt oluşturulduktan sonra ana bilgiler personel tarafından
              değiştirilemez.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={createCall} noValidate>
            {createError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {createError}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {fieldIsVisible("phoneNumber") && (
                <Field
                  label={fieldDisplayLabel("phoneNumber")}
                  error={createFieldErrors.phoneNumber}
                >
                  <Input
                    value={callForm.phoneNumber}
                    onChange={(event) =>
                      setCreateFieldValue("phoneNumber", event.target.value)
                    }
                    aria-invalid={Boolean(createFieldErrors.phoneNumber)}
                    required={fieldIsRequired("phoneNumber")}
                  />
                </Field>
              )}
              {fieldIsVisible("studentTc") && (
                <Field
                  label={fieldDisplayLabel("studentTc")}
                  error={createFieldErrors.studentTc}
                >
                  <Input
                    value={callForm.studentTc}
                    onChange={(event) =>
                      setCreateFieldValue("studentTc", event.target.value)
                    }
                    aria-invalid={Boolean(createFieldErrors.studentTc)}
                    maxLength={11}
                    required={fieldIsRequired("studentTc")}
                  />
                </Field>
              )}
            </div>
            {(fieldIsVisible("phoneNumber") || fieldIsVisible("studentTc")) && (
              <CallMatchPreview
                matches={callMatches}
                isLoading={isLoadingMatches}
                isCombinedFilter={false}
                statusOptions={statusOptions}
                priorityOptions={priorityOptions}
                onOpenCall={openMatchedCall}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {fieldIsVisible("studentName") && (
                <Field
                  label={fieldDisplayLabel("studentName")}
                  error={createFieldErrors.studentName}
                >
                  <Input
                    value={callForm.studentName}
                    onChange={(event) =>
                      setCreateFieldValue("studentName", event.target.value)
                    }
                    aria-invalid={Boolean(createFieldErrors.studentName)}
                    required={fieldIsRequired("studentName")}
                  />
                </Field>
              )}
              {fieldIsVisible("interactionType") && (
                <div className="grid gap-2">
                  <Label>{fieldDisplayLabel("interactionType")}</Label>
                  <Select
                    value={callForm.interactionType}
                    onValueChange={(interactionType) =>
                      setCreateFieldValue("interactionType", interactionType)
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={Boolean(createFieldErrors.interactionType)}
                    >
                      <SelectValue placeholder="Görüşme tipi seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {interactionTypes.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createFieldErrors.interactionType && (
                    <p className="text-xs text-destructive">
                      {createFieldErrors.interactionType}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {fieldIsVisible("category") && (
                <div className="grid gap-2">
                  <Label>{fieldDisplayLabel("category")}</Label>
                  <Select
                    value={callForm.category}
                    onValueChange={(category) =>
                      setCreateFieldValue("category", category)
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={Boolean(createFieldErrors.category)}
                    >
                      <SelectValue placeholder="Sorun kategorisi seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {issueCategories.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createFieldErrors.category && (
                    <p className="text-xs text-destructive">
                      {createFieldErrors.category}
                    </p>
                  )}
                </div>
              )}
              {fieldIsVisible("priority") && (
                <div className="grid gap-2">
                  <Label>{fieldDisplayLabel("priority")}</Label>
                  <Select
                    value={callForm.priority}
                    onValueChange={(priority) =>
                      setCreateFieldValue("priority", priority as CallPriority)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(priorityOptions.length > 0
                        ? priorityOptions
                        : Object.entries(priorityLabels).map(
                            ([value, label]) => ({
                              id: value,
                              value,
                              label,
                              color: null,
                            }),
                          )
                      ).map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {fieldIsVisible("issue") && (
              <Field
                label={fieldDisplayLabel("issue")}
                error={createFieldErrors.issue}
              >
                <Textarea
                  value={callForm.issue}
                  onChange={(event) =>
                    setCreateFieldValue("issue", event.target.value)
                  }
                  aria-invalid={Boolean(createFieldErrors.issue)}
                  required={fieldIsRequired("issue")}
                />
              </Field>
            )}
            {fieldIsVisible("initialNote") && (
              <Field
                label={fieldDisplayLabel("initialNote")}
                error={createFieldErrors.initialNote}
              >
                <Textarea
                  value={callForm.initialNote}
                  onChange={(event) =>
                    setCreateFieldValue("initialNote", event.target.value)
                  }
                  aria-invalid={Boolean(createFieldErrors.initialNote)}
                  required={fieldIsRequired("initialNote")}
                />
              </Field>
            )}
            {fieldIsVisible("needsFollowUp") && (
              <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[max-content_minmax(260px,1fr)] sm:items-end">
                <label className="flex min-h-8 items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={callForm.needsFollowUp}
                    onCheckedChange={(checked) =>
                      setCreateFieldValue("needsFollowUp", checked === true)
                    }
                  />
                  {fieldDisplayLabel("needsFollowUp")}
                </label>
                {callForm.needsFollowUp && fieldIsVisible("followUpAt") && (
                  <Field
                    label={fieldDisplayLabel("followUpAt")}
                    error={createFieldErrors.followUpAt}
                  >
                    <Input
                      type="datetime-local"
                      value={callForm.followUpAt}
                      onChange={(event) =>
                        setCreateFieldValue("followUpAt", event.target.value)
                      }
                      aria-invalid={Boolean(createFieldErrors.followUpAt)}
                      required={fieldIsRequired("followUpAt")}
                    />
                  </Field>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={isLoading}>
                <Plus />
                Kaydı oluştur
              </Button>
            </DialogFooter>
          </form>
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

function CallFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; value: string; label: string }>;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tümü</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block break-words text-sm font-medium">
        {value}
      </strong>
    </div>
  );
}

function TimelineItem({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <strong className="block text-sm font-medium">{title}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">{meta}</span>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}

function CallMatchPreview({
  matches,
  isLoading,
  isCombinedFilter,
  statusOptions,
  priorityOptions,
  onOpenCall,
}: {
  matches: CallMatches;
  isLoading: boolean;
  isCombinedFilter: boolean;
  statusOptions: CallFormOption[];
  priorityOptions: CallFormOption[];
  onOpenCall: (callId: string) => void;
}) {
  const hasPhoneMatches = matches.phoneMatches.length > 0;
  const hasTcMatches = matches.tcMatches.length > 0;

  if (!hasPhoneMatches && !hasTcMatches) {
    return null;
  }

  return (
    <section className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Geçmiş çağrı eşleşmeleri</h3>
          <p className="text-xs text-muted-foreground">
            Telefon numarası veya TC Kimlik No ile daha önce açılmış kayıtlar.
          </p>
        </div>
        {isLoading && <Badge variant="outline">Aranıyor</Badge>}
      </div>

      {hasPhoneMatches && (
        <MatchGroup
          title={
            isCombinedFilter
              ? "Telefon + TC Kimlik No eşleşmeleri"
              : "Telefon numarası eşleşmeleri"
          }
          calls={matches.phoneMatches}
          statusOptions={statusOptions}
          priorityOptions={priorityOptions}
          onOpenCall={onOpenCall}
        />
      )}
      {hasTcMatches && (
        <MatchGroup
          title="TC Kimlik No eşleşmeleri"
          calls={matches.tcMatches}
          onOpenCall={onOpenCall}
        />
      )}
    </section>
  );
}
function MatchGroup({
  title,
  calls,
  statusOptions = [],
  priorityOptions = [],
  onOpenCall,
}: {
  title: string;
  calls: CallRecord[];
  statusOptions?: CallFormOption[];
  priorityOptions?: CallFormOption[];
  onOpenCall: (callId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <div className="grid gap-2">
        {calls.map((call) => (
          <div
            key={call.id}
            className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm font-medium">
                  {call.recordNumber}
                </strong>
                <OptionBadge
                  label={findOptionLabel(
                    statusOptions,
                    call.status,
                    statusLabels[call.status] ?? call.status,
                  )}
                  color={findOptionColor(statusOptions, call.status)}
                  fallbackVariant="outline"
                />
                <OptionBadge
                  label={findOptionLabel(
                    priorityOptions,
                    call.priority,
                    priorityLabels[call.priority] ?? call.priority,
                  )}
                  color={findOptionColor(priorityOptions, call.priority)}
                  fallbackVariant={
                    call.priority === "urgent" ? "default" : "secondary"
                  }
                />
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {call.studentName || call.phoneNumber} · {call.category}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {call.issue}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDate(call.createdAt)} · Açan: {call.openedByName}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenCall(call.id)}
            >
              Detayı aç
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function findOptionLabel(
  options: CallFormOption[],
  value: string,
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function findOptionColor(options: CallFormOption[], value: string) {
  return options.find((option) => option.value === value)?.color ?? null;
}

function fieldLabel(key: CallFormKey) {
  const labels: Record<CallFormKey, string> = {
    phoneNumber: "Telefon numarası",
    studentTc: "Öğrenci TC",
    studentName: "Öğrenci adı soyadı",
    interactionType: "Görüşme tipi",
    category: "Sorun kategorisi",
    issue: "Yaşanılan sorun",
    initialNote: "İlk personel notu",
    priority: "Öncelik",
    needsFollowUp: "Takip gerekiyor",
    followUpAt: "Takip tarihi",
  };

  return labels[key];
}

function fieldFromServerMessage(message: string): CallFormKey | null {
  const normalized = message.toLocaleLowerCase("tr-TR");

  if (normalized.includes("telefon")) {
    return "phoneNumber";
  }

  if (normalized.includes("tc")) {
    return "studentTc";
  }

  if (normalized.includes("takip")) {
    return "followUpAt";
  }

  if (normalized.includes("görüşme")) {
    return "interactionType";
  }

  if (normalized.includes("kategori")) {
    return "category";
  }

  if (normalized.includes("sorun")) {
    return "issue";
  }

  return null;
}

function isValidTurkishIdentityNumber(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) {
    return false;
  }

  const digits = value.split("").map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const tenthDigit = (((oddSum * 7 - evenSum) % 10) + 10) % 10;
  const eleventhDigit =
    digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return digits[9] === tenthDigit && digits[10] === eleventhDigit;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateTimeInputValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return offsetDate.toISOString().slice(0, 16);
}
