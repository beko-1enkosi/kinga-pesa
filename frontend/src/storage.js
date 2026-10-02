export const keys = {
  senderCountry: 'kingapesa.senderCountry',
  draft: 'kingapesa.draft',
  recipients: 'kingapesa.recipients',
  currentTransfer: 'kingapesa.currentTransfer',
  dataLight: 'kingapesa.dataLight',
  sponsoredDemo: 'kingapesa.sponsoredDemo',
  pendingSend: 'kingapesa.pendingSend',
  currentServicePurchase: 'kingapesa.currentServicePurchase',
  pendingServicePurchase: 'kingapesa.pendingServicePurchase',
};

export function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function storageAvailable() {
  try {
    localStorage.getItem(keys.draft);
    return true;
  } catch {
    return false;
  }
}
