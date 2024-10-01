Directory Structure:

└── ./
    ├── src
    │   ├── app
    │   │   ├── api
    │   │   │   ├── extract-data
    │   │   │   │   └── route.js
    │   │   │   ├── fetch-data
    │   │   │   │   └── route.js
    │   │   │   └── telegram
    │   │   │       └── route.js
    │   │   ├── contacts
    │   │   │   └── page.js
    │   │   ├── groups
    │   │   │   └── page.js
    │   │   ├── global.css
    │   │   ├── layout.js
    │   │   └── page.js
    │   ├── components
    │   │   ├── ui
    │   │   │   ├── alert.jsx
    │   │   │   ├── button.jsx
    │   │   │   ├── card.jsx
    │   │   │   ├── checkbox.jsx
    │   │   │   ├── input.jsx
    │   │   │   ├── label.jsx
    │   │   │   ├── radio-group.jsx
    │   │   │   └── table.jsx
    │   │   ├── ClientTelegramManager.js
    │   │   ├── ContactsList.jsx
    │   │   ├── GroupsList.jsx
    │   │   ├── TelegramManager.jsx
    │   │   └── TelegramManagerbackup.jsx
    │   └── lib
    │       ├── apiUtils.js
    │       ├── csvUtils.js
    │       ├── supabase.js
    │       └── utils.js
    ├── utils
    │   └── config.js
    ├── .env
    ├── .gitignore
    ├── components.json
    ├── jsconfig.json
    ├── main.py
    ├── next.config.js
    ├── package.json
    ├── requirements.txt
    ├── tailwind.config.js
    └── vercel.json



---
File: /src/app/api/extract-data/route.js
---

import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { apiId, apiHash, phoneNumber, extractType } = await req.json();

    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => '',
      phoneCode: async () => '',
      onError: (err) => console.log(err),
    });

    let extractedData;
    if (extractType === 'groups') {
      const dialogs = await client.getDialogs();
      extractedData = dialogs.map(dialog => ({
        id: dialog.id.toString(),
        title: dialog.title,
        participants_count: dialog.participantsCount || 0,
        description: dialog.about || '',
      }));
    } else if (extractType === 'contacts') {
      const contacts = await client.getContacts();
      extractedData = contacts.map(contact => ({
        id: contact.id.toString(),
        first_name: contact.firstName,
        last_name: contact.lastName,
        phone_number: contact.phone,
        username: contact.username,
      }));
    } else {
      throw new Error(`Invalid extractType: ${extractType}`);
    }

    await client.disconnect();

    const { data, error } = await supabase
      .from(extractType)
      .upsert(extractedData, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `Data extracted and stored for ${extractType}`,
      count: extractedData.length
    });
  } catch (error) {
    console.error('Error in extract-data API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unknown error occurred'
    }, { status: 500 });
  }
}


---
File: /src/app/api/fetch-data/route.js
---

import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  const { apiId, apiHash, phoneNumber, extractType } = await req.json();

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => '',
      phoneCode: async () => '',
      onError: (err) => console.log(err),
    });

    let data;
    if (extractType === 'groups') {
      const dialogs = await client.getDialogs();
      data = dialogs.map(dialog => ({
        id: dialog.id.toString(),
        name: dialog.title,
        type: dialog.isGroup ? 'group' : 'channel',
      }));
    } else {
      const contacts = await client.getContacts();
      data = contacts.map(contact => ({
        id: contact.id.toString(),
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        username: contact.username,
        phone: contact.phone,
      }));
    }

    const { error } = await supabase.from(extractType).upsert(data, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({ success: true, message: `${extractType} fetched and updated successfully` });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await client.disconnect();
  }
}


---
File: /src/app/api/telegram/route.js
---

import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  const { apiId, apiHash, phoneNumber } = await req.json();

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => '',
      phoneCode: async () => '',
      onError: (err) => console.log(err),
    });

    const groups = await client.getDialogs();
    const groupsData = groups.map(group => ({
      id: group.id,
      group_name: group.title,
      description: group.about || '',
      invite_link: group.inviteLink || '',
    }));

    const { data, error } = await supabase
      .from('groups')
      .upsert(groupsData, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Groups fetched and updated successfully' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await client.disconnect();
  }
}



---
File: /src/app/contacts/page.js
---

'use client'

import ContactsList from '@/components/ContactsList'

