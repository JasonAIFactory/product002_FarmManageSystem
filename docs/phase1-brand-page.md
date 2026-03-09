# BINJO Phase 1: Brand Page — Implementation Spec

> This document is the **single source of truth** for Phase 1 implementation.
> Feed this directly to Claude Code along with CLAUDE.md.

---

## 1. What We're Building

A **branded direct-sales landing page** for 빈조농장 (Binjo Farm) — a solo-run apple orchard in Sacheon, Gyeongnam. The page is shared primarily via KakaoTalk and serves as the farm's single brand hub.

**One sentence**: A warm, trust-building farm brand page that converts KakaoTalk visitors into order inquiries.

**Primary CTA**: "주문 문의하기" (Place Order Inquiry) → opens KakaoTalk chat or phone call.

**NOT a shopping cart.** This is an inquiry-based sales flow. The farmer closes deals personally via KakaoTalk/phone. Phase 1 has no payment processing.

---

## 2. Design Philosophy

### Core Principle: "사람 냄새" (Human Warmth)
- Real photos, real story, real farmer — NOT corporate
- Trust > Flash: Clean, warm, authentic > modern/techy
- Think "네이버 블로그 감성" (Korean blog warmth) + professional structure

### Technical Constraints
- **Mobile-first**: 90%+ traffic comes from KakaoTalk in-app browser
- **Fast load**: Rural LTE — total page weight < 500KB (excluding images)
- **Image optimization**: All images served as WebP, lazy-loaded, max 800px width
- **KakaoTalk OG tags**: Must render perfectly in KakaoTalk link preview
- **No login required**: Everything is public

### UX Principle
- **3-second test**: Visitor knows "who, what, where" within 3 seconds
- **Single scroll path**: Hero → Story → Products → Seasonal Calendar → Order CTA
- **Sticky CTA**: "주문 문의" button always visible on mobile

---

## 3. Tech Stack (Phase 1 Only)

| Layer | Choice | Reason |
|---|---|---|
| Frontend | **Next.js 14+ (App Router, TypeScript)** | SSR for OG tags + SEO |
| Styling | **Tailwind CSS** | Rapid iteration, mobile-first utilities |
| Backend | **Next.js API Routes** | Phase 1 is content-heavy, no need for separate FastAPI yet |
| Database | **Supabase PostgreSQL (Prisma ORM, direct connection)** | Free tier, hosted PG, table editor for seed data |
| Image Storage | **Supabase Storage** | S3-compatible, same platform as DB, free 1GB |
| Deploy | **Vercel** | Zero-config Next.js deployment |
| Analytics | **Vercel Analytics** or **Umami** (self-hosted) | Privacy-friendly, lightweight |

### Phase 1 Stack Override (vs CLAUDE.md defaults)
- **No separate FastAPI backend** — Next.js API routes handle Phase 1's simple CRUD. FastAPI will be introduced in Phase 2 when voice processing pipeline needs Python.
- **Prisma instead of SQLAlchemy** — TypeScript-native, better DX for Next.js. Backend migration to SQLAlchemy happens in Phase 2.
- **Supabase as hosted PG + Storage only** — We do NOT use Supabase Auth, Realtime, Edge Functions, or PostgREST. Prisma connects directly to the PostgreSQL database. This keeps us ORM-agnostic for Phase 2.
- **No Redis** — Not needed for Phase 1's static-ish content.
- **No Auth** — Public brand page + simple admin with environment-variable password.

---

## 4. Page Structure (Single Page, 7 Sections)

### Section 1: Hero
```
┌─────────────────────────────────┐
│  [Full-width farm photo]         │
│                                  │
│  빈조농장                         │
│  경남 사천 용치골의 사과            │
│                                  │
│  "한 알 한 알, 정성으로 키웁니다"   │
│                                  │
│  [주문 문의하기] button            │
└─────────────────────────────────┘
```
- Background: Hero image with dark gradient overlay
- Farm name in Korean (빈조농장) large
- Location subtitle: 경남 사천시 용치골
- One-line tagline (farmer can customize via admin)
- CTA button → scrolls to order section or opens KakaoTalk

