const selectPointerDownEvents = new WeakSet<Event>()
const documentTrackers = new WeakMap<
  Document,
  { count: number; handlePointerDown: (event: PointerEvent) => void }
>()

function markSelectPointerDownEvent(event: Event) {
  selectPointerDownEvents.add(event)
}

function isSelectPointerDownEvent(event: Event) {
  return selectPointerDownEvents.has(event)
}

function trackSelectPointerDownEvents(ownerDocument: Document) {
  let tracker = documentTrackers.get(ownerDocument)

  if (!tracker) {
    const handlePointerDown = (event: PointerEvent) => {
      const openSelect = ownerDocument.querySelector(
        '[data-slot="select-content"][data-state="open"]',
      )
      const target = event.target as Node | null

      if (openSelect && (!target || !openSelect.contains(target))) {
        markSelectPointerDownEvent(event)
      }
    }

    tracker = { count: 0, handlePointerDown }
    documentTrackers.set(ownerDocument, tracker)
    ownerDocument.addEventListener("pointerdown", handlePointerDown, true)
  }

  tracker.count += 1

  return () => {
    if (!tracker) {
      return
    }

    tracker.count -= 1

    if (tracker.count === 0) {
      ownerDocument.removeEventListener(
        "pointerdown",
        tracker.handlePointerDown,
        true,
      )
      documentTrackers.delete(ownerDocument)
    }
  }
}

export { isSelectPointerDownEvent, trackSelectPointerDownEvents }
