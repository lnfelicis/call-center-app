import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { FormEvent, PointerEvent as ReactPointerEvent } from "react"
import { GripVertical, Plus, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CallFormFieldSetting, CallFormOption, CallOptionType, RequestFn } from "@/types"

type SettingsModuleProps = {
  request: RequestFn
}

type DropPlacement = "before" | "after"

type DragState = {
  id: string
  type: CallOptionType
}

const optionTypeLabels: Record<CallOptionType, string> = {
  interaction_type: "Görüşme Tipleri",
  issue_category: "Sorun Kategorileri",
  issue_sub_category: "Alt Sorun Kategorileri",
  status: "Durum Seçenekleri",
  priority: "Öncelik Seçenekleri",
  resolution_category: "Çözüm Kategorileri",
}

export function SettingsModule({ request }: SettingsModuleProps) {
  const [options, setOptions] = useState<CallFormOption[]>([])
  const [fields, setFields] = useState<CallFormFieldSetting[]>([])
  const [form, setForm] = useState({
    type: "interaction_type" as CallOptionType,
    label: "",
    value: "",
    sortOrder: 0,
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const dragState = useRef<DragState | null>(null)
  const lastMoveKey = useRef("")
  const optionsRef = useRef<CallFormOption[]>([])
  const pendingRects = useRef<Map<string, DOMRect> | null>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    if (!draggingId) {
      return
    }

    function handlePointerMove(event: PointerEvent) {
      event.preventDefault()
      moveDraggedItem(event.clientY)
    }

    function handlePointerEnd() {
      endDrag()
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false })
    window.addEventListener("pointerup", handlePointerEnd)
    window.addEventListener("pointercancel", handlePointerEnd)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerEnd)
      window.removeEventListener("pointercancel", handlePointerEnd)
    }
  }, [draggingId])

  useLayoutEffect(() => {
    const previousRects = pendingRects.current

    if (!previousRects) {
      return
    }

    pendingRects.current = null

    rowRefs.current.forEach((element, optionId) => {
      const previous = previousRects.get(optionId)

      if (!previous) {
        return
      }

      const current = element.getBoundingClientRect()
      const deltaX = previous.left - current.left
      const deltaY = previous.top - current.top

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return
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
      )
    })
  }, [options])

  const loadOptions = useCallback(async () => {
    setIsLoading(true)
    setMessage("")

    try {
      const data = await request<{ options: CallFormOption[]; fields: CallFormFieldSetting[] }>("/settings")
      setOptions(data.options)
      setFields(data.fields)
      setHasChanges(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seçenekler yüklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  async function createOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      await request(`/settings/options/${form.type}`, {
        method: "POST",
        body: JSON.stringify({
          label: form.label,
          value: form.value || form.label,
          sortOrder: form.sortOrder,
        }),
      })
      setForm((current) => ({ ...current, label: "", value: "", sortOrder: current.sortOrder + 10 }))
      setMessage("Seçenek eklendi.")
      await loadOptions()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seçenek eklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  async function saveAllOptions() {
    setIsLoading(true)
    setMessage("")

    try {
      await request("/settings", {
        method: "PATCH",
        body: JSON.stringify({ options, fields }),
      })
      setMessage("Tüm seçenekler kaydedildi.")
      await loadOptions()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seçenekler kaydedilemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  function patchLocalOption(optionId: string, patch: Partial<CallFormOption>) {
    setOptions((current) =>
      current.map((option) => (option.id === optionId ? { ...option, ...patch } : option)),
    )
    setHasChanges(true)
  }

  function patchLocalField(fieldKey: string, patch: Partial<CallFormFieldSetting>) {
    setFields((current) =>
      current.map((field) => (field.key === fieldKey ? { ...field, ...patch } : field)),
    )
    setHasChanges(true)
  }

  function captureRowRects() {
    pendingRects.current = new Map(
      [...rowRefs.current.entries()].map(([optionId, element]) => [
        optionId,
        element.getBoundingClientRect(),
      ]),
    )
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    type: CallOptionType,
    optionId: string,
  ) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.userSelect = "none"
    dragState.current = { id: optionId, type }
    lastMoveKey.current = ""
    setDraggingId(optionId)
  }

  function moveDraggedItem(clientY: number) {
    const currentDrag = dragState.current

    if (!currentDrag) {
      return
    }

    const candidates = optionsRef.current
      .filter((option) => option.type === currentDrag.type && option.id !== currentDrag.id)
      .sort((first, second) => first.sortOrder - second.sortOrder)

    if (candidates.length === 0) {
      return
    }

    let targetId = candidates[candidates.length - 1].id
    let placement: DropPlacement = "after"

    for (const option of candidates) {
      const element = rowRefs.current.get(option.id)

      if (!element) {
        continue
      }

      const rect = element.getBoundingClientRect()

      if (clientY < rect.top + rect.height / 2) {
        targetId = option.id
        placement = "before"
        break
      }
    }

    scheduleReorder(currentDrag.id, currentDrag.type, targetId, placement)
  }

  function endDrag(event?: ReactPointerEvent<HTMLButtonElement>) {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    document.body.style.userSelect = ""
    dragState.current = null
    lastMoveKey.current = ""
    pendingRects.current = null
    setDraggingId(null)
  }

  function scheduleReorder(
    draggedId: string,
    type: CallOptionType,
    targetId: string,
    placement: DropPlacement,
  ) {
    if (draggedId === targetId) {
      return
    }

    const moveKey = `${draggedId}:${targetId}:${placement}`

    if (lastMoveKey.current === moveKey) {
      return
    }

    lastMoveKey.current = moveKey
    reorderOption(draggedId, type, targetId, placement)
  }

  function reorderOption(
    draggedId: string,
    type: CallOptionType,
    targetId: string,
    placement: DropPlacement,
  ) {
    captureRowRects()
    setHasChanges(true)

    setOptions((current) => {
      const sameType = current
        .filter((option) => option.type === type)
        .sort((first, second) => first.sortOrder - second.sortOrder)
      const others = current.filter((option) => option.type !== type)
      const draggingIndex = sameType.findIndex((option) => option.id === draggedId)
      const targetIndex = sameType.findIndex((option) => option.id === targetId)

      if (draggingIndex === -1 || targetIndex === -1) {
        pendingRects.current = null
        return current
      }

      let insertionIndex = targetIndex + (placement === "after" ? 1 : 0)

      if (draggingIndex < insertionIndex) {
        insertionIndex -= 1
      }

      if (draggingIndex === insertionIndex) {
        pendingRects.current = null
        return current
      }

      const reordered = [...sameType]
      const [dragged] = reordered.splice(draggingIndex, 1)
      reordered.splice(insertionIndex, 0, dragged)

      return [
        ...others,
        ...reordered.map((option, index) => ({
          ...option,
          sortOrder: (index + 1) * 10,
        })),
      ].sort((first, second) => {
        if (first.type === second.type) {
          return first.sortOrder - second.sortOrder
        }

        return first.type.localeCompare(second.type)
      })
    })
  }

  return (
    <div className="grid gap-4">
      {message && <p className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Çağrı Formu Seçenekleri</CardTitle>
          <CardDescription>
            Görüşme tipi ve sorun kategorisi seçenekleri çağrı formunda select olarak kullanılır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-[minmax(190px,0.8fr)_minmax(220px,1fr)_minmax(180px,0.8fr)_auto_auto] lg:items-end" onSubmit={createOption}>
            <div className="grid gap-2">
              <Label>Seçenek türü</Label>
              <Select
                value={form.type}
                onValueChange={(type) =>
                  setForm((current) => ({ ...current, type: type as CallOptionType }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interaction_type">Görüşme tipi</SelectItem>
                  <SelectItem value="issue_category">Sorun kategorisi</SelectItem>
                  <SelectItem value="issue_sub_category">Alt sorun kategorisi</SelectItem>
                  <SelectItem value="status">Durum</SelectItem>
                  <SelectItem value="priority">Öncelik</SelectItem>
                  <SelectItem value="resolution_category">Çözüm kategorisi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Seçenek adı</Label>
              <Input
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Örn. Telefon dönüşü"
              />
            </div>
            <div className="grid gap-2">
              <Label>Sistem değeri</Label>
              <Input
                value={form.value}
                onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                placeholder="Boşsa ad kullanılır"
              />
            </div>
            <Button type="submit" disabled={isLoading || form.label.trim().length < 2}>
              <Plus />
              Ekle
            </Button>
            <Button type="button" variant="outline" onClick={() => void saveAllOptions()} disabled={isLoading || !hasChanges}>
              <Save />
              Tümünü Kaydet
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form Alanları</CardTitle>
          <CardDescription>
            Alanların aktiflik, zorunluluk, görünürlük, düzenlenebilirlik ve maskeleme davranışlarını yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
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
                      onChange={(event) => patchLocalField(field.key, { label: event.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">{field.key}</span>
                  </div>
                  <Flag label="Aktif" checked={field.isActive} onChange={(isActive) => patchLocalField(field.key, { isActive })} />
                  <Flag label="Görünür" checked={field.isVisible} onChange={(isVisible) => patchLocalField(field.key, { isVisible })} />
                  <Flag label="Zorunlu" checked={field.isRequired} onChange={(isRequired) => patchLocalField(field.key, { isRequired })} />
                  <Flag label="Düzenlenebilir" checked={field.isEditable} onChange={(isEditable) => patchLocalField(field.key, { isEditable })} />
                  <Flag label="Maskeli" checked={field.isMasked} onChange={(isMasked) => patchLocalField(field.key, { isMasked })} />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {(Object.keys(optionTypeLabels) as CallOptionType[]).map((type) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{optionTypeLabels[type]}</CardTitle>
              <CardDescription>Aktif seçenekler çağrı formunda gösterilir.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {options
                  .filter((option) => option.type === type)
                  .sort((first, second) => first.sortOrder - second.sortOrder)
                  .map((option) => (
                    <div
                      className="grid grid-cols-[1.75rem_minmax(180px,1fr)_auto] items-center gap-2 rounded-lg border bg-background p-2 shadow-xs transition-[background-color,border-color,box-shadow,opacity] duration-150 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5 data-[dragging=true]:opacity-70 data-[dragging=true]:shadow-md max-sm:grid-cols-1"
                      key={option.id}
                      ref={(node) => {
                        if (node) {
                          rowRefs.current.set(option.id, node)
                        } else {
                          rowRefs.current.delete(option.id)
                        }
                      }}
                      data-dragging={draggingId === option.id}
                    >
                      <button
                        type="button"
                        className="grid size-7 cursor-grab touch-none place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing max-sm:hidden"
                        onPointerDown={(event) => beginDrag(event, type, option.id)}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        title="Sırala"
                      >
                        <GripVertical className="size-4" />
                      </button>
                      <Input
                        value={option.label}
                        onChange={(event) => patchLocalOption(option.id, { label: event.target.value })}
                      />
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={option.isActive}
                          onCheckedChange={(checked) => patchLocalOption(option.id, { isActive: checked === true })}
                        />
                        Aktif
                      </label>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Flag({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  )
}
