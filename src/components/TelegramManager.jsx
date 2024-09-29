'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, InfoIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

export default function TelegramManager() {
  // ... (state and functions remain the same)

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId, apiHash, phoneNumber, extractType }),
      });

      const data = await response.json();

      if (response.ok) {
        setCsvUrl(data.csvUrl);
        // Handle successful extraction (e.g., show success message, update UI)
      } else {
        throw new Error(data.error || 'Failed to extract data');
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Telegram Groups and Contacts Manager</CardTitle>
        <CardDescription>Manage your Telegram groups and contacts ethically</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>How to get API ID and API Hash</AlertTitle>
          <AlertDescription>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>Go to <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://my.telegram.org</a> and log in with your Telegram account.</li>
              <li>Click on 'API development tools'.</li>
              <li>Fill in the form with your app details.</li>
              <li>Click on 'Create application'.</li>
              <li>You'll see your API ID and API Hash on the next page. Use these in the form below.</li>
            </ol>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-number">Phone Number</Label>
            <Input
              id="phone-number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Enter your phone number (with country code, e.g. +123456789)"
            />
          </div>
          <RadioGroup value={extractType} onValueChange={setExtractType} className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="groups" id="groups" disabled={isLoading} />
              <Label htmlFor="groups">Extract Groups</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="contacts" id="contacts" disabled={isLoading} />
              <Label htmlFor="contacts">Extract Contacts</Label>
            </div>
          </RadioGroup>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex space-x-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? 'Fetching...' : 'Fetch Data'}
            </Button>
            <Button type="button" onClick={handleUpdateUser} disabled={isLoading} variant="outline">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? 'Updating...' : 'Update User Data'}
            </Button>
            <Button type="button" onClick={handleDeleteUser} disabled={isLoading} variant="destructive">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? 'Deleting...' : 'Delete Account'}
            </Button>
          </div>
        </form>

        {showResults && (
          <div className="mt-8 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{extractType === 'groups' ? 'Groups' : 'Contacts'} List</h2>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedItems.length === items.length}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {selectedItems.length === items.length ? "Unselect All" : "Select All"}
                </Label>
              </div>
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    {extractType === 'groups' ? (
                      <>
                        <TableHead>Group Name</TableHead>
                        <TableHead>Group ID</TableHead>
                        <TableHead>Members</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Name</TableHead>
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
                      {extractType === 'groups' ? (
                        <>
                          <TableCell className="font-medium">{item.group_name}</TableCell>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>{item.members_count}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{`${item.first_name} ${item.last_name}`}</TableCell>
                          <TableCell>@{item.username}</TableCell>
                          <TableCell>{item.phone_number || 'N/A'}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {showResults && (
          <Button onClick={handleExtract} disabled={isLoading || selectedItems.length === 0}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Extracting...' : `Extract Selected ${extractType}`}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}