### Section 2: Farm Story (농장 이야기)
```
┌─────────────────────────────────┐
│  [Farmer photo]  │  우리 농장      │
│                  │  이야기         │
│                  │               │
│                  │  {2-3 paragraphs │
│                  │   about the     │
│                  │   farm story}   │
└─────────────────────────────────┘
```
- Farmer's portrait photo (or working in orchard)
- 2-3 paragraphs of farm story (admin-editable)
- Warm, personal tone
- Optional: Key stats (재배 면적, 재배 경력, 주요 품종)

### Section 3: Our Apples (우리 사과)
```
┌─────────────────────────────────┐
│  우리 사과                        │
│                                  │
│  [Card] [Card] [Card]            │
│  부사   홍로   시나노골드            │
│                                  │
│  Each card:                      │
│  - Variety photo                 │
│  - Name (Korean)                 │
│  - Harvest season                │
│  - Flavor description            │
│  - "자세히 보기" → expands         │
└─────────────────────────────────┘
```
- Product cards in horizontal scroll (mobile) or grid (desktop)
- Each card: photo, name, season, 1-line description
- Tap to expand: detailed description, weight options, price range

### Section 4: Seasonal Calendar (제철 달력)
```
┌─────────────────────────────────┐
│  제철 달력                        │
│                                  │
│  [Jan][Feb]...[Dec]              │
│                                  │
│  Current month highlighted       │
│  Shows what's available NOW      │
│  Shows what's coming next        │
└─────────────────────────────────┘
```
- 12-month horizontal bar
- Current month auto-highlighted
- Each month shows: available varieties, farm activities
- Seasonal messaging: "지금은 OO 제철입니다" or "곧 OO 수확이 시작됩니다"

### Section 5: Photo Gallery (농장 풍경)
```
┌─────────────────────────────────┐
│  농장 풍경                        │
│                                  │
│  [Photo grid - masonry layout]   │
│  Orchard scenes, harvest,        │
│  packing, seasonal beauty        │
│                                  │
│  Tap to expand fullscreen        │
└─────────────────────────────────┘
```
- 6-12 curated photos
- Masonry grid on mobile (2 columns)
- Fullscreen lightbox on tap
- Admin can add/remove/reorder

### Section 6: Customer Reviews (고객 후기)
```
┌─────────────────────────────────┐
│  고객 후기                        │
│                                  │
│  [Review card carousel]          │
│  "올해도 역시 빈조농장 사과가..."   │
│  — 김○○ 님, 서울                  │
│                                  │
│  ★★★★★                          │
└─────────────────────────────────┘
```
- Horizontal swipeable cards
- Each: quote, name (masked), location, star rating
- Admin manually adds reviews (from KakaoTalk screenshots etc.)

### Section 7: Order & Contact (주문 안내)
```
┌─────────────────────────────────┐
│  주문 안내                        │
│                                  │
│  현재 판매 중: 부사 5kg / 10kg     │
│  가격: 35,000원 ~ 65,000원       │
│                                  │
│  [카카오톡 문의] [전화 주문]        │
│                                  │
│  네이버 스마트스토어 →             │
│                                  │
│  농장 위치: 경남 사천시 용치골       │
│  [Kakao Map embed or link]       │
└─────────────────────────────────┘
```
- Currently available products with prices
- Two primary CTA buttons: KakaoTalk chat link + Phone call link
- Secondary link: Naver SmartStore
- Farm address + Kakao Map link
- Business hours / response time note

### Sticky Mobile CTA
- Fixed bottom bar on mobile: "주문 문의하기" button
- Always visible while scrolling
- Disappears when Section 7 is in viewport (avoid duplication)

---

## 5. Database Schema

