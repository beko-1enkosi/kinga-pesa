# KingaPesa 🛡️💸

> **Send money. Support needs. Stay connected.**

KingaPesa is a multilingual, low-connectivity-aware cross-border family-support prototype built for the **Mukuru × WeThinkCode_ SheHacks Hackathon**.

The product is built around one simple idea:

> **Supporting family across borders should be simple, transparent, inclusive and flexible.**

KingaPesa combines cross-border remittance with clear fees and exchange rates, transfer tracking, multilingual support, safer recipient access, and purpose-based support such as airtime, electricity and grocery vouchers.

The hackathon version uses **mock exchange rates, simulated money movement, simulated SMS notifications and simulated provider fulfilment** where commercial integrations are not available.

---

## 🌍 The Problem

Cross-border customers may face several barriers at the same time:

- unclear fees and exchange rates
- unreliable mobile signal
- expensive or limited mobile data
- language barriers
- uncertainty about whether money has arrived
- recipients who may want more control over how funds are accessed
- senders who sometimes want to support a specific family need instead of sending unrestricted cash

A sender may want to say:

> “Send Mama money.”

But sometimes the need is more specific:

> “Buy Mama airtime.”

> “Pay for Mama’s electricity.”

> “Send Mama a grocery voucher.”

KingaPesa brings those needs into one lightweight experience.

---

# ✅ What KingaPesa Does

## 1. Cross-Border Remittance

A sender can:

- choose where they are sending from
- choose a recipient
- enter an amount
- request a quote
- see the transfer fee
- see the exchange rate
- see the total amount they will pay
- see exactly what the recipient will receive
- confirm the transfer
- track the transfer from send to collection

### Demo sender options

| Sender country | Currency |
| --- | --- |
| South Africa | ZAR |
| Botswana | BWP |

### Demo recipients

| Recipient | Country | Receive currency |
| --- | --- | --- |
| Mama | Zimbabwe | USD |
| Naledi | Botswana | BWP |

The sender country determines the sender currency.

Supported demo routes include:

```text
ZAR → USD
ZAR → BWP
BWP → USD
BWP → BWP
```

### Transfer journey

```text
Sent
  ↓
In Transit
  ↓
Ready to Collect
  ↓
Collected
```

For the hackathon demo, normal transfers can be advanced manually so the complete journey can be demonstrated.

---

## 2. Transparent Fees and FX 💱

KingaPesa shows the customer the transaction cost before confirmation.

### Demo remittance fees

**South Africa / ZAR**

```text
ZAR 10.00 + 2% of the amount sent
```

**Botswana / BWP**

```text
BWP 7.50 + 2% of the amount sent
```

### Mock exchange rates

| Route | Demo rate |
| --- | ---: |
| ZAR → USD | 1 ZAR = 0.055 USD |
| ZAR → BWP | 1 ZAR = 0.75 BWP |
| BWP → USD | 1 BWP = 0.073333 USD |
| BWP → BWP | 1 BWP = 1 BWP |

All financial calculations use `Decimal` arithmetic and `ROUND_HALF_UP`.

Before sending, the customer can see:

```text
You send
Transfer fee
Exchange rate
Total you pay
Recipient receives
```

The backend recalculates the quote during confirmation and rejects altered fees, rates, totals or currencies.

---

## 3. Multilingual Experience 🌍

KingaPesa currently supports:

- **English**
- **isiZulu**
- **Shona**

The selected language is remembered on the device.

The interface translates:

- remittance screens
- Family Services
- transfer statuses
- notifications
- Safe Access screens
- connectivity messages
- validation and error messages

Backend values remain stable while the frontend translates how they are shown to the customer.

---

## 4. Low-Connectivity Support 📶

KingaPesa is designed for customers using unstable or expensive connections.

The app can:

- detect when the browser is offline
- detect when the browser is online but the backend cannot be reached
- save a transfer draft
- restore the selected recipient and sender country
- cache recipient information
- restore an existing transfer after the page is closed
- restore notifications
- reconnect and fetch the latest state
- preserve completed service-purchase receipts
- reopen the production app shell using a lightweight service worker

KingaPesa does **not** pretend financial actions can safely complete offline.

When the device is offline:

- a new quote is not created
- a transfer cannot be confirmed
- a Family Service purchase cannot be completed
- Safe Access financial actions are blocked

This avoids confirming outdated information or replaying financial requests blindly.

---

## 5. Safe Reconnection and Duplicate Protection

If connectivity is lost after a quote is received, KingaPesa requires a live connection before confirmation and can revalidate the quote.

For uncertain transfer or service-purchase responses, the app does not automatically repeat the financial request.

This reduces the risk of creating duplicate transactions after a connection failure.

---

