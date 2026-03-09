# BINJO Phase 2: Voice Farm Management — Implementation Spec

> This document is the **single source of truth** for Phase 2 implementation.
> Prerequisite: Phase 1 (Brand Page) must be deployed and serving traffic.

---

## 1. What We're Building

A **voice-first farm logging system** that lets the farmer record what he did today by simply talking — like leaving a voicemail. AI processes the audio into structured farm diary entries, auto-fills weather data, and generates 공익직불금-compliant 영농일지.

**One sentence**: Talk into your phone after work → AI turns it into a proper farm diary entry you can review and submit.

**The Glove Test**: Farmer finishes pruning, pulls out phone, taps one big button, talks for 30 seconds about what he did, puts phone back. Done.

---

## 2. Why Phase 2 Now

Phase 1 established the revenue channel (brand page). Phase 2 addresses the farmer's #1 daily pain: **recording what he does every day is tedious but mandatory for subsidies.**

The farmer currently:
- Doesn't write 영농일지 consistently
- Finds NH오늘농사's built-in diary feature too cumbersome
- Risks losing 공익직불금 (≈130만~224만원/year) due to incomplete records
- Can't remember details after a long day in the orchard

---

## 3. Core User Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Farmer   │     │  Upload   │     │  AI       │     │  Review   │
│  Records  │────▶│  Audio    │────▶│  Parse    │────▶│  Confirm  │
│  Voice    │     │  to Server│     │  to Struct │     │  or Edit  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                          │
                                       ┌──────────────────┤
                                       ▼                  ▼
                                 ┌──────────┐     ┌──────────┐
                                 │  Farm Log │     │  영농일지   │
                                 │  Stored   │     │  Export   │
                                 └──────────┘     └──────────┘
```

### Step-by-Step
1. **Tap record** — One large button on farmer's mobile dashboard
2. **Talk naturally** — "오늘 3번 밭에서 전정 작업 했고, 석회유황합제 200리터 살포했어. 날씨 맑았고 영하 2도쯤 됐을걸."
3. **AI processes** — Whisper transcribes → Claude extracts structured data → Weather API auto-fills
4. **Review card** — Farmer sees a clean summary card: date, field, task, chemicals, weather
5. **Confirm or edit** — Tap ✓ to save, or tap any field to fix
6. **Stored** — Entry saved to farm log database
7. **Export anytime** — 영농일지 PDF in government format

---

## 4. Tech Stack (Phase 2 Additions)

| Layer | Choice | Reason |
|---|---|---|
| Backend | **FastAPI (Python 3.11+)** | Whisper + Claude API both Python-native |
| STT | **OpenAI Whisper API** (primary), **self-hosted Whisper large-v3** (fallback) | API for speed; self-hosted for cost at scale |
| AI Parser | **Claude API (claude-sonnet-4-20250514)** | Best Korean understanding + structured output |
| Weather | **기상청 단기예보 API** (data.go.kr) | Free, official, location-based |
| Pest Info | **농사로 병해충 API** (nongsaro.go.kr) | Cross-reference with farm activities |
| PDF Export | **ReportLab** or **WeasyPrint** | Generate 영농일지 PDF |
| Audio Storage | **Supabase Storage** | Same platform as DB, S3-compatible, auto-lifecycle |
| Task Queue | **Celery + Redis** | Async audio processing |

### Phase 2 Architecture Change
Phase 1 was Next.js-only. Phase 2 introduces **FastAPI as the AI/processing backend**:

```
┌─────────────────┐     ┌─────────────────────┐
│  Next.js (Vercel)│     │  FastAPI (Railway)    │
│  - Brand page    │     │  - Voice upload API   │
│  - Farmer UI     │────▶│  - STT pipeline       │
│  - Admin panel   │     │  - AI parsing         │
│                  │     │  - Weather API proxy   │
│                  │     │  - PDF generation      │
│                  │◀────│  - Farm log CRUD       │
└─────────────────┘     └──────────┬────────────┘
                                   │
                        ┌──────────┴────────────┐
                        │  PostgreSQL            │
                        │  (shared with Phase 1) │
                        └───────────────────────┘
                        ┌───────────────────────┐
                        │  Redis (Celery broker) │
                        └───────────────────────┘
                        ┌───────────────────────┐
                        │  Supabase Storage     │
                        │  (audio + images)     │
                        └───────────────────────┘
