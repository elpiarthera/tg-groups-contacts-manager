'use client';

import { useState } from 'react';
import { Loader2, InfoIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TelegramExtractor() {
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validationCode, setValidationCode] = useState('');
  const [extractType, setExtractType] = useState('groups');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [showValidationInput, setShowValidationInput] = useState(false);
  const [csvUrl, setCsvUrl] = useState(null);
  const [validationCodeSent, setValidationCodeSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validate API ID
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('Please enter a valid API ID. It should be a positive number.');
      setIsLoading(false);
      return;
    }

    // Validate API Hash
    const apiHashPattern = /^[a-f0-9]{32}$/;
    if (!apiHash || !apiHashPattern.test(apiHash)) {
      setError('Please enter a valid API Hash. It should be a 32-character hexadecimal string.');
      setIsLoading(false);
      return;
    }

    // Validate phone number
    const trimmedPhoneNumber = phoneNumber.trim();
    if (!trimmedPhoneNumber || !trimmedPhoneNumber.startsWith('+') || trimmedPhoneNumber.length < 10) {
      setError('Please enter a valid phone number with the country code (e.g., +1234567890).');
      setIsLoading(false);
      return;
    }

    try {
      console.log('[FRONTEND DEBUG]: Sending payload:', { apiId, apiHash, phoneNumber: trimmedPhoneNumber, extractType });
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId: parseInt(apiId), apiHash, phoneNumber: trimmedPhoneNumber, extractType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to initiate extraction');
      }

      if (data.requiresValidation) {
        setShowValidationInput(true);
        setValidationCodeSent(true);
      } else {
        setItems(data.items || []);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidationSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!validationCode) {
      setError('Please enter the validation code.');
      setIsLoading(false);
      return;
    }

    try {
      console.log('[DEBUG]: Sending validation payload:', { apiId, apiHash, phoneNumber, validationCode, extractType });
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId, apiHash, phoneNumber, validationCode, extractType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate code or fetch data');
      }

      setItems(data.items || []);
      setShowResults(true);
      setShowValidationInput(false);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    setSelectedItems(selectedItems.length === items.length ? [] : items.map((item) => item.id));
  };

  const handleExtract = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId, apiHash, phoneNumber, extractType, selectedItems, validationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract data');
      }

      setCsvUrl(data.csvUrl);
    } catch (error) {
      console.error('Error extracting data:', error);
      setError('Failed to extract data. Please try again.');
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
        <Tabs defaultValue="extract" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="extract">Extract Data</TabsTrigger>
            <TabsTrigger value="account">Account Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="extract">
            <Alert className="mb-6">
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>How to get API ID and API Hash</AlertTitle>
              <AlertDescription>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    Go to{' '}
                    <a
                      href="https://my.telegram.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      https://my.telegram.org
                    </a>
                    {' '}and log in with your Telegram account.
                  </li>
                  <li>Click on &apos;API development tools&apos;.</li>
                  <li>Fill in the form with your app details.</li>
                  <li>Click on &apos;Create application&apos;.</li>
                  <li>You&apos;ll see your API ID and API Hash on the next page. Use these in the form below.</li>
                </ol>
              </AlertDescription>
            </Alert>

            {!validationCodeSent ? (
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
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Request Validation Code'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleValidationSubmit} className="space-y-4">
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
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Validate and Fetch Data'}
                </Button>
              </form>
            )}

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {showResults && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">{extractType === 'groups' ? 'Groups' : 'Contacts'} List</h2>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedItems.length === items.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <label
                      htmlFor="select-all"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {selectedItems.length === items.length ? 'Unselect All' : 'Select All'}
                    </label>
                  </div>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Select</TableHead>
                        <TableHead>Name</TableHead>
                        {extractType === 'groups' ? (
                          <TableHead>Members</TableHead>
                        ) : (
                          <>
                            <TableHead>Username</TableHead>
                            <TableHead>Phone Number</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.includes(item.id)}
                              onCheckedChange={() => handleSelectItem(item.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          {extractType === 'groups' ? (
                            <TableCell>{item.memberCount}</TableCell>
                          ) : (
                            <>
                              <TableCell>@{item.username}</TableCell>
                              <TableCell>{item.phoneNumber}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button onClick={handleExtract} disabled={isLoading || selectedItems.length === 0} className="mt-4">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Extract Selected ${extractType}`}
                </Button>
              </div>
            )}

            {csvUrl && (
              <Button asChild className="mt-4 w-full">
                <a href={csvUrl} download>
                  Download CSV
                </a>
              </Button>
            )}
          </TabsContent>
          <TabsContent value="account">
            <p>Account settings will be implemented in a future update.</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}