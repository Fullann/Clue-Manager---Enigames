import React, { useEffect, useMemo, useRef, useState } from "react";

export type GridItemType = "text" | "image" | "video" | "audio";

export type GridComposerItem = {
  id: string;
  type: GridItemType;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  zIndex?: number;
  text?: string;
  content?: string;
  file?: File;
};

type Props = {
  items: GridComposerItem[];
  setItems: React.Dispatch<React.SetStateAction<GridComposerItem[]>>;
};

const GRID_SIZE = 6;
const MIN_SPAN = 1;

type DragMode = "move" | "resize" | null;

export default function GridComposer({ items, setItems }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [previewBox, setPreviewBox] = useState<{ row: number; col: number; rowSpan: number; colSpan: number } | null>(null);
  const dragStartRef = useRef<{ row: number; col: number; rowSpan: number; colSpan: number; clientX: number; clientY: number } | null>(null);

  const previewUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.file) {
        map.set(item.id, URL.createObjectURL(item.file));
      }
    }
    return map;
  }, [items]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const addTextItem = () => {
    const nextItem: GridComposerItem = {
      id: crypto.randomUUID(),
      type: "text",
      row: 0,
      col: 0,
      rowSpan: 2,
      colSpan: 2,
      zIndex: getNextZIndex(items),
      text: "Nouveau texte",
    };
    const placed = findFirstAvailablePosition(nextItem, items);
    setItems((prev) => [...prev, { ...nextItem, ...placed }]);
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const next: GridComposerItem[] = [];
    Array.from(fileList).forEach((file, index) => {
      let type: GridItemType = "image";
      if (file.type.startsWith("video/")) type = "video";
      if (file.type.startsWith("audio/")) type = "audio";
      const item = {
        id: `${crypto.randomUUID()}-${index}`,
        type,
        row: 0,
        col: 0,
        rowSpan: type === "image" ? 3 : 2,
        colSpan: 2,
        zIndex: getNextZIndex([...items, ...next]),
        file,
      } as GridComposerItem;
      const placed = findFirstAvailablePosition(item, [...items, ...next]);
      next.push({ ...item, ...placed });
    });
    setItems((prev) => [...prev, ...next]);
  };

  const updateItem = (id: string, patch: Partial<GridComposerItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  };

  const toGridDelta = (clientX: number, clientY: number, startX: number, startY: number) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const cellWidth = rect.width / GRID_SIZE;
    const cellHeight = rect.height / GRID_SIZE;
    return {
      deltaCol: Math.round((clientX - startX) / cellWidth),
      deltaRow: Math.round((clientY - startY) / cellHeight),
    };
  };

  const applyDragPreview = (clientX: number, clientY: number) => {
    if (!dragId || !dragMode || !dragStartRef.current) return;
    const coords = toGridDelta(clientX, clientY, dragStartRef.current.clientX, dragStartRef.current.clientY);
    const current = items.find((item) => item.id === dragId);
    if (!coords || !current) return;

    let candidate = { ...dragStartRef.current };
    if (dragMode === "move") {
      candidate.col = clamp(dragStartRef.current.col + coords.deltaCol, 0, GRID_SIZE - current.colSpan);
      candidate.row = clamp(dragStartRef.current.row + coords.deltaRow, 0, GRID_SIZE - current.rowSpan);
    } else {
      const newColSpan = clamp(dragStartRef.current.colSpan + coords.deltaCol, MIN_SPAN, GRID_SIZE - current.col);
      const newRowSpan = clamp(dragStartRef.current.rowSpan + coords.deltaRow, MIN_SPAN, GRID_SIZE - current.row);
      candidate.colSpan = newColSpan;
      candidate.rowSpan = newRowSpan;
    }

    setPreviewBox(candidate);
  };

  const startDrag = (
    event: React.MouseEvent<HTMLDivElement>,
    id: string,
    mode: DragMode
  ) => {
    event.preventDefault();
    const current = items.find((item) => item.id === id);
    if (!current) return;
    setSelectedId(id);
    setDragId(id);
    setDragMode(mode);
    dragStartRef.current = {
      row: current.row,
      col: current.col,
      rowSpan: current.rowSpan,
      colSpan: current.colSpan,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    setPreviewBox(dragStartRef.current);
  };

  useEffect(() => {
    if (!dragId || !dragMode) return;

    const onMove = (e: MouseEvent) => {
      applyDragPreview(e.clientX, e.clientY);
    };

    const onUp = () => {
      if (dragId && previewBox) {
        updateItem(dragId, previewBox);
      }
      setDragId(null);
      setDragMode(null);
      setPreviewBox(null);
      dragStartRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragId, dragMode, previewBox, items]);

  const moveLayer = (id: string, direction: "up" | "down") => {
    const sorted = [...items].sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
    const idx = sorted.findIndex((item) => item.id === id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? Math.min(sorted.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (targetIdx === idx) return;
    const a = sorted[idx];
    const b = sorted[targetIdx];
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === a.id) return { ...item, zIndex: b.zIndex || 1 };
        if (item.id === b.id) return { ...item, zIndex: a.zIndex || 1 };
        return item;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addTextItem}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
        >
          Ajouter un texte
        </button>
        <label className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm cursor-pointer">
          Ajouter image/video/audio
          <input
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/*,audio/*"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
      </div>

      <div
        ref={gridRef}
        className="relative w-full aspect-square rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 overflow-hidden"
        style={{
          backgroundSize: `${100 / GRID_SIZE}% ${100 / GRID_SIZE}%`,
          backgroundImage:
            "linear-gradient(to right, rgba(120,120,120,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,120,120,0.2) 1px, transparent 1px)",
        }}
      >
        {previewBox && dragId && (
          <div
            className="absolute pointer-events-none border-2 border-indigo-500 bg-indigo-500/20"
            style={{
              left: `${(previewBox.col / GRID_SIZE) * 100}%`,
              top: `${(previewBox.row / GRID_SIZE) * 100}%`,
              width: `${(previewBox.colSpan / GRID_SIZE) * 100}%`,
              height: `${(previewBox.rowSpan / GRID_SIZE) * 100}%`,
            }}
          />
        )}
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className={`absolute rounded-lg border p-2 overflow-hidden ${
              selectedId === item.id ? "border-indigo-500" : "border-zinc-300 dark:border-zinc-600"
            } bg-white/90 dark:bg-zinc-800/90`}
            style={{
              left: `${(item.col / GRID_SIZE) * 100}%`,
              top: `${(item.row / GRID_SIZE) * 100}%`,
              width: `${(item.colSpan / GRID_SIZE) * 100}%`,
              height: `${(item.rowSpan / GRID_SIZE) * 100}%`,
              zIndex: item.zIndex || 1,
            }}
          >
            <div
              className="absolute left-0 top-0 z-10 px-2 py-1 text-[10px] bg-black/50 text-white rounded-br cursor-move select-none"
              onMouseDown={(e) => startDrag(e, item.id, "move")}
              title="Déplacer"
            >
              Deplacer
            </div>
            {item.type === "text" && <div className="text-xs line-clamp-4">{item.text || "Texte vide"}</div>}
            {item.type === "image" && (
              <img
                src={previewUrls.get(item.id) || item.content}
                alt=""
                className="w-full h-full object-cover rounded"
              />
            )}
            {item.type === "video" && (
              <video
                src={previewUrls.get(item.id) || item.content}
                className="w-full h-full object-cover rounded"
                controls
                muted
              />
            )}
            {item.type === "audio" && (
              <div className="h-full flex items-center">
                <audio src={previewUrls.get(item.id) || item.content} controls className="w-full" />
              </div>
            )}
            <div
              className="absolute right-0 bottom-0 w-4 h-4 bg-indigo-600 cursor-se-resize rounded-tl"
              onMouseDown={(e) => {
                e.stopPropagation();
                startDrag(e, item.id, "resize");
              }}
              title="Redimensionner"
            />
          </div>
        ))}
      </div>

      {selectedItem && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
          <p className="text-sm font-medium">Edition de l'element selectionne</p>
          {selectedItem.type === "text" && (
            <textarea
              value={selectedItem.text || ""}
              onChange={(e) => updateItem(selectedItem.id, { text: e.target.value })}
              className="w-full min-h-24 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-transparent p-2 text-sm"
            />
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Astuce: utilise la zone "Deplacer" pour bouger un bloc, la poignee en bas a droite pour redimensionner.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => moveLayer(selectedItem.id, "up")}
              className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-xs"
            >
              Monter d'un plan
            </button>
            <button
              type="button"
              onClick={() => moveLayer(selectedItem.id, "down")}
              className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-xs"
            >
              Descendre d'un plan
            </button>
          </div>
          <button
            type="button"
            onClick={() => removeItem(selectedItem.id)}
            className="text-sm text-red-500 hover:underline"
          >
            Supprimer cet element
          </button>
        </div>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function findFirstAvailablePosition(item: GridComposerItem, collection: GridComposerItem[]) {
  for (let row = 0; row <= GRID_SIZE - item.rowSpan; row += 1) {
    for (let col = 0; col <= GRID_SIZE - item.colSpan; col += 1) {
      const collision = collection.some((other) => {
        const aLeft = col;
        const aTop = row;
        const aRight = col + item.colSpan;
        const aBottom = row + item.rowSpan;
        const bLeft = other.col;
        const bTop = other.row;
        const bRight = other.col + other.colSpan;
        const bBottom = other.row + other.rowSpan;
        return !(aRight <= bLeft || aLeft >= bRight || aBottom <= bTop || aTop >= bBottom);
      });
      if (!collision) return { row, col };
    }
  }
  return { row: 0, col: 0 };
}

function getNextZIndex(items: GridComposerItem[]) {
  if (!items.length) return 1;
  return Math.max(...items.map((item) => item.zIndex || 1)) + 1;
}
