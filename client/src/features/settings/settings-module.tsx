import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { GripVertical, Plus, Save } from "lucide-react"

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
import type { CallFormOption, CallOptionType, RequestFn } from "@/types"

type SettingsModuleProps = {
  request: RequestFn
}

const optionTypeLabels: Record<CallOptionType, string> = {
  interaction_type: "Görüşme Tipleri",
  issue_category: "Sorun Kategorileri",
}

export function SettingsModule({ request }: SettingsModuleProps) {
  const [options, setOptions] = useState<CallFormOption[]>([])
  const [form, setForm] = useState({
    type: "interaction_type" as CallOptionType,
    label: "",
    sortOrder: 0,
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function loadOptions() {
    setIsLoading(true)
    setMessage("")

    try {
      const data = await request<{ options: CallFormOption[] }>("/call-options")
      setOptions(data.options)
      setHasChanges(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seçenekler yüklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOptions()
  }, [])

  async function createOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      await request("/call-options", {
        method: "POST",
        body: JSON.stringify(form),
      })
      setForm((current) => ({ ...current, label: "", sortOrder: current.sortOrder + 10 }))
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
      await request("/call-options", {
        method: "PATCH",
        body: JSON.stringify({ options }),
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

  function reorderOption(type: CallOptionType, targetId: string) {
    if (!draggingId || draggingId === targetId) {
      return
    }

    setOptions((current) => {
      const sameType = current
        .filter((option) => option.type === type)
        .sort((first, second) => first.sortOrder - second.sortOrder)
      const others = current.filter((option) => option.type !== type)
      const draggingIndex = sameType.findIndex((option) => option.id === draggingId)
      const targetIndex = sameType.findIndex((option) => option.id === targetId)

      if (draggingIndex === -1 || targetIndex === -1) {
        return current
      }

      const reordered = [...sameType]
      const [dragged] = reordered.splice(draggingIndex, 1)
      reordered.splice(targetIndex, 0, dragged)

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
    setHasChanges(true)
  }

  return (
    <div className="settings-module">
      {message && <p className="module-message">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Çağrı Formu Seçenekleri</CardTitle>
          <CardDescription>
            Görüşme tipi ve sorun kategorisi seçenekleri çağrı formunda select olarak kullanılır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="settings-option-form" onSubmit={createOption}>
            <label>
              <Label>Seçenek türü</Label>
              <select
                className="select-control"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value as CallOptionType }))
                }
              >
                <option value="interaction_type">Görüşme tipi</option>
                <option value="issue_category">Sorun kategorisi</option>
              </select>
            </label>
            <label>
              <Label>Seçenek adı</Label>
              <Input
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Örn. Telefon dönüşü"
              />
            </label>
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

      <div className="settings-grid">
        {(Object.keys(optionTypeLabels) as CallOptionType[]).map((type) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{optionTypeLabels[type]}</CardTitle>
              <CardDescription>Aktif seçenekler çağrı formunda gösterilir.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="option-list">
                {options
                  .filter((option) => option.type === type)
                  .sort((first, second) => first.sortOrder - second.sortOrder)
                  .map((option) => (
                    <div
                      className="option-row"
                      key={option.id}
                      draggable
                      data-dragging={draggingId === option.id}
                      onDragStart={() => setDraggingId(option.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => reorderOption(type, option.id)}
                    >
                      <span className="drag-handle" aria-hidden="true">
                        <GripVertical />
                      </span>
                      <Input
                        value={option.label}
                        onChange={(event) => patchLocalOption(option.id, { label: event.target.value })}
                      />
                      <label className="compact-check">
                        <input
                          type="checkbox"
                          checked={option.isActive}
                          onChange={(event) => patchLocalOption(option.id, { isActive: event.target.checked })}
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
