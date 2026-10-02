import { keys, readStored } from './storage';

// One country choice determines the currency; users cannot mix the two.
export const senders = [
  { country: 'ZA', currency: 'ZAR', flag: '🇿🇦' },
  { country: 'BW', currency: 'BWP', flag: '🇧🇼' },
];
// Display-only fee labels. The backend calculates and verifies all actual fees.
export const fixedFeeLabels = { ZAR: '10.00', BWP: '7.50' };

export function readSenderCountry(draft) {
  // Restore the denomination of entered money, even if a preference differs.
  // Legacy drafts without a currency were entered in ZAR.
  if (draft.recipientId || draft.amount) return draft.sendCurrency === 'BWP' ? 'BW' : 'ZA';
  const country = readStored(keys.senderCountry, 'ZA');
  return senders.some(sender => sender.country === country) ? country : 'ZA';
}