export default function ContactsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Telegram Contacts</h1>
      <ContactsList />
    </div>
  )
}



---
File: /src/app/groups/page.js
---

'use client'

import GroupsList from '@/components/GroupsList'

export default function GroupsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Telegram Groups</h1>
      <GroupsList />
    </div>
  )
}



---
File: /src/app/global.css
---

@tailwind base;
@tailwind components;
@tailwind utilities;



---
File: /src/app/layout.js
---

import './global.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}



---
File: /src/app/page.js
---

'use client'

import TelegramManager from '../components/TelegramManager';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 md:p-24">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8">Telegram Extractor</h1>
      <TelegramManager />
    </main>
  )
}



---
File: /src/components/ui/alert.jsx
---

import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };



---
File: /src/components/ui/button.jsx
---

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";


const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };



---
File: /src/components/ui/card.jsx
---

import * as React from "react"
import PropTypes from "prop-types"
import { cn } from "@/lib/utils"

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// PropTypes
const sharedPropTypes = {
  className: PropTypes.string,
}

Card.propTypes = sharedPropTypes
CardHeader.propTypes = sharedPropTypes
CardTitle.propTypes = sharedPropTypes
CardDescription.propTypes = sharedPropTypes
CardContent.propTypes = sharedPropTypes
CardFooter.propTypes = sharedPropTypes

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }



---
File: /src/components/ui/checkbox.jsx
---

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "@radix-ui/react-icons"
import PropTypes from "prop-types"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <CheckIcon className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))

Checkbox.displayName = CheckboxPrimitive.Root.displayName

Checkbox.propTypes = {
  className: PropTypes.string,
}

export { Checkbox }



---
File: /src/components/ui/input.jsx
---

import * as React from "react"
import PropTypes from "prop-types"
import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";

Input.propTypes = {
  className: PropTypes.string,
  type: PropTypes.string,
};

export { Input };



---
File: /src/components/ui/label.jsx
---

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva } from "class-variance-authority"
import PropTypes from "prop-types"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))

Label.displayName = LabelPrimitive.Root.displayName

Label.propTypes = {
  className: PropTypes.string,
  // Add other prop types as needed
}

export { Label }



---
File: /src/components/ui/radio-group.jsx
---

import * as React from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import PropTypes from "prop-types";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  );
});

RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

RadioGroup.propTypes = {
  className: PropTypes.string,
};

const RadioGroupItem = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <CheckIcon className="h-3.5 w-3.5 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});

RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

RadioGroupItem.propTypes = {
  className: PropTypes.string,
};

export { RadioGroup, RadioGroupItem };



---
File: /src/components/ui/table.jsx
---

import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn("w-full caption-bottom text-sm", className)}
    {...props}
  />
));
Table.displayName = "Table";

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("bg-primary font-medium text-primary-foreground", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};



---
File: /src/components/ClientTelegramManager.js
---

'use client';

import TelegramManager from './TelegramManager';

export default function ClientTelegramManager() {
  return <TelegramManager />;
}



---
File: /src/components/ContactsList.jsx
---

'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase';

