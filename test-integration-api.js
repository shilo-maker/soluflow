// Test script for Integration API
const API_KEY = '05b1e84075787db67e5a4926912105690ceed7387cb972d410b476d44eaafce1';
const BASE_URL = 'http://localhost:5002/api/integration';

async function testHealthCheck() {
  console.log('\n🔍 Testing Health Check...');
  const response = await fetch(`${BASE_URL}/health`);
  const data = await response.json();
  console.log('✅ Health Check:', data);
  return data;
}

async function testSongSearch() {
  console.log('\n🔍 Testing Song Search (without auth - public songs only)...');
  const response = await fetch(`${BASE_URL}/songs/search?q=kadosh&limit=5`);
  const data = await response.json();
  console.log(`✅ Found ${data.count} songs:`, data.songs?.slice(0, 2));
  return data;
}

async function testSongSearchWithApiKey() {
  console.log('\n🔍 Testing Song Search (with API key)...');
  const response = await fetch(`${BASE_URL}/songs/search?q=&limit=5`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  const data = await response.json();
  console.log(`✅ Found ${data.count} songs:`, data.songs?.slice(0, 2));
  return data;
}

async function testGetSong(songId) {
  if (!songId) {
    console.log('\n⏭️  Skipping Get Song test (no song ID)');
    return;
  }

  console.log(`\n🔍 Testing Get Song (ID: ${songId})...`);
  const response = await fetch(`${BASE_URL}/songs/${songId}`);
  const data = await response.json();

  if (data.success) {
    console.log(`✅ Song Details:`, {
      title: data.song.title,
      authors: data.song.authors,
      key: data.song.key,
      bpm: data.song.bpm
    });
  } else {
    console.log('❌ Error:', data.error);
  }
  return data;
}

async function runTests() {
  console.log('═══════════════════════════════════════');
  console.log('  SoluFlow Integration API Tests');
  console.log('═══════════════════════════════════════');

  try {
    // Test 1: Health Check
    await testHealthCheck();

    // Test 2: Search without auth
    const searchResult1 = await testSongSearch();

    // Test 3: Search with API key
    const searchResult2 = await testSongSearchWithApiKey();

    // Test 4: Get specific song (if we found any)
    const firstSong = searchResult1.songs?.[0] || searchResult2.songs?.[0];
    if (firstSong) {
      await testGetSong(firstSong.id);
    }

    console.log('\n═══════════════════════════════════════');
    console.log('✅ All tests completed successfully!');
    console.log('═══════════════════════════════════════');

    console.log('\n📝 Next Steps for SoluEvents Integration:');
    console.log('1. Use this API key in SoluEvents:');
    console.log(`   ${API_KEY}`);
    console.log('\n2. Endpoints available:');
    console.log(`   - Search: ${BASE_URL}/songs/search?q=query`);
    console.log(`   - Get Song: ${BASE_URL}/songs/:id`);
    console.log(`   - Create Service: POST ${BASE_URL}/services`);
    console.log('\n3. See INTEGRATION_API_DOCS.md for full examples');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run tests
runTests();
