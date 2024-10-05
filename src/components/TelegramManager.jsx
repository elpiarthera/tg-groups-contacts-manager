import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TelegramManager = () => {
  const router = useRouter();
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [extractType, setExtractType] = useState('groups');
  const [validationCode, setValidationCode] = useState('');
  const [showValidationInput, setShowValidationInput] = useState(false);
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateInputs = () => {
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a valid positive number');
      return false;
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string');
      return false;
    }
    if (!phoneNumber || phoneNumber.trim() === '') {
      setError('Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!validateInputs()) {
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType,
        validationCode: showValidationInput ? validationCode : undefined,
        phoneCodeHash: showValidationInput ? phoneCodeHash : undefined,
      };
      console.log('[DEBUG]: Submitting request with:', payload);
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('[DEBUG]: Received response:', data);

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to initiate extraction');
      }

      if (data.requiresValidation) {
        setShowValidationInput(true);
        setPhoneCodeHash(data.phoneCodeHash);
        setError(null);
        alert('Please enter the validation code sent to your Telegram app.');
      } else if (data.success) {
        router.push(`/${extractType}-list`);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } catch (error) {
      console.error('[ERROR]: Submit failed:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Telegram Extractor</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form fields remain the same */}
          {showValidationInput && (
            <div className="space-y-2">
              <Label htmlFor="validation-code">Validation Code</Label>
              <Input
                id="validation-code"
                value={validationCode}
                onChange={(e) => setValidationCode(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Enter the code sent to your Telegram app"
              />
            </div>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (showValidationInput ? 'Verify Code' : 'Request Code')}
          </Button>
        </form>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default TelegramManager;
