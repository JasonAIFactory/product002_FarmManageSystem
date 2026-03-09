# BINJO Phase 4: Direct Orders & Data Intelligence — Implementation Spec

> This document is the **single source of truth** for Phase 4 implementation.
> Prerequisite: Phases 1-3 must be operational.

---

## 1. What We're Building

Two parallel upgrades that transform BINJO from a tool into a **business engine**:

**A) Direct Order System** — Customers order and pay directly on the brand page. No more KakaoTalk back-and-forth for every sale. Farmer gets notifications, confirms, ships.

**B) Data Intelligence** — 3 phases of accumulated data (farm logs, weather, finances, sales) become **actionable insights**: yield predictions, optimal pricing, crop health patterns, and customer analytics.

**One sentence**: Customers can buy apples directly with one click, and the farmer gets AI-powered business intelligence from all the data we've been collecting.

---

## 2. Why Phase 4 Now

Phases 1-3 built the foundation:
- Phase 1: Brand page drives traffic
- Phase 2: Farm diary captures operations
- Phase 3: Financial tracking captures money flow

Phase 4 **closes the loop**:
- Direct payments = no more manual order management
- Data intelligence = farm decisions backed by evidence, not guesswork

---

## PART A: Direct Order System

---

## A.1. Order Flow

### Customer Journey (on brand page)
```
Visit brand page → Browse products → Select "부사 5kg" →
  → Choose quantity → Fill shipping info → 
  → Pay (토스페이먼츠) → Order confirmed →
  → Farmer gets KakaoTalk notification →
  → Farmer ships → Customer gets tracking
```

### Key Design Decision: Simple Cart, Not Full E-commerce
- **No user accounts** for customers (guest checkout only)
- **No complex cart** (buy one product type at a time)
- **No coupon/discount system** (keep it simple)
- **No inventory management** (farmer controls availability toggle)
- Phone number = order identifier (same as KakaoTalk direct sales)

---

## A.2. Payment Integration

### 토스페이먼츠 (TossPayments)

| Feature | Detail |
|---|---|
| Provider | 토스페이먼츠 (Korean market standard) |
| Methods | 카드결제, 계좌이체, 가상계좌, 카카오페이, 네이버페이 |
| Settlement | T+1 (다음 영업일 정산) |
| Fee | ~3.2% (카드), ~1.5% (계좌이체) |
| Integration | TossPayments SDK (JavaScript + server-side confirm) |

### Payment Flow
```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Customer   │     │  Toss SDK   │     │  Our Server │
│  clicks Pay │────▶│  Payment    │────▶│  Confirm    │
│             │     │  Widget     │     │  & Record   │
└────────────┘     └────────────┘     └────────────┘
                                           │
                                    ┌──────┴───────┐
                                    │ Create Order  │
                                    │ + Transaction │
                                    │ + Notify      │
                                    └──────────────┘
```

```python
# Server-side payment confirmation
# POST /api/v1/payments/confirm
# 1. Receive paymentKey, orderId, amount from Toss SDK
# 2. Verify with Toss API (server-to-server)
# 3. Create sales_order (status='paid')
# 4. Create transaction (type='income')
# 5. Send KakaoTalk notification to farmer
# 6. Send order confirmation to customer (SMS or KakaoTalk)
```

---

## A.3. Database Schema (Phase 4A Additions)

