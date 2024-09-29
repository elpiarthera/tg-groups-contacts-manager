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
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [extractType, setExtractType] = useState('groups');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // Fetch user's saved API details
        const { data, error } = await supabase
          .from('users')
          .select('api_id, api_hash, phone_number')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setApiId(data.api_id || '');
          setApiHash(data.api_hash || '');
          setPhoneNumber(data.phone_number || '');
        }
      } else {
        setError('Please log in to access this feature');
      }
    };
    checkUser();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Fetch data from Supabase instead of API
      const { data, error } = await supabase
        .from(extractType)
        .select('*');
      
      if (error) throw error;

      setItems(data);
      setShowResults(true);
      toast.success('Data fetched successfully');
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
      toast.error('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    setSelectedItems(selectedItems.length === items.length ? [] : items.map(item => item.id));
  };

  const handleExtract = async () => {
    setIsLoading(true);
    try {
      const selectedData = items.filter(item => selectedItems.includes(item.id));
      const csvContent = selectedData.map(item => {
        if (extractType === 'groups') {
          return `${item.group_name},${item.members_count || 'N/A'}`;
        } else {
          return `${item.first_name} ${item.last_name},${item.username || 'N/A'},${item.phone_number || 'N/A'}`;
        }
      }).join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${extractType}_data.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
      toast.error('Failed to extract data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!user) {
      toast.error('Please log in to update your account');
      return;
    }
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ api_id: apiId, api_hash: apiHash, phone_number: phoneNumber })
        .eq('id', user.id);
      
      if (error) throw error;
      toast.success('User updated successfully');
    } catch (err) {
      console.error('Error updating user:', err.message);
      toast.error('Error updating user in Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) {
      setError('Please log in to delete your account.');
      return;
    }
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id);
    
    if (error) {
      console.error('Error deleting user:', error);
      setError('Error deleting user from Supabase.');
    } else {
      console.log('User deleted successfully');
      setUser(null);
      router.push('/'); // Redirect to home page after deletion
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Telegram Groups and Contacts Manager</CardTitle>
        <CardDescription>Manage your Telegram groups and contacts ethically</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>How to get API ID and API Hash</AlertTitle>
          <AlertDescription>
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://my.telegram.org</a> and log in with your Telegram account.</li>
              <li>Click on 'API development tools'.</li>
              <li>Fill in the form with your app details.</li>
              <li>Click on 'Create application'.</li>
              <li>You'll see your API ID and API Hash on the next page. Use these in the form below.</li>
            </ol>
          </AlertDescription>
        </Alert>
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
            <Button type="button" onClick={handleUpdateUser} disabled={isLoading}>
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
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{extractType === 'groups' ? 'Groups' : 'Contacts'} List</h2>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedItems.length === items.length}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {selectedItems.length === items.length ? "Unselect All" : "Select All"}
                </label>
              </div>
            </div>
            <div className="rounded-md border">
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
            </div>
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
