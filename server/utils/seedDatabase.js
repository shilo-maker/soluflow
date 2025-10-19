const { Workspace, User, Song, Service, ServiceSong, syncDatabase } = require('../models');

const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...\n');

    // Sync database (create tables)
    await syncDatabase({ force: true }); // WARNING: This drops all tables!
    console.log('✓ Database tables created\n');

    // Create workspace
    const workspace = await Workspace.create({
      name: 'Oasis Church',
      slug: 'oasis-church'
    });
    console.log('✓ Workspace created');

    // Create users
    const admin = await User.create({
      workspace_id: workspace.id,
      email: 'admin@oasis.com',
      password_hash: 'password123', // Will be hashed
      username: 'Admin User',
      role: 'admin'
    });

    const planner = await User.create({
      workspace_id: workspace.id,
      email: 'planner@oasis.com',
      password_hash: 'password123',
      username: 'Jane Smith',
      role: 'planner'
    });

    const member = await User.create({
      workspace_id: workspace.id,
      email: 'john@oasis.com',
      password_hash: 'password123',
      username: 'John Doe',
      role: 'member'
    });

    console.log('✓ Users created');

    // Create songs
    const song1 = await Song.create({
      workspace_id: workspace.id,
      title: 'Bamidbar',
      content: `{title: Bamidbar}
{subtitle: Written by Solu Team}
{key: Eb}
{bpm: 105}
{time: 4/4}

{soc: Verse 1}
במד[Cm]בר קול קורא כ[Bb]אן במד[Ab]בר
הוא יצי[Eb]לה ל[Ab]נו
{eoc}

{soc: Chorus}
ס[Cm]ולו לו ד[Bb]רך, י[Ab]שר לו מס[Eb]ילה
{eoc}`,
      key: 'Eb',
      bpm: 105,
      time_signature: '4/4',
      authors: 'Solu Team',
      created_by: planner.id
    });

    const song2 = await Song.create({
      workspace_id: workspace.id,
      title: 'Kadosh Kadosh',
      content: `{title: Kadosh Kadosh}
{key: G}
{bpm: 90}

{soc: Verse}
[G]Kadosh kadosh ka[D]dosh
Adonai [Em]Tzeva[C]ot
{eoc}`,
      key: 'G',
      bpm: 90,
      time_signature: '3/4',
      authors: 'Traditional',
      created_by: planner.id
    });

    const song3 = await Song.create({
      workspace_id: workspace.id,
      title: 'Shema Israel',
      content: `{title: Shema Israel}
{key: Am}

{soc: Verse}
[Am]Shema Yisrael [G]Adonai Elo[Am]heinu
{eoc}`,
      key: 'Am',
      bpm: 80,
      time_signature: '4/4',
      authors: 'Traditional',
      created_by: planner.id
    });

    console.log('✓ Songs created');

    // Create services
    const service1 = await Service.create({
      workspace_id: workspace.id,
      title: '15/10 OasisChurch',
      date: '2025-10-15',
      time: '19:00',
      location: 'Oasis Church',
      leader_id: planner.id,
      created_by: planner.id,
      code: 'X4K9',
      is_public: true
    });

    const service2 = await Service.create({
      workspace_id: workspace.id,
      title: '17/10 Venue1',
      date: '2025-10-17',
      time: '20:00',
      location: 'Venue 1',
      leader_id: planner.id,
      created_by: planner.id,
      code: 'B7M3',
      is_public: true
    });

    console.log('✓ Services created');

    // Add songs to service
    await ServiceSong.create({
      service_id: service1.id,
      song_id: song1.id,
      position: 0,
      segment_type: 'song',
      notes: 'Start slow, build up'
    });

    await ServiceSong.create({
      service_id: service1.id,
      song_id: song2.id,
      position: 1,
      segment_type: 'song'
    });

    await ServiceSong.create({
      service_id: service1.id,
      song_id: null,
      position: 2,
      segment_type: 'prayer',
      segment_title: 'Opening Prayer',
      segment_content: 'Prayer for the gathering'
    });

    await ServiceSong.create({
      service_id: service1.id,
      song_id: song3.id,
      position: 3,
      segment_type: 'song',
      notes: 'Repeat 2x'
    });

    console.log('✓ Service songs added');

    console.log('\n✅ Database seeded successfully!\n');
    console.log('Test credentials:');
    console.log('  Admin:   admin@oasis.com / password123');
    console.log('  Planner: planner@oasis.com / password123');
    console.log('  Member:  john@oasis.com / password123');
    console.log('  Guest code: X4K9\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
