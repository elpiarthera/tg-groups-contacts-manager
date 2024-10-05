import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { PhoneNumberInvalidError, FloodWaitError, PhoneCodeExpiredError, PhoneCodeInvalidError } from 'telegram/errors';

function handleErrorResponse(message, status = 500) {
	console.error('[ERROR RESPONSE]:', message);
	return NextResponse.json({
		success: false,
		error: {
			code: status,
			message,
		},
	}, { status });
}

async function retryAsync(fn, retries = 3) {
	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch (err) {
			if (err instanceof FloodWaitError) {
				console.warn(`[FLOOD WAIT]: Waiting for ${err.seconds} seconds.`);
				await new Promise(resolve => setTimeout(resolve, err.seconds * 1000));
			} else if (err.message.includes('Invalid phone number')) {
				throw err; // Do not retry if it's a validation error
			} else {
				console.warn(`[RETRY]: Attempt ${i + 1} failed. Error: ${err.message}`);
				if (i === retries - 1) throw err;
				await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
			}
		}
	}
}

export async function POST(req) {
	let client;
	try {
		console.log('[START]: Extracting data');
		const { apiId, apiHash, phoneNumber: rawPhoneNumber, extractType, validationCode, existingSessionString } = await req.json();

		// Enhanced Logging and Validation
		console.log('[DEBUG]: Received payload:', { apiId, apiHash, phoneNumber: rawPhoneNumber, extractType, validationCode, existingSessionString: existingSessionString ? 'Exists' : 'Not provided' });

		// Validate inputs
		if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
			return handleErrorResponse('API ID is invalid or missing. Please provide a valid positive number.', 400);
		}

		const apiHashPattern = /^[a-f0-9]{32}$/;
		if (!apiHash || !apiHashPattern.test(apiHash)) {
			return handleErrorResponse('API Hash is invalid. It should be a 32-character hexadecimal string.', 400);
		}

		if (!rawPhoneNumber || typeof rawPhoneNumber !== 'string' || rawPhoneNumber.trim() === '') {
			return handleErrorResponse('Phone number is missing or invalid. Please enter a valid phone number.', 400);
		}

		const validPhoneNumber = rawPhoneNumber.trim();
		console.log('[DEBUG]: Valid phone number:', validPhoneNumber);

		// Use existing session string if provided, otherwise create a new one
		const stringSession = new StringSession(existingSessionString || '');
		client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
			connectionRetries: 5,
		});

		if (client && client.isConnected()) {
			console.warn('[DEBUG]: Client is already connected. Disconnecting...');
			try {
				await client.disconnect();
				console.log('[DEBUG]: Disconnected successfully.');
			} catch (disconnectError) {
				console.error('[DISCONNECT ERROR]: Failed to disconnect the client:', disconnectError);
			}
		}

		console.log('[PROCESS]: Connecting new session.');
		await retryAsync(async () => {
			await client.connect();
		});

		if (!validationCode) {
			console.log('[PROCESS]: Requesting validation code');
			try {
				const { phoneCodeHash } = await retryAsync(async () => {
					return await client.sendCode({
						apiId: parseInt(apiId),
						apiHash,
						phoneNumber: validPhoneNumber,
					});
				});
				
				console.log('[SUCCESS]: Validation code requested successfully');
				return NextResponse.json({
					success: true,
					message: 'Validation code sent to your phone. Please provide it in the next step.',
					requiresValidation: true,
					phoneCodeHash,
				});
			} catch (error) {
				console.error('[REQUEST CODE ERROR]:', error);
				return handleErrorResponse('Failed to send the validation code. Please try again.', 500);
			}
		} else {
			console.log('[PROCESS]: Starting Telegram client session');
			try {
				await retryAsync(async () => {
					await client.start({
						phoneNumber: async () => validPhoneNumber,
						password: async () => '',
						phoneCode: async () => validationCode,
						onError: (err) => {
							console.error('[TELEGRAM CLIENT ERROR]:', err);
							throw err;
						},
					});
				});

				console.log('[SUCCESS]: Telegram client session started successfully');

				// Extract data based on extractType
				let extractedData = [];
				if (extractType === 'groups') {
					const dialogs = await client.getDialogs();
					extractedData = dialogs.map(dialog => ({
						id: dialog.id.toString(),
						name: dialog.title,
						memberCount: dialog.participantsCount || 0,
						type: dialog.isChannel ? 'channel' : 'group',
						isPublic: !!dialog.username,
					}));
				} else if (extractType === 'contacts') {
					const contacts = await client.getContacts();
					extractedData = contacts.map(contact => ({
						id: contact.id.toString(),
						name: `${contact.firstName} ${contact.lastName}`.trim(),
						username: contact.username,
						phoneNumber: contact.phone,
						isMutualContact: contact.mutualContact,
					}));
				}

				console.log(`[SUCCESS]: Extracted ${extractedData.length} ${extractType}`);

				return NextResponse.json({
					success: true,
					items: extractedData,
					sessionString: client.session.save(), // Save the session string for future use
					sessionExpiresIn: '7 days', // Assuming a 7-day session validity
				});
			} catch (error) {
				console.error('[VALIDATION ERROR]: Error starting client session:', error);
				if (error instanceof PhoneCodeExpiredError) {
					return handleErrorResponse('The verification code has expired. Please request a new code.', 400);
				} else if (error instanceof PhoneCodeInvalidError) {
					return handleErrorResponse('The verification code is incorrect. Please try again.', 400);
				}
				return handleErrorResponse('An unexpected error occurred. Please try again later.', 500);
			}
		}
	} catch (error) {
		console.error('[GENERAL API ERROR]: Error in extract-data API:', error);
		return handleErrorResponse('An unexpected error occurred. Please try again later.');
	} finally {
		if (client) {
			try {
				await client.disconnect();
				console.log('[CLEANUP]: Telegram client disconnected successfully');
			} catch (disconnectError) {
				console.error('[DISCONNECT ERROR]: Error disconnecting Telegram client:', disconnectError);
			}
		}
	}
}