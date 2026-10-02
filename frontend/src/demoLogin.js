// Frontend navigation demo ONLY, not authentication or access control.
// Normal demo PIN: 1234. Never store, log, or put entered PINs in a URL.
// Replace this function with a POST to FastAPI later. Pass the entered PIN
// unchanged; keep the result generic so the UI never receives a PIN type/mode.
export async function authenticatePin(pin) {
  await new Promise(resolve => setTimeout(resolve, 650));
  return { success: pin === '1234' };
}
