# KingaPesa 🛡️💸

> **Money home, made simple, clear and resilient.**

KingaPesa is a multilingual, data-conscious cross-border remittance prototype built for the **Mukuru × WeThinkCode_ SheHacks Hackathon**.

The product is designed around one idea:

> **Supporting family across borders should be simple, transparent, inclusive and flexible.**

KingaPesa lets customers send money, track it clearly, continue through unstable connectivity, and support family needs through services such as airtime, electricity and grocery vouchers.

The hackathon version uses **mock financial rates, simulated transfers and simulated provider fulfilment** where real commercial integrations are not available.

---

# 🌍 The Problem

Cross-border customers may face several barriers at once:

- unclear fees and exchange rates
- unreliable mobile signal
- limited or expensive mobile data
- language barriers
- uncertainty about whether money has arrived
- recipients who may need safer access to funds
- senders who sometimes want to support a specific need rather than send unrestricted cash

A customer may not only want to say:

> “Send Mama money.”

They may instead want to say:

> “Buy Mama airtime.”

> “Pay for Mama’s electricity.”

> “Send Mama a food voucher.”

KingaPesa brings those needs into one simple cross-border experience.

---

# 💡 The KingaPesa Solution

KingaPesa is designed as a lightweight family-support platform.

A sender can use KingaPesa to:

- send cross-border money
- see fees and exchange rates before confirming
- track a transfer
- receive information in multiple languages
- continue after network interruptions
- simulate sponsored / zero-rated access
- notify the recipient when money is ready
- buy airtime for a recipient
- pay for prepaid electricity
- send a grocery voucher
- understand the value of each purchase in the recipient’s currency

The core transfer system is already working.

Additional provider-based services can be demonstrated using **mock integrations** so judges can experience the complete product idea without requiring live commercial provider APIs.

---

# ✅ Working Core Features

## 1. Cross-Border Remittance

The sender can:

- choose a recipient
- enter an amount in ZAR
- request a quote
- see the transfer fee
- see the exchange rate
- see the total amount they will pay
- see exactly what the recipient will receive
- confirm the transfer
- track the transfer status

Current demo recipients include:

- **Mama — Zimbabwe — USD**
- **Naledi — Botswana — BWP**

Transfer journey:

```text
Sent
  ↓
In Transit
  ↓
Ready to Collect
  ↓
Collected
```

For the hackathon demo, status progression can be advanced manually so the complete transfer journey can be shown.

---

## 2. Transparent Fees and FX 💱

KingaPesa shows the cost of the transaction before confirmation.

Current demo fee calculation:

```text
ZAR 10.00 + 2% of the amount sent
```

Mock exchange rates are currently used.

The sender can clearly see:

```text
You send
Transfer fee
Exchange rate
Total you pay
Recipient receives
```

The backend also recalculates the quote before creating a transfer so altered totals are rejected.

---

## 3. Multilingual Experience 🌍

KingaPesa currently supports:

- **English**
- **isiZulu**
- **Shona**

The selected language is remembered on the device.

The interface translates:

- transfer information
- fee information
- statuses
- notifications
- connection messages
- error messages

Backend status values remain stable while the frontend translates how they are shown to the customer.

---

## 4. Receiver Notification 📩

When a transfer reaches:

```text
Ready to Collect
```

KingaPesa creates a simulated SMS notification.

Example:

```text
Mama, your KingaPesa transfer of USD 55.00 is ready to collect.
```

The notification remains linked to the transfer.

> The current hackathon version simulates the SMS. No real telecom messaging provider is connected yet.

---

## 5. Low-Connectivity Support 📶

KingaPesa is designed for customers who may move in and out of connectivity.

The app can:

- detect when the device goes offline
- detect when the browser is online but the backend cannot be reached
- save a transfer draft
- restore the selected recipient
- restore the entered amount
- cache recipient information
- restore an existing transfer after the browser or tab is closed
- show the last saved transfer state offline
- restore notifications
- reconnect and fetch the latest transfer state

The product does **not** pretend financial actions can safely complete offline.

When the user is offline:

- a new quote is not generated
- a transfer cannot be confirmed
- the customer is told that their progress has been saved

This avoids confirming outdated rates or fees.

---

## 6. Safe Reconnection Behaviour

If connectivity is lost after a quote is received, KingaPesa waits for a live connection before sending.

If needed, the quote is checked again.

The app also avoids automatically retrying uncertain transfer requests, helping reduce the risk of duplicate sends.

---

## 7. Data-Light Mode 📱

KingaPesa includes a Data-light mode designed for unstable or expensive connections.

The current implementation:

- avoids unnecessary polling
- avoids large media
- avoids unnecessary background traffic
- reuses cached information when appropriate
- keeps the interface lightweight
- stores app files for offline reopening

Financial API actions are not treated as offline transactions.

---

## 8. Sponsored / Zero-Rated Data Demo 📡

KingaPesa demonstrates how sponsored data could work in a real deployment.

```text
Mobile data switched ON
        +
Participating network
        ↓
KingaPesa traffic is sponsored
        ↓
Customer does not use their own paid data bundle
```

