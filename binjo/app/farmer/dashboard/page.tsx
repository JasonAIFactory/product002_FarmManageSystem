"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listFarmLogs, type FarmLog } from "@/lib/farmerApi";
import LogList from "@/components/farmer/LogList";

/**
 * Farmer dashboard — main screen after login.
 * Shows: quick record button, this week's stats, recent logs.
 */
export default function FarmerDashboard() {
  const router = useRouter();
  const [recentLogs, setRecentLogs] = useState<FarmLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch last 7 days of logs
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    listFarmLogs(
      weekAgo.toISOString().split("T")[0],
      today.toISOString().split("T")[0]
    )
      .then((data) => setRecentLogs(data.logs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const daysRecorded = new Set(recentLogs.map((l) => l.log_date)).size;

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Quick record button — hero action */}
      <div className="text-center py-8">
        <button
          onClick={() => router.push("/farmer/record")}
          className="w-28 h-28 rounded-full flex items-center justify-center mx-auto shadow-lg transition-transform active:scale-95"
          style={{ backgroundColor: "#2D5016" }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="white">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </button>
        <p className="text-sm font-medium mt-4" style={{ color: "#2D5016" }}>
          오늘 하루 기록하기
        </p>
        <p className="text-xs mt-1" style={{ color: "#9B9B9B" }}>
          탭해서 말하기
        </p>
      </div>

      {/* Weekly stats */}
      <div
        className="rounded-xl p-4 mb-6 flex items-center justify-between"
        style={{ backgroundColor: "#EDF4E8" }}
      >
        <div>
          <p className="text-xs" style={{ color: "#6B6B6B" }}>이번 주 기록</p>
          <p className="text-lg font-bold" style={{ color: "#2D5016" }}>
            {daysRecorded}일 <span className="text-sm font-normal" style={{ color: "#6B6B6B" }}>/ 7일</span>
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg"
          style={{
            backgroundColor: daysRecorded >= 5 ? "#2D5016" : "#E8913A",
            color: "#FFFFFF",
          }}
        >
          {daysRecorded >= 5 ? "👍" : daysRecorded >= 3 ? "💪" : "📝"}
        </div>
      </div>

      {/* Recent logs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: "#1A1A1A" }}>
            최근 기록
          </h2>
          <button
            onClick={() => router.push("/farmer/logs")}
            className="text-xs"
            style={{ color: "#2D5016" }}
          >
            전체 보기 →
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-center py-8" style={{ color: "#9B9B9B" }}>
            불러오는 중...
          </p>
        ) : (
          <LogList
            logs={recentLogs.slice(0, 5)}
            onSelect={(log) => router.push(`/farmer/logs?id=${log.id}`)}
          />
        )}
      </div>
    </div>
  );
}
