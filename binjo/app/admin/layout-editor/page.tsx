"use client";

import { useEffect, useState } from "react";

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

export default function LayoutEditorPage() {
  const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_SECTIONS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/sections")
      .then((r) => r.json())
      .then((data) => {
        if (data.sections_config && Array.isArray(data.sections_config)) {
          // Merge saved config with defaults (in case new sections were added)
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

  const moveSection = (index: number, direction: "up" | "down") => {
    const newSections = [...sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setSections(newSections);
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
        브랜드 페이지의 섹션 순서를 변경하고, 보이기/숨기기를 설정합니다
      </p>

      <div className="space-y-2">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className="flex items-center gap-3 rounded-xl border p-4"
            style={{
              backgroundColor: section.visible ? "#FFFFFF" : "#F5F1EC",
              borderColor: "#E5E2DB",
              opacity: section.visible ? 1 : 0.6,
            }}
          >
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
              onClick={() => toggleVisibility(index)}
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

            {/* Move buttons */}
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button
                onClick={() => moveSection(index, "up")}
                disabled={index === 0}
                className="w-7 h-7 rounded flex items-center justify-center text-sm disabled:opacity-20 hover:bg-gray-100 transition-colors"
                style={{ color: "#2D5016" }}
              >
                ▲
              </button>
              <button
                onClick={() => moveSection(index, "down")}
                disabled={index === sections.length - 1}
                className="w-7 h-7 rounded flex items-center justify-center text-sm disabled:opacity-20 hover:bg-gray-100 transition-colors"
                style={{ color: "#2D5016" }}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>

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
          <li>• <strong>▲ ▼</strong> 버튼으로 섹션 순서를 변경합니다</li>
          <li>• <strong>토글 스위치</strong>로 섹션을 보이거나 숨깁니다</li>
          <li>• 변경 후 <strong>저장하기</strong>를 눌러야 반영됩니다</li>
        </ul>
      </div>
    </div>
  );
}