## 6. Receiver Notification 📩

When a transfer reaches:

```text
Ready to Collect
```

KingaPesa creates one simulated SMS notification for the recipient.

Example:

```text
Mama, your KingaPesa transfer of USD 55.00 is ready to collect.
```

The notification remains linked to the transfer even after collection.

> The prototype simulates SMS fulfilment. No live telecom messaging provider is connected.

---

# 🛡️ Safe Access

Safe Access is an optional recipient-side feature designed to give the recipient more control over what amount is displayed when accessing a transfer.

The recipient configures:

- a **Primary PIN**
- a separate **Safety PIN**
- a smaller **Protected Amount**

Example:

```text
Real amount available:      USD 55.00
Protected amount:           USD 15.00
```

Primary PIN:

```text
Available to collect: USD 55.00
```

Safety PIN:

```text
Available to collect: USD 15.00
```

The recipient interface looks the same regardless of which valid PIN was entered.

If USD 5 is withdrawn using the Safety PIN:

```text
Real remaining amount:      USD 50.00
Protected remaining amount: USD 10.00
```

### Safe Access implementation principles

- PINs are never stored in plaintext
- PBKDF2-HMAC-SHA256 is used for PIN hashing
- Primary and Safety PINs use separate random salts
- PIN comparisons are constant-time
- withdrawals reduce the real balance
- Safety PIN withdrawals also reduce the protected balance
- the recipient API does not reveal which PIN was used
- PINs and authenticated recipient balances are not stored in localStorage
- Safe Access requires live backend connectivity
- once Safe Access is configured, a transfer cannot be manually marked Collected while real funds remain
- the transfer becomes Collected automatically when the real remaining balance reaches zero

Safe Access does **not** contact emergency services and does not claim to guarantee personal safety.

---

# 🛍️ Support a Need

KingaPesa also lets the sender support a specific family need.

The current demo supports three Zimbabwe services for **Mama**:

### 📱 Airtime

Provider:

```text
Econet Zimbabwe
```

The sender enters a phone number and amount, then sees:

- sender currency
- service fee
- exchange rate
- USD airtime value
- provider

A successful demo purchase receives a generated reference.

> **Demo purchase — no real airtime is sent.**

### ⚡ Electricity

Provider:

```text
ZESA / ZETDC
```

The sender enters a prepaid meter number and amount.

KingaPesa returns:

- transparent currency conversion
- local electricity value
- a generated demo purchase reference
- a generated 20-digit demo electricity token

> **Demo token — not valid for real electricity.**

### 🛒 Grocery Voucher

Retailer:

```text
Gain Cash & Carry
```

The sender chooses an amount and sees the sender cost and USD voucher value before confirmation.

KingaPesa then generates:

- a demo voucher reference
- a demo voucher code

> **Demo voucher — not redeemable in a real store.**

---

## Family Services and Sender Currency

The selected sender country applies to both **Send Money** and **Support a Need**.

Example:

```text
Sender: Botswana / BWP
Service: Econet Zimbabwe airtime
You pay: BWP 100.00
Service fee: BWP 0.00
Exchange rate: 1 BWP = 0.073333 USD
Airtime value: USD 7.33
```

Family Services are currently configured only for the Zimbabwe demo recipient.

Naledi / Botswana does not currently have demo provider services configured.

---

# 💱 Currency and Value Clarity

Every financial flow follows the same transparency principle.

Before confirming, the customer should understand:

- what they are paying
- the sender currency
- the exchange rate
- any fee
- what value reaches the recipient
- the recipient or provider currency

This applies to:

- remittance
- airtime
- electricity
- grocery vouchers

---

# 📱 Data-Light Mode

KingaPesa includes a Data-Light mode designed for constrained connections.

The current implementation:

- avoids unnecessary polling
- avoids large media
- avoids unnecessary background requests
- reuses cached recipient information where appropriate
- keeps the frontend lightweight
- stores application files for offline reopening

Financial API mutations are never treated as offline transactions.

---

# 📡 Sponsored Data Demo

KingaPesa also demonstrates how sponsored or zero-rated access could work in a production environment.

Conceptually:

```text
Mobile data switched ON
        +
Participating mobile network
        ↓
KingaPesa traffic is sponsored
        ↓
Customer does not use their own paid data bundle
```

The current browser prototype only **simulates this product concept**.

Real zero-rating would require commercial and technical agreements with participating mobile-network operators.

---

# 🧭 Product Model

```text
                         KingaPesa
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
      Send Money         Support a Need      Protect Access
          │                  │                  │
     Remittance            Airtime           Safe Access
     Tracking              Electricity
     Fees + FX             Grocery Voucher
     Notifications         Currency Clarity
```

