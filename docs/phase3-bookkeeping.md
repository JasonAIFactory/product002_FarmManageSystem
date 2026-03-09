# BINJO Phase 3: Automated Bookkeeping — Implementation Spec

> This document is the **single source of truth** for Phase 3 implementation.
> Prerequisite: Phase 2 (Voice Farm Management) must be operational.

---

## 1. What We're Building

An **automated farm financial management system** that captures purchases and sales, categorizes them intelligently, and generates monthly P&L statements — so the farmer never has to manually track money in a notebook again.

**One sentence**: Every receipt, purchase, and sale gets captured automatically or with one photo → AI categorizes → monthly profit/loss report generated.

**The Glove Test**: Farmer buys fertilizer at the NH co-op, takes a photo of the receipt, done. Everything else is automatic.

---

## 2. Why Phase 3 Now

Phase 1 = revenue channel. Phase 2 = farm diary. Phase 3 completes the trifecta: **money management.**

The farmer currently:
- Has NH오늘농사 which tracks some purchases, but doesn't synthesize into P&L
- Keeps a mental model of expenses (dangerous for tax/subsidy filing)
- Can't easily answer "얼마 벌었어?" (How much did I make?) for any given period
- Needs financial records for 종합소득세 filing and 공익직불금 compliance

---

## 3. Data Sources (3 Input Channels)

### Channel 1: Receipt Photo → OCR → Structured Data
```
Farmer buys supplies → takes photo of receipt → uploads → AI extracts:
- Date
- Store name
- Items + quantities + prices
- Total amount
- Category (auto: 농약, 비료, 자재, 인건비, 기타)
```

### Channel 2: NH오늘농사 Manual Sync (Workaround)
NH오늘농사 has no public API. Workaround strategy:

**Option A (Primary): Screenshot OCR**
- Farmer screenshots NH오늘농사 purchase/settlement screens
- Upload screenshots → OCR → extract transaction data
- AI matches against known NH transaction patterns

**Option B (Fallback): Manual Voice Entry**
- "오늘 농협에서 석회유황합제 3통 사왔어, 12만원"
- Uses Phase 2 voice pipeline → financial entry instead of farm log

**Option C (Future): NH오늘농사 Screen Scraping**
- If farmer grants permission, periodically scrape NH오늘농사 web version
- HIGH RISK: depends on NH's web interface stability. Implement last.

### Channel 3: Sales Recording
```
Direct sales (KakaoTalk orders from Phase 1):
- Admin marks order as "배송완료" → sale recorded
- Amount, customer, product, channel (kakao/naver/offline)

Naver SmartStore:
- Manual entry for now (Phase 4 for API sync)

Offline/wholesale:
- Voice entry: "오늘 경매장에서 부사 200상자 납품, 상자당 2만원"
```

---

## 4. Tech Stack (Phase 3 Additions)

| Layer | Choice | Reason |
|---|---|---|
| OCR | **Claude Vision API** (primary), **Naver Clova OCR** (fallback) | Claude handles Korean receipts well; Clova as Korean-specialized fallback |
| PDF Reports | **WeasyPrint** | HTML → PDF for financial reports |
| Chart Generation | **Matplotlib** (server-side) | Simple charts for P&L reports |
| Scheduled Jobs | **Celery Beat** | Monthly report generation, reminders |

No new infrastructure — reuses Phase 2's FastAPI + Celery + PostgreSQL + R2.

---

## 5. Financial Data Model

### Core Concept: Every money movement is a `Transaction`

```
Transaction Types:
├── EXPENSE (지출)
│   ├── 농약 (Pesticides)
│   ├── 비료 (Fertilizer)
│   ├── 자재 (Materials/Equipment)
│   ├── 인건비 (Labor)
│   ├── 연료비 (Fuel)
│   ├── 포장비 (Packaging)
│   ├── 운송비 (Shipping)
│   ├── 기타지출 (Other expenses)
│   └── 시설투자 (Capital investment — tracked separately)
│
└── INCOME (수입)
    ├── 직거래 (Direct sales — KakaoTalk, phone)
    ├── 스마트스토어 (Naver SmartStore)
    ├── 도매/경매 (Wholesale/auction)
    ├── 보조금 (Government subsidies)
    └── 기타수입 (Other income)
```

---

