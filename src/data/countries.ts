// Static country list for the Connect Account wizard.
// No database call needed — country ID is sent in the request.

export interface WizardCountry {
  id: string;
  name: string;
  region: string;
  flagCode: string;
}

export const WIZARD_COUNTRIES: WizardCountry[] = [
  { id: "us", name: "United States",  region: "North America",  flagCode: "us" },
  { id: "cn", name: "China",          region: "Asia",           flagCode: "cn" },
  { id: "jp", name: "Japan",          region: "Asia",           flagCode: "jp" },
  { id: "kr", name: "South Korea",    region: "Asia",           flagCode: "kr" },
  { id: "gb", name: "United Kingdom", region: "Europe",         flagCode: "gb" },
  { id: "de", name: "Germany",        region: "Europe",         flagCode: "de" },
  { id: "fr", name: "France",         region: "Europe",         flagCode: "fr" },
  { id: "au", name: "Australia",      region: "Oceania",        flagCode: "au" },
  { id: "br", name: "Brazil",         region: "South America",  flagCode: "br" },
  { id: "in", name: "India",          region: "Asia",           flagCode: "in" },
  { id: "sg", name: "Singapore",      region: "Asia",           flagCode: "sg" },
  { id: "mx", name: "Mexico",         region: "North America",  flagCode: "mx" },
  { id: "id", name: "Indonesia",      region: "Asia",           flagCode: "id" },
  { id: "th", name: "Thailand",       region: "Asia",           flagCode: "th" },
  { id: "ca", name: "Canada",         region: "North America",  flagCode: "ca" },
];
