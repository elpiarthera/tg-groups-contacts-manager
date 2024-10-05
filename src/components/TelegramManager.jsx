'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, InfoIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  useEffect(() => {
    // Any client-side only logic can go here
  }, []);

  const validateInputs = () => {
    if (!apiId || !apiHash || !phoneNumber) {
      setError('Please fill in all fields');
      return false;
    }
    if (isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a positive number');
      return false;
    }
    if (!/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string');
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
        setError(null); // Clear any previous errors
        alert('Please enter the validation code sent to your Telegram app.');
      } else if (data.success) {
        // If the extraction was successful, navigate to the appropriate list page
        router.push(`/${extractType}-list`);
      } else {
        // Handle any other scenarios
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
        <CardDescription>Telegram Groups and Contacts Manager</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-id">API ID</Label>
            <Input
              id="api-id"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Enter your API ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-hash">API Hash</Label>
            <Input
              id="api-hash"
              value={apiHash}
              onChange={(e) => setApiHash(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Enter your API Hash"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-number">Phone Number (for Telegram API)</Label>
            <Input
              id="phone-number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.trim())}
              required
              disabled={isLoading}
              placeholder="Enter your phone number (with country code)"
            />
          </div>
          <RadioGroup value={extractType} onValueChange={setExtractType}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="groups" id="groups" disabled={isLoading} />
              <Label htmlFor="groups">Extract Groups</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="contacts" id="contacts" disabled={isLoading} />
              <Label htmlFor="contacts">Extract Contacts</Label>
            </div>
          </RadioGroup>
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