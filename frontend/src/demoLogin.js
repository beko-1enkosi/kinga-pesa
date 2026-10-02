import { openDemoSession } from './demoAccount';
// Both configured PINs have the same delay and response shape. Configuration lives
// in demoSecurity.js. No mode or balance is returned to the login UI.
export async function authenticatePin(pin) {
  await new Promise(resolve => setTimeout(resolve, 650));
  return { success: openDemoSession(pin) };
}
