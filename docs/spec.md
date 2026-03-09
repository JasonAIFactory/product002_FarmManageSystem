# BINJO (빈조) — Product Specification

> **"농사가 본업이다. 나머지는 다 자동으로."**
> "Farming is the real job. Everything else runs automatically."

---

## Product Overview

BINJO is an AI-powered farm management platform built for a solo apple orchard farmer in Sacheon, Gyeongnam (빈조농장, 경남 사천 용치골). The system has one design test: **"Can you use this wearing work gloves in the orchard?"** If not, redesign it.

BINJO turns voice recordings and photos into structured farm logs, automated bookkeeping, and a branded direct-sales page — so a farmer who can barely use KakaoTalk can run a professional operation without ever sitting at a desk.

## Target Instinct

**Relief from administrative burden.** Korean solo farmers dread paperwork (영농일지, 장부, 보조금 서류) but must do it. BINJO eliminates that friction entirely through voice-first AI automation.

---

## Context

| Item | Detail |
|---|---|
| Product Name | BINJO (빈조) |
| Farm | Binjo Farm (빈조농장), Yongchi Valley, Sacheon, Gyeongnam |
| Crop | Apple orchard (사과 과수원) |
| Operator | **Solo** — this is the core reason for all automation |
| IT Level | KakaoTalk-level only |
| Input Preference | Voice (like a phone call) + Photos |
| Sales Channels | KakaoTalk direct, Naver SmartStore, offline wholesale/auction |
| Existing Tools | NH오늘농사 app (no public API available) |

---

## Core Features (Prioritized)

### Priority 1: Brand Page (Revenue)
Branded direct-sales landing page shared via KakaoTalk. Farm story, product catalog, seasonal calendar, order inquiry CTA. **→ Money first.**

### Priority 2: Voice Farm Diary (Operations)
Voice recording → AI transcription → structured farm log entry with weather auto-fill. Generates government-compliant 영농일지 for 공익직불금 subsidy applications.

### Priority 3: Automated Bookkeeping (Finance)
Receipt photo OCR + voice expense entry → auto-categorized transactions → monthly P&L reports. NH오늘농사 screenshot OCR as workaround (no API).

### Priority 4: Direct Orders + Intelligence (Growth)
Online payment via TossPayments, customer management, and AI-generated business intelligence from accumulated farm data.

---

## 4-Phase Roadmap

| Phase | Name | Timeline | Core Value |
|---|---|---|---|
| 1 | Brand Page | 10 days | Revenue channel — customers find and contact the farm |
| 2 | Voice Farm Management | 17 days | Operations — daily farm diary via voice, 영농일지 export |
| 3 | Automated Bookkeeping | 17 days | Finance — receipt OCR, auto ledger, monthly P&L |
| 4 | Direct Orders + Intelligence | 21 days | Growth — online payment, customer analytics, AI insights |

**Total: ~65 working days (3 months)**

Detailed implementation specs for each phase:
- `/docs/phase1-brand-page.md`
- `/docs/phase2-voice-farm.md`
- `/docs/phase3-bookkeeping.md`
- `/docs/phase4-orders-intel.md`

---

## Tech Stack Summary

| Layer | Phase 1 | Phase 2+ |
|---|---|---|
| Frontend | Next.js 14 (TypeScript) | Same |
| Styling | Tailwind CSS | Same |
| Backend | Next.js API Routes | FastAPI (Python 3.11+) added |
| Database | Supabase PostgreSQL (Prisma) | Supabase PostgreSQL (Prisma + SQLAlchemy) |
| STT | — | OpenAI Whisper API |
| LLM | — | Claude API (primary), OpenAI (fallback) |
| OCR | — | Claude Vision API |
| Auth | Env-var password (admin) | Kakao OAuth + JWT |
| Payment | — | TossPayments (Phase 4) |
| Task Queue | — | Celery + Redis |
| Storage | Supabase Storage | Supabase Storage (audio/photos in Phase 2+) |
| Deploy | Vercel | Vercel (FE) + Railway (BE) |
| CI/CD | GitHub Actions | Same |

---

## Design Principles

