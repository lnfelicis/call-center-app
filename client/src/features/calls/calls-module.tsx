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
  X,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    <div className="calls-module">
      <div className="module-toolbar">
        <div className="call-stats">
          <span><ClipboardList /> {calls.length} kayıt</span>
          <span><Phone /> {listSummary.open} açık</span>
          <span><CheckCircle2 /> {listSummary.resolved} çözüldü</span>
          <span><FileText /> {listSummary.followUp} takip</span>
        </div>
        <div className="toolbar-actions">
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

      {message && <p className="module-message">{message}</p>}

      <div className="calls-layout">
        <Card>
          <CardHeader>
            <CardTitle>Çağrı Kayıtları</CardTitle>
            <CardDescription>Yetkiniz kapsamındaki kayıtlar listelenir.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="call-list">
              {calls.map((call) => (
                <button
                  key={call.id}
                  type="button"
                  className="call-row"
                  data-active={call.id === selectedCallId}
                  onClick={() => setSelectedCallId(call.id)}
                >
                  <span>
                    <strong>{call.recordNumber}</strong>
                    <small>{call.studentName || call.phoneNumber}</small>
                  </span>
                  <span>
                    <Badge variant="outline">{statusLabels[call.status]}</Badge>
                    <Badge variant={call.priority === "urgent" ? "default" : "secondary"}>
                      {priorityLabels[call.priority]}
                    </Badge>
                  </span>
                </button>
              ))}
              {calls.length === 0 && <p className="empty-state">Henüz görüntülenecek çağrı kaydı yok.</p>}
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
              <div className="call-detail">
                <div className="detail-header">
                  <div>
                    <strong>{selectedCall.recordNumber}</strong>
                    <span>{selectedCall.category} · {selectedCall.interactionType}</span>
                  </div>
                  <Badge variant={selectedCall.status === "resolved" ? "default" : "outline"}>
                    {statusLabels[selectedCall.status]}
                  </Badge>
                </div>

                <div className="detail-grid">
                  <Info label="Telefon" value={selectedCall.phoneNumber} />
                  <Info label="Öğrenci TC" value={selectedCall.studentTc ?? "-"} />
                  <Info label="Öğrenci" value={selectedCall.studentName ?? "-"} />
                  <Info label="Açan" value={selectedCall.openedByName} />
                <Info label="Öncelik" value={priorityLabels[selectedCall.priority]} />
              </div>

                <section className="detail-section">
                  <h3>Yaşanılan sorun</h3>
                  <p>{selectedCall.issue}</p>
                </section>

                {selectedCall.initialNote && (
                  <section className="detail-section">
                    <h3>İlk personel notu</h3>
                    <p>{selectedCall.initialNote}</p>
                  </section>
                )}

                <div className="action-strip">
                  {canEdit && !selectedCall.isLocked && (
                    <label>
                      <span>Durum</span>
                      <select
                        className="select-control"
                        value={selectedCall.status}
                        onChange={(event) => void updateStatus(event.target.value as CallStatus)}
                      >
                        {Object.entries(statusLabels)
                          .filter(([status]) => status !== "resolved")
                          .map(([status, label]) => (
                            <option key={status} value={status}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </div>

                {canAddAnyNote && !selectedCall.isLocked && (
                  <form className="inline-form" onSubmit={addNote}>
                    <label>
                      <span>Not türü</span>
                      <select
                        className="select-control"
                        value={noteForm.noteType}
                        onChange={(event) => setNoteForm((current) => ({ ...current, noteType: event.target.value }))}
                      >
                        <option value="personnel">Personel Notu</option>
                        <option value="follow_up">Takip Notu</option>
                        <option value="assigned_personnel">Atanan Personel Notu</option>
                        <option value="internal">İç Not</option>
                        <option value="manager">Yönetici Notu</option>
                      </select>
                    </label>
                    <label>
                      <span>Not</span>
                      <textarea
                        value={noteForm.content}
                        onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))}
                        placeholder="Not içeriği"
                      />
                    </label>
                    <Button type="submit" disabled={isLoading || !noteForm.content.trim()}>
                      <MessageSquarePlus />
                      Not ekle
                    </Button>
                  </form>
                )}

                {canResolve && !selectedCall.isLocked && (
                  <form className="inline-form" onSubmit={resolveCall}>
                    <label>
                      <span>Çözüm kategorisi</span>
                      <Input
                        value={resolutionForm.resolutionCategory}
                        onChange={(event) =>
                          setResolutionForm((current) => ({
                            ...current,
                            resolutionCategory: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Çözüm açıklaması</span>
                      <textarea
                        value={resolutionForm.resolutionDescription}
                        onChange={(event) =>
                          setResolutionForm((current) => ({
                            ...current,
                            resolutionDescription: event.target.value,
                          }))
                        }
                      />
                    </label>
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

                <section className="detail-section">
                  <h3>Ek notlar</h3>
                  <div className="timeline-list">
                    {selectedDetail?.notes.map((note) => (
                      <div key={note.id}>
                        <strong>{note.authorName}</strong>
                        <span>{note.noteType} · {formatDate(note.createdAt)}</span>
                        <p>{note.content}</p>
                      </div>
                    ))}
                    {selectedDetail?.notes.length === 0 && <p className="empty-state">Ek not yok.</p>}
                  </div>
                </section>

                <section className="detail-section">
                  <h3>İşlem geçmişi</h3>
                  <div className="timeline-list">
                    {selectedDetail?.events.map((event) => (
                      <div key={event.id}>
                        <strong>{event.actorName ?? "Sistem"}</strong>
                        <span>{formatDate(event.createdAt)}</span>
                        <p>{event.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <p className="empty-state">Detay görmek için bir çağrı kaydı seçin.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h2>Yeni Çağrı Kaydı</h2>
                <p>Kayıt oluşturulduktan sonra ana bilgiler personel tarafından değiştirilemez.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setIsCreateOpen(false)}>
                <X />
              </Button>
            </div>
            <form className="call-form" onSubmit={createCall}>
              <div className="two-column">
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
              <div className="two-column">
                <Field label="Öğrenci adı soyadı">
                  <Input
                    value={callForm.studentName}
                    onChange={(event) => setCallForm((current) => ({ ...current, studentName: event.target.value }))}
                  />
                </Field>
                <Field label="Görüşme tipi">
                  <select
                    className="select-control"
                    value={callForm.interactionType}
                    onChange={(event) =>
                      setCallForm((current) => ({ ...current, interactionType: event.target.value }))
                    }
                    required
                  >
                    {interactionTypes.map((option) => (
                      <option key={option.id} value={option.label}>{option.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="two-column">
                <Field label="Sorun kategorisi">
                  <select
                    className="select-control"
                    value={callForm.category}
                    onChange={(event) => setCallForm((current) => ({ ...current, category: event.target.value }))}
                    required
                  >
                    {issueCategories.map((option) => (
                      <option key={option.id} value={option.label}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Öncelik">
                  <select
                    className="select-control"
                    value={callForm.priority}
                    onChange={(event) =>
                      setCallForm((current) => ({ ...current, priority: event.target.value as CallPriority }))
                    }
                  >
                    {Object.entries(priorityLabels).map(([priority, label]) => (
                      <option key={priority} value={priority}>{label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Yaşanılan sorun">
                <textarea
                  value={callForm.issue}
                  onChange={(event) => setCallForm((current) => ({ ...current, issue: event.target.value }))}
                  required
                />
              </Field>
              <Field label="İlk personel notu">
                <textarea
                  value={callForm.initialNote}
                  onChange={(event) => setCallForm((current) => ({ ...current, initialNote: event.target.value }))}
                />
              </Field>
              <div className="follow-up-row">
                <label className="check-row">
                <input
                  type="checkbox"
                  checked={callForm.needsFollowUp}
                  onChange={(event) =>
                    setCallForm((current) => ({ ...current, needsFollowUp: event.target.checked }))
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
              <div className="modal-actions">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Vazgeç
                </Button>
                <Button type="submit" disabled={isLoading}>
                  <Plus />
                  Kaydı oluştur
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
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
