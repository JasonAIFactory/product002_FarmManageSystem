"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VoiceRecorder from "@/components/farmer/VoiceRecorder";
import ReviewCard from "@/components/farmer/ReviewCard";
import { uploadVoice, createFarmLog, getVoiceResult, type ParsedFarmLog } from "@/lib/farmerApi";

/**
 * Voice recording page — the core interaction.
 *
 * States:
 * 1. "idle" — show recorder
 * 2. "uploading" — processing animation
 * 3. "review" — show parsed result for confirmation
 * 4. "saved" — success message
 */
type RecordState = "idle" | "uploading" | "review" | "saved";

export default function RecordPage() {
  const router = useRouter();
  const [state, setState] = useState<RecordState>("idle");
  const [parsedData, setParsedData] = useState<ParsedFarmLog | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleRecordingComplete = async (blob: Blob) => {
    setState("uploading");
    setError(null);

    try {
      // Upload and process — synchronous for now
      const result = await uploadVoice(blob);
      setRecordingId(result.id);

      if (result.status === "completed") {
        // Fetch the parsed result
        const voiceResult = await getVoiceResult(result.id);
        setParsedData(voiceResult.parsed_data);
        setTranscript(voiceResult.transcript);
        setState("review");
      } else {
        setError(result.message || "처리에 실패했습니다");
        setState("idle");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setState("idle");
    }
  };

  const handleConfirm = async () => {
    if (!parsedData) return;

    setSaving(true);
    try {
      await createFarmLog({
        voice_recording_id: recordingId || undefined,
        log_date: parsedData.date,
        crop: parsedData.crop,
        tasks: parsedData.tasks.map((t) => ({
          stage: t.stage,
          detail: t.detail || undefined,
          duration_hours: t.duration_hours || undefined,
        })),
        chemicals: parsedData.chemicals.map((c) => ({
          type: c.type,
          name: c.name,
          amount: c.amount || undefined,
          action: c.action,
        })),
        weather_farmer: parsedData.weather_farmer || undefined,
        notes: parsedData.notes || undefined,
      });
      setState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다");
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    setState("idle");
    setParsedData(null);
    setTranscript(null);
    setRecordingId(null);
    setError(null);
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold mb-1" style={{ color: "#2D5016" }}>
        오늘 하루 기록
      </h2>
      <p className="text-xs mb-8" style={{ color: "#6B6B6B" }}>
        {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
      </p>

      {/* Error message */}
      {error && (
        <div
          className="rounded-xl p-3 mb-4 text-sm"
          style={{ backgroundColor: "#FEF3E2", color: "#D4421E" }}
        >
          {error}
        </div>
      )}

      {/* State: idle — show recorder */}
      {state === "idle" && (
        <div className="py-8">
          <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
        </div>
      )}

      {/* State: uploading — processing animation */}
      {state === "uploading" && (
        <div className="flex flex-col items-center py-16">
          <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin mb-4"
            style={{ borderColor: "#2D5016", borderTopColor: "transparent" }}
          />
          <p className="text-sm font-medium" style={{ color: "#2D5016" }}>
            AI가 분석 중입니다...
          </p>
          <p className="text-xs mt-1" style={{ color: "#9B9B9B" }}>
            음성을 텍스트로 변환하고 구조화하는 중
          </p>
        </div>
      )}

      {/* State: review — show parsed result */}
      {state === "review" && parsedData && (
        <ReviewCard
          data={parsedData}
          transcript={transcript}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
          loading={saving}
        />
      )}

      {/* State: saved — success */}
      {state === "saved" && (
        <div className="flex flex-col items-center py-16">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4"
            style={{ backgroundColor: "#EDF4E8" }}
          >
            ✓
          </div>
          <p className="text-lg font-bold mb-1" style={{ color: "#2D5016" }}>
            저장되었습니다!
          </p>
          <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>
            오늘의 영농일지가 기록되었습니다
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDiscard}
              className="px-6 py-3 rounded-xl text-sm font-medium"
              style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
            >
              추가 기록
            </button>
            <button
              onClick={() => router.push("/farmer/logs")}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: "#2D5016" }}
            >
              기록 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