KingaPesa is not only about transferring money.

It is about helping people **support family across borders in the way that family actually needs**.

---

# 🧪 Prototype Boundaries

KingaPesa is a hackathon prototype.

## Simulated in the demo

- real money movement
- exchange rates
- SMS delivery
- sponsored / zero-rated mobile data
- airtime provider fulfilment
- electricity provider fulfilment
- grocery voucher fulfilment
- commercial provider responses

## Implemented application logic

- quote calculations
- sender-country and sender-currency handling
- transfer creation
- transfer status progression
- data persistence
- multilingual UI
- connectivity handling
- cached restoration
- duplicate-send protection
- receiver notification records
- Safe Access PIN verification and withdrawal accounting
- Family Service quoting and purchase persistence
- generated demo service references, tokens and voucher codes

---

# 🛠️ Tech Stack

## Frontend

- React
- Vite
- JavaScript
- CSS
- localStorage
- lightweight service-worker caching

## Backend

- Python
- FastAPI
- SQLite
- Pydantic
- Pytest

## Architecture

```text
React + Vite
     │
     │ REST API
     ▼
FastAPI
     │
     ▼
SQLite
```

---

# 🔌 API

## Core

```text
GET    /health
GET    /recipients
POST   /quote
POST   /transfers
GET    /transfers/{id}
PATCH  /transfers/{id}/status
GET    /transfers/{id}/notifications
```

## Safe Access

```text
POST   /transfers/{id}/safe-access
GET    /transfers/{id}/safe-access
POST   /transfers/{id}/recipient-access
POST   /transfers/{id}/withdrawals
```

## Family Services

```text
GET    /recipients/{id}/services
POST   /service-quote
POST   /service-purchases
GET    /service-purchases/{id}
```

---

# 📁 Project Structure

```text
kinga-pesa/
│
├── backend/
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── pricing.py
│   ├── safe_access.py
│   ├── services.py
│   ├── requirements.txt
│   └── tests/
│
├── frontend/
│   ├── scripts/
│   ├── src/
│   │   ├── i18n/
│   │   ├── api.js
│   │   ├── FamilyServices.jsx
│   │   ├── main.jsx
│   │   ├── RecipientAccess.jsx
│   │   ├── sender.js
│   │   ├── storage.js
│   │   ├── style.css
│   │   └── useConnection.js
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

---

# ▶️ Running KingaPesa

## Backend

### Linux / macOS

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Windows PowerShell

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

FastAPI documentation:

```text
http://127.0.0.1:8000/docs
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

## Production Build / Offline Test

```bash
cd frontend
npm run build
npm run preview -- --host 127.0.0.1 --port 5173 --strictPort
```

Open the application once while online before testing an offline reload.

Chrome DevTools can be used to simulate offline mode and mobile devices during testing.

---

# 🧪 Validation

Latest functional validation before frontend visual polish:

```text
184 backend tests passed
npm run build passed
```

Browser validation covered:

- South Africa / ZAR → Zimbabwe / USD
- South Africa / ZAR → Botswana / BWP
- Botswana / BWP → Zimbabwe / USD
- Botswana / BWP → Botswana / BWP
- all three Zimbabwe Family Services using BWP
- quote invalidation when sender country changes
- historical transaction currency preservation
- persistence across refresh/reopen
- English, isiZulu and Shona
- Safe Access on BWP-funded USD transfers
- notifications
- offline / reconnection behaviour
- lost-response duplicate protection

---

# 🎬 Suggested Demo Story

The demo follows one family-support journey instead of presenting disconnected features.

### Thandi and Mama

**Thandi supports her mother, Mama, across the border.**

1. Thandi opens KingaPesa.
2. She chooses where she is sending from.
3. She chooses her preferred language.
4. She selects Mama.
5. She enters the amount she wants to send.
6. KingaPesa shows the fee, exchange rate and recipient amount before confirmation.
7. Thandi confirms the transfer.
8. The transfer moves through **Sent → In Transit → Ready to Collect**.
9. Mama receives a simulated notification.
10. If connectivity drops, KingaPesa preserves the journey and reconnects safely.
11. Mama can use Safe Access when collecting the transfer.
12. Thandi can also support Mama directly through:
    - airtime
    - electricity
    - a grocery voucher
13. KingaPesa shows what each service costs in the sender currency and what value reaches Mama.

End with:

> **KingaPesa lets people send money home, support specific family needs and stay connected even when connectivity is difficult.**

---

# 👥 Team Principle

Before adding anything to KingaPesa, ask:

> **Does this make supporting family across borders simpler, clearer, more inclusive or safer?**

If the answer is yes, it belongs in KingaPesa.

---

# KingaPesa

### **Send money. Support needs. Stay connected.**
