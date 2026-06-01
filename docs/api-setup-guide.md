# API Setup Guide - Tour & Activity Platform Integrations

Last updated: 2026-05-24

This guide covers how to get API access for each tour/activity platform, with exact URLs, steps, and what to expect.

---

## Table of Contents

1. [Viator (FREE API - Highest Priority)](#1-viator-free-api---highest-priority)
2. [GetYourGuide (via Awin / Travelpayouts)](#2-getyourguide-via-awin--travelpayouts)
3. [Klook (Partner API)](#3-klook-partner-api)
4. [KKday (KKpartners)](#4-kkday-kkpartners)
5. [Activity Japan (API with NDA)](#5-activity-japan-api-with-nda)
6. [Asoview (Agent API)](#6-asoview-agent-api)
7. [Jalan (Affiliate via ValueCommerce)](#7-jalan-affiliate-via-valuecommerce)

---

## 1. Viator (FREE API - Highest Priority)

Viator (owned by Tripadvisor) offers the most accessible and feature-rich API for tours and activities. No cost to sign up, no cost for API access.

### Links

- Signup URL: https://partners.viator.com/signup
- API Documentation: https://docs.viator.com/partner-api/
- Technical Reference: https://docs.viator.com/partner-api/technical/
- Affiliate API Docs: https://docs.viator.com/partner-api/affiliate/technical/
- Partner Resource Center: https://partnerresources.viator.com/
- Implementation Guide: https://partnerresources.viator.com/travel-commerce/implementation/

### Step-by-Step Registration

1. Go to https://partners.viator.com/signup
2. If you have a Tripadvisor account, sign in with those credentials (takes less than a minute)
3. If not, create a new account with your email, business name, and website URL
4. Select "Affiliate Partner" as your partner type
5. Fill in your business details and website information
6. Submit application and wait for approval
7. Once approved, receive your affiliate ID and API credentials
8. Start with Basic-access endpoints, then request Full-access when ready

### What Data is Available

**Basic-access Affiliate (immediate):**
- Product search and listing (destination, keyword, category)
- Product details (descriptions, images, highlights, inclusions/exclusions)
- Reviews and ratings
- Pricing information
- Destination taxonomy

**Full-access Affiliate (on request):**
- All non-transactional endpoints
- Real-time availability checking
- Availability schedules with modified-since polling
- Detailed pricing breakdowns by age band
- Product content with modified-since for syncing

**Key Endpoints:**
- `/products/search` - Search products by destination/keyword/filters
- `/search/freetext` - Free-text search
- `/products/modified-since` - Bulk product content sync
- `/availability/schedules/modified-since` - Availability and pricing sync
- Real-time availability and pricing checks

**Booking Flow (Merchant partners only):**
- Cart management
- Booking creation and confirmation
- Booking management (cancel, amend)

### Commission Rate

- **8% to 12%** per completed booking
- 30-day cookie window (earn on repeat visitors)
- Performance-based: higher volume can unlock higher rates
- No upfront API cost - revenue share model only

### Expected Approval Time

- **1-5 business days** (typical)
- Can be as fast as a few hours for travel-focused sites
- Sites with original travel content get approved faster

### Important Notes

- Affiliate partners redirect users to viator.com to complete purchase
- Merchant partners can complete transactions on their own site (requires certification)
- API v2 is the current version
- Viator API Certification is required for Merchant-level access
- No rate limits mentioned for reasonable usage
- Products cover 300,000+ experiences in 200+ countries

---

## 2. GetYourGuide (via Awin / Travelpayouts)

GetYourGuide does NOT offer a direct in-house affiliate program. You must join through a network partner.

### Option A: Awin (Recommended for EU/Global)

#### Links

- Awin Signup: https://www.awin.com/us/affiliates
- GetYourGuide on Awin (US): https://ui.awin.com/merchant-profile/18925
- GetYourGuide on Awin (UK): https://ui.awin.com/merchant-profile/77814

#### Step-by-Step Registration

1. Go to https://www.awin.com/us/affiliates and click "Join as Publisher"
2. Pay the $1/GBP1 refundable sign-up deposit (refunded on first payment)
3. Fill in your website details, traffic sources, and promotional methods
4. Wait for Awin account approval (1-3 business days)
5. Once approved, search for "GetYourGuide" in the Advertiser Directory
6. Apply to the GetYourGuide program (Merchant ID: 18925 for US, 77814 for UK)
7. Wait for GetYourGuide to approve your application
8. Once approved, access deep links, banners, and product feeds

#### What Data/Tools are Available

- Deep links to specific activities/destinations
- Banner ads (various sizes)
- Product data feeds (CSV/XML) with activity details
- Widget integration options
- Text links with custom tracking
- Awin reporting dashboard

#### What You CANNOT Get via This Route

- No real-time availability checking API
- No booking API (users redirect to GetYourGuide)
- No product detail API endpoints
- No real-time pricing API
- Limited to pre-generated data feeds (not live data)
- No custom search functionality

#### Commission Rate

- **7% base** commission on Awin
- 30-day cookie duration
- Twice-monthly payouts via Awin

### Option B: Travelpayouts (Recommended for Content Sites)

#### Links

- Travelpayouts Signup: https://www.travelpayouts.com/en/
- GetYourGuide on Travelpayouts: https://www.travelpayouts.com/en/offers/getyourguide-affiliate-program/

#### Step-by-Step Registration

1. Go to https://www.travelpayouts.com/en/ and click "Join for Free"
2. Register with email and website details
3. Once approved, find GetYourGuide in the "Offers" section
4. Apply to the GetYourGuide program
5. Once approved, access widgets, deep links, and API tools

#### What Data/Tools are Available

- Widgets and tables (embeddable tour listings)
- Deep links to specific activities
- WordPress plugin for easy integration
- Travelpayouts API for link generation
- Reporting interface

#### Commission Rate

- **8%** commission via Travelpayouts
- 30-day cookie duration

### Option C: GetYourGuide Partner API (Direct - Limited Access)

#### Links

- API Endpoint: https://api.getyourguide.com/
- API Reference: https://code.getyourguide.com/partner-api-spec/

#### Important Notes

- The Partner API requires a direct partnership agreement with GetYourGuide
- Not available to general affiliates
- Must contact GetYourGuide business development directly
- Typically reserved for large OTAs and travel platforms

### Expected Approval Time

- Awin account: 1-3 business days
- GetYourGuide program approval on Awin: 3-7 business days
- Travelpayouts: 1-2 business days

---

## 3. Klook (Partner API)

Klook offers both an affiliate program and a Partner API for deeper integration.

### Links

- Affiliate Portal: https://affiliate.klook.com/home
- Partner Page: https://www.klook.com/partner/
- API Documentation (OpenAPI): https://klook.gitbook.io/openapi
- Products Endpoint Docs: https://klook.gitbook.io/openapi/api-core-mandatory/products

### Step-by-Step Registration

**For Affiliate Program:**
1. Go to https://affiliate.klook.com/home
2. Click "Sign Up" or "Join Now"
3. Fill in your website/app details, traffic information, and promotional methods
4. Submit application
5. Wait for approval (typically 2 working days via Involve Asia)
6. Once approved, access tracking links and dashboard

**For Partner API Access:**
1. First register as an affiliate at https://affiliate.klook.com/home
2. Once established as an affiliate, contact Klook partner team via https://www.klook.com/partner/
3. Express interest in API integration (state your use case, expected volume)
4. Klook will evaluate and potentially grant API access
5. Receive API credentials and access to OpenAPI documentation
6. Integrate using the REST API endpoints

### Available Data (Partner API)

**Core Endpoints (Mandatory):**
- `GET /products` - Fetch product listings
- Availability checking (real-time)
- Pricing (dynamic pricing by traveler type)
- Booking creation and management
- Cancellation processing

**Product Data Includes:**
- Product descriptions, images, highlights
- Inclusions/exclusions
- Meeting point information
- Duration and schedule
- Multiple ticket delivery formats (QRCODE, CODE128, PDF_URL)
- Redemption methods (DIGITAL, PRINT, MANIFEST)

**Additional Features:**
- Pickup information
- Availability holds and price locking
- Bulk product content retrieval
- 530,000+ travel experiences across 1,700+ destinations

### Commission Rate

- **2% to 20%** depending on product category:
  - Tours: 6.5%
  - Hotels: 6.5%
  - Attractions/tickets: 5%
  - Klook eSIM: 20%
  - Transport: varies
- 30-day cookie window (7 days for hotels and car rentals)
- No commission cap
- Upsized commissions during peak travel periods

### Expected Approval Time

- Affiliate program: 2-5 business days
- Partner API access: 1-4 weeks (requires additional review)

### Important Notes

- API uses OCTO (Open Connectivity for Tourism) standard
- Accepts worldwide traffic
- Separate Kreator Program for social media influencers
- Also available via Involve Asia, Ecomobi, and CJ Affiliate networks

---

## 4. KKday (KKpartners)

KKday is the leading travel e-commerce platform in Asia with strong coverage of Japan, Taiwan, Korea, and Southeast Asia.

### Links

- KKpartners Signup: https://kkpartners.kkday.com/
- Cooperation Agreement: https://kkpartners.kkday.com/term/agreements
- Supplier Portal: https://www.kkday.com/en/kk/supplier

### Step-by-Step Registration

1. Go to https://kkpartners.kkday.com/
2. Click "Sign Up" or "Join Now"
3. Select your partner type (Content Creator, Travel Blogger, Website Owner, etc.)
4. Fill in your details:
   - Website/app URL
   - Traffic volume and sources
   - Target audience and regions
   - Promotional methods
5. Submit application
6. Wait for approval (typically 3-7 business days)
7. Once approved, access your affiliate dashboard
8. Generate tracking links and start promoting

### Available Data

**Via Affiliate Dashboard:**
- Deep links to specific products
- Banner creatives and promotional materials
- Product feeds (for select partners)
- Performance reporting and analytics
- Tracking links with affsub parameters

**Product Coverage:**
- 300,000+ experiences
- Strong Asia focus: Japan, Taiwan, Korea, Thailand, Hong Kong, Singapore
- Tours, tickets, transport, WiFi/SIM, food experiences
- Regional-specific products not found on Western platforms

### Commission Rate

- **2-5%** per completed booking (varies by region and category)
- Base rate: ~3.15% CPS (cost per sale)
- Higher rates possible for high-volume partners
- 30-day cookie duration
- Last-click attribution model

### Expected Approval Time

- **3-7 business days**

### Important Notes

- Strongest for Asia-Pacific tours and activities
- Also available via Involve Asia and other networks
- Deep linking supported via affsub5 parameter
- Accepted regions: US, Thailand, Taiwan, Singapore, Malaysia, Korea, Japan, China, Hong Kong, Global
- KKday's strength is hyper-local experiences in Asia that other platforms miss
- For API-level integration, contact KKpartners team directly after becoming an established affiliate

---

## 5. Activity Japan (API with NDA)

Activity Japan (owned by Rakuten Group) specializes in outdoor activities and experiences across Japan. API access requires a partnership agreement with NDA.

### Links

- Official API Page: https://pr.activityjapan.co.jp/api
- Company Website: https://www.activityjapan.co.jp/
- Partner Inquiry Contact: TEL 03-6894-1512

### How to Request API Access

1. Visit https://pr.activityjapan.co.jp/api to review API offerings
2. Contact the Partner Inquiry Department:
   - Phone: **03-6894-1512**
   - Or use the inquiry form on the API page
3. Discuss your use case, expected volume, and integration needs
4. Activity Japan will schedule a consultation (development staff may join)
5. Sign NDA and partnership agreement
6. Receive connection information (URLs, credentials, passwords)
7. Begin development and integration

### What's Available

**Information API (Info API):**
- Product/plan information (17,000+ activity plans)
- Activity descriptions, images, schedules
- Pricing and availability data
- Area/category taxonomy
- For affiliate contracts, only Info API setup is required

**Booking API:**
- Real-time availability checking
- Reservation creation
- Booking management
- Payment processing integration
- Required for transactional partnerships

### Process/Timeline

1. **Initial Contact**: 1-2 weeks for first response
2. **Consultation**: 1-2 weeks to schedule and complete
3. **NDA & Agreement**: 2-4 weeks for legal review and signing
4. **Credential Delivery**: 1 week after agreement signed
5. **Development & Testing**: Varies (typically 2-4 weeks)
6. **Total estimated timeline: 6-12 weeks**

### Important Notes

- Owned by Rakuten Group (strong backing, reliable service)
- Exclusively Japan-focused activities
- Coverage includes: diving, snorkeling, rafting, paragliding, pottery, kimono experience, etc.
- Previous integrations: TRAVEL Now, J-TripGateway
- Japanese language preferred for business communications
- API documentation likely in Japanese
- Commission rates negotiated individually during partnership discussion

---

## 6. Asoview (Agent API)

Asoview is Japan's largest leisure/activity booking platform with an Agent API for partners.

### Links

- Agent API Documentation: https://agent-docs.asoview.com/
- Swagger UI: https://agent-docs.asoview.com/swagger/index.html
- Company Website: https://www.asoview.co.jp/
- Service Page: https://www.asoview.co.jp/service
- Partner Support: https://asoview.my.site.com/activitypartner/s/
- Tech Blog: https://tech.asoview.co.jp/

### How to Access Agent API

1. Visit https://agent-docs.asoview.com/ to review the API documentation
2. Review the Swagger docs at https://agent-docs.asoview.com/swagger/index.html to understand available endpoints
3. Contact Asoview business development:
   - Via partner support portal: https://asoview.my.site.com/activitypartner/s/
   - Or via company contact page at https://www.asoview.co.jp/
4. Submit a partnership inquiry explaining:
   - Your platform/business model
   - Expected booking volume
   - Integration use case
   - Target audience
5. Asoview will review and schedule a discussion
6. Sign partnership agreement
7. Receive API credentials (authentication tokens)
8. Develop integration using the Swagger documentation

### What's Available

**Agent API Capabilities:**
- Facility and ticket information retrieval
- Product/plan listing and details
- Availability checking
- Booking/purchase APIs
- Admission processing
- Electronic ticket issuance
- Ticket information coordination

**Platform Coverage:**
- Japan's largest leisure activity platform
- Theme parks, aquariums, museums
- Outdoor activities (camping, BBQ, fishing)
- Indoor experiences (escape rooms, VR, workshops)
- Hot springs and spa facilities
- Seasonal events and festivals

**Technical Details:**
- RESTful API with Swagger/OpenAPI documentation
- JSON response format
- Authentication via API tokens
- Full interactive Swagger UI for testing

### Process

1. **Review Documentation**: Self-service via Swagger UI
2. **Contact**: 1-2 weeks for initial response
3. **Discussion & Agreement**: 2-4 weeks
4. **Credential Issuance**: 1 week after agreement
5. **Integration Development**: 2-4 weeks
6. **Total estimated timeline: 5-10 weeks**

### Important Notes

- Documentation is primarily in Japanese
- Strong domestic Japan focus
- Asoview also operates "Urakata Ticket" (backend ticketing SaaS for facilities)
- External system integrations available (connected to various travel platforms)
- Agent API is separate from their consumer-facing API
- Business communications in Japanese preferred/required

---

## 7. Jalan (Affiliate via ValueCommerce)

Jalan.net is one of Japan's most popular travel booking sites (60M+ annual unique visitors). Affiliate access is through ValueCommerce ASP.

### Links

- ValueCommerce Affiliate Signup: https://aff.valuecommerce.ne.jp/reg/affiliate_presignup
- ValueCommerce Main Site: https://www.valuecommerce.ne.jp/affiliate/
- Jalan.net: https://www.jalan.net/

### How to Sign Up for ValueCommerce

1. Go to https://aff.valuecommerce.ne.jp/reg/affiliate_presignup
2. Enter your email address (mobile carrier emails not accepted)
3. Receive confirmation email and click the verification link
4. Fill in required information:
   - Full name (Japanese name required)
   - Address in Japan
   - Phone number
   - Bank account details (Japanese bank)
   - Website/blog URL
5. Submit registration
6. Wait for ValueCommerce to review and approve your site
7. Once approved, log in to your ValueCommerce dashboard

### How to Find Jalan Listings

1. Log in to ValueCommerce affiliate dashboard
2. Navigate to **Offer Search** (広告検索) from the menu
3. Click on **Travel/Hotel** (旅行・ホテル) category
4. Search for "じゃらん" (Jalan)
5. Find Jalan.net programs (multiple available for different services)
6. Click **Apply** (提携申請) for each Jalan program you want
7. **No approval required** - Jalan programs on ValueCommerce have instant acceptance

### What Data is Available

**Via ValueCommerce Tools:**
- Deep links to specific hotels, ryokan, and experiences
- Customizable ad widgets (colors, layout match your site)
- Product data feeds (hotel/accommodation listings)
- Banner creatives (multiple sizes)
- Text link generation
- "jalan net Affiliate+" enhanced customization tools
- Performance reporting

**Jalan Content Coverage:**
- Hotels and ryokan across Japan
- Onsen (hot spring) facilities
- Leisure activities and experiences (じゃらん遊び・体験)
- Restaurant reservations
- Rental cars
- Domestic flights
- Bus tours

**LinkShare/API Tools:**
- Product link builder
- MyLink (custom deep links)
- Auto-generated ad units
- Data feeds in CSV format

### Commission Rate

- **1-3%** per completed booking (varies by service)
- Accommodation bookings: ~1-2%
- Activities/experiences: ~2-3%
- ValueCommerce offers the highest self-back rates for Jalan among ASPs
- Monthly payouts (minimum threshold applies)

### Expected Approval Time

- ValueCommerce account: 3-7 business days
- Jalan program approval: **Instant** (no approval required)

### Important Notes

- ValueCommerce interface is entirely in Japanese
- Japanese bank account required for payouts
- Japanese address required for registration
- Site content in Japanese preferred for approval
- As of April 2026, ValueCommerce has 8,707 advertisers and 1,079,312 registered affiliates
- Jalan is also available via A8.net (another Japanese ASP) with similar terms
- For the "じゃらん遊び・体験" (activities/experiences) section, this is the most relevant for tour activities
- No direct API available - use affiliate links and data feeds only
- Consider using Jalan's Web Service API (separate from affiliate) for search functionality if available

---

## Summary Comparison Table

| Platform | API Type | Cost | Commission | Approval Time | Best For |
|----------|----------|------|------------|---------------|----------|
| **Viator** | Full REST API | Free | 8-12% | 1-5 days | Global tours, easiest API |
| **GetYourGuide** | Affiliate links only* | Free | 7-8% | 3-7 days | European tours |
| **Klook** | REST API (OpenAPI) | Free | 2-20% | 2-5 days (affiliate), 1-4 weeks (API) | Asia-Pacific activities |
| **KKday** | Affiliate links | Free | 2-5% | 3-7 days | Asia hyper-local |
| **Activity Japan** | REST API (NDA) | Free | Negotiated | 6-12 weeks | Japan outdoors |
| **Asoview** | REST API (Swagger) | Free | Negotiated | 5-10 weeks | Japan leisure/tickets |
| **Jalan** | Affiliate links/feeds | Free | 1-3% | 3-7 days (instant for Jalan) | Japan hotels + activities |

*GetYourGuide Partner API exists but requires direct business relationship

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Week 1-2)
1. **Viator** - Sign up immediately, get API access, richest data
2. **KKday** - Sign up for KKpartners, good Asia coverage with affiliate links
3. **Klook** - Sign up for affiliate, request API access

### Phase 2: Network Affiliates (Week 2-3)
4. **GetYourGuide via Travelpayouts** - Sign up, get widget tools
5. **Jalan via ValueCommerce** - Sign up (requires Japanese details)

### Phase 3: Japanese Platform APIs (Week 3-12)
6. **Asoview** - Contact for Agent API access
7. **Activity Japan** - Contact for API partnership (longest process)

---

## Tips for Faster Approval

1. **Have a live website** - All platforms check your site exists and has relevant content
2. **Travel-focused content** - Sites about travel/tourism get approved faster
3. **Clear monetization model** - Explain how you'll drive bookings
4. **Traffic data** - Be ready to share monthly visitors/page views
5. **Professional presentation** - Clean site design, privacy policy, terms of service
6. **Japan-specific**: For ValueCommerce/Asoview/ActivityJapan, having Japanese language content significantly helps