```sql
-- Payment records
CREATE TABLE payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES sales_order(id),
    
    -- TossPayments fields
    toss_payment_key VARCHAR(200) UNIQUE,
    toss_order_id VARCHAR(100) UNIQUE,       -- Our generated order ID
    method VARCHAR(50),                      -- 'CARD', 'TRANSFER', 'VIRTUAL_ACCOUNT', etc.
    
    -- Amounts
    amount DECIMAL(12, 0) NOT NULL,
    fee DECIMAL(10, 0),                      -- Payment gateway fee
    net_amount DECIMAL(12, 0),               -- amount - fee
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',    -- 'pending' | 'confirmed' | 'cancelled' | 'refunded'
    
    -- Details
    card_company VARCHAR(50),
    card_number_masked VARCHAR(20),
    receipt_url VARCHAR(500),                -- Toss receipt URL
    
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipping info (for paid orders)
CREATE TABLE shipping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES sales_order(id),
    
    recipient_name VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    postal_code VARCHAR(10),
    address TEXT NOT NULL,
    address_detail VARCHAR(200),
    
    -- Delivery
    carrier VARCHAR(50),                     -- '우체국', 'CJ대한통운', '한진' etc.
    tracking_number VARCHAR(100),
    
    -- Special instructions
    delivery_message TEXT,                   -- '부재시 문 앞에 놔주세요'
    
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer management (lightweight, no accounts)
CREATE TABLE customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    phone VARCHAR(20) NOT NULL,              -- Primary identifier
    name VARCHAR(100),
    address TEXT,                            -- Last used address
    
    -- Analytics
    total_orders INT DEFAULT 0,
    total_spent DECIMAL(12, 0) DEFAULT 0,
    first_order_at TIMESTAMPTZ,
    last_order_at TIMESTAMPTZ,
    
    -- Preferences
    preferred_products TEXT[],               -- ['부사', '시나노골드']
    notes TEXT,                              -- Farmer's notes about this customer
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(farm_id, phone)
);
```

---

## A.4. API Endpoints (Phase 4A)

### Public Order API (No Auth)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/orders/create` | Create order (pre-payment) |
| POST | `/api/v1/payments/confirm` | Confirm payment (Toss callback) |
| GET | `/api/v1/orders/[id]/status` | Check order status (by order ID) |
| POST | `/api/v1/payments/webhook` | TossPayments webhook receiver |

### Admin Order Management API

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/orders` | List all orders (status/date filter) |
| PUT | `/api/admin/orders/[id]/confirm` | Confirm order for shipping |
| PUT | `/api/admin/orders/[id]/ship` | Mark shipped (with tracking) |
| PUT | `/api/admin/orders/[id]/cancel` | Cancel order + trigger refund |
| GET | `/api/admin/customers` | Customer list with analytics |
| GET | `/api/admin/customers/[id]` | Customer detail + order history |

---

## A.5. Order Notification Flow

```
Payment confirmed →
  1. Customer: SMS "주문이 완료되었습니다. 주문번호: BJ20260307001"
  2. Farmer: KakaoTalk "🍎 새 주문! 부사 5kg, 김○○님, 서울시 강남구"
  
Order shipped →
  1. Customer: SMS "상품이 발송되었습니다. 송장번호: 12345678"
  2. Auto-create income transaction in Phase 3 ledger

3 days after delivery →
  1. Customer: SMS "빈조농장 사과는 맛있으셨나요? 후기를 남겨주세요 → [링크]"
```

---

## PART B: Data Intelligence

---

## B.1. What Data We Have (by Phase 4)

| Data Source | Since | Volume (est. 1 year) |
|---|---|---|
| Farm logs | Phase 2 | ~200 daily entries |
| Weather history | Phase 2 | Daily weather for 365 days |
| Chemical usage | Phase 2 | ~50 applications/year |
| Financial transactions | Phase 3 | ~300 transactions/year |
| Sales orders | Phase 1+4 | ~100 orders/year |
| Customer data | Phase 4 | ~60 unique customers |
| Seasonal calendar | Phase 1 | 12 months × activities |

### The Insight Opportunity
All this data exists in silos right now. Phase 4B connects the dots:

```
Farm Log (labor) + Chemical Usage + Weather → Yield Pattern Analysis
Sales + Customer Data → Customer Lifetime Value + Repeat Rate
Expenses + Income by Channel → Channel Profitability
Weather + Historical Sales → Demand Forecasting
```

---

## B.2. Intelligence Features (Prioritized)

### Feature 1: Yearly Farm Report (AI-Generated)

**What**: An annual comprehensive report synthesizing all farm data with AI narrative.

```
2026 빈조농장 연간 리포트

