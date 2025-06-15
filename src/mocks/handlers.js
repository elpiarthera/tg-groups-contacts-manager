// src/mocks/handlers.js
import { rest } from 'msw';

export const handlers = [
  // Mock for POST /api/extract-data
  rest.post('/api/extract-data', async (req, res, ctx) => {
    const body = await req.json();

    if (body.action === 'checkSession') {
      // This mock assumes that if specific credentials for an "existing session user" are passed,
      // it returns hasSession: true. Otherwise, false.
      // You might want to make this more generic or specific based on test needs.
      if (body.phoneNumber === '+12345670000' && body.apiId === 12345 && body.apiHash === 'validhashforsession') {
        return res(ctx.json({ hasSession: true }));
      }
      return res(ctx.json({ hasSession: false })); // Default to no session
    }

    if (!body.validationCode && !body.twoFactorPassword) {
      // Requesting code
      if (body.phoneNumber === '+19998887777') { // Simulate a number that requires 2FA later
         return res(ctx.json({ success: true, requiresValidation: true, message: 'Code sent to 2FA number', phoneRegistered: true }));
      }
      // Generic success for code request
      return res(ctx.json({ success: true, requiresValidation: true, message: 'Code sent', phoneRegistered: true }));
    }

    if (body.validationCode && !body.twoFactorPassword) {
      // Verifying code
      if (body.validationCode === '12345') { // Generic valid code
         if (body.phoneNumber === '+19998887777') { // This number needs 2FA after code verification
             return res(ctx.json({ success: false, requires2FA: true, message: 'Please enter your 2FA password.' }));
         }
        // Generic success for code verification (non-2FA path)
        return res(ctx.json({ success: true, message: 'Authentication successful. You can now extract data.' }));
      } else {
        // Generic invalid code
        return res(ctx.status(400), ctx.json({ success: false, message: 'Invalid validation code.' }));
      }
    }

    if (body.twoFactorPassword) {
      // Verifying 2FA password
      if (body.twoFactorPassword === 'password123') {
         return res(ctx.json({ success: true, message: '2FA Authentication successful. You can now extract data.' }));
      } else {
         return res(ctx.status(400), ctx.json({ success: false, message: 'Invalid 2FA password.'}));
      }
    }

    if (body.extractType) { // Data extraction after authentication
      return res(ctx.json({
        success: true,
        message: `Extracted ${body.extractType} successfully. Found 1 item.`, // Simplified message
        data: [{id: 'mockId1', name: `Mocked ${body.extractType} Data`}]
      }));
    }

    // Fallback for unhandled scenarios within /api/extract-data
    console.error('MSW: Unhandled POST /api/extract-data scenario:', body);
    return res(ctx.status(500), ctx.json({ success: false, message: 'Unhandled mock scenario for /api/extract-data' }));
  }),

  // Mock for POST /api/auth/logout
  rest.post('/api/auth/logout', (req, res, ctx) => {
    // No specific body check needed as backend now uses JWT from header
    return res(ctx.json({ success: true, message: 'Logged out successfully.' }));
  }),
];