## 6. Database Schema (Phase 3 Additions)

```sql
-- Financial transactions (central ledger)
CREATE TABLE transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    farmer_id UUID REFERENCES farmer(id),
    
    -- Core fields
    type VARCHAR(10) NOT NULL,               -- 'income' | 'expense'
    category VARCHAR(50) NOT NULL,           -- '농약', '비료', '직거래', etc.
    amount DECIMAL(12, 0) NOT NULL,          -- Korean won (no decimals)
    
    -- Details
    description TEXT,                        -- '석회유황합제 3통'
    counterparty VARCHAR(200),               -- Store/customer name
    transaction_date DATE NOT NULL,
    
    -- Source tracking
    source VARCHAR(20) NOT NULL,             -- 'receipt_photo', 'voice', 'nh_screenshot', 'order', 'manual'
    source_id UUID,                          -- Link to voice_recording, receipt_scan, order_inquiry, etc.
    
    -- Linkage to farm operations
    farm_log_id UUID REFERENCES farm_log(id),  -- Optional: link expense to work day
    product_id UUID REFERENCES product(id),    -- Optional: link sale to product
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',    -- 'pending' | 'confirmed' | 'exported'
    confidence DECIMAL(3, 2),                -- AI parsing confidence 0.00-1.00
    
    -- Metadata
    receipt_image_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipt scans
CREATE TABLE receipt_scan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID REFERENCES farmer(id),
    image_url VARCHAR(500) NOT NULL,
    
    -- OCR results
    raw_ocr_text TEXT,
    parsed_data JSONB,                       -- Structured extraction result
    status VARCHAR(20) DEFAULT 'uploaded',   -- 'uploaded' | 'processing' | 'completed' | 'failed'
    
    -- Generated transactions
    transaction_ids UUID[],                  -- Transactions created from this receipt
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Monthly financial reports (cached)
CREATE TABLE monthly_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    year INT NOT NULL,
    month INT NOT NULL,
    
    -- Summary data (cached for fast access)
    total_income DECIMAL(12, 0) DEFAULT 0,
    total_expense DECIMAL(12, 0) DEFAULT 0,
    net_profit DECIMAL(12, 0) DEFAULT 0,
    
    -- Breakdown by category (JSONB)
    income_by_category JSONB,               -- {"직거래": 500000, "스마트스토어": 300000, ...}
    expense_by_category JSONB,              -- {"농약": 120000, "비료": 80000, ...}
    
    -- Report file
    report_pdf_url VARCHAR(500),
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft',     -- 'draft' | 'finalized'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(farm_id, year, month)
);

-- Sales orders (upgraded from Phase 1 inquiry tracking)
CREATE TABLE sales_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    
    -- Customer
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    customer_address TEXT,
    
    -- Order details
    channel VARCHAR(20) NOT NULL,            -- 'kakao', 'phone', 'naver', 'wholesale', 'offline'
    product_id UUID REFERENCES product(id),
    product_name VARCHAR(100),               -- Denormalized for flexibility
    quantity INT DEFAULT 1,
    weight_option VARCHAR(50),               -- '5kg', '10kg'
    unit_price DECIMAL(10, 0),
    total_amount DECIMAL(12, 0),
    
    -- Status
    status VARCHAR(20) DEFAULT 'inquiry',   -- 'inquiry' | 'confirmed' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
    
    -- Shipping
    tracking_number VARCHAR(100),
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Link to financial
    transaction_id UUID REFERENCES transaction(id),
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Receipt OCR Pipeline

### Step 1: Photo Upload
```python
# Accept image from farmer's phone camera
# Supported formats: JPEG, PNG, HEIC (convert HEIC → JPEG server-side)
# Max file size: 10MB
# Store original in R2
```

### Step 2: Claude Vision OCR + Parsing

**System Prompt:**
```
너는 한국 농업 영수증/거래명세서를 분석하는 AI야.
사진에서 다음 정보를 추출해:

## 추출 필드
- store_name: 상호명
- store_type: "농협" | "농자재상" | "마트" | "온라인" | "기타"
- date: 거래일 (YYYY-MM-DD)
- items: 품목 리스트
  - name: 상품명
  - quantity: 수량
  - unit_price: 단가
  - total_price: 합계
  - category: "농약" | "비료" | "자재" | "연료" | "포장" | "기타"
