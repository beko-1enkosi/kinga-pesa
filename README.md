# King-Pesa 🛡️

> **Money Home, Made Simple.**  
> A simple, multilingual, low-connectivity cross-border remittance app with recipient safety protection.

---

## 📌 Problem Statement

Cross-border remittance customers across Africa face significant barriers when sending money home to support their families:
- **Hidden Costs:** Opaque fees and exchange rates lead to uncertainty before completing a transfer.
- **Connectivity Barriers:** Heavy mobile apps fail or drop transactions in areas with low bandwidth or poor mobile network coverage.
- **Language Barriers:** Non-intuitive interfaces that lack native language support create confusion.
- **Post-Arrival Safety:** Recipient safety at physical cash payout locations is often overlooked, leaving vulnerable family members exposed to extortion or coercion.

---

## 💡 Solution: What is King-Pesa?

**King-Pesa** (meaning *"Protect"* in Swahili) is designed specifically for Mukuru's core audience. It ensures that sending money home is **simple to send, transparent to track, and safer to access**.

It satisfies all standard cross-border remittance needs while introducing **Safe Access**, a unique safety feature that protects recipients at the point of cash pickup.

---

## 🚀 Key Features

### 1. Transparent Remittance Flow
- **Upfront Costs:** Clear display of transfer fees, FX rates, total charge, and exact payout amount before confirmation—no hidden charges.
- **Human-Readable Tracking:** Real-time transfer updates (*Sent → In Transit → Ready to Collect → Collected*).
- **Receiver Notifications:** Automatic alerts when money is ready for payout.

### 2. Built for Low-Connectivity & Inclusivity
- **Ultra-Lightweight UI:** Designed for low-end mobile phones and unstable $2\text{G}/3\text{G}$ networks.
- **Multilingual Support:** Native language selection (e.g., IsiZulu, Shona, English) with a scalable architecture for future locales.
- **Multi-Corridor Aware:** Dynamic configuration for sender/receiver countries and currencies.

### 3. Standout Feature: Safe Access 🔒
An optional security layer for situations where a recipient is being forced or coerced to reveal their wallet balance:
- **Dual PIN System:** Users set a standard **Primary PIN** and a **Safe Access PIN**.
- **Balance Masking:** Entering the Safe Access PIN opens the app normally but only displays a user-defined **Protected Amount** (e.g., showing **R300** instead of an actual **R4,800** balance).
- **State Persistence:** Withdrawing money under Safe Access reduces only the protected balance on screen (e.g., withdrawing R100 leaves a visible R200 balance), keeping the true underlying balance secure until authenticated via the Primary PIN.