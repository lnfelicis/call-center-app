import { useEffect, useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquarePlus,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  AuthUser,
  CallDetail,
  CallForm,
  CallFormFieldSetting,
  CallFormOption,
  CallPriority,
  CallRecord,
  CallStatus,
  RequestFn,
} from "@/types"

type CallsModuleProps = {
  currentUser: AuthUser
  request: RequestFn
}

type CallFormKey = keyof CallForm
type CallFormErrors = Partial<Record<CallFormKey, string>>

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
}

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
}

const priorityLabels: Record<CallPriority, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
}

const noteTypeLabels = {
  personnel: "Personel Notu",
  follow_up: "Takip Notu",
  assigned_personnel: "Atanan Personel Notu",
  internal: "İç Not",
  manager: "Yönetici Notu",
}

export function CallsModule({ currentUser, request }: CallsModuleProps) {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [callOptions, setCallOptions] = useState<CallFormOption[]>([])
  const [fieldSettings, setFieldSettings] = useState<CallFormFieldSetting[]>([])
  const [selectedCallId, setSelectedCallId] = useState("")
  const [selectedDetail, setSelectedDetail] = useState<CallDetail | null>(null)
  const [callForm, setCallForm] = useState<CallForm>(emptyCallForm)
  const [editForm, setEditForm] = useState<CallForm>(emptyCallForm)
  const [noteForm, setNoteForm] = useState({ noteType: "personnel", content: "" })
  const [resolutionForm, setResolutionForm] = useState({
    resolutionCategory: "Bilgi verildi",
    resolutionDescription: "",
  })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [createError, setCreateError] = useState("")
  const [editError, setEditError] = useState("")
  const [createFieldErrors, setCreateFieldErrors] = useState<CallFormErrors>({})
  const [editFieldErrors, setEditFieldErrors] = useState<CallFormErrors>({})
  const [activeScope, setActiveScope] = useState<"own" | "all">("own")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const selectedCall = selectedDetail?.call ?? calls.find((call) => call.id === selectedCallId)
  const canCreate = currentUser.permissions.includes("calls.create")
  const canEdit = currentUser.permissions.includes("calls.edit")
  const canViewAll = currentUser.permissions.includes("calls.view.all")
  const canResolve = currentUser.permissions.includes("calls.resolve")
  const canReopen = currentUser.permissions.includes("calls.reopen")
  const canAddAnyNote =
    currentUser.permissions.includes("calls.note.own") ||
    currentUser.permissions.includes("calls.note.assigned") ||
    canEdit

  const visibleCalls = useMemo(() => {
    if (activeScope === "own") {
      return calls.filter((call) => call.openedByUserId === currentUser.id)
    }

    return calls
  }, [activeScope, calls, currentUser.id])

  const listSummary = useMemo(() => {
    return {
      open: visibleCalls.filter((call) => call.status !== "resolved" && call.status !== "closed").length,
      resolved: visibleCalls.filter((call) => call.status === "resolved").length,
      followUp: visibleCalls.filter((call) => call.needsFollowUp).length,
    }
  }, [visibleCalls])

  const interactionTypes = callOptions.filter((option) => option.type === "interaction_type" && option.isActive)
  const issueCategories = callOptions.filter((option) => option.type === "issue_category" && option.isActive)
  const priorityOptions = callOptions.filter((option) => option.type === "priority" && option.isActive)
  const resolutionCategories = callOptions.filter((option) => option.type === "resolution_category" && option.isActive)

  function fieldSetting(key: CallFormFieldSetting["key"]) {
    return fieldSettings.find((field) => field.key === key)
  }

  function fieldIsVisible(key: CallFormFieldSetting["key"]) {
    const field = fieldSetting(key)
    return !field || (field.isActive && field.isVisible)
  }

  function fieldIsRequired(key: CallFormFieldSetting["key"]) {
    const field = fieldSetting(key)
    return fieldIsVisible(key) && Boolean(field?.isRequired)
  }

  function fieldCanEdit(key: CallFormFieldSetting["key"]) {
    const field = fieldSetting(key)
    const canViewMaskedValue = !field?.isMasked || currentUser.permissions.includes("sensitive.view_unmasked")

    return fieldIsVisible(key) && Boolean(field?.isEditable ?? true) && canViewMaskedValue
  }

  function validateCallForm(form: CallForm, mode: "create" | "edit") {
    const errors: CallFormErrors = {}
    const editable = (key: CallFormKey) => mode === "create" || fieldCanEdit(key)
    const requiredKeys: CallFormKey[] = [
      "phoneNumber",
      "studentTc",
      "studentName",
      "interactionType",
      "category",
      "issue",
      "initialNote",
      "followUpAt",
    ]

    for (const key of requiredKeys) {
      if (fieldIsRequired(key) && editable(key) && !String(form[key] ?? "").trim()) {
        errors[key] = `${fieldLabel(key)} zorunludur.`
      }
    }

    for (const key of ["phoneNumber", "interactionType", "category", "issue"] as CallFormKey[]) {
      if (editable(key) && !String(form[key] ?? "").trim()) {
        errors[key] = `${fieldLabel(key)} zorunludur.`
      }
    }

    if (editable("phoneNumber") && form.phoneNumber.trim() && !/^[0-9+\s()-]{7,20}$/.test(form.phoneNumber.trim())) {
      errors.phoneNumber = "Telefon numarası 7-20 karakter olmalı ve sadece rakam, boşluk, +, -, ( ) içermelidir."
    }

    if (editable("studentTc") && form.studentTc.trim() && !isValidTurkishIdentityNumber(form.studentTc.trim())) {
      errors.studentTc = "Geçerli bir TC Kimlik No girin."
    }

    if (form.needsFollowUp && editable("followUpAt") && !form.followUpAt.trim()) {
      errors.followUpAt = "Takip gerekiyorsa takip tarihi zorunludur."
    }

    return errors
  }

  function buildEditableCallPayload(form: CallForm) {
    const payload: Partial<CallForm> = {}

    for (const key of Object.keys(form) as CallFormKey[]) {
      if (fieldCanEdit(key)) {
        payload[key] = form[key] as never
      }
    }

    return payload
  }

  function setCreateFieldValue<K extends CallFormKey>(key: K, value: CallForm[K]) {
    setCallForm((current) => ({ ...current, [key]: value }))
    setCreateFieldErrors((current) => ({ ...current, [key]: undefined }))
    setCreateError("")
  }

  function setEditFieldValue<K extends CallFormKey>(key: K, value: CallForm[K]) {
    setEditForm((current) => ({ ...current, [key]: value }))
    setEditFieldErrors((current) => ({ ...current, [key]: undefined }))
    setEditError("")
  }

  function applyServerErrorToForm(
    error: unknown,
    setFormError: (message: string) => void,
    setFieldErrors: (errors: CallFormErrors) => void,
    fallback: string,
  ) {
    const message = error instanceof Error ? error.message : fallback
    const field = fieldFromServerMessage(message)

    setFormError(message)
    setFieldErrors(field ? { [field]: message } : {})
  }

  async function loadCalls() {
    setIsLoading(true)
    setMessage("")

    try {
      const [callData, optionData] = await Promise.all([
        request<{ calls: CallRecord[] }>("/calls"),
        canCreate || canResolve || canEdit
          ? request<{ options: CallFormOption[]; fields: CallFormFieldSetting[] }>("/call-options")
          : Promise.resolve({ options: [], fields: [] }),
      ])

      setCalls(callData.calls)
      setCallOptions(optionData.options)
      setFieldSettings("fields" in optionData ? optionData.fields : [])
      setSelectedCallId((current) => current || callData.calls[0]?.id || "")
      const activeInteractionTypes = optionData.options.filter(
        (option) => option.type === "interaction_type" && option.isActive,
      )
      const activeIssueCategories = optionData.options.filter(
        (option) => option.type === "issue_category" && option.isActive,
      )
      const activePriorityOptions = optionData.options.filter(
        (option) => option.type === "priority" && option.isActive,
      )
      setCallForm((current) => ({
        ...current,
        interactionType: activeInteractionTypes.some(
          (option) => option.value === current.interactionType || option.label === current.interactionType,
        )
          ? current.interactionType
          : activeInteractionTypes[0]?.value || activeInteractionTypes[0]?.label || "",
        category: activeIssueCategories.some((option) => option.value === current.category || option.label === current.category)
          ? current.category
          : activeIssueCategories[0]?.value || activeIssueCategories[0]?.label || "",
        priority: (activePriorityOptions.some((option) => option.value === current.priority)
          ? current.priority
          : activePriorityOptions[0]?.value || "normal") as CallPriority,
      }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Çağrı kayıtları yüklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  async function loadCallDetail(callId: string) {
    if (!callId) {
      setSelectedDetail(null)
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      const detail = await request<CallDetail>(`/calls/${callId}`)
      setSelectedDetail(detail)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Çağrı detayı yüklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCalls()
  }, [])

  useEffect(() => {
    void loadCallDetail(selectedCallId)
  }, [selectedCallId])

  useEffect(() => {
    if (!canViewAll && activeScope === "all") {
      setActiveScope("own")
    }
  }, [activeScope, canViewAll])

  useEffect(() => {
    if (visibleCalls.length === 0) {
      setSelectedCallId("")
      return
    }

    if (!visibleCalls.some((call) => call.id === selectedCallId)) {
      setSelectedCallId(visibleCalls[0].id)
    }
  }, [selectedCallId, visibleCalls])

  function openEditDialog() {
    if (!selectedCall) {
      return
    }

    setEditError("")
    setEditFieldErrors({})
    setEditForm({
      phoneNumber: selectedCall.phoneNumber,
      studentTc: selectedCall.studentTc ?? "",
      studentName: selectedCall.studentName ?? "",
      interactionType: selectedCall.interactionType,
      category: selectedCall.category,
      issue: selectedCall.issue,
      initialNote: selectedCall.initialNote ?? "",
      priority: selectedCall.priority,
      needsFollowUp: selectedCall.needsFollowUp,
      followUpAt: selectedCall.followUpAt ? toDateTimeInputValue(selectedCall.followUpAt) : "",
    })
    setIsEditOpen(true)
  }

  function setCreateDialogOpen(open: boolean) {
    setIsCreateOpen(open)

    if (open) {
      setCreateError("")
      setCreateFieldErrors({})
    }
  }

  async function updateCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")

    if (!selectedCall) {
      return
    }

    const errors = validateCallForm(editForm, "edit")
    if (Object.keys(errors).length > 0) {
      setEditFieldErrors(errors)
      setEditError("Lütfen işaretlenen alanları kontrol edin.")
      return
    }

    setIsLoading(true)
    setMessage("")
    setEditError("")
    setEditFieldErrors({})

    try {
      await request(`/calls/${selectedCall.id}`, {
        method: "PATCH",
        body: JSON.stringify(buildEditableCallPayload(editForm)),
      })
      setIsEditOpen(false)
      setMessage("Çağrı bilgileri güncellendi.")
      await loadCalls()
      await loadCallDetail(selectedCall.id)
    } catch (error) {
      applyServerErrorToForm(error, setEditError, setEditFieldErrors, "Çağrı bilgileri güncellenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  async function createCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")

    const errors = validateCallForm(callForm, "create")
    if (Object.keys(errors).length > 0) {
      setCreateFieldErrors(errors)
      setCreateError("Lütfen işaretlenen alanları kontrol edin.")
      return
    }

    setIsLoading(true)
    setMessage("")
    setCreateError("")
    setCreateFieldErrors({})

    try {
      const data = await request<{ call: CallRecord; warnings: string[] }>("/calls", {
        method: "POST",
        body: JSON.stringify(callForm),
      })
      setCallForm(emptyCallForm)
      setIsCreateOpen(false)
      setSelectedCallId(data.call.id)
      setMessage(
        data.warnings.length > 0
          ? `Kayıt oluşturuldu. Uyarı: ${data.warnings.join(" ")}`
          : "Çağrı kaydı oluşturuldu.",
      )
      await loadCalls()
    } catch (error) {
      applyServerErrorToForm(error, setCreateError, setCreateFieldErrors, "Çağrı kaydı oluşturulamadı.")
    } finally {
      setIsLoading(false)
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedCall) {
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      await request(`/calls/${selectedCall.id}/notes`, {
        method: "POST",
        body: JSON.stringify(noteForm),
      })
      setNoteForm({ noteType: "personnel", content: "" })
      setMessage("Not eklendi.")
      await loadCallDetail(selectedCall.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Not eklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  async function updateStatus(status: CallStatus) {
    if (!selectedCall) {
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      await request(`/calls/${selectedCall.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      setMessage("Durum güncellendi.")
      await loadCalls()
      await loadCallDetail(selectedCall.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Durum güncellenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  async function resolveCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedCall) {
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      await request(`/calls/${selectedCall.id}/resolve`, {
        method: "POST",
        body: JSON.stringify(resolutionForm),
      })
      setResolutionForm({
        resolutionCategory: resolutionCategories[0]?.value || "Bilgi verildi",
        resolutionDescription: "",
      })
      setMessage("Çağrı çözüldü.")
      await loadCalls()
      await loadCallDetail(selectedCall.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Çağrı çözülemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  async function reopenCall() {
    if (!selectedCall) {
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      await request(`/calls/${selectedCall.id}/reopen`, { method: "POST" })
      setMessage("Çağrı yeniden açıldı.")
      await loadCalls()
      await loadCallDetail(selectedCall.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Çağrı yeniden açılamadı.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Stat icon={<ClipboardList />} label={`${visibleCalls.length} kayıt`} />
          <Stat icon={<Phone />} label={`${listSummary.open} açık`} />
          <Stat icon={<CheckCircle2 />} label={`${listSummary.resolved} çözüldü`} />
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
          <Button type="button" variant="outline" onClick={() => void loadCalls()} disabled={isLoading}>
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

      {message && <p className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">{message}</p>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Çağrı Kayıtları</CardTitle>
            <CardDescription>Yetkiniz kapsamındaki kayıtlar listelenir.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {visibleCalls.map((call) => (
                <button
                  key={call.id}
                  type="button"
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-primary/5"
                  data-active={call.id === selectedCallId}
                  onClick={() => setSelectedCallId(call.id)}
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-medium">{call.recordNumber}</strong>
                    <small className="block truncate text-xs text-muted-foreground">
                      {call.studentName || call.phoneNumber}
                    </small>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    <Badge variant="outline">{statusLabels[call.status]}</Badge>
                    <Badge variant={call.priority === "urgent" ? "default" : "secondary"}>
                      {priorityLabels[call.priority]}
                    </Badge>
                  </span>
                </button>
              ))}
              {visibleCalls.length === 0 && <p className="text-sm text-muted-foreground">Henüz görüntülenecek çağrı kaydı yok.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Çağrı Detayı</CardTitle>
            <CardDescription>Notlar, durum ve çözüm işlemleri.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedCall ? (
              <div className="grid gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-medium">{selectedCall.recordNumber}</strong>
                    <span className="block truncate text-sm text-muted-foreground">
                      {selectedCall.category} · {selectedCall.interactionType}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant={selectedCall.status === "resolved" ? "default" : "outline"}>
                      {statusLabels[selectedCall.status]}
                    </Badge>
                    {canEdit && !selectedCall.isLocked && (
                      <Button type="button" size="sm" variant="outline" onClick={openEditDialog}>
                        <Pencil />
                        Bilgileri düzenle
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <Info label="Telefon" value={selectedCall.phoneNumber} />
                  <Info label="Öğrenci TC" value={selectedCall.studentTc ?? "-"} />
                  <Info label="Öğrenci" value={selectedCall.studentName ?? "-"} />
                  <Info label="Açan" value={selectedCall.openedByName} />
                  <Info label="Öncelik" value={priorityLabels[selectedCall.priority]} />
                </div>

                <DetailSection title="Yaşanılan sorun">{selectedCall.issue}</DetailSection>

                {selectedCall.initialNote && (
                  <DetailSection title="İlk personel notu">{selectedCall.initialNote}</DetailSection>
                )}

                {canEdit && !selectedCall.isLocked && (
                  <div className="border-t pt-4">
                    <div className="grid gap-2 sm:max-w-xs">
                      <Label>Durum</Label>
                      <Select
                        value={selectedCall.status}
                        onValueChange={(status) => void updateStatus(status as CallStatus)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels)
                            .filter(([status]) => status !== "resolved")
                            .map(([status, label]) => (
                              <SelectItem key={status} value={status}>
                                {label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {canAddAnyNote && !selectedCall.isLocked && (
                  <form className="grid gap-3 border-t pt-4" onSubmit={addNote}>
                    <div className="grid gap-3 sm:grid-cols-[minmax(180px,0.35fr)_minmax(260px,1fr)]">
                      <div className="grid gap-2">
                        <Label>Not türü</Label>
                        <Select
                          value={noteForm.noteType}
                          onValueChange={(noteType) => setNoteForm((current) => ({ ...current, noteType }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(noteTypeLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Not</Label>
                        <Textarea
                          value={noteForm.content}
                          onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))}
                          placeholder="Not içeriği"
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={isLoading || !noteForm.content.trim()}>
                      <MessageSquarePlus />
                      Not ekle
                    </Button>
                  </form>
                )}

                {canResolve && !selectedCall.isLocked && (
                  <form className="grid gap-3 border-t pt-4" onSubmit={resolveCall}>
                    <div className="grid gap-3 sm:grid-cols-[minmax(180px,0.35fr)_minmax(260px,1fr)]">
                      <div className="grid gap-2">
                        <Label>Çözüm kategorisi</Label>
                        <Select
                          value={resolutionForm.resolutionCategory}
                          onValueChange={(resolutionCategory) =>
                            setResolutionForm((current) => ({ ...current, resolutionCategory }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Çözüm kategorisi seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {resolutionCategories.map((option) => (
                              <SelectItem key={option.id} value={option.value}>
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
                    <Button type="submit" disabled={isLoading || !resolutionForm.resolutionDescription.trim()}>
                      <CheckCircle2 />
                      Çözüldü yap
                    </Button>
                  </form>
                )}

                {canReopen && selectedCall.isLocked && (
                  <Button type="button" variant="outline" onClick={() => void reopenCall()}>
                    <RotateCcw />
                    Yeniden aç
                  </Button>
                )}

                <section className="border-t pt-4">
                  <h3 className="mb-2 text-sm font-semibold">Ek notlar</h3>
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
                    {selectedDetail?.notes.length === 0 && <p className="text-sm text-muted-foreground">Ek not yok.</p>}
                  </div>
                </section>

                <section className="border-t pt-4">
                  <h3 className="mb-2 text-sm font-semibold">İşlem geçmişi</h3>
                  <div className="grid gap-2">
                    {selectedDetail?.events.map((event) => (
                      <TimelineItem
                        key={event.id}
                        title={event.actorName ?? "Sistem"}
                        meta={formatDate(event.createdAt)}
                      >
                        {event.description}
                      </TimelineItem>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Detay görmek için bir çağrı kaydı seçin.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Yeni Çağrı Kaydı</DialogTitle>
            <DialogDescription>
              Kayıt oluşturulduktan sonra ana bilgiler personel tarafından değiştirilemez.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={createCall} noValidate>
            {createError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {createError}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefon numarası" error={createFieldErrors.phoneNumber}>
                <Input
                  value={callForm.phoneNumber}
                  onChange={(event) => setCreateFieldValue("phoneNumber", event.target.value)}
                  aria-invalid={Boolean(createFieldErrors.phoneNumber)}
                  required={fieldIsRequired("phoneNumber")}
                />
              </Field>
              <Field label="Öğrenci TC" error={createFieldErrors.studentTc}>
                <Input
                  value={callForm.studentTc}
                  onChange={(event) => setCreateFieldValue("studentTc", event.target.value)}
                  aria-invalid={Boolean(createFieldErrors.studentTc)}
                  maxLength={11}
                  required={fieldIsRequired("studentTc")}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Öğrenci adı soyadı" error={createFieldErrors.studentName}>
                <Input
                  value={callForm.studentName}
                  onChange={(event) => setCreateFieldValue("studentName", event.target.value)}
                  aria-invalid={Boolean(createFieldErrors.studentName)}
                  required={fieldIsRequired("studentName")}
                />
              </Field>
              <div className="grid gap-2">
                <Label>Görüşme tipi</Label>
                <Select
                  value={callForm.interactionType}
                  onValueChange={(interactionType) => setCreateFieldValue("interactionType", interactionType)}
                >
                  <SelectTrigger className="w-full" aria-invalid={Boolean(createFieldErrors.interactionType)}>
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
                  <p className="text-xs text-destructive">{createFieldErrors.interactionType}</p>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Sorun kategorisi</Label>
                <Select
                  value={callForm.category}
                  onValueChange={(category) => setCreateFieldValue("category", category)}
                >
                  <SelectTrigger className="w-full" aria-invalid={Boolean(createFieldErrors.category)}>
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
                  <p className="text-xs text-destructive">{createFieldErrors.category}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Öncelik</Label>
                <Select
                  value={callForm.priority}
                  onValueChange={(priority) => setCreateFieldValue("priority", priority as CallPriority)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(priorityOptions.length > 0
                      ? priorityOptions
                      : Object.entries(priorityLabels).map(([value, label]) => ({ id: value, value, label }))
                    ).map((option) => (
                      <SelectItem key={option.id} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Field label="Yaşanılan sorun" error={createFieldErrors.issue}>
              <Textarea
                value={callForm.issue}
                onChange={(event) => setCreateFieldValue("issue", event.target.value)}
                aria-invalid={Boolean(createFieldErrors.issue)}
                required={fieldIsRequired("issue")}
              />
            </Field>
            <Field label="İlk personel notu" error={createFieldErrors.initialNote}>
              <Textarea
                  value={callForm.initialNote}
                  onChange={(event) => setCreateFieldValue("initialNote", event.target.value)}
                  aria-invalid={Boolean(createFieldErrors.initialNote)}
                  required={fieldIsRequired("initialNote")}
              />
            </Field>
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[max-content_minmax(260px,1fr)] sm:items-end">
              <label className="flex min-h-8 items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={callForm.needsFollowUp}
                  onCheckedChange={(checked) =>
                    setCreateFieldValue("needsFollowUp", checked === true)
                  }
                />
                Takip gerekiyor
              </label>
              {callForm.needsFollowUp && (
                <Field label="Takip tarihi" error={createFieldErrors.followUpAt}>
                  <Input
                    type="datetime-local"
                    value={callForm.followUpAt}
                    onChange={(event) => setCreateFieldValue("followUpAt", event.target.value)}
                    aria-invalid={Boolean(createFieldErrors.followUpAt)}
                    required={fieldIsRequired("followUpAt")}
                  />
                </Field>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
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

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Çağrı Bilgilerini Düzenle</DialogTitle>
            <DialogDescription>
              Yalnızca ayarlarda düzenlenebilir olan alanlar değiştirilebilir.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={updateCall} noValidate>
            {editError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {editError}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefon numarası" error={editFieldErrors.phoneNumber}>
                <Input
                  value={editForm.phoneNumber}
                  onChange={(event) => setEditFieldValue("phoneNumber", event.target.value)}
                  disabled={!fieldCanEdit("phoneNumber")}
                  aria-invalid={Boolean(editFieldErrors.phoneNumber)}
                  required={fieldIsRequired("phoneNumber")}
                />
              </Field>
              <Field label="Öğrenci TC" error={editFieldErrors.studentTc}>
                <Input
                  value={editForm.studentTc}
                  onChange={(event) => setEditFieldValue("studentTc", event.target.value)}
                  disabled={!fieldCanEdit("studentTc")}
                  aria-invalid={Boolean(editFieldErrors.studentTc)}
                  maxLength={11}
                  required={fieldIsRequired("studentTc")}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Öğrenci adı soyadı" error={editFieldErrors.studentName}>
                <Input
                  value={editForm.studentName}
                  onChange={(event) => setEditFieldValue("studentName", event.target.value)}
                  disabled={!fieldCanEdit("studentName")}
                  aria-invalid={Boolean(editFieldErrors.studentName)}
                  required={fieldIsRequired("studentName")}
                />
              </Field>
              <div className="grid gap-2">
                <Label>Görüşme tipi</Label>
                <Select
                  value={editForm.interactionType}
                  onValueChange={(interactionType) => setEditFieldValue("interactionType", interactionType)}
                  disabled={!fieldCanEdit("interactionType")}
                >
                  <SelectTrigger className="w-full" aria-invalid={Boolean(editFieldErrors.interactionType)}>
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
                {editFieldErrors.interactionType && (
                  <p className="text-xs text-destructive">{editFieldErrors.interactionType}</p>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Sorun kategorisi</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(category) => setEditFieldValue("category", category)}
                  disabled={!fieldCanEdit("category")}
                >
                  <SelectTrigger className="w-full" aria-invalid={Boolean(editFieldErrors.category)}>
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
                {editFieldErrors.category && (
                  <p className="text-xs text-destructive">{editFieldErrors.category}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Öncelik</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(priority) => setEditFieldValue("priority", priority as CallPriority)}
                  disabled={!fieldCanEdit("priority")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(priorityOptions.length > 0
                      ? priorityOptions
                      : Object.entries(priorityLabels).map(([value, label]) => ({ id: value, value, label }))
                    ).map((option) => (
                      <SelectItem key={option.id} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Field label="Yaşanılan sorun" error={editFieldErrors.issue}>
              <Textarea
                value={editForm.issue}
                onChange={(event) => setEditFieldValue("issue", event.target.value)}
                disabled={!fieldCanEdit("issue")}
                aria-invalid={Boolean(editFieldErrors.issue)}
                required={fieldIsRequired("issue")}
              />
            </Field>
            <Field label="İlk personel notu" error={editFieldErrors.initialNote}>
              <Textarea
                value={editForm.initialNote}
                onChange={(event) => setEditFieldValue("initialNote", event.target.value)}
                disabled={!fieldCanEdit("initialNote")}
                aria-invalid={Boolean(editFieldErrors.initialNote)}
                required={fieldIsRequired("initialNote")}
              />
            </Field>
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[max-content_minmax(260px,1fr)] sm:items-end">
              <label className="flex min-h-8 items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={editForm.needsFollowUp}
                  disabled={!fieldCanEdit("needsFollowUp")}
                  onCheckedChange={(checked) =>
                    setEditFieldValue("needsFollowUp", checked === true)
                  }
                />
                Takip gerekiyor
              </label>
              {editForm.needsFollowUp && (
                <Field label="Takip tarihi" error={editFieldErrors.followUpAt}>
                  <Input
                    type="datetime-local"
                    value={editForm.followUpAt}
                    onChange={(event) => setEditFieldValue("followUpAt", event.target.value)}
                    disabled={!fieldCanEdit("followUpAt")}
                    aria-invalid={Boolean(editFieldErrors.followUpAt)}
                    required={fieldIsRequired("followUpAt")}
                  />
                </Field>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={isLoading}>
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-primary">
      {icon}
      {label}
    </span>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block break-words text-sm font-medium">{value}</strong>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t pt-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{children}</p>
    </section>
  )
}

function TimelineItem({
  title,
  meta,
  children,
}: {
  title: string
  meta: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border p-3">
      <strong className="block text-sm font-medium">{title}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">{meta}</span>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
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
  }

  return labels[key]
}

function fieldFromServerMessage(message: string): CallFormKey | null {
  const normalized = message.toLocaleLowerCase("tr-TR")

  if (normalized.includes("telefon")) {
    return "phoneNumber"
  }

  if (normalized.includes("tc")) {
    return "studentTc"
  }

  if (normalized.includes("takip")) {
    return "followUpAt"
  }

  if (normalized.includes("görüşme")) {
    return "interactionType"
  }

  if (normalized.includes("kategori")) {
    return "category"
  }

  if (normalized.includes("sorun")) {
    return "issue"
  }

  return null
}

function isValidTurkishIdentityNumber(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) {
    return false
  }

  const digits = value.split("").map(Number)
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
  const tenthDigit = ((oddSum * 7 - evenSum) % 10 + 10) % 10
  const eleventhDigit = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10

  return digits[9] === tenthDigit && digits[10] === eleventhDigit
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function toDateTimeInputValue(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 16)
}