```sql
-- Farm profile (single row for MVP)
CREATE TABLE farm (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,              -- '빈조농장'
    name_en VARCHAR(100),                    -- 'Binjo Farm'
    tagline TEXT,                            -- Hero tagline
    story TEXT,                              -- Farm story (Section 2)
    phone VARCHAR(20),                       -- Order phone number
    kakao_chat_url VARCHAR(500),             -- KakaoTalk chat link
    naver_store_url VARCHAR(500),            -- Naver SmartStore URL
    address TEXT,                            -- Full address
    address_short VARCHAR(100),              -- '경남 사천시 용치골'
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    hero_image_url VARCHAR(500),
    farmer_image_url VARCHAR(500),
    stats JSONB,                             -- {"area": "3,000평", "experience": "15년", ...}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apple varieties / Products
CREATE TABLE product (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    name VARCHAR(100) NOT NULL,              -- '부사'
    name_en VARCHAR(100),                    -- 'Fuji'
    description TEXT,                        -- Detailed description
    short_description VARCHAR(200),          -- One-line for card
    harvest_start_month INT,                 -- 9 (September)
    harvest_end_month INT,                   -- 11 (November)
    is_available BOOLEAN DEFAULT false,      -- Currently selling?
    price_options JSONB,                     -- [{"weight": "5kg", "price": 35000}, ...]
    image_url VARCHAR(500),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seasonal calendar entries
CREATE TABLE seasonal_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    month INT NOT NULL,                      -- 1-12
    activities TEXT[],                       -- ['전정 작업', '비료 살포']
    available_products TEXT[],               -- ['부사', '홍로']
    highlight TEXT,                          -- '지금이 부사 사과 제철!'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photo gallery
CREATE TABLE gallery_photo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    image_url VARCHAR(500) NOT NULL,
    caption VARCHAR(200),
    taken_at DATE,                           -- When photo was taken
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer reviews
CREATE TABLE review (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    customer_name VARCHAR(50),               -- '김○○'
    customer_location VARCHAR(50),           -- '서울'
    content TEXT NOT NULL,
    rating INT DEFAULT 5,                    -- 1-5
    is_visible BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order inquiries (tracked for analytics)
CREATE TABLE order_inquiry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm(id),
    channel VARCHAR(20) NOT NULL,            -- 'kakao', 'phone', 'naver'
    product_id UUID REFERENCES product(id),  -- Which product they clicked from
    referrer VARCHAR(500),                   -- Where they came from
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. API Endpoints

### Public API (No Auth)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/farm` | Get farm profile |
| GET | `/api/v1/products` | List all products (with availability filter) |
| GET | `/api/v1/products/[id]` | Get single product detail |
| GET | `/api/v1/calendar` | Get seasonal calendar (all 12 months) |
| GET | `/api/v1/gallery` | Get gallery photos |
| GET | `/api/v1/reviews` | Get visible reviews |
| POST | `/api/v1/inquiry` | Track order inquiry click (analytics) |

### Admin API (Simple Auth: env var password)

| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/login` | Simple password auth → JWT token |
| PUT | `/api/admin/farm` | Update farm profile |
| POST | `/api/admin/products` | Create product |
| PUT | `/api/admin/products/[id]` | Update product |
| DELETE | `/api/admin/products/[id]` | Delete product |
| POST | `/api/admin/gallery` | Upload gallery photo |
| DELETE | `/api/admin/gallery/[id]` | Delete gallery photo |
| POST | `/api/admin/reviews` | Add review |
| PUT | `/api/admin/reviews/[id]` | Update review |
| DELETE | `/api/admin/reviews/[id]` | Delete review |
| PUT | `/api/admin/calendar/[month]` | Update calendar month |
| GET | `/api/admin/inquiries` | List inquiry analytics |

---

## 7. Admin Panel

Simple, functional admin at `/admin` route. NOT for the farmer — for Jason to manage content.

### Admin Pages
1. **Farm Profile** — Edit name, tagline, story, contact info, hero image
2. **Products** — CRUD apple varieties with photos, prices, availability toggle
3. **Calendar** — Edit each month's activities and highlights
4. **Gallery** — Upload/delete/reorder photos
5. **Reviews** — Add/edit/delete customer reviews
6. **Analytics** — Order inquiry counts by channel, by product, by date

### Admin Auth
- Single password stored in `ADMIN_PASSWORD` env var
- POST `/api/admin/login` with password → returns JWT (24h expiry)
- All admin routes check JWT

---

## 8. KakaoTalk Integration

### OG Meta Tags (Critical for KakaoTalk sharing)
```html
<meta property="og:title" content="빈조농장 — 경남 사천 용치골의 사과" />
<meta property="og:description" content="한 알 한 알, 정성으로 키운 사과를 농장에서 직접 보내드립니다." />
<meta property="og:image" content="https://binjo.farm/og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="https://binjo.farm" />
<meta property="og:type" content="website" />
```

### OG Image Requirements
- 1200x630px
- Farm photo with logo overlay
- Text legible at small preview size
- Updated seasonally (can be automated later)

### KakaoTalk Chat Link
- Use KakaoTalk Channel chat URL: `https://pf.kakao.com/_xxxxx/chat`
- Farmer needs to create a KakaoTalk Channel (카카오톡 채널) — guide them

