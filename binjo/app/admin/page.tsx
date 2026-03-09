"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  total: number;
  by_channel: Record<string, number>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/inquiries?days=30")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const QUICK_LINKS = [
    { href: "/admin/farm", label: "농장 정보 수정", icon: "🌿", desc: "이름, 소개글, 연락처 수정" },
    { href: "/admin/products", label: "상품 관리", icon: "🍎", desc: "사과 품종 추가·수정" },
    { href: "/admin/gallery", label: "사진 추가", icon: "📷", desc: "농장 사진 업로드" },
    { href: "/admin/reviews", label: "후기 추가", icon: "⭐", desc: "고객 후기 등록" },
  ];

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#2D5016" }}>대시보드</h1>
      <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>빈조농장 관리자 페이지입니다</p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl p-4" style={{ backgroundColor: "#FFFFFF" }}>
            <p className="text-xs" style={{ color: "#6B6B6B" }}>30일 총 문의</p>
            <p className="text-3xl font-bold mt-1" style={{ color: "#2D5016" }}>{stats.total}</p>
          </div>
          {Object.entries(stats.by_channel).map(([channel, count]) => (
            <div key={channel} className="rounded-xl p-4" style={{ backgroundColor: "#FFFFFF" }}>
              <p className="text-xs" style={{ color: "#6B6B6B" }}>
                {channel === "kakao" ? "카카오 문의" : channel === "phone" ? "전화 문의" : "스마트스토어"}
              </p>
              <p className="text-3xl font-bold mt-1" style={{ color: "#D4421E" }}>{count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <h2 className="text-base font-semibold mb-4" style={{ color: "#1A1A1A" }}>빠른 메뉴</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-4 p-5 rounded-2xl transition-shadow hover:shadow-md"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <span className="text-3xl">{link.icon}</span>
            <div>
              <p className="font-semibold" style={{ color: "#1A1A1A" }}>{link.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "#6B6B6B" }}>{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
