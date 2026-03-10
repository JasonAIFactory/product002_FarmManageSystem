"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getKakaoLoginUrl, loginWithKakao, isLoggedIn } from "@/lib/farmerApi";

/**
 * Kakao login page — one big yellow button.
 * After Kakao redirects back with a code, we exchange it for our JWT.
 */
export default function FarmerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Already logged in — redirect to dashboard
    if (isLoggedIn()) {
      router.replace("/farmer/dashboard");
      return;
    }

    // Check for Kakao callback code
    const code = searchParams.get("code");
    if (code) {
      loginWithKakao(code)
        .then(() => router.replace("/farmer/dashboard"))
        .catch(() => alert("로그인에 실패했습니다. 다시 시도해주세요."));
    }
  }, [router, searchParams]);

  const handleLogin = async () => {
    try {
      const loginUrl = await getKakaoLoginUrl();
      window.location.href = loginUrl;
    } catch {
      alert("로그인 URL을 가져올 수 없습니다.");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#FDFBF7" }}
    >
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2" style={{ color: "#2D5016" }}>
          빈조농장
        </h1>
        <p className="text-sm" style={{ color: "#6B6B6B" }}>
          음성으로 간편하게 영농일지를 기록하세요
        </p>
      </div>

      <button
        onClick={handleLogin}
        className="w-full max-w-sm py-4 rounded-xl font-bold text-lg transition-opacity hover:opacity-90 active:scale-98"
        style={{ backgroundColor: "#FEE500", color: "#000000" }}
      >
        카카오로 시작하기
      </button>

      <p className="text-xs mt-8 text-center max-w-xs" style={{ color: "#9B9B9B" }}>
        카카오 계정으로 간편하게 로그인하세요.
        <br />
        별도의 회원가입이 필요 없습니다.
      </p>
    </div>
  );
}
