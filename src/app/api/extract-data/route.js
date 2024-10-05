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
	if (!fn) throw new Error('Function to retry is undefined.');

	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch (err) {
			if (i === retries - 1) throw err;
			console.warn(`[RETRY]: Attempt ${i + 1} failed. Error: ${err.message}`);
			if (err.message.includes('phone number is undefined')) {
				console.warn('[RETRY ERROR]: Cannot retry as phoneNumber is undefined.');
				throw err;
			}
			await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
		}
	}
}

export async function POST(req) {
	let client;
	try {
		console.log('[START]: Extracting data');
		const { apiId, apiHash, phoneNumber, extractType, validationCode, existingSessionString } = await req.json();

		// Enhanced Logging and Validation
		console.log('[DEBUG]: Received payload:', { apiId, apiHash, phoneNumber, extractType, validationCode, existingSessionString: existingSessionString ? 'Exists' : 'Not provided' });

		// Validate phone number
		if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
			console.error('[VALIDATION ERROR]: Phone number is missing, undefined, or not a valid string');
			return handleErrorResponse('Phone number is missing or invalid. Please enter a valid phone number.', 400);
		}
		console.log('[DEBUG]: Valid phone number:', phoneNumber);

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
		console.log(`[INFO]: Phone number: ${phoneNumber}`);
		console.log(`[INFO]: Validation code received: ${validationCode ? 'Yes' : 'No'}`);

		// Use existing session string if provided, otherwise create a new one
		const stringSession = new StringSession(existingSessionString || '');
		client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
			connectionRetries: 5,
		});

		if (client.isConnected && client.session.userPhone !== phoneNumber) {
			console.warn('[INFO]: Disconnecting from old session to create a new one.');
			await client.disconnect();
		}

		if (!validationCode) {
			console.log('[PROCESS]: Requesting validation code');
			await retryAsync(async () => {
				await client.connect();
				const { phoneCodeHash } = await client.sendCode({
					apiId: parseInt(apiId),
					apiHash,
					phoneNumber,
				});
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
					await client.start({
						phoneNumber: async () => phoneNumber,
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
				console.error('[TELEGRAM SESSION ERROR]: Error starting Telegram client:', error);
				if (error instanceof PhoneCodeExpiredError) {
					return handleErrorResponse('The verification code has expired. Please request a new code.', 400);
				} else if (error instanceof PhoneCodeInvalidError) {
					return handleErrorResponse('The verification code is incorrect. Please try again.', 400);
				} else if (error instanceof FloodWaitError) {
					console.warn(`[FLOOD WAIT]: Waiting for ${error.seconds} seconds.`);
					return handleErrorResponse(`Rate limit reached. Please try again in ${error.seconds} seconds.`, 429);
				}
				return handleErrorResponse('An unexpected error occurred while starting the Telegram client. Please try again later.');
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