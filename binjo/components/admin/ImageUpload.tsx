"use client";

import { useRef, useState } from "react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  hint?: string;
}

export default function ImageUpload({ value, onChange, label, hint }: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onChange(data.url);
      } else {
        const data = await res.json();
        setError(data.error?.message ?? "업로드 실패");
      }
    } catch {
      setError("업로드 중 오류가 발생했습니다");
    }

    setUploading(false);
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>
        {label}
      </label>
      {hint && <p className="text-xs mb-2" style={{ color: "#9B9B9B" }}>{hint}</p>}

      {/* Preview */}
      {value && (
        <div className="mb-2 rounded-xl overflow-hidden border" style={{ borderColor: "#E5E2DB" }}>
          <img
            src={value}
            alt="미리보기"
            className="w-full h-40 object-cover"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
        >
          {uploading ? "업로드 중..." : value ? "사진 변경" : "사진 선택"}
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "#F5F1EC", color: "#9B9B9B" }}
          >
            삭제
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleUpload}
        className="hidden"
      />

      {error && (
        <p className="text-xs mt-1" style={{ color: "#D4421E" }}>{error}</p>
      )}
    </div>
  );
}