```

---

## 5. Voice Processing Pipeline

### 5.1 Audio Recording (Client-Side)
```
Input: Browser MediaRecorder API
Format: WebM/Opus (default on mobile Chrome/Safari)
Max duration: 5 minutes (configurable)
Sample rate: 16kHz (Whisper optimal)
Upload: Chunked upload to FastAPI endpoint
```

### 5.2 Speech-to-Text (Server-Side)

**Primary: OpenAI Whisper API**
```python
# API call — fast, reliable, no GPU needed
response = openai.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    language="ko",
    response_format="verbose_json",  # includes timestamps
    prompt="사과 과수원 영농일지. 전정, 적과, 봉지씌우기, 살포, 수확"  
    # ↑ Prompt priming with agricultural terminology improves accuracy
)
```

**Whisper Accuracy Mitigation for Korean Agricultural Terms:**
- Prompt priming with common orchard terms (전정, 적과, 봉지씌우기, 석회유황합제, etc.)
- Post-processing: common mishearing dictionary (e.g., "적과" misheard as "적화")
- Claude-based correction pass as part of parsing step
- Farmer feedback loop: corrections stored → improve prompt priming

### 5.3 AI Structured Parsing (Claude)

**System Prompt (Korean agricultural context):**
```
너는 경남 사천 사과 과수원의 영농일지 작성 보조 AI야.
농부가 음성으로 말한 내용을 구조화된 영농일지 데이터로 변환해.

## 추출할 필드 (JSON)
- date: 작업일 (YYYY-MM-DD, 언급 없으면 오늘)
- field_ids: 필지 번호 목록 (e.g., ["3번 밭", "앞 과수원"])
- crop: 작목 (기본값: "사과")
- tasks: 작업 목록, 각각:
  - stage: 작업단계 (전정/시비/방제/적화/적과/봉지씌우기/수확/기타)
  - detail: 세부 내용
  - duration_hours: 작업 시간 (추정 가능)
- chemicals: 농약/비료 사용 목록, 각각:
  - type: "농약" | "비료"
  - name: 제품명
  - amount: 사용량 (숫자+단위)
  - action: "구입" | "사용"
- weather_farmer: 농부가 말한 날씨 (있으면)
- notes: 기타 메모

## 규칙
- 경상도 사투리 이해 필요 (예: "했더" = "했다", "갔더" = "갔다")
- 필수 필드: date, tasks (하나 이상)
- 불확실한 정보는 "확인필요" 표시
- 농약 이름이 불분명하면 가장 가능성 높은 후보 2~3개 제시
```

**Example Input/Output:**
```
Input (transcribed): "오늘 3번 밭에서 전정 작업 했고, 석회유황합제 200리터 살포했어. 
날씨 맑았고 영하 2도쯤 됐을걸."

Output (JSON):
{
  "date": "2026-03-07",
  "field_ids": ["3번 밭"],
  "crop": "사과",
  "tasks": [
    {"stage": "전정", "detail": "전정 작업", "duration_hours": null},
    {"stage": "방제", "detail": "석회유황합제 살포", "duration_hours": null}
  ],
  "chemicals": [
    {"type": "농약", "name": "석회유황합제", "amount": "200리터", "action": "사용"}
  ],
  "weather_farmer": "맑음, 영하 2도",
  "notes": null
}
```

### 5.4 Weather Auto-Fill

After parsing, auto-fill official weather data:
```python
# 기상청 단기예보 API
# Base URL: http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0
# Endpoint: /getUltraSrtNcst (초단기실황)
# Params: base_date, base_time, nx, ny (사천시 좌표)
# Returns: T1H (기온), REH (습도), RN1 (강수량), etc.
```

Compare farmer's stated weather vs. official data. If they match, auto-confirm. If different, show both and let farmer choose.

---

## 6. Farmer Authentication

### Kakao Login (Primary)
```
Flow: Farmer taps "카카오로 시작" → Kakao OAuth → JWT issued
Why: The farmer already uses KakaoTalk for everything
```

### Implementation
```python
# core/auth/kakao_auth.py — CORE_CANDIDATE
# 1. Redirect to Kakao OAuth
# 2. Receive authorization code
# 3. Exchange for access token
# 4. Get user profile (nickname, profile image)
# 5. Create/update user in DB
# 6. Issue app JWT
```

### User Roles
- **farmer**: Can record voice, view/edit own farm logs, export PDF
- **admin** (Jason): Can manage all data, view analytics

---

## 7. Database Schema (Phase 2 Additions)

```sql
-- Farmer user (linked to Kakao account)
CREATE TABLE farmer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    kakao_id VARCHAR(100) UNIQUE NOT NULL,
    nickname VARCHAR(50),
    profile_image_url VARCHAR(500),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'farmer',       -- 'farmer' | 'admin'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Farm fields/plots (필지)