The current prototype includes a **Sponsored Data Demo** mode.

### Demo limitation

The browser prototype does not actually zero-rate traffic.

In a real product, sponsored access would require agreements and technical integration between Mukuru and participating mobile-network operators.

---

# 🛡️ Next Standout Feature: Safe Access

Safe Access is the planned recipient-side protection feature.

A recipient can configure:

- a **Primary PIN**
- a separate **Safety PIN**
- a smaller **Protected Amount**

Example:

```text
Real amount available: USD 100
Protected amount:      USD 20
```

Primary PIN:

```text
Available to collect: USD 100
```

Safety PIN:

```text
Available to collect: USD 20
```

The recipient interface should look normal in both cases.

If USD 5 is collected using the Safety PIN:

```text
Real remaining amount:      USD 95
Protected remaining amount: USD 15
```

### Safe Access principles

- never visually reveal which PIN was used
- never store PINs in plaintext
- preserve correct financial accounting
- withdrawals reduce the real balance
- protected balance persists
- do not automatically contact police
- do not claim to guarantee personal safety

Safe Access is the next major feature planned for implementation.

---

# 🛍️ KingaPesa Services

The demo product can go beyond sending unrestricted cash.

These service flows may use **mock provider integrations** so the complete customer experience can be demonstrated.

The mock layer should behave like a real provider response from the user’s perspective while remaining clearly identified in technical documentation as simulated.

---

## 1. Buy Airtime for Family 📱

A sender can buy airtime directly for someone in another country.

Example flow:

```text
Services
   ↓
Buy Airtime
   ↓
Choose recipient / country
   ↓
Choose mobile network
   ↓
Enter phone number
   ↓
Choose airtime value
   ↓
See cost in ZAR
   ↓
See value in recipient currency
   ↓
Confirm
   ↓
Airtime sent successfully
```

### Demo behaviour

For the hackathon:

- one network can be selected as the demo provider
- available airtime bundles or denominations can be mocked
- the purchase response can be simulated
- a mock transaction reference can be generated
- the interface can show the purchase as completed

Example:

```text
Airtime Purchase

You pay: ZAR 100
Recipient value: USD XX.XX
Mobile number: +XXX...
Provider: Demo Network

Status: Successful
```

### Production version

A real deployment would connect KingaPesa to an approved airtime provider, mobile operator or aggregator API.

---

## 2. Pay Electricity ⚡

A sender can pay for prepaid electricity for a family member.

Example flow:

```text
Services
   ↓
Electricity
   ↓
Choose country / provider
   ↓
Enter meter number
   ↓
Choose amount
   ↓
See ZAR cost
   ↓
See value in local currency
   ↓
Confirm
   ↓
Receive electricity token
```

### Demo behaviour

The hackathon version can simulate:

- provider selection
- meter validation
- currency conversion
- successful payment
- generated prepaid token
- transaction reference

Example:

```text
Electricity Purchase

Meter: 123456789
You pay: ZAR 300
Local value: USD XX.XX

Token:
4821 7739 1084 5620

Status: Successful
```

The token is a **mock demo token**, not a real utility token.

### Production version

A real deployment would require integration with the selected electricity provider or prepaid utility aggregator.

---

## 3. Grocery / Food Voucher 🛒

A sender may want to make sure support is used specifically for food and household essentials.

Instead of sending unrestricted cash, KingaPesa can provide a grocery voucher.

Example:

```text
Services
   ↓
Grocery Voucher
   ↓
Choose retailer
   ↓
Choose voucher value
   ↓
See ZAR cost
   ↓
See recipient-currency value
   ↓
Confirm
   ↓
Voucher generated
```

The demo may use **Shoprite** as the example retailer if the team chooses it for the final prototype.

### Demo behaviour

KingaPesa can simulate:

- retailer selection
- voucher amount
- FX conversion
- voucher generation
- redemption code
- recipient notification

Example:

```text
Grocery Voucher

Retailer: Shoprite
You pay: ZAR 500
Voucher value: USD XX.XX

Voucher code:
KP-FOOD-483921

Status: Ready to use
```

The voucher code is a **mock demo code**.

### Why this matters

Cash is flexible, but sometimes the sender has a specific intention:

> “This money is for groceries.”

KingaPesa gives the sender the option to support that need directly.

---

# 💱 Currency Translation and Value Clarity

Every KingaPesa service should follow the same transparency principle as remittances.

Before confirming, the sender should understand:

- what they are paying in ZAR
- the exchange rate
- any fee
- what value reaches the recipient
- the recipient-country currency

Example:

```text
You pay:
ZAR 500

Exchange rate:
1 ZAR = X.XX local currency

Recipient value:
USD XX.XX

Service:
Grocery Voucher
```

This applies to:

- remittance
- airtime
- electricity
- grocery vouchers

For the hackathon, mock FX values are acceptable.

A production product would connect to an approved live rate source.

---

# 🧭 Product Vision

