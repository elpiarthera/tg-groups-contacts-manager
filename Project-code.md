Directory Structure:

└── ./
    ├── src
    │   ├── app
    │   │   ├── api
    │   │   │   └── extract-data
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
    │   │   │   ├── avatar.jsx
    │   │   │   ├── badge.jsx
    │   │   │   ├── button.jsx
    │   │   │   ├── card.jsx
    │   │   │   ├── checkbox.jsx
    │   │   │   ├── input.jsx
    │   │   │   ├── label.jsx
    │   │   │   ├── radio-group.jsx
    │   │   │   ├── table.jsx
    │   │   │   └── tabs.jsx
    │   │   ├── ClientTelegramManager.js
    │   │   ├── ContactsList.jsx
    │   │   ├── GroupsList.jsx
    │   │   └── TelegramManager.jsx
    │   └── lib
    │       ├── apiUtils.js
    │       ├── csvUtils.js
    │       ├── supabase.js
    │       └── utils.js
    ├── utils
    │   └── config.js
    ├── .gitignore
    ├── .vercelignore
    ├── components.json
    ├── h origin main:master
    ├── jsconfig.json
    ├── next.config.js
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    └── vercel.json



---
File: /src/app/api/extract-data/route.js
---

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { PhoneNumberInvalidError, FloodWaitError, PhoneCodeExpiredError, PhoneCodeInvalidError } from 'telegram/errors';

function handleErrorResponse(message, status = 500) {
	return NextResponse.json({
		success: false,
		error: message,
	}, { status });
}

async function retryAsync(fn, retries = 3) {
	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch (err) {
			if (i === retries - 1) throw err;
			console.warn(`[RETRY]: Attempt ${i + 1} failed. Retrying...`);
			await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
		}
	}
}

