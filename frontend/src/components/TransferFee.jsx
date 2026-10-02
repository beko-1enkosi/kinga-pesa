import React from 'react';
import { fixedFeeLabels } from '../sender';
import './TransferFee.css';

export function TransferFee({ quote, t, money }) {
  const currency = quote.send_currency;
  // Display only: use the quoted amount and backend fee, never a replacement fee.
  return <div className="kp-fee-row">
    <dt>{t('transferFee')}</dt><dd>{money(quote.fee, currency)}</dd>
    <dd className="kp-fee-explanation">{t('transferFeeBreakdown', {
      base: money(fixedFeeLabels[currency], currency),
      amount: money(quote.send_amount, currency),
      fee: money(quote.fee, currency),
    })}</dd>
  </div>;
}
