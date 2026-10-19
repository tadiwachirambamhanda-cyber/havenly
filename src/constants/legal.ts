// Draft legal documents, written from what the app actually collects and
// does. To be reviewed by a UAE lawyer before launch — especially the
// housing referral and data-sharing sections. Replace the bracketed
// placeholders below once the company and business email exist.
export const LEGAL_ENTITY = '[Havenly legal entity name]';
export const LEGAL_CONTACT_EMAIL = '[privacy email]';
export const LEGAL_LAST_UPDATED = '19 October 2026';
export const LEGAL_IS_DRAFT = true;

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  after?: string[];
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy policy',
  intro: `This policy explains what information Havenly collects, why, who it's shared with, and the choices you have. Havenly is operated by ${LEGAL_ENTITY} ("Havenly", "we", "us") in the United Arab Emirates.`,
  sections: [
    {
      heading: 'What we collect',
      paragraphs: ['We only collect what the app needs to work:'],
      bullets: [
        'Account details: your email address and password. Passwords are stored encrypted by our authentication provider; we never see them.',
        'Your profile: display name, username, bio, profile and cover photos, university and interests.',
        'What you post and do: posts, photos, videos, comments, likes, saved posts, communities you join, people you follow, and your daily activity streak.',
        'Messages: direct and group messages, including posts you share in them.',
        'Location: only while you use the map or location-based sorting, and only if you allow it. We don\'t track your location in the background. A check-in is something you choose to make; it expires after 4 hours and is only visible to mutual follows, members of group chats you share, and members of communities you share.',
        'Housing: residences you save, and enquiries you send — move-in month, length of stay, room, budget, viewing availability, your message and the phone or WhatsApp number you give us. If you sign with a residence, we record the contract value so we can work out the fee the residence owes us.',
        'Perks: offers you claim and their redemption codes.',
        'Safety: people you block and reports you make.',
        'Technical data: standard logs from our hosting provider (such as IP address, device type and request times), and crash reports when the app hits an error, used to keep the service running and secure.',
      ],
    },
    {
      heading: 'How we use it',
      bullets: [
        'To run the app: show your profile, posts, messages, communities, perks, map and housing listings.',
        'To personalise your feed using your interests and university.',
        'To pass your housing enquiries to the residence you contacted and follow them up.',
        'To calculate and invoice the referral fees residences pay us.',
        'To send you in-app notifications, for example when someone follows you or your enquiry moves forward.',
        'To keep Havenly safe: reviewing reports, enforcing our terms and preventing abuse.',
      ],
      after: ['We don\'t sell your personal information, and we don\'t use advertising or analytics trackers in the app.'],
    },
    {
      heading: 'Who we share it with',
      bullets: [
        'Other Havenly users see what you choose to make visible: your profile, posts, comments and community activity. Messages are visible to the people in that conversation.',
        'Residences you enquire with receive your name, university, phone or WhatsApp number and your enquiry details, so they can contact you. Once they have it, they handle it under their own privacy policy.',
        'Brands offering perks see your redemption code when you use it, not your profile.',
        'Service providers who run parts of Havenly for us: Supabase (database, accounts and file storage), Mapbox (maps) and Sentry (crash reports, which record what went wrong and on which screen, linked to your account ID at most and never to your name, email or messages). They process data only to provide their service.',
        'Authorities, where UAE law requires us to.',
      ],
    },
    {
      heading: 'Where your data is stored',
      paragraphs: [
        'Our database and files are hosted by Supabase in its Mumbai (India) region, so your information is stored outside the UAE. We rely on our providers\' security and contractual safeguards for this transfer.',
      ],
    },
    {
      heading: 'How long we keep it',
      paragraphs: [
        'We keep your information while your account is open. Expired check-ins stop being shown after 4 hours.',
        `If you delete your account (Settings → Delete account), we delete your account, profile, posts, comments, messages you sent, saved items, enquiries, and the photos and videos you uploaded. If you signed with a residence through Havenly, we keep a record of that deal (the residence, dates, contract value and fee) with your name, phone number and messages removed, because we need it for accounting. Information a residence already received from an enquiry is held by that residence.`,
      ],
    },
    {
      heading: 'Your choices and rights',
      bullets: [
        'Edit your profile, university and interests at any time.',
        'Turn off location access in your phone\'s settings; the map then shows Dubai without your position.',
        'Block anyone, and report posts, people, messages or communities.',
        'Delete your account from Settings.',
        `Ask us for a copy of your information, to correct it, or to delete it, by emailing ${LEGAL_CONTACT_EMAIL}. We reply within 30 days.`,
      ],
    },
    {
      heading: 'Age',
      paragraphs: ['Havenly is for people aged 18 and over. We don\'t knowingly collect information from anyone younger; if you think a younger person has an account, tell us and we\'ll remove it.'],
    },
    {
      heading: 'Changes',
      paragraphs: ['If we change this policy in a meaningful way, we\'ll tell you in the app before the change takes effect.'],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions or requests about your data: ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  title: 'Terms of use',
  intro: `These terms are an agreement between you and ${LEGAL_ENTITY} ("Havenly", "we", "us"). By creating an account or using Havenly, you agree to them. Please also read our privacy policy.`,
  sections: [
    {
      heading: 'Who can use Havenly',
      paragraphs: ['You must be at least 18 and able to agree to these terms. One account per person, with accurate details — including your university, since some communities are only open to its students.'],
    },
    {
      heading: 'Your account',
      paragraphs: ['Keep your password safe; you\'re responsible for activity on your account. Tell us if you think someone else has access to it.'],
    },
    {
      heading: 'What you post',
      paragraphs: [
        'You own what you post. You give Havenly a non-exclusive, royalty-free licence to host, display and share it within the app so the service can work. This ends when you delete the content or your account, except where others have already re-shared it in messages.',
        'Only post what you have the right to share. Don\'t post anything that:',
      ],
      bullets: [
        'breaks UAE law, including laws on privacy, defamation and online content;',
        'harasses, threatens, bullies or impersonates anyone;',
        'is hateful, sexually explicit, violent or promotes illegal activity;',
        'shares someone else\'s personal information or photos without their consent;',
        'is spam, a scam, or misleading advertising.',
      ],
    },
    {
      heading: 'Keeping Havenly safe',
      paragraphs: ['You can block people and report content. We review reports and may remove content, limit features, or suspend or close accounts that break these terms, with or without notice where that\'s needed to protect others.'],
    },
    {
      heading: 'Housing',
      paragraphs: [
        'Havenly introduces students to student residences. We are not a landlord, a real estate broker or an agent for either side, and we are not a party to any tenancy.',
        'Any tenancy, deposit or payment is between you and the residence, on their terms. Havenly never collects rent or deposits. Read the residence\'s contract carefully before you sign.',
        'Havenly is free for students. Residences may pay Havenly a referral fee when a student we introduced signs with them.',
        'Listings are written from information residences give us. We check them, but we can\'t guarantee availability, prices or descriptions — confirm details with the residence, and visit before you commit. For your safety, meet residences at their premises and never pay anyone through Havenly messages.',
      ],
    },
    {
      heading: 'Perks and events',
      paragraphs: [
        'Perks are offered by the brands themselves, on their terms. Codes have no cash value, can\'t be transferred, and may end at any time. The brand, not Havenly, is responsible for honouring an offer.',
        'Events and places shown in Havenly are run by others. Take part at your own risk and follow the organiser\'s rules.',
      ],
    },
    {
      heading: 'Location features',
      paragraphs: ['Check-ins and the map are optional. Think about who can see a check-in before you make one, and don\'t use location features to follow or harass anyone.'],
    },
    {
      heading: 'Ending your account',
      paragraphs: ['You can delete your account at any time in Settings. We may close accounts that break these terms. Sections that by their nature should continue — such as content licences already used, disclaimers and the limits on liability — continue after your account ends.'],
    },
    {
      heading: 'Disclaimers and liability',
      paragraphs: [
        'Havenly is provided "as is". We work to keep it available and accurate, but we don\'t promise it will always be uninterrupted or error-free.',
        'To the extent UAE law allows, Havenly isn\'t liable for indirect or consequential losses, or for the acts of other users, residences, brands or event organisers. Nothing in these terms limits liability that can\'t be limited by law.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: ['We may update these terms. If a change is significant, we\'ll tell you in the app before it takes effect. Continuing to use Havenly after that means you accept the updated terms.'],
    },
    {
      heading: 'Governing law',
      paragraphs: ['These terms are governed by the laws of the United Arab Emirates as applied in the Emirate of Dubai, and the courts of Dubai have jurisdiction over any dispute.'],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about these terms: ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};