- total_amount: 총 금액
- payment_method: "현금" | "카드" | "계좌이체" | "외상"

## 주의사항
- 한국 농협(NH) 영수증 형식에 익숙할 것
- 농자재 제품명은 정확히 (예: "석회유황합제", "쏘크린유제" 등)
- 금액의 천원 단위 콤마 주의
- 읽기 어려운 부분은 confidence 점수 낮게
- 여러 품목이 있으면 각각 분리
```

### Step 3: Transaction Generation
```python
# For each item in parsed receipt:
# 1. Create Transaction(type='expense', category=auto-assigned)
# 2. Link to receipt_scan
# 3. Set confidence score
# 4. If confidence < 0.8, mark status='pending' for farmer review
# 5. If confidence >= 0.8, mark status='confirmed' (auto-approve)
```

---

## 8. API Endpoints (Phase 3)

### Financial API (Auth Required)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/receipts/upload` | Upload receipt photo |
| GET | `/api/v1/receipts/[id]/status` | Check OCR processing status |
| GET | `/api/v1/receipts/[id]/result` | Get parsed receipt data |
| GET | `/api/v1/transactions` | List transactions (date/type/category filter) |
| POST | `/api/v1/transactions` | Create manual transaction |
| PUT | `/api/v1/transactions/[id]` | Update transaction |
| PUT | `/api/v1/transactions/[id]/confirm` | Confirm pending transaction |
| DELETE | `/api/v1/transactions/[id]` | Delete transaction |
| GET | `/api/v1/reports/monthly` | Get monthly summary (year, month params) |
| GET | `/api/v1/reports/monthly/pdf` | Download monthly P&L PDF |
| GET | `/api/v1/reports/yearly` | Get yearly summary |
| GET | `/api/v1/reports/dashboard` | Financial dashboard data (current month + trend) |

### Sales Order API (Admin)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/orders` | List all orders (status filter) |
| POST | `/api/v1/orders` | Create order (from KakaoTalk inquiry) |
| PUT | `/api/v1/orders/[id]` | Update order (status, tracking, etc.) |
| PUT | `/api/v1/orders/[id]/ship` | Mark as shipped → auto-create income transaction |
| PUT | `/api/v1/orders/[id]/deliver` | Mark as delivered |

---

## 9. Farmer Financial UI

### Financial Dashboard
```
┌─────────────────────────────────┐
│  💰 이번 달 현황 (3월)            │
│                                  │
│  수입    1,250,000원  ↑          │
│  지출      380,000원  ↓          │
│  ───────────────────             │
│  순이익    870,000원  😊          │
│                                  │
│  [간단 막대 차트: 최근 6개월]      │
│                                  │
│  ── 최근 거래 ──                  │
│  3/7  지출  농협  석회유황합제     │
│            -120,000원            │
│  3/5  수입  카톡주문  부사 5kg    │
│            +35,000원             │
│  3/3  지출  농자재상  전정가위     │
│            -45,000원             │
│                                  │
│  [📷 영수증 촬영]  [🎤 음성 입력]  │
│  [📊 월간 리포트]  [전체 내역]     │
└─────────────────────────────────┘
```

### Receipt Capture Flow
```
[📷 탭] → 카메라 실행 → 촬영 → 업로드 중... → 

결과:
┌─────────────────────────────────┐
│  영수증 인식 결과                  │
│                                  │
│  🏪 사천농협                      │
│  📅 2026.03.07                   │
│                                  │
│  석회유황합제 3통    120,000원     │
│  [카테고리: 농약] ← 탭해서 변경    │
│                                  │
│  합계: 120,000원                  │
│                                  │
│  [✓ 맞아요]    [✎ 수정할게요]     │
└─────────────────────────────────┘
```

---

## 10. Monthly P&L Report (PDF)

