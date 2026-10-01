const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export class ApiError extends Error {
  constructor(key, kind = 'application', status = 0) {
    super(key);
    this.kind = kind;
    this.status = status;
  }
}

// No automatic retries: a lost POST response does not mean the transfer failed.
export async function api(path, method = 'GET', body) {
  if (!navigator.onLine) throw new ApiError('deviceOffline', 'offline');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method, signal: controller.signal, cache: 'no-store',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted || error instanceof TypeError) throw error;
      throw new ApiError('requestFailed', 'application', response.status);
    }
    if (!response.ok) {
      let key = 'requestFailed';
      const safeOperation = /\/(safe-access|recipient-access|withdrawals)$/.test(path);
      const safeErrors = {
        'Safe Access already configured.': 'saAlreadyConfigured',
        'Transfer must be Ready to Collect.': 'saNotReady',
        'PINs must be four numeric digits.': 'saInvalidPin',
        'PINs must differ.': 'saPinsDiffer',
        'Invalid protected amount.': 'saInvalidProtected',
        'PIN could not be verified.': 'saIncorrectPin',
        'Withdrawal exceeds available amount.': 'saWithdrawalTooLarge',
        'Collect remaining funds through recipient access.': 'saCollectionRequired',
      };
      if (response.status === 404) key = data.detail === 'Recipient not found' ? 'recipientNotFound' : 'transferNotFound';
      else if (response.status === 422) key = 'invalidData';
      else if (response.status === 409) {
        key = method === 'PATCH' ? 'statusConflict' : 'quoteChanged';
        if (data.detail === 'Transfer is already Collected') key = 'alreadyCollected';
      }
      if (typeof data.detail === 'string' && safeErrors[data.detail]) key = safeErrors[data.detail];
      else if (safeOperation && response.status === 422) {
        const fields = Array.isArray(data.detail) ? data.detail.map(error => error.loc?.at(-1)) : [];
        key = fields.includes('protected_amount') ? 'saInvalidProtected' :
          fields.includes('amount') ? 'saInvalidWithdrawal' : 'saInvalidPin';
      }
      if (path === '/service-quote' || path.startsWith('/service-purchases')) {
        const serviceErrors = {
          'Service unavailable for this recipient.': 'fsUnavailable',
          'Service quote no longer matches.': 'fsQuoteChanged',
          'Service purchase not found.': 'fsNotFound',
          'Enter a Zimbabwe phone number in +263 format.': 'fsInvalidPhone',
          'Enter a demo meter number of 6 to 20 digits.': 'fsInvalidMeter',
          'Enter a delivery recipient.': 'fsInvalidDelivery',
        };
        if (typeof data.detail === 'string' && serviceErrors[data.detail]) key = serviceErrors[data.detail];
        else if (response.status === 422) {
          const fields = Array.isArray(data.detail) ? data.detail.map(error => error.loc?.at(-1)) : [];
          key = fields.includes('amount') || fields.includes('send_amount') ? 'fsInvalidAmount' :
            fields.includes('service_type') ? 'fsUnavailable' : 'fsInvalidData';
        }
      }
      throw new ApiError(key, 'application', response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(navigator.onLine ? 'weakConnection' : 'deviceOffline', navigator.onLine ? 'network' : 'offline');
  } finally {
    clearTimeout(timeout);
  }
}