```text
                         KingaPesa
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
      Send Money         Pay a Need         Protect Access
          │                  │                  │
     Remittance            Airtime           Safe Access
     Tracking              Electricity
     Fees + FX             Food Voucher
     Notifications         Currency Clarity
```

KingaPesa is not only about transferring money.

It is about helping people **support family across borders in the way that family actually needs**.

---

# 🎯 Hackathon Build Scope

## Already Working

- core remittance journey
- transparent fee display
- mock FX
- transfer tracking
- English
- isiZulu
- Shona
- simulated receiver notification
- low-connectivity persistence
- reopening saved transfers
- connection recovery
- Data-light mode
- Sponsored Data Demo

## Next Major Build

- Safe Access

## Planned Demo Services

- Airtime
- Electricity
- Grocery Voucher
- Currency translation for service value

These may use mock provider data and simulated fulfilment.

The purpose is to demonstrate the complete KingaPesa customer experience, not to pretend that commercial integrations were completed during the hackathon.

---

# 🔬 Provider Research

The team can research one realistic provider for each service so that the mock demo resembles a possible real deployment.

### Airtime

Research one:

- mobile network
- country
- denominations
- digital purchase flow
- API or aggregator option

### Electricity

Research one:

- electricity provider
- country
- meter / customer identifier
- prepaid purchase process
- integration possibility

### Grocery Voucher

Research:

- Shoprite or another suitable grocery retailer
- supported country
- digital voucher availability
- redemption process
- possible API / voucher partner

The prototype may still mock the transaction even after a realistic provider is selected.

---

# 🧪 Prototype and Production Boundaries

KingaPesa is a hackathon prototype.

## Simulated in the demo

- money movement
- exchange rates
- SMS fulfilment
- sponsored mobile data
- airtime fulfilment
- electricity fulfilment
- grocery voucher generation
- external provider responses

## Real application logic in the prototype

- transfer journey
- quote calculations
- status progression
- data persistence
- multilingual UI
- connectivity handling
- caching
- receiver notification records
- transaction-state handling

This allows the team to demonstrate a realistic finished product while being clear about which external systems are mocked.

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

# 🔌 Current API

```text
GET    /health

GET    /recipients

POST   /quote

POST   /transfers

GET    /transfers/{id}

PATCH  /transfers/{id}/status

GET    /transfers/{id}/notifications
```

Safe Access and service-purchase endpoints will be added as those demo features are implemented.

---

# 📁 Current Project Structure

```text
kinga-pesa/
│
├── backend/
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   └── tests/
│
├── frontend/
│   ├── scripts/
│   ├── src/
│   │   ├── i18n/
│   │   ├── api.js
│   │   ├── main.jsx
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

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

uvicorn main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

FastAPI docs:

```text
http://127.0.0.1:8000/docs
```

## Frontend

```bash
cd frontend

npm ci
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

---

# 🎬 Suggested Demo Story

The final demo should follow one person instead of presenting disconnected features.

### Thandi and Mama

**Thandi works in Johannesburg and supports her mother, Mama, across the border.**

1. Thandi opens KingaPesa.
2. She chooses her preferred language.
3. She selects Mama.
4. She enters the amount she wants to send.
5. KingaPesa clearly shows the fee, exchange rate and recipient amount.
6. Thandi confirms.
7. The transfer moves to **Sent** and then **In Transit**.
8. Her connection drops.
9. KingaPesa preserves her journey.
10. She closes the page.
11. She returns later and the transfer is still there.
12. KingaPesa reconnects and retrieves the latest status.
13. The transfer becomes **Ready to Collect**.
14. Mama receives a simulated notification.
15. Safe Access can then demonstrate safer recipient access.
16. Thandi can also choose to support Mama differently:
    - buy airtime
    - pay electricity
    - send a grocery voucher
17. KingaPesa shows the ZAR cost and what the service is worth in Mama’s currency.

End with:

> **KingaPesa lets people send money home, support specific family needs and stay connected even when connectivity is difficult.**

---

# 🌅 Morning Finalisation Checklist

- [ ] Test remittance from start to finish
- [ ] Test English
- [ ] Test isiZulu
- [ ] Test Shona
- [ ] Test offline draft restoration
- [ ] Close and reopen a saved transfer
- [ ] Test reconnection
- [ ] Test receiver notification
- [ ] Implement Safe Access
- [ ] Build Airtime demo
- [ ] Build Electricity demo
- [ ] Build Grocery Voucher demo
- [ ] Add service currency-value display
- [ ] Select realistic mock providers
- [ ] Finalise visual design
- [ ] Remove unnecessary debug/demo clutter
- [ ] Run backend tests
- [ ] Run frontend build
- [ ] Prepare 5–7 minute presentation
- [ ] Give every team member a speaking section
- [ ] Rehearse the full customer story

---

# 👥 Team Principle

Before adding a feature, ask:

> **Does this make supporting family across borders simpler, clearer, more inclusive or safer?**

If the answer is yes, it belongs in KingaPesa.

---

# KingaPesa

### **Send money. Support needs. Stay connected.**