export async function POST(req) {
	let client;
	try {
		console.log('[START]: Extracting data');
		const { apiId, apiHash, phoneNumber, extractType, validationCode, existingSessionString } = await req.json();

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

		// Validate phone number
		const phoneNumberPattern = /^\+\d{10,15}$/;
		if (!phoneNumber || !phoneNumberPattern.test(phoneNumber)) {
			console.error('[VALIDATION ERROR]: Phone number is undefined or not in the correct format');
			return handleErrorResponse('Invalid or missing phone number. Ensure it is in the format +1234567890.', 400);
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

export const metadata = {
  title: 'Telegram Groups and Contacts Extractor',
  description: 'Extract Telegram Groups and Contacts easily',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">{children}</body>
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
File: /src/components/ui/avatar.jsx
---

import * as React from "react"

export const Avatar = ({ children }) => <div className="rounded-full overflow-hidden">{children}</div>
export const AvatarImage = ({ src, alt }) => <img className="w-full h-full object-cover" src={src} alt={alt} />
export const AvatarFallback = ({ children }) => <div className="w-full h-full bg-gray-300">{children}</div>




---
File: /src/components/ui/badge.jsx
---

import * as React from "react"

export const Badge = ({ children, variant = "default" }) => {
  const variants = {
    default: "bg-gray-200 text-gray-800",
    success: "bg-green-200 text-green-800",
    error: "bg-red-200 text-red-800",
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded ${variants[variant]}`}>
      {children}
    </span>
  )
}



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
File: /src/components/ui/tabs.jsx
---

// src/components/ui/tabs.jsx
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }


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

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from '@/lib/supabase';
import { generateCSV } from '@/lib/csvUtils';

export default function ContactsList() {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('*'); // Ensure filtering by user_id if necessary

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
  }, []);

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    setSelectedContacts(selectAll ? [] : contacts.map(contact => contact.id));
  };

  const handleSelectContact = (contactId) => {
    setSelectedContacts(prevSelected =>
      prevSelected.includes(contactId)
        ? prevSelected.filter(id => id !== contactId)
        : [...prevSelected, contactId]
    );
  };

  const handleExtract = async () => {
    try {
      const selectedData = contacts.filter(contact => selectedContacts.includes(contact.id));
      const csvContent = generateCSV(selectedData, ['id', 'first_name', 'last_name', 'username', 'phone_number', 'bio', 'online_status']);
      downloadCSV(csvContent, 'extracted_contacts.csv');
    } catch (error) {
      console.error('Error extracting contacts:', error);
      setError('Failed to extract contacts. Please try again.');
    }
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
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
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
  );
}



---
File: /src/components/GroupsList.jsx
---

'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from '@/lib/supabase';
import { generateCSV } from '@/lib/csvUtils';

export default function GroupsList() {
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase
          .from('groups')
          .select('*'); // Ensure filtering by user_id if necessary

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
  }, []);

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    setSelectedGroups(selectAll ? [] : groups.map(group => group.id));
  };

  const handleSelectGroup = (groupId) => {
    setSelectedGroups(prevSelected =>
      prevSelected.includes(groupId)
        ? prevSelected.filter(id => id !== groupId)
        : [...prevSelected, groupId]
    );
  };

  const handleExtract = async () => {
    try {
      const selectedData = groups.filter(group => selectedGroups.includes(group.id));
      const csvContent = generateCSV(selectedData, ['id', 'group_name', 'description', 'invite_link']);
      downloadCSV(csvContent, 'extracted_groups.csv');
    } catch (error) {
      console.error('Error extracting groups:', error);
      setError('Failed to extract groups. Please try again.');
    }
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
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
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
  );
}



---
File: /src/components/TelegramManager.jsx
---

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

    try {
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId: parseInt(apiId), apiHash, phoneNumber, extractType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate extraction');
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

    try {
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
                    onChange={(e) => setPhoneNumber(e.target.value)}
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


---
File: /src/lib/apiUtils.js
---

import { FloodWaitError, errors } from 'telegram'; // Import errors from telegram for more specific error handling

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
    await new Promise(resolve => setTimeout(resolve, error.seconds * 1000)); // Wait for the duration specified by FloodWaitError
    backoffTime = Math.min(error.seconds * 1000, MAX_BACKOFF_TIME);
  } 
  else if (error instanceof errors.PhoneNumberInvalidError) { // Add specific handling for PhoneNumberInvalidError
    console.error('Invalid phone number error:', error);
    throw new Error('Invalid phone number. Please check and try again.');
  }
  else {
    console.error('Telegram API error:', error);
    throw error; // Re-throw any other errors to be handled elsewhere
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
File: /.gitignore
---

# Ignore Vercel deployment configurations
.vercel

# Ignore dependencies
node_modules/

# Ignore environment variables (for security)
.env
.env.local
.env.production
.env.development

# Ignore Python virtual environment (if applicable)
venv/

# Ignore Next.js build outputs
.next/

# Ignore any local build or distribution folders
dist/
build/

# Ignore IDE or editor configurations
.vscode/
.idea/
.editorconfig  # Only exclude if you don't need it in the repo

# Ignore macOS system files
.DS_Store

# Ignore log files and other temporary files
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Ignore coverage reports
coverage/
*.lcov

# Ignore test configurations and reports
*.test.js
*.spec.js
jest.config.js

# Ignore project documentation files
Project-code.md
.cursorrules

# Optional: Lock files should generally be included for consistent dependency versions
# package-lock.json
# yarn.lock

# Exclude specific unnecessary folders/files (modify if not needed)
.project-code/
.node_modules/

# Optional: Ignore temporary files created by your OS or editors
Thumbs.db



---
File: /.vercelignore
---

# Node modules should not be included in the repository, Vercel handles this
node_modules/

# Environment files (make sure to use environment variables on Vercel)
.env
.env.local
.env.production
.env.development

# Build output directories
.next/
dist/
build/

# Test and coverage reports (not needed in production)
tests/
coverage/
jest.config.js
*.test.js
*.spec.js

# IDE/Editor configurations (local settings)
.vscode/
.idea/

# Log files and temporary files
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.cursorrules

# Documentation and unnecessary files
README.md
*.md

# Python virtual environment (if applicable)
venv/

# OS-specific files
.DS_Store  # macOS
Thumbs.db  # Windows

# Optional: include lock files for consistent dependency versions across environments
# package-lock.json
# yarn.lock



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
File: /h origin main:master
---

[33mcommit 0c4a6a78842080bd0ac714787d69edec6ceac27e[m[33m ([m[1;36mHEAD -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m)[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sun Sep 29 20:22:28 2024 +0200

    Update Telegram Manager, API routes, and fix import issues

[33mcommit c20606efa3fa1e932967e5baf031e0a6dfa6b53d[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sun Sep 29 20:18:50 2024 +0200

    Update Supabase configuration and environment variables

[33mcommit a5d9c7bb05f8a7beb5fb316ad357f0eef5f12991[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sun Sep 29 20:09:40 2024 +0200

    MVP version ready for testing

[33mcommit 490e6a289dc8cd158ea7e75ba71296654f22d72f[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sat Sep 28 23:13:04 2024 +0200

    Configured API base URL and updated imports

[33mcommit de148b641169912ee3170388a55706c45580e55e[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sat Sep 28 22:30:27 2024 +0200

    Updated TelegramManager to allow direct API ID, API Hash, and Phone Number submission



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
  "description": "First version of Telegram Groups and Contacts extractor",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "author": "ElPi",
  "license": "MIT",
  "engines": {
    "node": ">=14.0.0"
  },
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
    "@radix-ui/react-tabs": "^1.1.1",
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
File: /postcss.config.js
---

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}



---
File: /tailwind.config.js
---

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/app/**/*.{js,jsx}",
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
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}