### Phone Call Link
```html
<a href="tel:010-XXXX-XXXX">전화 주문</a>
```

---

## 9. SEO & Performance

### SEO
- Next.js SSR for all public pages (critical for Naver search)
- Korean-language meta tags
- Structured data (JSON-LD): LocalBusiness + Product
- Sitemap.xml auto-generated
- Naver Search Advisor registration (한국 SEO의 핵심)

### Performance Targets
- Lighthouse Mobile Score: ≥ 90
- LCP (Largest Contentful Paint): < 2.5s
- Total page weight: < 500KB (excl. lazy images)
- All images: WebP format, responsive srcset
- Font: System font stack (no web font download)

### Korean System Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 
  'Pretendard Variable', Pretendard, 'Noto Sans KR', system-ui, sans-serif;
```

---

## 10. Seed Data (빈조농장)

### Farm Profile
```json
{
  "name": "빈조농장",
  "name_en": "Binjo Farm",
  "tagline": "한 알 한 알, 정성으로 키웁니다",
  "address_short": "경남 사천시 용치골",
  "story": "[농장주가 직접 작성 — placeholder 텍스트 넣기]"
}
```

### Products (Common Sacheon Apple Varieties)
```json
[
  {
    "name": "부사",
    "name_en": "Fuji",
    "short_description": "아삭하고 달콤한 대표 품종",
    "harvest_start_month": 10,
    "harvest_end_month": 12,
    "price_options": [
      {"weight": "5kg (16-18과)", "price": 35000},
      {"weight": "10kg (32-36과)", "price": 60000}
    ]
  },
  {
    "name": "홍로",
    "name_en": "Hongro",
    "short_description": "새콤달콤, 가을의 첫 맛",
    "harvest_start_month": 9,
    "harvest_end_month": 10,
    "price_options": [
      {"weight": "5kg", "price": 30000},
      {"weight": "10kg", "price": 55000}
    ]
  },
  {
    "name": "시나노골드",
    "name_en": "Shinano Gold",
    "short_description": "상큼한 황금빛 프리미엄 사과",
    "harvest_start_month": 10,
    "harvest_end_month": 11,
    "price_options": [
      {"weight": "3kg", "price": 25000},
      {"weight": "5kg", "price": 40000}
    ]
  }
]
```

### Seasonal Calendar
```json
[
  {"month": 1, "activities": ["전정 작업 시작"], "highlight": "겨울 전정으로 내년 수확을 준비합니다"},
  {"month": 2, "activities": ["전정 작업", "자재 준비"], "highlight": "꼼꼼한 전정이 좋은 사과의 시작"},
  {"month": 3, "activities": ["전정 마무리", "비료 시비"], "highlight": "봄을 맞아 과수원에 영양을 줍니다"},
  {"month": 4, "activities": ["꽃눈 관리", "서리 대비"], "highlight": "사과꽃 피기 전 긴장의 시간"},
  {"month": 5, "activities": ["사과꽃 개화", "인공수분", "적화"], "highlight": "하얀 사과꽃이 과수원을 가득 채웁니다"},
  {"month": 6, "activities": ["적과 작업", "병해충 관리"], "highlight": "좋은 열매만 남기는 정성 적과"},
  {"month": 7, "activities": ["봉지 씌우기", "관수 관리"], "highlight": "한여름 더위 속 사과가 자라는 중"},
  {"month": 8, "activities": ["봉지 벗기기", "착색 관리"], "highlight": "사과가 빨갛게 물들기 시작합니다"},
  {"month": 9, "activities": ["홍로 수확 시작", "선별 작업"], "highlight": "🍎 홍로 수확! 가을의 첫 사과"},
  {"month": 10, "activities": ["부사·시나노골드 수확", "직거래 시작"], "highlight": "🍎 본격 수확! 주문 받습니다"},
  {"month": 11, "activities": ["부사 후기 수확", "저장 작업"], "highlight": "🍎 마지막 부사 수확, 서두르세요"},
  {"month": 12, "activities": ["과수원 정리", "내년 계획"], "highlight": "한 해를 마무리하며 감사합니다"}
]
```

---

## 11. Project Structure (Phase 1)

```
binjo/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout + Korean font + OG tags
│   │   ├── page.tsx                # Main brand page (7 sections)
│   │   ├── globals.css             # Tailwind + custom styles
│   │   ├── admin/
│   │   │   ├── layout.tsx          # Admin layout with auth check
│   │   │   ├── page.tsx            # Admin dashboard
│   │   │   ├── farm/page.tsx       # Farm profile editor
│   │   │   ├── products/page.tsx   # Product management
│   │   │   ├── gallery/page.tsx    # Gallery management
│   │   │   ├── reviews/page.tsx    # Review management
│   │   │   ├── calendar/page.tsx   # Calendar editor
│   │   │   └── analytics/page.tsx  # Inquiry analytics
│   │   └── api/
│   │       ├── v1/
│   │       │   ├── farm/route.ts
│   │       │   ├── products/route.ts
│   │       │   ├── products/[id]/route.ts
│   │       │   ├── calendar/route.ts
│   │       │   ├── gallery/route.ts
│   │       │   ├── reviews/route.ts
│   │       │   └── inquiry/route.ts
│   │       └── admin/
│   │           ├── login/route.ts
│   │           ├── farm/route.ts
│   │           ├── products/route.ts
│   │           ├── products/[id]/route.ts
│   │           ├── gallery/route.ts
│   │           ├── gallery/[id]/route.ts
│   │           ├── reviews/route.ts
│   │           ├── reviews/[id]/route.ts
│   │           ├── calendar/[month]/route.ts
│   │           └── inquiries/route.ts
│   ├── components/
│   │   ├── brand/                  # Brand page sections
│   │   │   ├── HeroSection.tsx
│   │   │   ├── StorySection.tsx
│   │   │   ├── ProductsSection.tsx
│   │   │   ├── CalendarSection.tsx
│   │   │   ├── GallerySection.tsx
│   │   │   ├── ReviewsSection.tsx
│   │   │   ├── OrderSection.tsx
│   │   │   └── StickyOrderCTA.tsx
│   │   ├── admin/                  # Admin components
│   │   │   ├── AdminNav.tsx
│   │   │   ├── ImageUploader.tsx
│   │   │   └── RichTextEditor.tsx  # Simple textarea, not WYSIWYG
│   │   └── ui/                     # Shared UI components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Modal.tsx
│   │       └── LoadingSpinner.tsx
│   ├── lib/
│   │   ├── db.ts                   # Prisma client
│   │   ├── auth.ts                 # JWT helper for admin
│   │   ├── storage.ts             # Supabase Storage helper (upload, public URL)
│   │   └── image.ts               # Image optimization helper
│   └── types/
│       └── index.ts                # Shared TypeScript types
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                     # Seed 빈조농장 data
├── public/
│   ├── og-image.jpg                # Default OG image
│   └── favicon.ico
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md                       # Setup instructions only
```

---

## 12. Implementation Tasks (Ordered)

### Sprint 1: Foundation (Day 1-2)
- [ ] `chore:` Initialize Next.js 14 project with TypeScript + Tailwind
- [ ] `chore:` Set up Prisma with PostgreSQL schema (all tables above)
- [ ] `feat:` Create seed script with 빈조농장 placeholder data
- [ ] `feat:` Public API routes: GET farm, products, calendar, gallery, reviews
- [ ] `chore:` Set up `.env.example` with all required variables

### Sprint 2: Brand Page UI (Day 3-5)
- [ ] `feat:` HeroSection — full-width image + tagline + CTA
- [ ] `feat:` StorySection — farmer photo + story text
- [ ] `feat:` ProductsSection — product cards with expand detail
- [ ] `feat:` CalendarSection — 12-month bar with current month highlight
- [ ] `feat:` GallerySection — masonry photo grid + lightbox
- [ ] `feat:` ReviewsSection — swipeable review cards
- [ ] `feat:` OrderSection — contact info + KakaoTalk/phone CTAs + map link
- [ ] `feat:` StickyOrderCTA — fixed bottom bar on mobile
- [ ] `feat:` OG meta tags + JSON-LD structured data
- [ ] `feat:` Responsive design — test in KakaoTalk in-app browser

### Sprint 3: Admin Panel (Day 6-8)
- [ ] `feat:` Admin login (password → JWT)
- [ ] `feat:` Farm profile editor (text fields + image upload)
- [ ] `feat:` Product CRUD (create/edit/delete with image upload)
- [ ] `feat:` Gallery management (upload/delete/reorder)
- [ ] `feat:` Review management (add/edit/delete)
- [ ] `feat:` Calendar editor (month-by-month)
- [ ] `feat:` Order inquiry tracking + basic analytics page

### Sprint 4: Polish & Deploy (Day 9-10)
- [ ] `fix:` Image optimization pipeline (upload → resize → WebP → Supabase Storage)
- [ ] `fix:` Lighthouse score ≥ 90 (performance audit)
- [ ] `fix:` KakaoTalk in-app browser testing
- [ ] `chore:` Deploy to Vercel + connect domain (binjo.farm or similar)
- [ ] `chore:` Register with Naver Search Advisor
- [ ] `docs:` Update seed data with real farm content

---

## 13. Environment Variables

```bash
# Supabase (Database + Storage)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # For server-side Storage uploads

