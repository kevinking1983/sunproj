# RATION roadmap

Last updated 2026-10-24. Built from a full code audit (six area reviews, each finding re-checked
against the code: 172 confirmed findings in [`audit-findings.csv`](audit-findings.csv)), a
marketplace design comparison, and a group-structure and AI design comparison. Nothing is
deployed yet; everything below runs on the local open-source test stack today.

## 1. Decisions made

| Topic | Decision |
|---|---|
| Legal operator | RATION is a **brand of Z Rainbow Pride Private Limited**. The parent's PAN, GSTIN (applying) and accounts are used. It may become a separate company, or more sister brands may be added, later. |
| Business model | **Marketplace.** Shops are third-party retailers (kiranas) that RATION incubates and lists. |
| Segments | **B2C:** 10-minute delivery (nearest shop) and 2-day delivery (customer picks a shop). **B2B:** no customer interface; workflow to be decided with the owner later. |
| Delivery | **Both:** each shop chooses RATION riders or its own delivery staff. |
| Money | **RATION collects** all customer payments and settles to shops, minus commission, fees and TCS/TDS. |
| Prices | RATION suggests a price based on MRP; the shop may change it but **never above MRP** (enforced in the database). |
| Apps | Customer app + website, **RATION HQ console** (today's admin, RATION staff only), **retailer panel** (mobile web app, installable, at its own address, e.g. `partner.zrainbowpride.com`), rider app. Native Android retailer app in phase 3. |
| Group structure | **One group platform** owned by Z Rainbow Pride: a shared `core` section (identity, legal entities, payment accounts, invoices and numbering, consents, AI usage) plus one section per brand (`ration` now). Company details are data with effective dates, so a merger, spin-off or new brand adds rows and never rewrites history. |
| AI | Build the AI layer now. Most intelligence comes from our own data at no API cost; the Claude API is used for conversational, visual and writing tasks. Testing runs on `mock` and local models plus free-tier credits; the paid key is decided later. The owner's existing customer-service project is reused for the support bot. |

## 2. Critical path (owner)

1. **GST registration of Z Rainbow Pride**, with "RATION" as trade name, covering e-commerce-operator TCS. Required before RATION can collect money for sellers. **Start now.**
2. **Razorpay marketplace + Route** (split payments to shops) application, which needs the GSTIN.
3. **FSSAI central licence** for the e-commerce food business.
4. Company details for the legal pages, and lawyer-reviewed policies.

Development continues in parallel; real payments switch on when 1 and 2 are done.

## 3. Phases

Effort figures are rough developer-days, for planning only.

### Phase 0: fix now (security, money safety, foundations), about 8 to 10 days

These are needed whatever else happens, and are cheapest to do before any real data exists.

**Security and money bugs found by the audit**
- [ ] Customers can set their own wallet balance and referral fields directly (free groceries). Restrict profile updates to name, email and avatar.
- [ ] A shop price can be set above MRP, or to zero. Add database checks.
- [ ] Store staff can rewrite any order column and jump order status (e.g. straight to "delivered"). Remove direct writes; enforce status steps.
- [ ] The website can charge a different amount from the price shown at checkout.
- [ ] Choosing online payment without gateway keys leaves a ghost order and uses up the coupon.
- [ ] The payment webhook can lose payments (event recorded before handling, errors ignored).
- [ ] Cancelling an online-paid order never refunds it; money paid after a cancellation, or paid twice, is never refunded; failed refunds are never retried.
- [ ] Unpaid orders hold stock forever (no scheduled clean-up jobs).
- [ ] Image uploads have no storage rules, so admin uploads will fail in production.
- [ ] Admin lists silently stop at 1,000 rows, so about 253 products are invisible.

**Permanent identifiers (can't change after the first store upload)**
- [ ] App IDs under the company: `com.zrainbowpride.ration` (customer), `com.zrainbowpride.ration.rider` (rider app, renamed from "RATION Partner"), retailer app ID reserved.
- [ ] Brand-neutral internal names (secrets, wallet payment method → "store credit").

**Group-ready foundations**
- [ ] Move all tables into `core` and `ration` sections (no production data yet, so a clean rewrite).
- [ ] Random IDs for the three tables still using counters; year-and-brand order numbers (e.g. `RT26-0100001`).
- [ ] `legal_entities`, `brands`, registrations (GSTIN, FSSAI, TAN) and payment accounts as data with effective dates; every order and payment stamped with its legal entity and payment account.
- [ ] Tax snapshot on each order line (HSN code, GST rate, taxable value, tax).
- [ ] Company details served from the database instead of hard-coded.
- [ ] Remove the unused payment key from the app environment files.

### Phase 1: marketplace + launch readiness, about 8 to 10 weeks for one developer

**1A. Backend**
- [ ] Shop membership (owner, manager, staff) and strict per-shop access; retailers see only their orders and the minimum customer data needed.
- [ ] Seller profile: legal and trade name, GST status and GSTIN, PAN (mandatory), FSSAI number and expiry (auto-pause on expiry), status, commission, settlement cycle, agreement; private KYC documents.
- [ ] Listings: shop price ≤ MRP, in-stock switch, optional unit counts; RATION's suggested price from MRP.
- [ ] Shop order steps: accept or reject, packing, mark items unavailable (re-prices with a partial refund), ready; accept timeout with re-routing or auto-cancel and refund; "shop offline" heartbeat.
- [ ] Delivery modes: 10-minute (nearest open shop) and 2-day (customer picks a shop, delivery slots, wider area); per-shop choice of RATION riders or own staff.
- [ ] Money: per-order snapshot of goods value, commission, fees, discounts and who funds them, TCS/TDS; an append-only shop ledger; weekly settlements with bank reference and two-person approval; built so Razorpay Route can switch on without schema changes.
- [ ] One refund pipeline for every cancellation type, with retries.
- [ ] Order issues: missing, damaged, wrong or expired items, with photos, time limits and shop clawback.
- [ ] Invoices: the shop's tax invoice or bill of supply, plus RATION's invoice for its fees; gapless numbering per shop and financial year; credit notes instead of deletions.
- [ ] Shop opening hours enforced (IST), pause for 30 or 60 minutes or the day, holidays.
- [ ] Coupons: platform- or shop-funded.
- [ ] Account deletion that removes personal data but keeps order and invoice records for the legal period.
- [ ] DPDP: privacy-notice versions, consent records, 18+ declaration, data export.

**1B. Retailer panel** (mobile web app at its own address, Hindi + English)
- [ ] New orders with a loud repeating alert, plus an "alert check" setup step (test alert, phone battery settings).
- [ ] Packing checklist, item unavailable, mark ready.
- [ ] Listings: add from catalogue, price, in-stock switch.
- [ ] Shop: open, pause or close, hours, delivery mode.
- [ ] Earnings, ledger, settlement statements, invoices.
- [ ] Team: invite staff by phone.

**1C. RATION HQ console**
- [ ] HQ access for RATION staff only, with roles (admin, ops, finance) and an audit log of staff actions; extra login protection (Cloudflare Access).
- [ ] Retailer onboarding: KYC, agreement, listing on the shop's behalf, bulk listing.
- [ ] Live operations: orders not yet accepted, escalations.
- [ ] Store performance: acceptance rate, time to accept, partial and rejection rates, missed alerts.
- [ ] Settlements, cash and UPI-on-delivery reconciliation per rider, TCS/TDS registers.
- [ ] Order search, filters, export; customer lookup and support tools; account-deletion requests.
- [ ] Reports in IST: sales, GST summary, top products, GMV against net revenue.
- [ ] Rider management; third-level categories; full product fields (HSN, labelling).

**1D. Customer app and website**
- [ ] "Sold by <shop>" with the shop's legal name, address, FSSAI number, GSTIN and rating.
- [ ] 10-minute / 2-day switch and shop picker.
- [ ] Legally required product details: manufacturer or packer, country of origin, net quantity, best before.
- [ ] Payment options driven by settings: cash and UPI on delivery at launch, online once Route is live; recovery when an online payment fails.
- [ ] Receipts and invoices in the order page.
- [ ] Report a missing or damaged item.
- [ ] Account deletion in the app, plus a web page (both stores require it).
- [ ] Final legal pages with company and grievance-officer details, linked from login.
- [ ] Closed-shop state ("opens at 7 am"), error and offline handling, fresh prices in the cart.
- [ ] WhatsApp OTP login with SMS fallback; bot protection on web login.
- [ ] Order updates for website users (WhatsApp, SMS or email).

**1E. Rider app**
- [ ] Pickup card with the shop's name, address, navigation and call button.
- [ ] Record cash or UPI at the door; rider cash ledger; daily hand-in.
- [ ] Delivery proof (OTP for cash or high-value orders).
- [ ] Background-location disclosure and partner privacy policy (Play Store rule).
- [ ] Stronger new-order alerts with an accept timer; no going offline while holding orders.
- [ ] Failed-delivery and "report a problem" flows; support number.
- [ ] Hide the customer's personal data beyond what delivery needs.

**1F. Go-live setup**
- [ ] Supabase cloud project in Mumbai (paid plan) plus a staging project; automatic deploys of database changes and functions.
- [ ] Custom API address (e.g. `api.zrainbowpride.com`), so apps never depend on a vendor address.
- [ ] Cloudflare Pages for the website, retailer panel and HQ console, with security headers.
- [ ] App store builds (EAS), push notifications (Firebase / Apple), store listings, data-safety forms, reviewer test login.
- [ ] Branded app icons, splash screens and favicons.
- [ ] Error tracking (Sentry), uptime checks, alerts.
- [ ] Nightly backups to an off-site bucket, plus a tested restore.
- [ ] OTP rate limits, DLT registration and SMS templates.
- [ ] Load real starting data: pilot shops, real catalogue and MRPs.
- [ ] Go-live checklist and incident runbooks.
- [ ] Pilot with 3 to 5 shops, a promised time of about 20 to 25 minutes at first, and "Waiting for the shop to confirm" shown to customers.

### Phase 2: AI layer, can start alongside Phase 1

**Platform**
- [ ] AI gateway (server-side only), with modes `mock` (recorded answers, zero calls), `local` (free model on your PC) and `anthropic`.
  - Record-once-replay for tests, an identical-request cache, and daily call and spend caps that fall back to `mock`.
  - Per-user rate limits and usage and cost logging.
  - Model routing: default Claude Opus 5.5, with cheaper models per feature as the owner chooses.
- [ ] Safety rules:
  - The AI never moves money, sets prices, changes stock or places orders.
  - Seller-written text is filtered before it reaches a prompt.
  - No Aadhaar data ever goes to a model.
  - The 18+ declaration and consent checks are enforced on the server.
  - No invented urgency ("only 2 left").
- [ ] Event capture from day one, gated by consent: searches (including zero-result ones), views, add-to-cart, substitutions, delivery times.

**Features that use our own data (no AI key)**
- [ ] Smart search: Hinglish, Hindi and Kannada synonyms, typos. Meaning-based search comes later.
- [ ] Buy again; out-of-stock substitutes; frequently bought together; personalised home rails; "running low?" nudges.
- [ ] Retailer stock and reorder suggestions; price suggestions within MRP.
- [ ] Fraud and abuse rules; anomaly alerts; delivery-time estimates from rider history; demand forecasting.

**Features that use the Claude API**
- [ ] Catalogue enrichment: descriptions, tags, translations, categorising imports. Batch, run once and stored.
- [ ] Support assistant with guarded refunds. Reuses the owner's customer-service project; the top questions are answered without AI.
- [ ] Recipe-to-cart and shopping assistant. A recipe library is prepared in batch, then live chat.
- [ ] Photo of a handwritten list → cart; Hindi and regional voice search (speech recognition runs on the phone).
- [ ] Review moderation and summaries; plain-language retailer insights; HQ analyst; seller KYC form prefill; B2B purchase-order capture.

### Phase 3: after launch and scale
- [ ] Native Android retailer app with an alarm-style order alert (when there are 10 to 15+ shops, or alerts are being missed).
- [ ] Automated rider and shop payouts (RazorpayX / Route), Cashfree as a second gateway.
- [ ] In-app support chat; masked calls between rider and customer; order batching and multi-drop routing; rider incentives, shifts and ratings.
- [ ] SEO (sitemap, structured data), installable website, app links, analytics, ratings shown, more languages.
- [ ] Waitlist for areas not yet served; promotional messages (DLT templates); scheduled and targeted coupons and banners.
- [ ] Batch and expiry tracking, capacity-aware delivery times, drawn delivery zones, bag weight limits, loose produce priced by weight, appliance warranties.
- [ ] B2B segment (workflow to be defined with the owner).

## 4. Owner to-do list (non-development)

**Registrations and advisers**
- [ ] GST registration (trade name RATION, e-commerce TCS); TAN for income-tax TDS (Section 194-O).
- [ ] CA and lawyer: seller agreement, marketplace terms, TCS/TDS set-up, receipt format before GSTIN, wallet / store-credit position.
- [ ] FSSAI central e-commerce licence; check each pilot shop's FSSAI registration.
- [ ] Delivery partners: gig-worker registration (Karnataka Act, Social Security Code), accident insurance.

**Company details** (for the legal pages and stores)
- [ ] Registered address, CIN, support phone / WhatsApp, grievance officer name, email and phone.

**Accounts, owned by Z Rainbow Pride and not by individuals**
- [ ] GitHub organisation (move the repository into it).
- [ ] Supabase organisation (Pro plan, Mumbai).
- [ ] Cloudflare.
- [ ] Expo organisation.
- [ ] Google Play organisation account and Apple Developer account (both need a D-U-N-S number).
- [ ] Razorpay marketplace + Route.
- [ ] MSG91 + DLT.
- [ ] Meta WhatsApp Business.
- [ ] Ola Maps.
- [ ] Firebase.
- [ ] Sentry.
- [ ] Anthropic (when ready). Use role email addresses, not personal ones.

**Brand**
- [ ] RATION logo and app icons; register the RATION trademark in the parent's name.

**Policies to decide**
- [ ] Refunds and time windows; substitutions; cash handling and the store UPI ID; rider pay.
- [ ] How long data is kept after account deletion; COD limits.
- [ ] Commission per category; settlement cycle.

**Pilot**
- [ ] 3 to 5 retailers with their real product lists and MRPs.
- [ ] Distributor pack shots for missing photos.
- [ ] Decide on the 26 photos awaiting a decision.

**Email and domain**
- [ ] DKIM (InterServer ticket); DirectAdmin two-step login, SSL check and a backup.
- [ ] Test the support and grievance email forwarding.

**AI**
- [ ] Share the customer-service project; choose the test key or provider.

**When ready**
- [ ] Supabase project URL and anon key.

## 5. Where the details are
- `docs/audit-findings.csv`: every confirmed gap, with file evidence and the checker's notes.
- `supabase/catalog/IMAGE_POLICY.md` and `IMAGE_COVERAGE.md`: catalogue photos.
- `docs/FEATURE_PARITY.md`: production services versus the open-source test stack.