📊 경영 요약
총 수입: 32,500,000원 (전년 대비 +12%)
총 지출: 14,200,000원 (전년 대비 -5%)
순이익: 18,300,000원

🍎 생산 현황
총 작업일수: 245일
주요 품종별 출하량: 부사 1,200상자, 홍로 400상자, 시나노골드 200상자

💊 투입 분석
농약 사용: 18회 (전년 20회 — 감소 추세 👍)
비료 투입: 총 2,400kg

🌤️ 기상 분석
올해 특이사항: 5월 이상 저온으로 꽃샘추위 피해 경미
수확기(9-11월) 날씨 양호, 평년 대비 일조량 +8%

👥 판매 분석
채널별: 직거래 58%, 스마트스토어 25%, 도매 17%
고객 재구매율: 42%
평균 주문 금액: 47,000원

🔮 AI 제안
1. 시나노골드 수요 증가 추세 — 내년 재배 면적 확대 고려
2. 도매 비중 감소, 직거래 마진 2.3배 → 직거래 채널 강화 추천
3. 5월 서리 대비 방상팬 투자 ROI 분석: 2년 내 회수 가능
```

**Implementation**: Claude API with full year's data as context → structured analysis → PDF report.

### Feature 2: Customer Analytics Dashboard

```
┌─────────────────────────────────┐
│  👥 고객 분석                     │
│                                  │
│  총 고객: 62명                    │
│  올해 신규: 28명                  │
│  재구매 고객: 26명 (42%)          │
│  VIP (3회+): 8명                 │
│                                  │
│  채널별 고객                      │
│  카톡 직거래: 35명                │
│  스마트스토어: 22명               │
│  전화: 5명                       │
│                                  │
│  🏆 상위 고객                     │
│  1. 김○○ (서울) — 5회, 285,000원 │
│  2. 박○○ (부산) — 4회, 220,000원 │
│  3. 이○○ (대구) — 3회, 180,000원 │
│                                  │
│  💡 AI 인사이트                    │
│  "작년 추석 주문 고객 중 12명이    │
│   올해 아직 주문하지 않았습니다.    │
│   연락해보시는 건 어떨까요?"       │
└─────────────────────────────────┘
```

### Feature 3: Seasonal Sales Prediction

```python
# Using historical data:
# - Last year's same-month sales
# - Current year's farm log (crop condition)
# - Weather forecast (기상청 중기예보)
# - Customer order patterns

# Output:
# "9월 홍로 예상 주문량: 80-100상자 (작년 대비 +15%)"
# "사전 주문 안내를 8월 셋째 주에 보내는 것을 추천합니다"
```

### Feature 4: Expense Optimization Insights

```
💡 비용 절감 제안

1. 석회유황합제를 농협 공동구매로 구입하면
   연간 약 180,000원 절감 가능 (현재 개별 구매)

2. 올해 비료비가 전년 대비 23% 증가
   → 토양검사 기반 맞춤 시비로 15% 절감 가능

3. 포장비 월 평균 85,000원
   → 50상자 이상 구매 시 상자당 200원 할인 업체 정보
```

---

## B.3. Technical Implementation

### AI Report Generation
```python
# modules/intelligence/yearly_report.py

async def generate_yearly_report(farm_id: UUID, year: int) -> Report:
    """Generate AI-powered yearly farm report."""
    
    # 1. Gather all data
    farm_logs = await get_farm_logs(farm_id, year)
    transactions = await get_transactions(farm_id, year)
    weather_data = await get_weather_history(farm_id, year)
    orders = await get_orders(farm_id, year)
    customers = await get_customers(farm_id)
    
    # 2. Pre-compute statistics (deterministic)
    stats = compute_yearly_stats(farm_logs, transactions, orders, customers)
    
    # 3. AI narrative + insights (judgment)
    prompt = build_yearly_report_prompt(stats, weather_data)
    narrative = await llm_provider.generate(prompt)
    
    # 4. Generate PDF
    pdf_url = await generate_report_pdf(stats, narrative)
    
    return Report(stats=stats, narrative=narrative, pdf_url=pdf_url)
