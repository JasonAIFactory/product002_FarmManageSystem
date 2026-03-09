"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SectionConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: "hero", label: "메인 배너", visible: true },
  { id: "story", label: "농장 이야기", visible: true },
  { id: "products", label: "상품 소개", visible: true },
  { id: "calendar", label: "제철 달력", visible: true },
  { id: "youtube", label: "유튜브 영상", visible: true },
  { id: "gallery", label: "사진 갤러리", visible: true },
  { id: "reviews", label: "고객 후기", visible: true },
  { id: "order", label: "주문/문의", visible: true },
];

function SortableItem({
  section,
  index,
  onToggle,
}: {
  section: SectionConfig;
  index: number;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border p-4"
      {...attributes}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1"
        style={{ color: "#9B9B9B" }}
        aria-label="드래그하여 순서 변경"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="7" cy="4" r="1.5" />
          <circle cx="13" cy="4" r="1.5" />
          <circle cx="7" cy="10" r="1.5" />
          <circle cx="13" cy="10" r="1.5" />
          <circle cx="7" cy="16" r="1.5" />
          <circle cx="13" cy="16" r="1.5" />
        </svg>
      </button>

      {/* Order number */}
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          backgroundColor: section.visible ? "#2D5016" : "#9B9B9B",
          color: "#FFFFFF",
        }}
      >
        {index + 1}
      </span>

      {/* Section name */}
      <span
        className="flex-1 text-sm font-medium"
        style={{ color: section.visible ? "#1A1A1A" : "#9B9B9B" }}
      >
        {section.label}
      </span>

      {/* Toggle visibility */}
      <button
        onClick={onToggle}
        className="w-12 h-7 rounded-full relative transition-colors flex-shrink-0"
        style={{
          backgroundColor: section.visible ? "#2D5016" : "#D1D1D1",
        }}
      >
        <span
          className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
          style={{
            transform: section.visible ? "translateX(22px)" : "translateX(2px)",
          }}
        />
      </button>
    </div>
  );
}

export default function LayoutEditorPage() {
  const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_SECTIONS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  useEffect(() => {
    fetch("/api/admin/sections")
      .then((r) => r.json())
      .then((data) => {
        if (data.sections_config && Array.isArray(data.sections_config)) {
          const saved = data.sections_config as SectionConfig[];
          const savedIds = new Set(saved.map((s) => s.id));
          const merged = [
            ...saved,
            ...DEFAULT_SECTIONS.filter((d) => !savedIds.has(d.id)),
          ];
          setSections(merged);
        }
      });
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const toggleVisibility = (index: number) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], visible: !newSections[index].visible };
    setSections(newSections);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/sections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("저장되었습니다!");
    } else {
      const data = await res.json();
      setMessage(data.error?.message ?? "저장 실패");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-1" style={{ color: "#2D5016" }}>
        페이지 관리
      </h1>
      <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>
        드래그하여 순서를 변경하고, 토글로 보이기/숨기기를 설정합니다
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sections.map((section, index) => (
              <SortableItem
                key={section.id}
                section={section}
                index={index}
                onToggle={() => toggleVisibility(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#2D5016" }}
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
        {message && (
          <p
            className="text-sm"
            style={{ color: message === "저장되었습니다!" ? "#4A7C2E" : "#D4421E" }}
          >
            {message}
          </p>
        )}
      </div>

      <div
        className="mt-6 rounded-xl p-4 text-xs leading-relaxed"
        style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
      >
        <p className="font-semibold mb-1" style={{ color: "#1A1A1A" }}>사용법</p>
        <ul className="space-y-1">
          <li>• <strong>⠿</strong> 아이콘을 잡고 드래그하여 순서를 변경합니다</li>
          <li>• <strong>토글 스위치</strong>로 섹션을 보이거나 숨깁니다</li>
          <li>• 변경 후 <strong>저장하기</strong>를 눌러야 반영됩니다</li>
        </ul>
      </div>
    </div>
  );
}
