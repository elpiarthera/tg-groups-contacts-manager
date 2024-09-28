'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib2/supabase';
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Checkbox } from "./ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { InfoIcon } from 'lucide-react';

export default function TelegramManager() {
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [extractType, setExtractType] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
      } else {
        setError('Please log in to access this feature');
      }
    };
    checkUser();
  }, []);

  // Fetch groups and contacts from Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*');
      
      if (groupsError) throw groupsError;
      setGroups(groupsData);

      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*');
      
      if (contactsError) throw contactsError;
      setContacts(contactsData);

      toast.success('Data fetched successfully');
    } catch (err) {
      console.error('Error fetching data:', err.message);
      toast.error('Error fetching data from Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate CSV from selected groups/contacts and trigger download
  const handleExtract = () => {
    setIsLoading(true);

    try {
      const items = extractType === 'groups' ? groups : contacts;
      const selectedData = items.filter(item => selectedItems.includes(item.id));
      const csvContent = selectedData.map(item => {
        if (extractType === 'groups') {
          return `${item.group_name}, ${item.members_count || 'N/A'}`;
        } else {
          return `${item.first_name} ${item.last_name}, ${item.username || 'N/A'}, ${item.phone_number || 'N/A'}`;
        }
      }).join("\n");

      const csvBlob = new Blob([csvContent], { type: "text/csv" });
      const csvUrl = URL.createObjectURL(csvBlob);
      setDownloadUrl(csvUrl);

      toast.success('CSV generated successfully');
    } catch (err) {
      console.error('Error generating CSV:', err.message);
      toast.error('Error generating CSV');
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
      // You might want to redirect the user after successful deletion
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Telegram Groups and Contacts Manager</CardTitle>
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
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Loading...' : 'Fetch Data'}
          </Button>
          <Button type="button" onClick={handleUpdateUser} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Updating...' : 'Update User Data'}
          </Button>
          <Button type="button" onClick={handleDeleteUser} disabled={isLoading} className="bg-red-500 hover:bg-red-600">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Deleting...' : 'Delete Account'}
          </Button>
        </form>
        {error && <p className="text-red-500">{error}</p>}
        {(groups.length > 0 || contacts.length > 0) && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold">Select {extractType === 'groups' ? 'Groups' : 'Contacts'} to Extract</h3>
            {(extractType === 'groups' ? groups : contacts).map((item) => (
              <div key={item.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`item-${item.id}`}
                  checked={selectedItems.includes(item.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedItems((prev) => [...prev, item.id]);
                    } else {
                      setSelectedItems((prev) => prev.filter(id => id !== item.id));
                    }
                  }}
                />
                <Label htmlFor={`item-${item.id}`}>
                  {extractType === 'groups' 
                    ? `${item.group_name} (${item.members_count || 'N/A'} members)`
                    : `${item.first_name} ${item.last_name} (@${item.username || 'N/A'})`}
                </Label>
              </div>
            ))}
            <Button onClick={handleExtract} disabled={isLoading || selectedItems.length === 0}>
              {isLoading ? 'Extracting...' : `Extract Selected ${extractType === 'groups' ? 'Groups' : 'Contacts'}`}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {downloadUrl && (
          <Button asChild>
            <a href={downloadUrl} download="groups_or_contacts.csv">Download CSV</a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