CREATE TABLE field (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    name VARCHAR(100) NOT NULL,              -- '3번 밭', '앞 과수원'
    area_pyeong DECIMAL(10, 2),              -- 면적 (평)
    crop VARCHAR(50) DEFAULT '사과',
    address TEXT,                            -- 필지 주소
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice recordings (raw audio tracking)
CREATE TABLE voice_recording (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID REFERENCES farmer(id),
    audio_url VARCHAR(500) NOT NULL,
    duration_seconds INT,
    file_size_bytes BIGINT,
    status VARCHAR(20) DEFAULT 'uploaded',   -- uploaded → processing → completed → failed
    transcript TEXT,                          -- Raw Whisper output
    parsed_data JSONB,                       -- Structured AI output
    error_message TEXT,                       -- If processing failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ                   -- Auto-delete after 30 days
);

-- Farm log entries (structured, confirmed data)
CREATE TABLE farm_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    farmer_id UUID REFERENCES farmer(id),
    voice_recording_id UUID REFERENCES voice_recording(id),
    log_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',      -- draft → confirmed → exported
    
    -- 영농일지 required fields
    crop VARCHAR(50) DEFAULT '사과',
    
    -- Weather (official + farmer-reported)
    weather_official JSONB,                  -- From 기상청 API
    weather_farmer VARCHAR(200),             -- What farmer said
    
    -- Free notes
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Farm log tasks (one log can have multiple tasks)
CREATE TABLE farm_log_task (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_log_id UUID REFERENCES farm_log(id) ON DELETE CASCADE,
    field_id UUID REFERENCES field(id),      -- Which field
    field_name VARCHAR(100),                 -- Fallback if field not in DB
    stage VARCHAR(50) NOT NULL,              -- 전정/시비/방제/적과/수확/기타
    detail TEXT,
    duration_hours DECIMAL(4, 1),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chemical usage tracking (농약/비료)
CREATE TABLE chemical_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_log_id UUID REFERENCES farm_log(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL,               -- '농약' | '비료'
    name VARCHAR(200) NOT NULL,
    amount VARCHAR(100),                     -- '200리터', '100kg'
    action VARCHAR(10) DEFAULT 'used',       -- 'purchased' | 'used'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 영농일지 exports
CREATE TABLE farm_diary_export (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    farmer_id UUID REFERENCES farmer(id),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    format VARCHAR(10) DEFAULT 'pdf',        -- 'pdf' | 'xlsx'
    file_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. API Endpoints (Phase 2)

### Farmer API (Kakao Auth Required)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/kakao` | Kakao OAuth callback → JWT |
| GET | `/api/v1/auth/me` | Get current farmer profile |
| POST | `/api/v1/voice/upload` | Upload voice recording |
| GET | `/api/v1/voice/[id]/status` | Check processing status |
| GET | `/api/v1/voice/[id]/result` | Get parsed result |
| GET | `/api/v1/farm-logs` | List farm log entries (date range filter) |
| POST | `/api/v1/farm-logs` | Create farm log (manual or from voice) |
| PUT | `/api/v1/farm-logs/[id]` | Update farm log entry |
| PUT | `/api/v1/farm-logs/[id]/confirm` | Confirm entry (draft → confirmed) |
| DELETE | `/api/v1/farm-logs/[id]` | Delete farm log entry |
| GET | `/api/v1/farm-logs/export` | Export 영농일지 PDF (date range) |
| GET | `/api/v1/fields` | List registered fields |
| POST | `/api/v1/fields` | Register new field |
| PUT | `/api/v1/fields/[id]` | Update field info |
| GET | `/api/v1/weather/current` | Get current weather for farm location |
| GET | `/api/v1/weather/history/[date]` | Get weather for specific date |

---

## 9. Farmer Mobile UI

### Dashboard (after Kakao login)
```
┌─────────────────────────────────┐
│  빈조농장                        │
│  안녕하세요, [닉네임]님 👋         │
│                                  │
│  ┌─────────────────────────────┐ │
│  │         🎤                   │ │
│  │    오늘 하루 기록하기          │ │
│  │   (탭해서 말하기)             │ │
│  └─────────────────────────────┘ │
│                                  │
│  오늘 날씨: 맑음 4°C             │
│  이번 주 기록: 3일 / 7일          │
│                                  │
│  ── 최근 기록 ──                  │
│  3/7 (금) 전정 작업, 3번 밭       │
│  3/6 (목) 비료 살포, 앞 과수원    │
│  3/5 (수) 전정 작업, 1번 밭       │
│                                  │
│  [전체 기록 보기] [영농일지 출력]   │
└─────────────────────────────────┘
```

### Voice Recording Screen
```
┌─────────────────────────────────┐
│  오늘 하루 기록                    │
│  2026년 3월 7일 (토)              │
│                                  │
│           🔴                     │
│        녹음 중...                 │
│        00:23                     │
│                                  │
│  "오늘 3번 밭에서 전정 작업..."    │
│  (실시간 텍스트 미리보기)           │
│                                  │
│  [⬜ 중지]    [⏸ 일시정지]        │
│                                  │
│  💡 팁: 작업한 밭, 내용, 사용한    │
│  농약/비료를 말해주세요.           │
└─────────────────────────────────┘
```

### Review & Confirm Screen
```
┌─────────────────────────────────┐
│  기록 확인                        │
│                                  │
│  📅 2026년 3월 7일               │
│  📍 3번 밭                       │
│                                  │
│  ── 작업 내용 ──                  │
│  ✂️ 전정 | 전정 작업              │
│  🧪 방제 | 석회유황합제 살포       │
│                                  │
│  ── 농약/비료 ──                  │
│  🧪 석회유황합제 200리터 사용      │
│                                  │
│  ── 날씨 ──                      │
│  🌤️ 맑음 -2°C (기상청 확인완료)   │
│                                  │
│  [필드 수정 가능 — 탭하면 편집]    │
│                                  │
│  [✓ 확인 저장]    [✎ 직접 수정]   │
└─────────────────────────────────┘
```

---

## 10. 영농일지 PDF Export

### Government-Compliant Format

The exported PDF must match the official 영농일지 양식 structure:

**Required fields per entry:**
- 작업일 (date)
- 필지 (field name/number)
- 작목 (crop — always "사과" for Binjo Farm)
- 농약/비료 사용내역 (chemical name, amount, purchased/used)

**Optional fields (but recommended):**
- 작업단계 (task stage)
- 세부작업내용 (task detail)
- 날씨 (weather)

### PDF Layout
```
┌──────────────────────────────────────┐
│              영 농 일 지               │
│                                      │
│  농장명: 빈조농장                      │
│  농장주: [이름]                        │
│  주소: 경남 사천시 ...                  │
│  기간: 2026.03.01 ~ 2026.03.31        │
│                                      │
│  ┌──────┬──────┬──────┬───────────┐   │
│  │작업일│필지  │작목  │농약/비료    │   │
│  │      │      │      │사용내역    │   │
│  ├──────┼──────┼──────┼───────────┤   │
│  │03.01 │3번밭 │사과  │석회유황합제 │   │
│  │      │      │      │200L 사용  │   │
│  ├──────┼──────┼──────┼───────────┤   │
│  │ ...  │ ...  │ ...  │ ...       │   │
│  └──────┴──────┴──────┴───────────┘   │
│                                      │
│  작성일: 2026.03.31                   │
│  작성자: [서명/이름]                   │
└──────────────────────────────────────┘
```

---

## 11. Task Alerts (Bonus Feature)

Based on the seasonal calendar data from Phase 1, push gentle reminders:

```
[카카오톡 알림]
🍎 빈조농장 알림
이번 주는 전정 마무리 시기입니다.
기상청 예보: 목요일 영하 5°C — 서리 주의

3일째 기록이 없어요. 오늘 하루 기록해볼까요?
[기록하기 →]
```

Implementation: Cron job checks calendar + weather + last log date → sends KakaoTalk Channel message.

---

## 12. Project Structure (Phase 2 Backend)

```
binjo-api/
├── app/
│   ├── main.py
│   ├── config.py                    # pydantic-settings
│   ├── dependencies.py
│   ├── api/v1/
│   │   ├── router.py
│   │   └── endpoints/
│   │       ├── auth.py              # Kakao OAuth
│   │       ├── voice.py             # Voice upload + status
│   │       ├── farm_logs.py         # Farm log CRUD
│   │       ├── fields.py            # Field management
│   │       ├── weather.py           # Weather proxy
│   │       └── export.py            # PDF export
│   ├── core/                        # CORE_CANDIDATE modules
│   │   ├── auth/
│   │   │   ├── kakao_auth.py        # Kakao OAuth client
│   │   │   └── jwt_handler.py       # JWT issue/verify
│   │   ├── ai/
│   │   │   ├── llm_provider.py      # Abstract LLM interface
│   │   │   ├── claude_provider.py   # Claude API implementation
│   │   │   └── openai_provider.py   # OpenAI fallback
│   │   ├── stt/
│   │   │   ├── whisper_api.py       # OpenAI Whisper API client
│   │   │   └── post_processor.py    # Korean agriculture term correction
│   │   ├── external_api/
│   │   │   ├── weather_kma.py       # 기상청 API client
│   │   │   └── public_data.py       # Generic data.go.kr client
│   │   ├── notification/
│   │   │   └── kakao_channel.py     # KakaoTalk Channel messaging
│   │   └── storage/
│   │       └── file_manager.py      # R2/S3 file operations
│   ├── modules/
│   │   └── farm_log/
│   │       ├── voice_pipeline.py    # Full voice → struct pipeline
│   │       ├── parser_prompt.py     # Claude parsing prompts
│   │       └── pdf_exporter.py      # 영농일지 PDF generation
│   ├── models/                      # SQLAlchemy models
│   │   ├── farmer.py
│   │   ├── field.py
│   │   ├── voice_recording.py
│   │   ├── farm_log.py
│   │   └── chemical_usage.py
│   ├── schemas/                     # Pydantic schemas
│   │   ├── auth.py
│   │   ├── voice.py
│   │   ├── farm_log.py
│   │   └── weather.py
│   └── services/
│       ├── voice_service.py
│       ├── farm_log_service.py
│       └── weather_service.py
├── workers/
│   ├── celery_app.py
│   └── tasks/
│       ├── process_voice.py         # Async voice processing
│       └── cleanup_audio.py         # Delete expired audio files
├── tests/
├── alembic/
├── docs/
│   └── spec.md                      # This file
├── pyproject.toml
└── Dockerfile
```

---

## 13. Implementation Tasks (Ordered)

### Sprint 1: FastAPI Foundation + Auth (Day 1-3)
- [ ] `chore:` Initialize FastAPI project with SQLAlchemy async + Alembic
- [ ] `feat:` Pydantic settings config (all env vars validated at startup)
- [ ] `feat:` `core/auth/kakao_auth.py` — Kakao OAuth flow
- [ ] `feat:` `core/auth/jwt_handler.py` — JWT issue/verify
- [ ] `feat:` Auth endpoints: `/api/v1/auth/kakao`, `/api/v1/auth/me`
- [ ] `feat:` Farmer + Field models + migrations
- [ ] `chore:` Connect to Phase 1's PostgreSQL database

### Sprint 2: Voice Processing Pipeline (Day 4-7)
- [ ] `feat:` `core/stt/whisper_api.py` — Whisper API client with Korean prompt priming
- [ ] `feat:` `core/stt/post_processor.py` — Agricultural term correction dictionary
- [ ] `feat:` `core/ai/llm_provider.py` — Abstract LLM interface (CORE_CANDIDATE)
- [ ] `feat:` `core/ai/claude_provider.py` — Claude API with structured output
- [ ] `feat:` `modules/farm_log/parser_prompt.py` — Korean agricultural parsing prompt
- [ ] `feat:` `modules/farm_log/voice_pipeline.py` — Full pipeline: upload → STT → parse → struct
- [ ] `feat:` Celery worker for async processing
- [ ] `feat:` Voice upload + status + result endpoints

### Sprint 3: Farm Log CRUD + Weather (Day 8-10)
- [ ] `feat:` Farm log CRUD endpoints (create, read, update, delete, confirm)
- [ ] `feat:` `core/external_api/weather_kma.py` — 기상청 API integration
- [ ] `feat:` Weather auto-fill on farm log creation
- [ ] `feat:` Field management endpoints (list, create, update)
- [ ] `feat:` Chemical usage tracking linked to farm logs

### Sprint 4: Farmer Mobile UI (Day 11-14)
- [ ] `feat:` Kakao Login button on farmer dashboard (Next.js)
- [ ] `feat:` Voice recording UI (MediaRecorder API + big red button)
- [ ] `feat:` Processing status indicator (uploading → processing → done)
- [ ] `feat:` Review & confirm card UI
- [ ] `feat:` Farm log history list with date filter
- [ ] `feat:` Field editor for quick editing parsed results

### Sprint 5: PDF Export + Polish (Day 15-17)
- [ ] `feat:` `modules/farm_log/pdf_exporter.py` — 영농일지 PDF in government format
- [ ] `feat:` Export endpoint with date range filter
- [ ] `feat:` Download PDF from farmer UI
- [ ] `fix:` Voice processing error handling + retry logic
- [ ] `fix:` Edge cases: empty audio, too-short recording, background noise
- [ ] `chore:` Audio file cleanup cron job (delete after 30 days)

### Sprint 6 (Bonus): Task Alerts (Day 18-19)
- [ ] `feat:` `core/notification/kakao_channel.py` — KakaoTalk Channel messaging
- [ ] `feat:` Cron job: seasonal calendar + weather → alert logic
- [ ] `feat:` "You haven't logged in X days" nudge

---

## 14. Environment Variables (Phase 2 Additions)

```bash
# OpenAI (Whisper + fallback LLM)
OPENAI_API_KEY=sk-...

# Anthropic (Primary LLM)
ANTHROPIC_API_KEY=sk-ant-...

# Kakao OAuth
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
KAKAO_REDIRECT_URI=https://binjo.farm/api/v1/auth/kakao/callback

# Korean Public APIs (data.go.kr)
KMA_API_KEY=...                      # 기상청 단기예보
NCPMS_API_KEY=...                    # 병해충 정보 (Phase 2 bonus)

# Redis (Celery)
REDIS_URL=redis://...

# Existing from Phase 1
DATABASE_URL=...
# Supabase (inherited from Phase 1)
# DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# KakaoTalk Channel (alerts)
KAKAO_CHANNEL_ADMIN_KEY=...
```

---

## 15. Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Whisper Korean accuracy on dialect | Wrong transcription | Prompt priming + Claude correction + farmer review |
| Agricultural terms not recognized | Missing chemical names | Custom correction dictionary + Claude's knowledge |
| Audio quality from field (wind, noise) | STT failure | Whisper is noise-robust; show "try again" for low-confidence |
| Farmer forgets to record daily | Incomplete 영농일지 | KakaoTalk nudge after 2 days of no recording |
| Privacy: voice data | Farmer trust | Auto-delete audio after 30 days; only text stored permanently |

---

## 16. Success Criteria (Ship When)

- [ ] Farmer can record voice, see structured result in < 30 seconds
- [ ] AI parsing accuracy ≥ 85% (farmer confirms without editing)
- [ ] 영농일지 PDF exports in government-compliant format
- [ ] Kakao Login works on farmer's actual phone
- [ ] Voice recording works in KakaoTalk in-app browser
- [ ] Weather auto-fill matches farmer's location
- [ ] At least 7 consecutive days of test entries successfully processed

---

## 17. What Phase 2 Does NOT Include

- ❌ Photo-based disease detection (Phase 4)
- ❌ NH오늘농사 data sync (Phase 3)
- ❌ Automated bookkeeping/ledger (Phase 3)
- ❌ Multi-farm support (future)
- ❌ Real-time streaming transcription (nice-to-have, not MVP)