```

### Data Aggregation Queries
```python
# Pre-computed aggregations stored as materialized views or cached tables
# Updated nightly via Celery Beat

# Monthly sales by channel
# Monthly expenses by category
# Customer purchase frequency
# Weather correlation with farm activities
# Chemical usage trends
```

---

## B.4. Naver SmartStore Integration (Optional)

If achievable within Phase 4 timeline:

```python
# Naver Commerce API
# - Order sync: Pull new orders from SmartStore
# - Status sync: Push shipping info back
# - Sales data: Pull for financial reconciliation
#
# Requires: Naver Commerce Partner Center registration
# API docs: https://apicenter.commerce.naver.com/
```

This would unify all sales channels into one dashboard.

---

## 3. Database Schema (Phase 4B — Intelligence)

```sql
-- Cached analytics snapshots (refreshed nightly)
CREATE TABLE analytics_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    snapshot_date DATE NOT NULL,
    type VARCHAR(50) NOT NULL,               -- 'daily_summary', 'customer_stats', 'channel_stats'
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(farm_id, snapshot_date, type)
);

-- AI-generated insights (stored for review)
CREATE TABLE ai_insight (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    type VARCHAR(50) NOT NULL,               -- 'cost_saving', 'sales_prediction', 'customer_alert', 'yearly_report'
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    data JSONB,                              -- Supporting data
    priority VARCHAR(10) DEFAULT 'normal',   -- 'high', 'normal', 'low'
    status VARCHAR(20) DEFAULT 'new',        -- 'new', 'read', 'actioned', 'dismissed'
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
```

---

## 4. Implementation Tasks (Ordered)

### Part A: Direct Orders

#### Sprint 1: Payment Integration (Day 1-4)
- [ ] `feat:` TossPayments account setup + API key configuration
- [ ] `feat:` `core/payment/toss_provider.py` — CORE_CANDIDATE payment client
- [ ] `feat:` Payment model + migration
- [ ] `feat:` Order creation → Toss payment widget → server confirmation flow
- [ ] `feat:` Webhook handler for async payment events
- [ ] `feat:` Refund handling

#### Sprint 2: Order UI + Checkout (Day 5-8)
- [ ] `feat:` Brand page product cards → "바로 주문" button
- [ ] `feat:` Checkout page: shipping form + payment widget
- [ ] `feat:` Order confirmation page (order number + details)
- [ ] `feat:` Guest order status lookup (by phone + order number)
- [ ] `feat:` Customer model + auto-populate returning customer info

#### Sprint 3: Admin Order Management (Day 9-11)
- [ ] `feat:` Admin order dashboard (new/confirmed/shipped/delivered)
- [ ] `feat:` Ship order flow: enter carrier + tracking → notify customer
- [ ] `feat:` Auto-create income transaction on delivery
- [ ] `feat:` KakaoTalk notification to farmer on new order
- [ ] `feat:` SMS notification to customer (order confirmed, shipped)

### Part B: Data Intelligence

#### Sprint 4: Analytics Foundation (Day 12-14)
- [ ] `feat:` Nightly aggregation jobs (Celery Beat)
- [ ] `feat:` Monthly/yearly statistics computation
- [ ] `feat:` Customer analytics (LTV, frequency, channel distribution)
- [ ] `feat:` Analytics snapshot caching

#### Sprint 5: AI Insights + Reports (Day 15-18)
- [ ] `feat:` Yearly farm report generator (Claude + data)
- [ ] `feat:` Customer re-engagement alerts
- [ ] `feat:` Sales prediction (based on historical patterns)
- [ ] `feat:` Expense optimization suggestions
- [ ] `feat:` Intelligence dashboard UI in farmer app

#### Sprint 6: Polish + Naver (Day 19-21)
- [ ] `feat:` Naver SmartStore API integration (if feasible)
- [ ] `fix:` End-to-end order flow testing
- [ ] `fix:` Financial reconciliation (orders ↔ payments ↔ transactions)
- [ ] `fix:` Performance optimization for analytics queries
- [ ] `chore:` Full system integration test (Phase 1-4 working together)

---

## 5. Environment Variables (Phase 4 Additions)

```bash
# TossPayments
TOSS_CLIENT_KEY=...                  # For frontend SDK
TOSS_SECRET_KEY=...                  # For server-side confirmation
TOSS_WEBHOOK_SECRET=...              # For webhook verification

# SMS (for customer notifications)
SOLAPI_API_KEY=...                   # 솔라피 or similar Korean SMS provider
SOLAPI_API_SECRET=...
SOLAPI_SENDER_PHONE=...

# Naver Commerce (optional)
NAVER_COMMERCE_CLIENT_ID=...
NAVER_COMMERCE_CLIENT_SECRET=...

# All other env vars inherited from Phase 1-3
```

---

## 6. Success Criteria (Ship When)

### Part A: Direct Orders
- [ ] Customer can browse → order → pay → receive confirmation in < 3 minutes
- [ ] Payment processing works for 카드결제 + 계좌이체 + 카카오페이
- [ ] Farmer receives KakaoTalk notification within 30 seconds of order
- [ ] Order tracking works for customer (SMS + status page)
- [ ] Refund process works end-to-end
- [ ] Income auto-recorded in financial system (Phase 3 integration)

### Part B: Data Intelligence
- [ ] Yearly report generates with meaningful AI insights
- [ ] Customer analytics dashboard shows top customers + re-engagement alerts
- [ ] Monthly P&L includes direct order revenue automatically
- [ ] At least 3 actionable AI insights generated from test data

---

## 7. The Full Picture (Phase 1-4 Complete)

When Phase 4 ships, BINJO is a **complete farm business platform**:

```
┌─────────────────────────────────────────────────────────┐
│                    BINJO PLATFORM                        │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │ Phase 1  │  │ Phase 2  │  │ Phase 3  │  │ Phase 4  │  │
│  │ Brand    │  │ Voice    │  │ Book-    │  │ Orders + │  │
│  │ Page     │  │ Farm Log │  │ keeping  │  │ Intel    │  │
│  │          │  │          │  │          │  │          │  │
│  │ Revenue  │  │ Ops      │  │ Finance  │  │ Growth   │  │
│  │ Channel  │  │ Tracking │  │ Tracking │  │ Engine   │  │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │
│       │              │            │            │        │
│       └──────────────┴────────────┴────────────┘        │
│                          │                              │
│               ┌──────────┴──────────┐                   │
│               │  AI Intelligence    │                   │
│               │  Layer (Claude)     │                   │
│               └─────────────────────┘                   │
│                                                         │
│  CORE_CANDIDATE Modules:                                │
│  ├── core/auth/kakao_auth.py                           │
│  ├── core/ai/llm_provider.py                           │
│  ├── core/stt/whisper_api.py                           │
│  ├── core/payment/toss_provider.py                     │
│  ├── core/external_api/public_data.py                  │
│  ├── core/notification/kakao_channel.py                │
│  └── core/storage/file_manager.py                      │
│                                                         │
│  All reusable for the next AI Product Factory product.  │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Beyond Phase 4 (Future Roadmap Ideas)

These are NOT in scope but worth noting:

- **Photo disease detection** — Farmer photos leaf → AI identifies pest/disease → recommends treatment
- **Multi-farm platform** — Other local farmers join → shared intelligence
- **B2B wholesale platform** — Connect farmers directly with restaurants/stores
- **IoT sensor integration** — Soil moisture, temperature → auto-alerts
- **Government subsidy automation** — Auto-fill all required forms from BINJO data
- **Crop insurance assistance** — Use farm log data to streamline insurance claims
