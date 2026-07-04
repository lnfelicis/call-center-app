import { useEffect, useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquarePlus,
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
  const [selectedCallId, setSelectedCallId] = useState("")
  const [selectedDetail, setSelectedDetail] = useState<CallDetail | null>(null)
  const [callForm, setCallForm] = useState<CallForm>(emptyCallForm)
  const [noteForm, setNoteForm] = useState({ noteType: "personnel", content: "" })
  const [resolutionForm, setResolutionForm] = useState({
    resolutionCategory: "Bilgi verildi",
    resolutionDescription: "",
  })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const selectedCall = selectedDetail?.call ?? calls.find((call) => call.id === selectedCallId)
  const canCreate = currentUser.permissions.includes("calls.create")
  const canEdit = currentUser.permissions.includes("calls.edit")
  const canResolve = currentUser.permissions.includes("calls.resolve")
  const canReopen = currentUser.permissions.includes("calls.reopen")
  const canAddAnyNote =
    currentUser.permissions.includes("calls.note.own") ||
    currentUser.permissions.includes("calls.note.assigned") ||
    canEdit

  const listSummary = useMemo(() => {
    return {
      open: calls.filter((call) => call.status !== "resolved" && call.status !== "closed").length,
      resolved: calls.filter((call) => call.status === "resolved").length,
      followUp: calls.filter((call) => call.needsFollowUp).length,
    }
  }, [calls])

  const interactionTypes = callOptions.filter((option) => option.type === "interaction_type" && option.isActive)
  const issueCategories = callOptions.filter((option) => option.type === "issue_category" && option.isActive)

  async function loadCalls() {
    setIsLoading(true)
    setMessage("")

    try {
      const [callData, optionData] = await Promise.all([
        request<{ calls: CallRecord[] }>("/calls"),
        canCreate
          ? request<{ options: CallFormOption[] }>("/call-options")
          : Promise.resolve({ options: [] }),
      ])

      setCalls(callData.calls)
      setCallOptions(optionData.options)
      setSelectedCallId((current) => current || callData.calls[0]?.id || "")
      const activeInteractionTypes = optionData.options.filter(
        (option) => option.type === "interaction_type" && option.isActive,
      )
      const activeIssueCategories = optionData.options.filter(
        (option) => option.type === "issue_category" && option.isActive,
      )
      setCallForm((current) => ({
        ...current,
        interactionType: activeInteractionTypes.some((option) => option.label === current.interactionType)
          ? current.interactionType
          : activeInteractionTypes[0]?.label || "",
        category: activeIssueCategories.some((option) => option.label === current.category)
          ? current.category
          : activeIssueCategories[0]?.label || "",
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

  async function createCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage("")

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
      setMessage(error instanceof Error ? error.message : "Çağrı kaydı oluşturulamadı.")
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
      setResolutionForm({ resolutionCategory: "Bilgi verildi", resolutionDescription: "" })
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
          <Stat icon={<ClipboardList />} label={`${calls.length} kayıt`} />
          <Stat icon={<Phone />} label={`${listSummary.open} açık`} />
          <Stat icon={<CheckCircle2 />} label={`${listSummary.resolved} çözüldü`} />
          <Stat icon={<FileText />} label={`${listSummary.followUp} takip`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadCalls()} disabled={isLoading}>
            <RefreshCw />
            Yenile
          </Button>
          {canCreate && (
            <Button type="button" onClick={() => setIsCreateOpen(true)}>
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
              {calls.map((call) => (
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
              {calls.length === 0 && <p className="text-sm text-muted-foreground">Henüz görüntülenecek çağrı kaydı yok.</p>}
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
                  <Badge variant={selectedCall.status === "resolved" ? "default" : "outline"}>
                    {statusLabels[selectedCall.status]}
                  </Badge>
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
                        <Input
                          value={resolutionForm.resolutionCategory}
                          onChange={(event) =>
                            setResolutionForm((current) => ({
                              ...current,
                              resolutionCategory: event.target.value,
                            }))
                          }
                        />
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Yeni Çağrı Kaydı</DialogTitle>
            <DialogDescription>
              Kayıt oluşturulduktan sonra ana bilgiler personel tarafından değiştirilemez.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={createCall}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefon numarası">
                <Input
                  value={callForm.phoneNumber}
                  onChange={(event) => setCallForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                  required
                />
              </Field>
              <Field label="Öğrenci TC">
                <Input
                  value={callForm.studentTc}
                  onChange={(event) => setCallForm((current) => ({ ...current, studentTc: event.target.value }))}
                  maxLength={11}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Öğrenci adı soyadı">
                <Input
                  value={callForm.studentName}
                  onChange={(event) => setCallForm((current) => ({ ...current, studentName: event.target.value }))}
                />
              </Field>
              <div className="grid gap-2">
                <Label>Görüşme tipi</Label>
                <Select
                  value={callForm.interactionType}
                  onValueChange={(interactionType) =>
                    setCallForm((current) => ({ ...current, interactionType }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Görüşme tipi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {interactionTypes.map((option) => (
                      <SelectItem key={option.id} value={option.label}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Sorun kategorisi</Label>
                <Select
                  value={callForm.category}
                  onValueChange={(category) => setCallForm((current) => ({ ...current, category }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sorun kategorisi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {issueCategories.map((option) => (
                      <SelectItem key={option.id} value={option.label}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Öncelik</Label>
                <Select
                  value={callForm.priority}
                  onValueChange={(priority) =>
                    setCallForm((current) => ({ ...current, priority: priority as CallPriority }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([priority, label]) => (
                      <SelectItem key={priority} value={priority}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Field label="Yaşanılan sorun">
              <Textarea
                value={callForm.issue}
                onChange={(event) => setCallForm((current) => ({ ...current, issue: event.target.value }))}
                required
              />
            </Field>
            <Field label="İlk personel notu">
              <Textarea
                value={callForm.initialNote}
                onChange={(event) => setCallForm((current) => ({ ...current, initialNote: event.target.value }))}
              />
            </Field>
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[max-content_minmax(260px,1fr)] sm:items-end">
              <label className="flex min-h-8 items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={callForm.needsFollowUp}
                  onCheckedChange={(checked) =>
                    setCallForm((current) => ({ ...current, needsFollowUp: checked === true }))
                  }
                />
                Takip gerekiyor
              </label>
              {callForm.needsFollowUp && (
                <Field label="Takip tarihi">
                  <Input
                    type="datetime-local"
                    value={callForm.followUpAt}
                    onChange={(event) => setCallForm((current) => ({ ...current, followUpAt: event.target.value }))}
                    required
                  />
                </Field>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </label>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
