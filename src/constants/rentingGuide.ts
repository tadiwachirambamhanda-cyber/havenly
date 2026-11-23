// Renting in Dubai: general guidance for a first-time student renter, written from the published sources listed
// below. It is not legal advice. Prices and rules change, so the date matters and where a source did not say,
// the guide says "ask" instead of guessing. To be read by the founder and a UAE lawyer before launch.

export const GUIDE_LAST_CHECKED = '23 November 2026';

export const GUIDE_DISCLAIMER =
  'General guidance from published sources, last checked ' + GUIDE_LAST_CHECKED + '. It is not legal advice. Prices and rules change, so confirm anything that matters with the provider and the Dubai Land Department.';

export interface GuideSection {
  id: string;
  title: string;
  intro?: string;
  points: string[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'before-you-pay',
    title: 'Before you pay anything',
    points: [
      'Dubai property adverts carry a permit number (Trakheesi). Ask for it. Havenly shows it on a listing when we have it.',
      'Ask for the tenancy contract in writing before you pay a deposit, and read it.',
      'Pay only to the account named in the contract, never in cash to a person, and keep every receipt.',
      'On Havenly, tap the Verified badge on a listing to see what the team checks, and when.',
    ],
  },
  {
    id: 'costs',
    title: 'What it costs to move in',
    intro: 'Student residences are often priced all in. Whole homes and apartments usually have extra costs on top of the rent. Ask for the total to move in.',
    points: [
      'First rent. Student residences often charge monthly or by semester. For homes and apartments, rent is commonly paid a year at a time or by post-dated cheques. Ask which applies.',
      'Security deposit. Landlords commonly ask for 5% of the annual rent for an unfurnished home and 10% for a furnished one. The amount is whatever your contract says.',
      'Ejari. A tenancy contract is registered with the Dubai Land Department through Ejari. The sources we read quote about AED 178 online and about AED 220 at a registration centre. Ask who registers it.',
      'DEWA (water and electricity). It is connected once the Ejari is registered. The sources quote a refundable deposit of about AED 2,000 for an apartment and AED 4,000 for a villa, plus an activation fee of roughly AED 130 to 155.',
      'Agent fee. The sources we read give no standard rate. Ask whether there is one, how much it is and who pays it, before you sign.',
      'What is included. Some places include bills, internet or cleaning. Havenly shows "Bills included" or an estimate on each listing. Ask what the rent covers.',
    ],
  },
  {
    id: 'papers',
    title: 'Papers you may be asked for',
    points: [
      'A passport copy, a valid residence visa and an Emirates ID are the usual papers for a tenancy.',
      'To connect DEWA you also need the Ejari number and the premises number.',
      'If you do not have a visa or Emirates ID yet, ask the provider what they accept. Do not assume.',
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing a home',
    points: [
      'Dubai passed a shared-housing law in 2026. Sharing is allowed only in homes that may be shared, through owners or licensed operators.',
      'Everyone who lives in the home should be named on the tenancy or have the landlord\'s written consent.',
      'Be careful with anyone offering a bed space or a room in a partitioned flat. Ask for the permit and the contract first.',
      'Havenly\'s housemate board is for friends and students taking a whole home together on one lease.',
    ],
  },
  {
    id: 'deposit-back',
    title: 'Getting your deposit back',
    points: [
      'Take dated photos of every room when you move in and when you move out, and hand the home back in good condition.',
      'Keep your contract, Ejari, ID and visa copies and every payment record.',
      'If the landlord does not return the deposit after the tenancy ends, you can complain to Dubai\'s Rental Dispute Centre. It starts with mediation. Check its current fees on its website.',
    ],
  },
  {
    id: 'questions',
    title: 'Questions to ask the provider',
    points: [
      'What is the total I pay to move in, and what is it made of?',
      'What does the rent include: bills, internet, cleaning?',
      'Is the advert permit number on the listing, and who is the landlord or licensed operator?',
      'Who signs the contract, and is the tenancy registered with Ejari? Who pays for that?',
      'When and how is the deposit returned, and what can be deducted?',
      'Can I leave early, and what does it cost?',
    ],
  },
];

export interface GuideSource { label: string; url: string }

export const GUIDE_SOURCES: GuideSource[] = [
  { label: 'Gulf News: extra costs when moving in (Ejari, DEWA, deposits)', url: 'https://gulfnews.com/living-in-uae/housing/dubai-rental-costs-ejari-dewa-deposits-moving-fees-1.500296020' },
  { label: 'Property Finder: documents needed to rent', url: 'https://propertyfinder.ae/guides/what-documents-needed-to-rent-a-property-in-dubai' },
  { label: 'Bayut: first-time guide to renting in Dubai', url: 'https://www.bayut.com/mybayut/first-time-guide-for-renting-in-dubai' },
  { label: 'The National: Dubai shared housing rules (2026)', url: 'https://www.thenationalnews.com/news/uae/2026/08/26/dubai-shared-housing-rules-come-into-effect-in-bid-to-curb-dangerous-accommodation/' },
  { label: 'Gulf News: subletting and apartment-sharing rules', url: 'https://gulfnews.com/living-in-uae/housing/dubais-subletting-and-apartment-sharing-rules-what-tenants-need-to-know-1.500626734' },
  { label: 'Gulf News: getting your security deposit back', url: 'https://gulfnews.com/living-in-uae/housing/renting-in-dubai-how-to-get-your-security-deposit-back-and-what-to-do-if-your-landlord-refuses-1.500414675' },
  { label: 'dubizzle: rental deposit disputes in Dubai', url: 'https://www.dubizzle.com/blog/property/rental-deposit-disputes-dubai/' },
];

// What the Havenly team checks before marking a listing Verified. A draft: the founder must confirm it matches
// what the team really does, because it is a promise to students.
export const VERIFIED_TITLE = 'What does Verified mean?';
export const VERIFIED_EXPLAINER =
  'A member of the Havenly team checked this listing: that the provider is real, that the advert permit number is valid, and that the price and details match what the provider told us. We do not inspect every room, and Verified is not a guarantee. Always read the contract before you pay.';
export const NOT_VERIFIED_LINE =
  'Not checked by Havenly yet. Before you pay, ask for the permit number and a written contract.';