export default function ContactsList() {
  const [contacts, setContacts] = useState([])
  const [selectedContacts, setSelectedContacts] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('*');
        
        if (error) throw error;
        setContacts(data);
      } catch (error) {
        console.error('Error fetching contacts:', error);
        setError('Failed to load contacts. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContacts();
  }, [])

  const handleSelectAll = () => {
    setSelectAll(!selectAll)
    setSelectedContacts(selectAll ? [] : contacts.map(contact => contact.id))
  }

  const handleSelectContact = (contactId) => {
    setSelectedContacts(prevSelected =>
      prevSelected.includes(contactId)
        ? prevSelected.filter(id => id !== contactId)
        : [...prevSelected, contactId]
    )
  }

  const handleExtract = async () => {
    try {
      const selectedData = contacts.filter(contact => selectedContacts.includes(contact.id));
      const csvContent = generateCSV(selectedData);
      downloadCSV(csvContent, 'extracted_contacts.csv');
    } catch (error) {
      console.error('Error extracting contacts:', error);
      setError('Failed to extract contacts. Please try again.');
    }
  };

  const generateCSV = (data) => {
    const headers = ['ID', 'Name', 'Username', 'Phone', 'Bio', 'Status'];
    const rows = data.map(contact => [
      contact.id,
      `${contact.first_name} ${contact.last_name}`,
      contact.username,
      contact.phone_number,
      contact.bio,
      contact.online_status
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadCSV = (content, fileName) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Contacts List</h2>
      <Checkbox
        id="select-all"
        checked={selectAll}
        onCheckedChange={handleSelectAll}
        label={selectAll ? "Unselect All" : "Select All"}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Select</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Bio</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>
                <Checkbox
                  checked={selectedContacts.includes(contact.id)}
                  onCheckedChange={() => handleSelectContact(contact.id)}
                />
              </TableCell>
              <TableCell>{`${contact.first_name} ${contact.last_name}`}</TableCell>
              <TableCell>{contact.username}</TableCell>
              <TableCell>{contact.phone_number}</TableCell>
              <TableCell>{contact.bio}</TableCell>
              <TableCell>
                <span className={contact.online_status === 'Online' ? 'text-green-500' : 'text-gray-500'}>
                  {contact.online_status || 'Offline'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={handleExtract} disabled={selectedContacts.length === 0}>Extract Selected Contacts</Button>
    </div>
  )
}


---
File: /src/components/GroupsList.jsx
---

'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'

export default function GroupsList() {
  const [groups, setGroups] = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase
          .from('groups')
          .select('*');
        
        if (error) throw error;
        setGroups(data);
      } catch (error) {
        console.error('Error fetching groups:', error);
        setError('Failed to load groups. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, [])

  const handleSelectAll = () => {
    setSelectAll(!selectAll)
    setSelectedGroups(selectAll ? [] : groups.map(group => group.id))
  }

  const handleSelectGroup = (groupId) => {
    setSelectedGroups(prevSelected =>
      prevSelected.includes(groupId)
        ? prevSelected.filter(id => id !== groupId)
        : [...prevSelected, groupId]
    )
  }

  const handleExtract = async () => {
    try {
      const selectedData = groups.filter(group => selectedGroups.includes(group.id));
      const csvContent = generateCSV(selectedData);
      downloadCSV(csvContent, 'extracted_groups.csv');
    } catch (error) {
      console.error('Error extracting groups:', error);
      setError('Failed to extract groups. Please try again.');
    }
  };

  const generateCSV = (data) => {
    const headers = ['ID', 'Group Name', 'Description', 'Invite Link'];
    const rows = data.map(group => [
      group.id,
      group.group_name,
      group.description,
      group.invite_link
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadCSV = (content, fileName) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Groups List</h2>
      <Checkbox
        id="select-all"
        checked={selectAll}
        onCheckedChange={handleSelectAll}
        label={selectAll ? "Unselect All" : "Select All"}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Select</TableHead>
            <TableHead>Group Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Invite Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.id}>
              <TableCell>
                <Checkbox
                  checked={selectedGroups.includes(group.id)}
                  onCheckedChange={() => handleSelectGroup(group.id)}
                />
              </TableCell>
              <TableCell>{group.group_name}</TableCell>
              <TableCell>{group.description}</TableCell>
              <TableCell>
                <a href={group.invite_link} target="_blank" rel="noopener noreferrer">
                  {group.invite_link}
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={handleExtract} disabled={selectedGroups.length === 0}>Extract Selected Groups</Button>
    </div>
  )
}


---
File: /src/components/TelegramManager.jsx
---

'use client'

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, Loader2 } from 'lucide-react'

export default function TelegramManager() {
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [extractType, setExtractType] = useState('groups');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      console.log('Raw response:', text);

      if (!text) {
        throw new Error('Empty response from server');
      }

      const data = JSON.parse(text);
      console.log('Data extracted successfully:', data);
      // TODO: Handle successful extraction (e.g., show success message, update UI)
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
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
            <p className="mt-2"><strong>Note:</strong> Keep your API ID and API Hash private and never share them publicly.</p>
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
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Fetching...' : 'Fetch Data'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}



---
File: /src/components/TelegramManagerbackup.jsx
---

'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from 'lucide-react';

export default function TelegramManager() {
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [extractType, setExtractType] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulating API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    // In a real app, you would make an API call to your backend here
    setGroups([
      { id: 1, name: 'Group 1', memberCount: 100 },
      { id: 2, name: 'Group 2', memberCount: 200 },
      { id: 3, name: 'Group 3', memberCount: 150 },
    ]);
    setIsLoading(false);
  };

  const handleExtract = async () => {
    setIsLoading(true);
    // Simulating API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    // In a real app, you would make an API call to your backend here
    setDownloadUrl('https://example.com/download.csv');
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
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
            <p className="mt-2"><strong>Note:</strong> Keep your API ID and API Hash private and never share them publicly.</p>
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
              placeholder="Enter your phone number (with country code)"
            />
          </div>
          <RadioGroup value={extractType} onValueChange={setExtractType}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="groups" id="groups" />
              <Label htmlFor="groups">Extract Groups</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="contacts" id="contacts" />
              <Label htmlFor="contacts">Extract Contacts</Label>
            </div>
          </RadioGroup>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Fetch Data'}
          </Button>
        </form>
        {groups.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold">Select Groups to Extract</h3>
            {groups.map((group) => (
              <div key={group.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`group-${group.id}`}
                  checked={selectedGroups.includes(group.id)}
                  onCheckedChange={(checked) => {
                    setSelectedGroups(
                      checked
                        ? [...selectedGroups, group.id]
                        : selectedGroups.filter((id) => id !== group.id)
                    );
                  }}
                />
                <Label htmlFor={`group-${group.id}`}>
                  {group.name} ({group.memberCount} members)
                </Label>
              </div>
            ))}
            <Button onClick={handleExtract} disabled={isLoading || selectedGroups.length === 0}>
              {isLoading ? 'Extracting...' : 'Extract Selected Groups'}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {downloadUrl && (
          <Button asChild>
            <a href={downloadUrl} download>Download CSV</a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}


---
File: /src/lib/apiUtils.js
---

import { FloodWaitError } from 'telegram';

const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_BACKOFF_TIME = 60000;

let requestCount = 0;
let lastRequestTime = Date.now();
let backoffTime = 2000;

export function checkRateLimit() {
  const currentTime = Date.now();
  if (currentTime - lastRequestTime > 60000) {
    requestCount = 0;
    lastRequestTime = currentTime;
  }
  
  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    throw new Error('Rate limit exceeded');
  }

  requestCount++;
}

export async function handleTelegramError(error) {
  if (error instanceof FloodWaitError) {
    console.warn(`Rate limit hit! Waiting for ${error.seconds} seconds...`);
    await new Promise(resolve => setTimeout(resolve, error.seconds * 1000));
    backoffTime = Math.min(error.seconds * 1000, MAX_BACKOFF_TIME);
  } else {
    console.error('Telegram API error:', error);
    throw error;
  }
}

export function handleSupabaseError(error) {
  console.error('Supabase error:', error);
  throw new Error('Database operation failed');
}



---
File: /src/lib/csvUtils.js
---

import { Parser } from 'json2csv';

export function generateCSV(data, fields) {
  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(data);
}



---
File: /src/lib/supabase.js
---

import { createClient } from '@supabase/supabase-js';

// Read the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check for missing environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
} else {
  console.log('Supabase environment variables loaded successfully');
}

// Create a supabase client instance
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Log successful client creation
console.log('Supabase client created successfully');

// Remove or comment out these console.log statements
// console.log('Supabase client created:', supabase);
// console.log("Supabase Config Loaded");


---
File: /src/lib/utils.js
---

// lib/utils.js
export function cn(...classes) {
    return classes.filter(Boolean).join(" ");
  }
  


---
File: /utils/config.js
---

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://tg-groups-contacts-managerv2.vercel.app/api';

export { API_BASE_URL };



---
File: /.env
---

NEXT_PUBLIC_SUPABASE_URL=https://oisymxsvkchphdvxucdt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pc3lteHN2a2NocGhkdnh1Y2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc1MDcyMDYsImV4cCI6MjA0MzA4MzIwNn0.JsGtX4Kaq5g1ySxtT-oBYJNvNZ3LWEX5FOB5cN8wcAs
NEXT_PUBLIC_API_BASE_URL=/api



---
File: /.gitignore
---

.vercel
node_modules/
.env
venv/
.next/
!lib/
!lib/**/*
.env
project-code.node_modules


---
File: /components.json
---

{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "styles/global.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}


---
File: /jsconfig.json
---

{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}



---
File: /main.py
---

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from telethon.sync import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.functions.messages import ExportChatInviteRequest
from telethon.tl.functions.messages import GetDialogsRequest
from telethon.tl.types import InputPeerEmpty
import os
import csv
from io import StringIO
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

app = FastAPI()

# Fetch environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class TelegramCredentials(BaseModel):
    api_id: str
    api_hash: str
    phone_number: str
    extract_type: str

class ExtractionRequest(BaseModel):
    api_id: str
    api_hash: str
    phone_number: str
    extract_type: str
    selected_groups: list[int]

@app.post("/api/fetch-data")
async def fetch_data(credentials: TelegramCredentials):
    client = TelegramClient('session', credentials.api_id, credentials.api_hash)
    await client.start(phone=credentials.phone_number)

    try:
        if credentials.extract_type == 'groups':
            chats = []
            try:
                result = await client(GetDialogsRequest(
                    offset_date=None,
                    offset_id=0,
                    offset_peer=InputPeerEmpty(),
                    limit=None,
                    hash=0
                ))
                chats.extend(chat for chat in result.chats if hasattr(chat, 'megagroup') and chat.megagroup)
            except FloodWaitError as e:
                await client.disconnect()
                raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Please wait for {e.seconds} seconds before trying again.")
            return {"data": [{"id": chat.id, "title": chat.title, "members_count": chat.participants_count} for chat in chats]}
        elif credentials.extract_type == 'contacts':
            try:
                contacts = await client.get_contacts()
            except FloodWaitError as e:
                await client.disconnect()
                raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Please wait for {e.seconds} seconds before trying again.")
            return {"data": [{"id": contact.id, "first_name": contact.first_name, "last_name": contact.last_name, "phone": contact.phone} for contact in contacts]}
        else:
            raise HTTPException(status_code=400, detail="Invalid extract type")
    finally:
        await client.disconnect()

@app.post("/api/extract-data")
async def extract_data(request: ExtractionRequest):
    client = TelegramClient('session_name', request.api_id, request.api_hash)
    await client.start(phone=request.phone_number)

    try:
        groups = await client.get_dialogs()
        selected_groups = [g for g in groups if g.id in request.selected_groups]
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Group Name', 'Group ID', 'Member Name', 'Username', 'User ID'])
        
        for group in selected_groups:
            participants = await client.get_participants(group)
            for user in participants:
                writer.writerow([group.name, group.id, user.first_name, user.username, user.id])
                
                # Store the extracted data in Supabase
                supabase.table("extracted_data").insert({
                    "group_name": group.name,
                    "group_id": group.id,
                    "member_name": user.first_name,
                    "username": user.username,
                    "user_id": user.id
                }).execute()
        
        # Reset the pointer of the StringIO object
        output.seek(0)
        
        # Upload the CSV content to Supabase Storage
        storage_response = supabase.storage.from_('my-bucket').upload(
            f"telegram_{request.extract_type}.csv",
            output.getvalue(),
            file_options={"content-type": "text/csv"}
        )
        
        # Get the public URL of the uploaded file
        public_url = supabase.storage.from_('my-bucket').get_public_url(f"telegram_{request.extract_type}.csv")

        return {"downloadUrl": public_url}
    finally:
        await client.disconnect()


---
File: /next.config.js
---

/** @type {import('next').NextConfig} */
module.exports = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    },
};



---
File: /package.json
---

{
  "name": "tg-groups-and-contacts-extractor",
  "version": "1.0.0",
  "description": "First version fo Telegram Groups and Contacts extractor",
  "main": "index.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "author": "ElPi",
  "license": "MIT",
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13"
  },
  "dependencies": {
    "@radix-ui/react-checkbox": "^1.1.1",
    "@radix-ui/react-icons": "^1.3.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-radio-group": "^1.2.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@supabase/supabase-js": "^2.45.4",
    "class-variance-authority": "^0.7.0",
    "csv-stringify": "^6.5.1",
    "date-fns": "^4.1.0",
    "json2csv": "^5.0.7",
    "lucide-react": "^0.446.0",
    "next": "^14.2.13",
    "prop-types": "^15.8.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hot-toast": "^2.4.1",
    "telegram": "^2.25.11"
  }
}



---
File: /requirements.txt
---

fastapi==0.95.2
pydantic==1.10.7
telethon==1.28.5
supabase==1.0.3
uvicorn==0.22.0



---
File: /tailwind.config.js
---

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}



---
File: /vercel.json
---

{
  "version": 2,
  "builds": [
    {
      "src": "next.config.js",
      "use": "@vercel/next"
    },
    {
      "src": "main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "main.py"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}