# Admin
ADMIN_PASSWORD=...                     # Simple admin password
JWT_SECRET=...                         # For admin JWT tokens

# KakaoTalk
NEXT_PUBLIC_KAKAO_CHAT_URL=https://pf.kakao.com/_xxxxx/chat
NEXT_PUBLIC_FARM_PHONE=010-XXXX-XXXX
NEXT_PUBLIC_NAVER_STORE_URL=https://smartstore.naver.com/...

# Analytics (optional)
NEXT_PUBLIC_UMAMI_WEBSITE_ID=...
```

---

## 14. Design Tokens

### Colors
```
Primary:        #2D5016 (deep orchard green)
Primary Light:  #4A7C2E (fresh leaf green)
Accent:         #D4421E (apple red)
Accent Warm:    #E8913A (autumn gold)
Background:     #FDFBF7 (warm cream)
Surface:        #FFFFFF
Text Primary:   #1A1A1A
Text Secondary: #6B6B6B
Text Muted:     #9B9B9B
Border:         #E5E2DB
```

### Typography Scale
```
Hero Title:     text-4xl md:text-6xl (font-weight: 700)
Section Title:  text-2xl md:text-3xl (font-weight: 600)
Card Title:     text-lg md:text-xl (font-weight: 600)
Body:           text-base (font-weight: 400)
Caption:        text-sm (font-weight: 400)
Price:          text-xl (font-weight: 700)
```

### Spacing
```
Section gap:    py-16 md:py-24
Content max-w:  max-w-5xl mx-auto
Card gap:       gap-4 md:gap-6
Mobile padding: px-4
```

---

## 15. Success Criteria (Ship When)

- [ ] Brand page loads in < 3s on 4G
- [ ] All 7 sections render correctly on mobile (375px) and desktop (1280px)
- [ ] KakaoTalk link preview shows correct OG image + text
- [ ] "주문 문의" CTA opens KakaoTalk chat
- [ ] Phone number CTA triggers phone dialer on mobile
- [ ] Admin can update all content without code changes
- [ ] At least 3 products listed with photos and prices
- [ ] Lighthouse mobile score ≥ 90

---

## 16. What Phase 1 Does NOT Include

- ❌ Payment processing (farmer handles via bank transfer)
- ❌ Shopping cart / checkout flow
- ❌ User accounts / login for customers
- ❌ Voice input / farm diary (Phase 2)
- ❌ Weather API integration (Phase 2)
- ❌ Automated notifications (Phase 2)
- ❌ NH오늘농사 integration (Phase 3)
- ❌ Naver SmartStore API sync (Phase 4)

---

## 17. Migration Path to Phase 2

When Phase 2 starts (Voice Farm Management):
1. **Add FastAPI backend** alongside Next.js (Python for Whisper/Claude)
2. **Migrate DB** from Prisma to SQLAlchemy (or keep Prisma + add Python DB client)
3. **Add farmer auth** via Kakao Login
4. **Keep brand page** as-is — it's the revenue engine while we build Phase 2

The brand page is NOT throwaway. It's the permanent customer-facing layer.
