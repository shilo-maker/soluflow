# SoluEvents Integration Guide

Quick start guide for integrating SoluFlow with SoluEvents.

## API Key (For Local Development)

```
05b1e84075787db67e5a4926912105690ceed7387cb972d410b476d44eaafce1
```

## Quick Setup in SoluEvents

### 1. Environment Variables

Create `.env` file in your SoluEvents project:

```env
REACT_APP_SOLUFLOW_API_URL=http://localhost:5002/api/integration
REACT_APP_SOLUFLOW_API_KEY=05b1e84075787db67e5a4926912105690ceed7387cb972d410b476d44eaafce1
```

For production (when SoluEvents goes live):
```env
REACT_APP_SOLUFLOW_API_URL=https://soluflow.app/api/integration
REACT_APP_SOLUFLOW_API_KEY=05b1e84075787db67e5a4926912105690ceed7387cb972d410b476d44eaafce1
```

### 2. Create SoluFlow Service (utils/soluflowApi.js)

```javascript
const SOLUFLOW_API_URL = process.env.REACT_APP_SOLUFLOW_API_URL || 'http://localhost:5002/api/integration';
const API_KEY = process.env.REACT_APP_SOLUFLOW_API_KEY;

export const searchSongs = async (query, limit = 10) => {
  try {
    const response = await fetch(
      `${SOLUFLOW_API_URL}/songs/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: {
          'X-API-Key': API_KEY
        }
      }
    );
    const data = await response.json();
    return data.success ? data.songs : [];
  } catch (error) {
    console.error('SoluFlow search error:', error);
    return [];
  }
};

export const getSongDetails = async (songId) => {
  try {
    const response = await fetch(
      `${SOLUFLOW_API_URL}/songs/${songId}`,
      {
        headers: {
          'X-API-Key': API_KEY
        }
      }
    );
    const data = await response.json();
    return data.success ? data.song : null;
  } catch (error) {
    console.error('SoluFlow get song error:', error);
    return null;
  }
};

export const createSoluFlowService = async (eventData, userToken) => {
  try {
    const response = await fetch(
      `${SOLUFLOW_API_URL}/services`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}` // Use user's SoluFlow token
        },
        body: JSON.stringify({
          name: eventData.name,
          date: eventData.date,
          songIds: eventData.songIds,
          notes: eventData.notes || ''
        })
      }
    );
    const data = await response.json();
    return data.success ? data.service : null;
  } catch (error) {
    console.error('SoluFlow create service error:', error);
    return null;
  }
};
```

### 3. Song Search Component

```javascript
import { useState, useEffect } from 'react';
import { searchSongs } from '../utils/soluflowApi';

function SongSearchAutocomplete({ onSelectSong }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const results = await searchSongs(query, 10);
      setSuggestions(results);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חפש שיר בסולו פלואו..."
        className="w-full p-2 border rounded"
      />

      {loading && (
        <div className="absolute top-full left-0 right-0 bg-white p-2 border">
          מחפש...
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 bg-white border rounded shadow-lg max-h-60 overflow-y-auto z-50">
          {suggestions.map(song => (
            <li
              key={song.id}
              onClick={() => {
                onSelectSong(song);
                setQuery('');
                setSuggestions([]);
              }}
              className="p-3 hover:bg-blue-50 cursor-pointer border-b"
            >
              <div className="font-semibold">{song.title}</div>
              {song.authors && (
                <div className="text-sm text-gray-600">{song.authors}</div>
              )}
              <div className="text-xs text-gray-500">
                {song.key && `${song.key} • `}
                {song.bpm && `${song.bpm} BPM`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SongSearchAutocomplete;
```

### 4. Usage in Event Program Editor

```javascript
import { useState } from 'react';
import SongSearchAutocomplete from './SongSearchAutocomplete';
import { createSoluFlowService } from '../utils/soluflowApi';

function EventProgramEditor() {
  const [eventData, setEventData] = useState({
    name: '',
    date: '',
    description: ''
  });
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [soluflowServiceUrl, setSoluflowServiceUrl] = useState(null);

  const handleAddSong = (song) => {
    setSelectedSongs([...selectedSongs, {
      soluflowId: song.id,
      title: song.title,
      authors: song.authors,
      key: song.key,
      bpm: song.bpm,
      soluflowCode: song.code
    }]);
  };

  const handleRemoveSong = (index) => {
    setSelectedSongs(selectedSongs.filter((_, i) => i !== index));
  };

  const handleCreateSoluFlowService = async () => {
    const userToken = localStorage.getItem('soluflowToken'); // Or however you store it

    if (!userToken) {
      alert('יש להתחבר לסולו פלואו כדי ליצור שירות');
      return;
    }

    const service = await createSoluFlowService({
      name: eventData.name,
      date: new Date(eventData.date).toISOString(),
      songIds: selectedSongs.map(s => s.soluflowId),
      notes: `נוצר מסולו אירועים: ${eventData.description}`
    }, userToken);

    if (service) {
      setSoluflowServiceUrl(service.shareUrl);
      alert('השירות נוצר בהצלחה בסולו פלואו!');
    } else {
      alert('שגיאה ביצירת השירות');
    }
  };

  return (
    <div className="p-6" dir="rtl">
      <h2 className="text-2xl font-bold mb-4">עריכת תוכנית האירוע</h2>

      <div className="space-y-4 mb-6">
        <input
          type="text"
          placeholder="שם האירוע"
          value={eventData.name}
          onChange={(e) => setEventData({...eventData, name: e.target.value})}
          className="w-full p-2 border rounded"
        />

        <input
          type="datetime-local"
          value={eventData.date}
          onChange={(e) => setEventData({...eventData, date: e.target.value})}
          className="w-full p-2 border rounded"
        />
      </div>

      <h3 className="text-xl font-semibold mb-3">שירים</h3>
      <SongSearchAutocomplete onSelectSong={handleAddSong} />

      <ul className="mt-4 space-y-2">
        {selectedSongs.map((song, index) => (
          <li key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <div className="font-semibold">{song.title}</div>
              <div className="text-sm text-gray-600">
                {song.authors} • {song.key}
              </div>
            </div>
            <button
              onClick={() => handleRemoveSong(index)}
              className="text-red-500 hover:text-red-700"
            >
              הסר
            </button>
          </li>
        ))}
      </ul>

      {selectedSongs.length > 0 && (
        <button
          onClick={handleCreateSoluFlowService}
          className="mt-6 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
        >
          צור שירות בסולו פלואו
        </button>
      )}

      {soluflowServiceUrl && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
          <p className="font-semibold">שירות נוצר בהצלחה!</p>
          <a
            href={soluflowServiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            פתח בסולו פלואו
          </a>
        </div>
      )}
    </div>
  );
}

export default EventProgramEditor;
```

## User Authentication Flow

For the best experience, users should be logged into SoluFlow:

1. **Option 1**: User logs into SoluFlow first, then use their token in SoluEvents
2. **Option 2**: Implement SoluFlow OAuth (future enhancement)
3. **Option 3**: Use API key for search only, require manual login for creating services

## Testing Locally

Both apps should be running:
- **SoluFlow**: http://localhost:3000 (client) + http://localhost:5002 (server)
- **SoluEvents**: http://localhost:3003 (or whatever port you use)

## Production Deployment

When deploying to production:

1. Update `SOLU_EVENTS_URL` in SoluFlow's production `.env`
2. Update `REACT_APP_SOLUFLOW_API_URL` in SoluEvents to `https://soluflow.app/api/integration`
3. Keep the same API key (or generate a new one for production if preferred)

## Support

See full documentation: `INTEGRATION_API_DOCS.md`
