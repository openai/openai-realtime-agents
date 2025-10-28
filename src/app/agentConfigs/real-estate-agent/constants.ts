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
    {
      name: "Julien Bichsel",
      role: "Directeur - Brevet fédéral d'expert en estimation immobilière",
      phone: "032 487 11 29",
      email: "julien.bichsel@regiedelatrame.ch",
      contactableByPhone: true,
    },
    {
      name: "Stéphanie Morgado",
      role: "Responsable du département gérance",
      phone: "032 487 11 29",
      email: "stephanie.morgado@regiedelatrame.ch",
      contactableByPhone: true,
    },
    {
      name: "Sandy Bircher",
      role: "Conseillère en immobilier",
      phone: "032 487 11 29",
      email: "sandy.bircher@regiedelatrame.ch",
      contactableByPhone: true,
    },
    {
      name: "Maéva Broglie",
      role: "Responsable de l'accueil",
      phone: "032 487 11 29",
      email: "maeva.broglie@regiedelatrame.ch",
      contactableByPhone: true,
    },
    {
      name: "Noé Burri",
      role: "Gérant administratif",
      phone: "032 487 11 29",
      email: "noe.burri@regiedelatrame.ch",
      contactableByPhone: true,
    },
    {
      name: "Aurélien Borst",
      role: "Gérant IT",
      phone: "076 804 86 09",
      email: "aurélien.borst@gmail.com",
      contactableByPhone: true,
    },
    {
      name: "Julien Gogniat",
      role: "Gérant technique",
      phone: "032 487 11 29",
      email: "julien.gogniat@regiedelatrame.ch",
      contactableByPhone: true,
    },
    {
      name: "Françoise Bichsel",
      role: "Mise en location",
      phone: "032 487 11 29",
      email: "francoise.bichsel@regiedelatrame.ch",
      contactableByPhone: true,
    },
    {
      name: "Marion Spiess",
      role: "Responsable du contentieux",
      phone: "032 487 11 29",
      email: "marion.spiess@regiedelatrame.ch",
      contactableByPhone: true,
    },
    {
      name: "Laurent Carraux",
      role: "Comptabilité générale",
      phone: "032 487 11 29",
      email: "laurent.carraux@regiedelatrame.ch",
      contactableByPhone: false,
      escalateTo: "Julien Bichsel",
    },
    {
      name: "Luc Bircher",
      role: "Responsable Edos Facility Management",
      phone: "032 421 06 80",
      email: "sav@edos-immobilier.ch",
      contactableByPhone: false,
    },
  ],
};

export const getCompanyInfoText = () => `
**Nom**: ${companyInfo.name}
**Adresse**: ${companyInfo.address}
**Téléphone**: ${companyInfo.phone}
**Email**: ${companyInfo.email}
**Site web**: ${companyInfo.website}

**Heures d'ouverture (réception & téléphone)**:
- Lundi: ${companyInfo.openingHours.monday}
- Mardi: ${companyInfo.openingHours.tuesday}
- Mercredi: ${companyInfo.openingHours.wednesday}
- Jeudi: ${companyInfo.openingHours.thursday}
- Vendredi: ${companyInfo.openingHours.friday}
- Samedi: ${companyInfo.openingHours.saturday}
- Dimanche: ${companyInfo.openingHours.sunday}

**Notre équipe**:
${companyInfo.team
  .map(
    (m) =>
      `- ${m.name}${m.role ? ` - ${m.role}` : ""} | Tél: ${m.phone} | Email: ${
        m.email
      }`
  )
  .join("\n")}
`;