```
┌──────────────────────────────────────┐
│       빈조농장 월간 경영 리포트         │
│       2026년 3월                      │
│                                      │
│  ■ 요약                              │
│  총 수입: 1,250,000원                 │
│  총 지출:   380,000원                 │
│  순 이익:   870,000원                 │
│                                      │
│  ■ 수입 내역                          │
│  직거래 (카톡)     850,000원  (68%)   │
│  스마트스토어       300,000원  (24%)   │
│  도매/경매         100,000원  ( 8%)   │
│                                      │
│  ■ 지출 내역                          │
│  농약              120,000원  (32%)   │
│  비료               80,000원  (21%)   │
│  자재               95,000원  (25%)   │
│  인건비             50,000원  (13%)   │
│  기타               35,000원  ( 9%)   │
│                                      │
│  ■ 전월 대비                          │
│  수입: +15.2% ↑                      │
│  지출: -8.3% ↓                       │
│                                      │
│  [6개월 추이 차트]                     │
│  ╔═══════════════════════╗           │
│  ║  📊 bar chart here    ║           │
│  ╚═══════════════════════╝           │
│                                      │
│  작성일: 2026.04.01                   │
│  빈조농장 경영관리시스템               │
└──────────────────────────────────────┘
```

---

## 11. Implementation Tasks (Ordered)

### Sprint 1: Financial Data Model + CRUD (Day 1-3)
- [ ] `feat:` Transaction, ReceiptScan, MonthlyReport, SalesOrder models + migrations
- [ ] `feat:` Transaction CRUD endpoints
- [ ] `feat:` Manual transaction creation (voice + form)
- [ ] `feat:` Sales order management endpoints (upgrade from Phase 1 inquiry)

### Sprint 2: Receipt OCR Pipeline (Day 4-7)
- [ ] `feat:` Receipt photo upload endpoint
- [ ] `feat:` Claude Vision OCR integration for Korean receipts
- [ ] `feat:` Auto-categorization logic (AI + rule-based hybrid)
- [ ] `feat:` Transaction auto-generation from receipt data
- [ ] `feat:` Confidence-based auto-confirm vs pending-review flow
- [ ] `feat:` NH오늘농사 screenshot OCR (same pipeline, different prompt)

### Sprint 3: Financial Dashboard UI (Day 8-10)
- [ ] `feat:` Financial dashboard page (current month summary + trend)
- [ ] `feat:` Receipt photo capture UI (camera → upload → review)
- [ ] `feat:` Transaction list with filters (date, type, category)
- [ ] `feat:` Transaction edit/confirm UI for pending items
- [ ] `feat:` Simple bar chart for monthly trend (Recharts in Next.js)

### Sprint 4: Reports + Sales Order Flow (Day 11-14)
- [ ] `feat:` Monthly report generation logic (aggregate transactions)
- [ ] `feat:` Monthly P&L PDF generation (WeasyPrint)
- [ ] `feat:` Sales order flow: inquiry → confirmed → shipped → delivered
- [ ] `feat:` Auto-create income transaction when order marked as delivered
- [ ] `feat:` Yearly summary endpoint

### Sprint 5: Automation + Polish (Day 15-17)
- [ ] `feat:` Celery Beat: auto-generate monthly report on 1st of each month
- [ ] `feat:` KakaoTalk notification: "이번 달 리포트 준비됐어요"
- [ ] `feat:` Link expenses to farm log entries (optional association)
- [ ] `fix:` Edge cases: duplicate receipts, cancelled orders, refunds
- [ ] `fix:` Financial data export for 종합소득세 preparation

---

## 12. Environment Variables (Phase 3 Additions)

```bash
# Naver Clova OCR (fallback)
CLOVA_OCR_SECRET=...
CLOVA_OCR_API_URL=...

# All other env vars inherited from Phase 1 + Phase 2
```

Minimal new infrastructure — leverages existing Claude API, Celery, R2, PostgreSQL.

---

## 13. Success Criteria (Ship When)

- [ ] Receipt photo → parsed transaction in < 15 seconds
- [ ] OCR accuracy ≥ 80% on Korean agricultural receipts
- [ ] Monthly P&L PDF generates correctly with all transaction data
- [ ] Sales orders track from inquiry to delivery with financial recording
- [ ] Financial dashboard shows current month summary on farmer's phone
- [ ] At least 1 full month of test data processed end-to-end

---

## 14. What Phase 3 Does NOT Include

- ❌ Direct NH오늘농사 API integration (no public API exists)
- ❌ Bank account sync (complex, regulated)
- ❌ Tax filing automation (consult accountant)
- ❌ Naver SmartStore API order sync (Phase 4)
- ❌ Multi-year financial analytics (Phase 4)
- ❌ Inventory management (future consideration)
