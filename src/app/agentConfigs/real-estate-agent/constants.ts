export const realEstateCompanyName = "Grand Chasseral Immo SA";

export const companyInfo = {
  name: "Grand Chasseral Immo SA",
  address: "Grand-Rue 169, 2720 Tramelan, Suisse",
  phone: "+41 32 487 11 29",
  email: "contact@gcimmo.ch",
  website: "https://www.gcimmo.ch",
  openingHours: {
    // Horaires officiels (réception & téléphone)
    monday: "09:00 - 12:00 et 13:30 - 17:00",
    tuesday: "09:00 - 12:00 et 13:30 - 17:00",
    wednesday: "09:00 - 12:00 et 13:30 - 17:00",
    thursday: "Fermé",
    friday: "09:00 - 12:00 et 13:30 - 16:00",
    saturday: "Fermé",
    sunday: "Fermé",
  },
  team: [
    { name: "Julien Bichsel", role: "Expertise / Direction", contactableByPhone: true },
    { name: "Stéphanie Morgado", role: "Département Gérance, Département Location", contactableByPhone: true },
    { name: "Sandy Bircher", role: "Département Courtage", contactableByPhone: true },
    { name: "Maéva Broglie", role: "Assistance Gérance", contactableByPhone: true },
    { name: "Noé Burri", role: "Département Gérance – questions administratives", contactableByPhone: true },
    { name: "Julien Gogniat", role: "Département Gérance – questions techniques", contactableByPhone: true },
    { name: "Françoise Bichsel", role: "", contactableByPhone: true },
    { name: "Marion Spiess", role: "Contentieux", contactableByPhone: true },
    { name: "Laurent Carraux", role: "Comptabilité générale (ne jamais solliciter)", contactableByPhone: false, escalateTo: "Julien Bichsel" },
    { name: "Luc Bircher", role: "Ne jamais solliciter", contactableByPhone: false },
  ],
};
