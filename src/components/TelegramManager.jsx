import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const CODE_EXPIRATION_TIME = 30 * 60; // 30 minutes in seconds

export default function TelegramManager() {
  const router = useRouter()
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [apiId, setApiId] = useState('')
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [apiHash, setApiHash] = useState('')
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [phoneNumber, setPhoneNumber] = useState('')
  /** @type {['groups' | 'contacts', React.Dispatch<React.SetStateAction<'groups' | 'contacts'>>]} */
  const [extractType, setExtractType] = useState('groups')
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [validationCode, setValidationCode] = useState('')
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
  const [showValidationInput, setShowValidationInput] = useState(false)
  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
  const [error, setError] = useState(null)
  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
  const [successMessage, setSuccessMessage] = useState(null)
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
  const [isLoading, setIsLoading] = useState(false)
  /** @type {[number | null, React.Dispatch<React.SetStateAction<number | null>>]} */
  const [codeRequestTime, setCodeRequestTime] = useState(null)
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  /** @type {[number, React.Dispatch<React.SetStateAction<number>>]} */
  const [timeRemaining, setTimeRemaining] = useState(CODE_EXPIRATION_TIME)
  /** @type {[boolean | null, React.Dispatch<React.SetStateAction<boolean | null>>]} */
  const [isPhoneRegistered, setIsPhoneRegistered] = useState(null)
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
  const [hasExistingSession, setHasExistingSession] = useState(false)
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
  const [show2FAInput, setShow2FAInput] = useState(false)
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [twoFactorPassword, setTwoFactorPassword] = useState('')

  useEffect(() => {
    const checkExistingSession = async () => {
      if (phoneNumber && apiId && apiHash) {
        setIsLoading(true)
        try {
          const response = await fetch('/api/extract-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'checkSession', 
              phoneNumber: phoneNumber.trim(),
              apiId: parseInt(apiId),
              apiHash
            }),
          });
          // Try to parse JSON regardless of response.ok to get backend error message
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Failed to check session');
          }
          setHasExistingSession(data.hasSession);
          if (data.hasSession) {
            setIsAuthenticated(true);
            setSuccessMessage('Active session found. You can extract data or logout.');
          }
        } catch (error) {
          console.error('Failed to check session:', /** @type {Error} */ (error));
          setError(/** @type {Error} */ (error).message || 'Failed to check for existing session.');
        } finally {
          setIsLoading(false);
        }
      }
    };
    if (phoneNumber && apiId && apiHash && !isAuthenticated && !showValidationInput && !show2FAInput) {
        checkExistingSession();
    }
  }, [phoneNumber, apiId, apiHash, isAuthenticated, showValidationInput, show2FAInput]);

  useEffect(() => {
    let timer
    if (showValidationInput && codeRequestTime && !show2FAInput) {
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - codeRequestTime) / 1000)
        const remaining = Math.max(CODE_EXPIRATION_TIME - elapsed, 0)
        setTimeRemaining(remaining)
        if (remaining === 0) {
          setError('Code expired. Please request a new one.')
          setShowValidationInput(false)
          setValidationCode('')
          setCodeRequestTime(null)
          setShow2FAInput(false)
          setTwoFactorPassword('')
        }
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [showValidationInput, codeRequestTime, show2FAInput])

  /** @param {boolean} [is2FASubmit=false] */
  const validateInputs = (is2FASubmit = false) => {
    if (!is2FASubmit && !isAuthenticated) {
        if (!apiId || isNaN(parseInt(apiId)) || parseInt(apiId) <= 0) { // Check parseInt(apiId)
          setError('API ID must be a valid positive number'); return false;
        }
        if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
          setError('API Hash should be a 32-character hexadecimal string'); return false;
        }
        if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber.trim())) {
          setError('Valid phone number with country code required (e.g., +1234567890)'); return false;
        }
    }
    // These checks apply even if authenticated but inputs are shown (which shouldn't happen with current logic, but good for safety)
    if (showValidationInput && !validationCode && !is2FASubmit) {
        setError('Please enter the validation code.'); return false;
    }
    if (show2FAInput && !twoFactorPassword) {
        setError('Please enter your 2FA password.'); return false;
    }
    return true
  }

  /** @param {React.FormEvent<HTMLFormElement>} e */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsLoading(true)

    if (!validateInputs(show2FAInput)) {
      setIsLoading(false)
      return
    }

    try {
      /** @type {any} */
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType: isAuthenticated ? extractType : undefined,
        validationCode: showValidationInput && validationCode ? validationCode : undefined,
      }
      if (show2FAInput) {
        payload.twoFactorPassword = twoFactorPassword;
      }

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json();

      if (!response.ok) {
        // Prefer message from backend response, default if not present
        throw new Error(data.message || `Server error: ${response.statusText} (${response.status})`);
      }

      if (data.requires2FA) {
        setShow2FAInput(true);
        setError(null); // Clear previous errors
        setSuccessMessage(data.message || '2FA required. Enter password.');
      } else if (data.requiresValidation) {
        setShowValidationInput(true)
        setShow2FAInput(false) // Reset 2FA if back to code validation
        setTwoFactorPassword('')
        setCodeRequestTime(Date.now())
        setTimeRemaining(CODE_EXPIRATION_TIME)
        setIsPhoneRegistered(data.phoneRegistered === true) // Ensure boolean
        setSuccessMessage(data.message || `Validation code sent. ${data.phoneRegistered ? '' : 'New user will be signed up.'}`)
      } else if (data.success) {
        setIsAuthenticated(true)
        setShowValidationInput(false)
        setShow2FAInput(false)
        setTwoFactorPassword('')
        setValidationCode('')
        setSuccessMessage(data.message || 'Operation successful!')
        // Check if data extraction happened
        if (data.data && Array.isArray(data.data)) {
             setSuccessMessage(data.message || `Extracted ${data.data.length} ${extractType}.`)
             setTimeout(() => router.push(`/${extractType}-list`), 2000)
        } else if (isAuthenticated && payload.extractType) { // If was authenticated and extractType was set for the call
            setSuccessMessage(data.message || `Data extraction for ${extractType} initiated.`);
        }
      } else { // General failure from API (e.g. data.success === false but not specific known cases)
        setError(data.message || 'An unexpected error occurred.')
        setShow2FAInput(false)
        setTwoFactorPassword('')
      }
    } catch (error) {
      console.error('[ERROR]: Submit failed:', /** @type {Error} */ (error))
      setError(/** @type {Error} */ (error).message || 'An unexpected client-side error occurred.')
      setShow2FAInput(false)
      setTwoFactorPassword('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Logout failed.');
      }

      setApiId('');
      setApiHash('');
      setPhoneNumber('');
      setValidationCode('');
      setTwoFactorPassword('');
      setShowValidationInput(false);
      setShow2FAInput(false);
      setIsAuthenticated(false);
      setHasExistingSession(false);
      setCodeRequestTime(null);
      setIsPhoneRegistered(null);
      setExtractType('groups');
      setSuccessMessage('Logged out successfully.');

    } catch (error) {
      console.error('[LOGOUT ERROR]:', /** @type {Error} */ (error));
      setError(/** @type {Error} */ (error).message || 'Logout failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderTimer = () => {
    const minutes = Math.floor(timeRemaining / 60)
    const seconds = timeRemaining % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getButtonText = () => {
    if (isLoading && !isAuthenticated) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    if (isAuthenticated) return isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Extract Data';
    if (show2FAInput) return 'Submit 2FA Password';
    if (showValidationInput) return 'Verify Code';
    return 'Request Code';
  }

  const navigateToContactsList = () => router.push('/contacts-list')
  const navigateToGroupsList = () => router.push('/groups-list')

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Telegram Extractor</h1>
      <Card className="w-full max-w-md mb-4">
        <CardHeader>
          <CardTitle>Telegram Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-id">API ID</Label>
              <Input id="api-id" value={apiId} onChange={(e) => setApiId(e.target.value)} required disabled={isLoading || showValidationInput || isAuthenticated || show2FAInput} placeholder="Enter API ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-hash">API Hash</Label>
              <Input id="api-hash" value={apiHash} onChange={(e) => setApiHash(e.target.value)} required disabled={isLoading || showValidationInput || isAuthenticated || show2FAInput} placeholder="Enter API Hash" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input id="phone-number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required disabled={isLoading || showValidationInput || isAuthenticated || show2FAInput} placeholder="Phone (with country code)" />
            </div>

            {!isAuthenticated && showValidationInput && (
              <div className="space-y-2">
                <Label htmlFor="validation-code">Validation Code</Label>
                <Input id="validation-code" value={validationCode} onChange={(e) => setValidationCode(e.target.value)} required disabled={isLoading || show2FAInput} placeholder="Code from Telegram" />
                <p className="text-sm text-gray-500">Expires in: {renderTimer()}</p>
                {isPhoneRegistered !== null && <p className="text-sm text-blue-500">{isPhoneRegistered ? 'Phone registered.' : 'Phone not registered (will sign up).'}</p>}
              </div>
            )}

            {!isAuthenticated && show2FAInput && (
              <div className="space-y-2">
                <Label htmlFor="two-factor-password">2FA Password</Label>
                <Input id="two-factor-password" type="password" value={twoFactorPassword} onChange={(e) => setTwoFactorPassword(e.target.value)} required disabled={isLoading} placeholder="Enter 2FA password" />
              </div>
            )}

            {isAuthenticated && (
              <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2"><RadioGroupItem value="groups" id="groups" disabled={isLoading} /><Label htmlFor="groups">Extract Groups</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="contacts" id="contacts" disabled={isLoading} /><Label htmlFor="contacts">Extract Contacts</Label></div>
              </RadioGroup>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>{getButtonText()}</Button>
          </form>

          {error && <Alert variant="destructive" className="mt-4"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {successMessage && !error && <Alert className="mt-4"><AlertTitle>Success</AlertTitle><AlertDescription>{successMessage}</AlertDescription></Alert>}

          {(isAuthenticated || hasExistingSession) && (
            <Button variant="outline" onClick={handleLogout} className="w-full mt-4" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Logout'}
            </Button>
          )}
        </CardContent>
      </Card>
      
      <div className="flex space-x-4 mt-4">
        <Button onClick={navigateToContactsList} disabled={!isAuthenticated}>View Contacts</Button>
        <Button onClick={navigateToGroupsList} disabled={!isAuthenticated}>View Groups</Button>
      </div>
    </div>
  )
}
