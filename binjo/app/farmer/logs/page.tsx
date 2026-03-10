"use client";

import { useEffect, useState } from "react";
import { listFarmLogs, confirmFarmLog, deleteFarmLog, getExportUrl, type FarmLog } from "@/lib/farmerApi";
import LogList from "@/components/farmer/LogList";

/**
 * Farm log history page — list all entries with date filter.
 * Tap a log to see details, confirm, or delete.
 */
export default function LogsPage() {
  const [logs, setLogs] = useState<FarmLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<FarmLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await listFarmLogs();
      setLogs(data.logs);
    } catch {
      // silently handle — empty list shown
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleConfirm = async (id: string) => {
    await confirmFarmLog(id);
    await fetchLogs();
    setSelectedLog(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 기록을 삭제하시겠습니까?")) return;
    await deleteFarmLog(id);
    await fetchLogs();
    setSelectedLog(null);
  };

  const STAGE_EMOJI: Record<string, string> = {
    전정: "✂️", 시비: "🌱", 방제: "🧪", 적화: "🌸",
    적과: "🍎", 봉지씌우기: "📦", 수확: "🧺", 기타: "📝",
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold mb-1" style={{ color: "#2D5016" }}>
        영농일지
      </h2>
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs" style={{ color: "#6B6B6B" }}>
          전체 기록 ({logs.length}건)
        </p>
        {logs.length > 0 && (
          <button
            onClick={() => {
              const dates = logs.map((l) => l.log_date).sort();
              const url = getExportUrl(dates[0], dates[dates.length - 1]);
              window.open(url, "_blank");
            }}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
          >
            📄 영농일지 출력
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-center py-12" style={{ color: "#9B9B9B" }}>
          불러오는 중...
        </p>
      ) : (
        <LogList logs={logs} onSelect={setSelectedLog} />
      )}

      {/* Detail modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div
            className="w-full max-w-lg rounded-t-2xl max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            {/* Header */}
            <div className="sticky top-0 p-4 border-b flex items-center justify-between" style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}>
              <h3 className="font-bold" style={{ color: "#2D5016" }}>
                {selectedLog.log_date}
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-lg"
                style={{ color: "#9B9B9B" }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Tasks */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "#6B6B6B" }}>작업 내용</p>
                {selectedLog.tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2 rounded-xl p-3 mb-1" style={{ backgroundColor: "#F5F1EC" }}>
                    <span>{STAGE_EMOJI[task.stage] || "📝"}</span>
                    <div>
                      <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{task.stage}</span>
                      {task.detail && <p className="text-xs" style={{ color: "#6B6B6B" }}>{task.detail}</p>}
                      {task.field_name && <p className="text-xs" style={{ color: "#9B9B9B" }}>📍 {task.field_name}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chemicals */}
              {selectedLog.chemicals.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#6B6B6B" }}>농약/비료</p>
                  {selectedLog.chemicals.map((c) => (
                    <div key={c.id} className="text-sm rounded-lg p-2 mb-1" style={{ backgroundColor: "#FEF3E2" }}>
                      {c.type === "농약" ? "🧪" : "🌱"} {c.name}{c.amount && ` · ${c.amount}`}
                    </div>
                  ))}
                </div>
              )}

              {/* Weather & Notes */}
              {selectedLog.weather_farmer && (
                <p className="text-sm" style={{ color: "#1A1A1A" }}>🌤️ {selectedLog.weather_farmer}</p>
              )}
              {selectedLog.notes && (
                <p className="text-sm" style={{ color: "#6B6B6B" }}>{selectedLog.notes}</p>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex gap-3" style={{ borderColor: "#E5E2DB" }}>
              <button
                onClick={() => handleDelete(selectedLog.id)}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: "#F5F1EC", color: "#D4421E" }}
              >
                삭제
              </button>
              {selectedLog.status === "draft" && (
                <button
                  onClick={() => handleConfirm(selectedLog.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: "#2D5016" }}
                >
                  ✓ 확인 완료
                </button>
              )}
              {selectedLog.status === "confirmed" && (
                <span
                  className="flex-1 py-2.5 rounded-xl text-sm text-center"
                  style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
                >
                  ✓ 확인됨
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
