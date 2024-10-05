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
			if (!err.message || err.message.includes('phone number is undefined')) {
				console.warn('[RETRY ABORT]: Invalid phone number detected. Aborting retries.');
				throw err;
			}
			console.warn(`[RETRY]: Attempt ${i + 1} failed. Error: ${err.message}`);
			if (i === retries - 1) throw err;
			await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Backoff time
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

		// Validate phone number
		if (!rawPhoneNumber || typeof rawPhoneNumber !== 'string' || rawPhoneNumber.trim() === '') {
			console.error('[VALIDATION ERROR]: Phone number is missing or invalid');
			return handleErrorResponse('Phone number is missing or invalid. Please enter a valid phone number.', 400);
		}

		const validPhoneNumber = rawPhoneNumber.trim(); // Ensuring immutability and correctness
		console.log('[DEBUG]: Valid phone number:', validPhoneNumber);

		// Validate API ID
		if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
			console.error('[VALIDATION ERROR]: Invalid API ID');
			return handleErrorResponse('Invalid API ID. It should be a positive number.', 400);
		}

		// Validate API Hash
		const apiHashPattern = /^[a-f0-9]{32}$/;
		if (!apiHash || !apiHashPattern.test(apiHash)) {
			console.error('[VALIDATION ERROR]: Invalid API Hash');
			return handleErrorResponse('Invalid API Hash. It should be a 32-character hexadecimal string.', 400);
		}

		// Validate extractType
		if (extractType !== 'groups' && extractType !== 'contacts') {
			console.error('[VALIDATION ERROR]: Invalid extract type');
			return handleErrorResponse('Invalid extract type. Allowed values are "groups" or "contacts".', 400);
		}

		console.log(`[INFO]: Received request for ${extractType} extraction`);
		console.log(`[INFO]: Phone number: ${validPhoneNumber}`);
		console.log(`[INFO]: Validation code received: ${validationCode ? 'Yes' : 'No'}`);

		// Use existing session string if provided, otherwise create a new one
		const stringSession = new StringSession(existingSessionString || '');
		client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
			connectionRetries: 5,
		});

		if (client && client.isConnected()) {
			console.warn('[DEBUG]: Client is already connected. Disconnecting...');
			await client.disconnect();
		}

		console.log('[PROCESS]: Connecting new session.');
		await retryAsync(async () => {
			await client.connect();
		});

		if (!validationCode) {
			console.log('[PROCESS]: Requesting validation code');
			await retryAsync(async () => {
				console.log(`[DEBUG BEFORE CONNECT]: Connecting with phone number: ${validPhoneNumber}`);
				if (!validPhoneNumber) {
					throw new Error('Phone number is missing or undefined before connecting. Cannot proceed.');
				}
				const { phoneCodeHash } = await client.sendCode({
					apiId: parseInt(apiId),
					apiHash,
					phoneNumber: validPhoneNumber,
				});
				console.log('[DEBUG]: Code sent successfully. Phone number used:', validPhoneNumber);
				console.log('[SUCCESS]: Validation code requested successfully');
				return NextResponse.json({
					success: true,
					message: 'Validation code sent to your phone. Please provide it in the next step.',
					requiresValidation: true,
					phoneCodeHash,
				});
			});
		} else {
			console.log('[PROCESS]: Starting Telegram client session');
			try {
				await retryAsync(async () => {
					console.log(`[DEBUG BEFORE START]: Starting client with phone number: ${validPhoneNumber}`);
					if (!validPhoneNumber) {
						throw new Error('Phone number is missing or undefined before starting client. Cannot proceed.');
					}
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
				console.log('[DEBUG]: Client started successfully. Phone number used:', validPhoneNumber);
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
				if (error.message.includes('phone number is undefined')) {
					console.error('[PHONE NUMBER ERROR]:', error.message);
					return handleErrorResponse('Invalid phone number. Please verify and try again.', 400);
				} else if (error instanceof PhoneCodeExpiredError) {
					return handleErrorResponse('The verification code has expired. Please request a new code.', 400);
				} else if (error instanceof PhoneCodeInvalidError) {
					return handleErrorResponse('The verification code is incorrect. Please try again.', 400);
				} else if (error instanceof FloodWaitError) {
					console.warn(`[FLOOD WAIT]: Waiting for ${error.seconds} seconds.`);
					return handleErrorResponse(`Rate limit reached. Please try again in ${error.seconds} seconds.`, 429);
				}
				// Other general errors
				console.error('[GENERAL ERROR]:', error);
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