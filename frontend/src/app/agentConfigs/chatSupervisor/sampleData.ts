export const exampleAccountInfo = {
  accountId: "NT-123456",
  name: "Alex Johnson",
  phone: "+1-206-135-1246",
  email: "alex.johnson@email.com",
  plan: "Unlimited Plus",
  balanceDue: "$42.17",
  lastBillDate: "2024-05-15",
  lastPaymentDate: "2024-05-20",
  lastPaymentAmount: "$42.17",
  status: "Active",
  address: {
    street: "1234 Pine St",
    city: "Seattle",
    state: "WA",
    zip: "98101"
  },
  lastBillDetails: {
    basePlan: "$30.00",
    internationalCalls: "$8.00",
    dataOverage: "$4.00",
    taxesAndFees: "$0.17",
    notes: "Higher than usual due to international calls and data overage."
  }
};

export const examplePolicyDocs = [
  {
    id: "ID-010",
    name: "Family Plan Policy",
    topic: "family plan options",
    content:
      "The family plan allows up to 5 lines per account. All lines share a single data pool. Each additional line after the first receives a 10% discount. All lines must be on the same account.",
  },
  {
    id: "ID-020",
    name: "Promotions and Discounts Policy",
    topic: "promotions and discounts",
    content:
      "The Summer Unlimited Data Sale provides a 20% discount on the Unlimited Plus plan for the first 6 months for new activations completed by July 31, 2024. The Refer-a-Friend Bonus provides a $50 bill credit to both the referring customer and the new customer after 60 days of active service, for activations by August 31, 2024. A maximum of 5 referral credits may be earned per account. Discounts cannot be combined with other offers.",
  },
  {
    id: "ID-030",
    name: "International Plans Policy",
    topic: "international plans",
    content:
      "International plans are available and include discounted calling, texting, and data usage in over 100 countries.",
  },
  {
    id: "ID-040",
    name: "Handset Offers Policy",
    topic: "new handsets",
    content:
      "Handsets from brands such as iPhone and Google are available. The iPhone 16 is $200 and the Google Pixel 8 is available for $0, both with an additional 18-month commitment. These offers are valid while supplies last and may require eligible plans or trade-ins. For more details, visit one of our stores.",
  },
];

export const exampleStoreLocations = [
  // NorCal
  {
    name: "NewTelco San Francisco Downtown Store",
    address: "1 Market St, San Francisco, CA",
    zip_code: "94105",
    phone: "(415) 555-1001",
    hours: "Mon-Sat 10am-7pm, Sun 11am-5pm"
  },
  {
    name: "NewTelco San Jose Valley Fair Store",
    address: "2855 Stevens Creek Blvd, Santa Clara, CA",
    zip_code: "95050",
    phone: "(408) 555-2002",
    hours: "Mon-Sat 10am-8pm, Sun 11am-6pm"
  },
  {
    name: "NewTelco Sacramento Midtown Store",
    address: "1801 L St, Sacramento, CA",
    zip_code: "95811",
    phone: "(916) 555-3003",
    hours: "Mon-Sat 10am-7pm, Sun 12pm-5pm"
  },
  // SoCal
  {
    name: "NewTelco Los Angeles Hollywood Store",
    address: "6801 Hollywood Blvd, Los Angeles, CA",
    zip_code: "90028",
    phone: "(323) 555-4004",
    hours: "Mon-Sat 10am-9pm, Sun 11am-7pm"
  },
  {
    name: "NewTelco San Diego Gaslamp Store",
    address: "555 5th Ave, San Diego, CA",
    zip_code: "92101",
    phone: "(619) 555-5005",
    hours: "Mon-Sat 10am-8pm, Sun 11am-6pm"
  },
  {
    name: "NewTelco Irvine Spectrum Store",
    address: "670 Spectrum Center Dr, Irvine, CA",
    zip_code: "92618",
    phone: "(949) 555-6006",
    hours: "Mon-Sat 10am-8pm, Sun 11am-6pm"
  },
  // East Coast
  {
    name: "NewTelco New York City Midtown Store",
    address: "350 5th Ave, New York, NY",
    zip_code: "10118",
    phone: "(212) 555-7007",
    hours: "Mon-Sat 9am-8pm, Sun 10am-6pm"
  },
  {
    name: "NewTelco Boston Back Bay Store",
    address: "800 Boylston St, Boston, MA",
    zip_code: "02199",
    phone: "(617) 555-8008",
    hours: "Mon-Sat 10am-7pm, Sun 12pm-6pm"
  },
  {
    name: "NewTelco Washington DC Georgetown Store",
    address: "1234 Wisconsin Ave NW, Washington, DC",
    zip_code: "20007",
    phone: "(202) 555-9009",
    hours: "Mon-Sat 10am-7pm, Sun 12pm-5pm"
  },
  {
    name: "NewTelco Miami Beach Store",
    address: "1601 Collins Ave, Miami Beach, FL",
    zip_code: "33139",
    phone: "(305) 555-1010",
    hours: "Mon-Sat 10am-8pm, Sun 11am-6pm"
  }
];