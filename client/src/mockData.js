// Mock data for development and testing

export const mockUser = {
  id: 1,
  username: 'John Doe',
  email: 'john@example.com',
  role: 'member',
  workspaceId: 1
};

export const mockServices = [
  {
    id: 1,
    title: '15/10 OasisChurch',
    date: '2025-10-15',
    time: '19:00',
    location: 'Oasis Church',
    leaderId: 2,
    leaderName: 'Jane Smith',
    code: 'X4K9',
    isPublic: true
  },
  {
    id: 2,
    title: '17/10 Venue1',
    date: '2025-10-17',
    time: '20:00',
    location: 'Venue 1',
    leaderId: 2,
    leaderName: 'Jane Smith',
    code: 'B7M3',
    isPublic: true
  },
  {
    id: 3,
    title: '22/10 House Gathering',
    date: '2025-10-22',
    time: '18:30',
    location: 'Home',
    leaderId: 1,
    leaderName: 'John Doe',
    code: 'Q2P8',
    isPublic: false
  }
];

export const mockSongs = [
  {
    id: 1,
    title: 'Bamidbar',
    authors: 'Solu Team',
    key: 'Eb',
    bpm: 105,
    timeSig: '4/4',
    content: `{title: Bamidbar}
{subtitle: Written by Solu Team}
{key: Eb}
{bpm: 105}
{time: 4/4}

{soc: Intro}
[Cm]    [Bb]    [Ab]    [Eb]
{eoc}

{soc: Verse 1}
במד[Cm]בר קול קורא כ[Bb]אן במד[Ab]בר
הוא יצי[Eb]לה ל[Ab]נו
[Bb]ונהיה עבדי ניקום וב[Cm]וננו
אין מ[Bb]קום לפ[Eb]חד, א[Ab]ין זמן לב[Cm]כה
[Bb]והם נהלחם בא[Ab]הבה[Cm]
{eoc}

{soc: Pre-Chorus}
במד[Cm]בר קול קורא כ[Bb]אן במד[Ab]בר
{eoc}

{soc: Chorus}
ס[Cm]ולו לו ד[Bb]רך, י[Ab]שר לו מס[Eb]ילה
[Bb]הרימו כל משפ[Cm]ל, כי תתה ה[Bb]וא כבר ב[Eb]א
במד[Cm]בר בער[Bb]בה, בהר[Ab]ים ובשפ[Eb]לה
קול קורא בם ב[Cm]רמה, קול מפ[Bb]אר את השמ[Eb]מה[Cm]
{eoc}

{soc: Bridge}
קול קורא גם ב[Bb]רחוב[Eb]ות ובנילי[Ab]ות[Fm]
בחדרי החדרי[Ab]ם, וגם על גגות נב[Cm]ורים
במד[Bb]בר, במד[Ab]בר קול קורא כ[Cm]אן במדבר
{eoc}

{soc: Chorus 2x}
ס[Cm]ולו לו ד[Bb]רך, י[Ab]שר לו מס[Eb]ילה
כלי[Bb]נו מתכנם בצפ[Eb]יה[Ab]
שהנגלה ל[Eb]נו בתהלו[Ab]א כבכ[Cm]ודך
או [Bb]ישמח, פי אדנ[Eb]י דיבר
[Bb]במד[Ab]בר קול קורא כ[Cm]אן במדבר
{eoc}`
  },
  {
    id: 2,
    title: 'Kadosh Kadosh',
    authors: 'Traditional',
    key: 'G',
    bpm: 90,
    timeSig: '3/4',
    content: `{title: Kadosh Kadosh}
{subtitle: Traditional}
{key: G}
{bpm: 90}
{time: 3/4}

{soc: Verse}
[G]Kadosh kadosh ka[D]dosh
Adonai [Em]Tzeva[C]ot
[G]Melo chol ha[D]aretz kevo[Em]do[C]
{eoc}

{soc: Chorus}
[G]Holy holy [D]holy
Is the [Em]Lord of [C]Hosts
[G]The whole earth is [D]full of His [Em]glory[C]
{eoc}`
  },
  {
    id: 3,
    title: 'Shema Israel',
    authors: 'Traditional',
    key: 'Am',
    bpm: 80,
    timeSig: '4/4',
    content: `{title: Shema Israel}
{subtitle: Traditional}
{key: Am}
{bpm: 80}
{time: 4/4}

{soc: Verse}
[Am]Shema Yisrael [G]Adonai Elo[Am]heinu
Adonai E[G]chad [Am]
{eoc}`
  },
  {
    id: 4,
    title: 'Baruch Adonai',
    authors: 'Paul Wilbur',
    key: 'D',
    bpm: 130,
    timeSig: '4/4',
    content: `{title: Baruch Adonai}
{subtitle: Paul Wilbur}
{key: D}
{bpm: 130}
{time: 4/4}

{soc: Verse}
[D]Baruch Adonai [A]El Shaddai
[Bm]Baruch Adonai [G]El Elyon
[D]Blessed be the [A]Lord God Almighty
[Bm]Who was and is [G]and is to come
{eoc}

{soc: Chorus}
[D]Blessed be the [A]Lord our God
[Bm]Ruler of the [G]universe
[D]Holy and a[A]nointed [Bm]One[G]
{eoc}`
  }
];

// Set lists organized by service ID
export const mockSetLists = {
  1: [ // 15/10 OasisChurch
    {
      id: 1,
      position: 0,
      segmentType: 'song',
      song: mockSongs[0],
      notes: 'Start slow, build up to chorus'
    },
    {
      id: 2,
      position: 1,
      segmentType: 'song',
      song: mockSongs[1],
      notes: ''
    },
    {
      id: 3,
      position: 2,
      segmentType: 'prayer',
      segmentTitle: 'Opening Prayer',
      segmentContent: 'Prayer for the gathering',
      notes: 'Led by worship leader'
    },
    {
      id: 4,
      position: 3,
      segmentType: 'song',
      song: mockSongs[2],
      notes: ''
    },
    {
      id: 5,
      position: 4,
      segmentType: 'song',
      song: mockSongs[3],
      notes: 'Repeat bridge 2x'
    }
  ],
  2: [ // 17/10 Venue1
    {
      id: 6,
      position: 0,
      segmentType: 'song',
      song: mockSongs[3],
      notes: ''
    },
    {
      id: 7,
      position: 1,
      segmentType: 'song',
      song: mockSongs[1],
      notes: 'Acoustic version'
    },
    {
      id: 8,
      position: 2,
      segmentType: 'song',
      song: mockSongs[0],
      notes: ''
    }
  ],
  3: [ // 22/10 House Gathering
    {
      id: 9,
      position: 0,
      segmentType: 'song',
      song: mockSongs[2],
      notes: 'Simple and intimate'
    },
    {
      id: 10,
      position: 1,
      segmentType: 'song',
      song: mockSongs[1],
      notes: ''
    }
  ]
};

// Legacy export for backward compatibility
export const mockSetList = mockSetLists[1];

export const mockNotes = [
  {
    id: 1,
    songId: 1,
    serviceId: 1,
    content: 'Remember capo 2 for this one',
    isVisible: true
  },
  {
    id: 2,
    songId: 2,
    serviceId: 1,
    content: 'Play softly during verse',
    isVisible: true
  }
];