### UX Principles
1. **The Glove Test**: Every feature must pass — "Can you use this wearing work gloves?"
2. **Voice-first**: Talking is easier than typing for someone in a field
3. **One-tap actions**: Minimize taps. Maximum one confirmation per entry.
4. **KakaoTalk-native**: Everything must work in KakaoTalk in-app browser

### Brand Page Principles
1. **사람 냄새 (Human Warmth)**: Real photos, real story, real farmer — not corporate
2. **Trust > Flash**: Clean, warm, authentic > modern/techy
3. **Mobile-first**: 90%+ traffic from KakaoTalk shares
4. **Fast load**: Rural LTE — page weight < 500KB (excluding lazy images)
5. **Season-aware**: Hero content changes with harvest season

### Data Principles
1. All farmer data stays in Korea (Korean hosting)
2. Voice recordings processed → structured data stored, audio deleted after 30 days
3. Financial data encrypted at rest
4. Farmer owns all data — full export anytime

---

## CORE_CANDIDATE Modules

Six reusable modules designed for the AI Product Factory:

| Module | Reuse Potential |
|---|---|
| `core/ai/llm_provider.py` | Any product needing LLM (already in CLAUDE.md) |
| `core/stt/whisper_api.py` | Any voice-input product (support, notes, etc.) |
| `core/auth/kakao_auth.py` | Any Korean B2C product |
| `core/external_api/public_data.py` | Any product using Korean 공공데이터 |
| `core/notification/kakao_channel.py` | Any product targeting Korean users |
| `core/storage/file_manager.py` | Any product with media uploads |
| `core/payment/toss_provider.py` | Any Korean e-commerce product |

### Composability for Other Products
- Voice diary modules → any crop (change prompt context)
- Sales modules → any farm product (direct sales)
- OCR pipeline → any receipt/document processing
- Kakao auth + notification → any Korean consumer app

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| NH오늘농사 has no public API | Bookkeeping automation blocked | Screenshot OCR + voice entry fallback |
| Korean dialect STT accuracy | Farm logs have errors | Whisper prompt priming + Claude correction + farmer review |
| Farmer won't use even simple app | Zero adoption | KakaoTalk channel as primary interface (no app install) |
| Apple season is seasonal (Sep-Nov) | Revenue concentrated in 3 months | Pre-order system + off-season farm story content |
| Rural LTE is slow | Poor page performance | Aggressive image optimization, system font stack |

---

## Success Metrics

### Phase 1 (Brand Page)
- [ ] Brand page live with ≥ 5 products listed
- [ ] First order inquiry via brand page within 2 weeks
- [ ] Page shared in ≥ 3 KakaoTalk group chats by farmer
- [ ] Lighthouse mobile score ≥ 90

### Phase 2 (Voice Farm Management)
- [ ] Farmer records ≥ 5 voice entries per week
- [ ] AI parsing accuracy ≥ 85% (farmer confirms without editing)
- [ ] 영농일지 PDF exports in government-compliant format
- [ ] Zero missed critical seasonal tasks

### Phase 3 (Bookkeeping)
- [ ] Receipt OCR accuracy ≥ 80%
- [ ] Monthly P&L generated automatically
- [ ] 공익직불금 영농일지 exported successfully
- [ ] Farmer can answer "이번 달 얼마 벌었어?" in 3 seconds

### Phase 4 (Direct Orders + Intelligence)
- [ ] Online payment works (card + transfer + KakaoPay)
- [ ] Customer re-purchase rate tracked
- [ ] Yearly AI report with actionable insights generated
- [ ] All 4 phases working together as integrated system

---

## Revenue Model

### Short-term (Phase 1-2): Free for friend
No charge. This is being built for a friend's farm. The value is in proving the product and building CORE_CANDIDATE modules.

### Medium-term (Phase 3-4): Potential SaaS
If other farmers want to use BINJO:
- Freemium: Brand page + basic farm log free
- Premium: ₩29,000/month for OCR bookkeeping + AI insights + direct orders
- Transaction fee: 1% on direct order payments (on top of TossPayments fee)

### Long-term: AI Product Factory
CORE_CANDIDATE modules become building blocks for:
- Other agricultural products (different crops, livestock)
- Korean B2C products (Kakao auth, notification, payment)
- Voice-first applications (any domain)
