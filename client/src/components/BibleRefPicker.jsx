import { useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './BibleRefPicker.css';

export const BIBLE_BOOKS = [
  // Old Testament
  { name: 'Genesis', chapters: 50, tKey: 'bibleRef.books.genesis' },
  { name: 'Exodus', chapters: 40, tKey: 'bibleRef.books.exodus' },
  { name: 'Leviticus', chapters: 27, tKey: 'bibleRef.books.leviticus' },
  { name: 'Numbers', chapters: 36, tKey: 'bibleRef.books.numbers' },
  { name: 'Deuteronomy', chapters: 34, tKey: 'bibleRef.books.deuteronomy' },
  { name: 'Joshua', chapters: 24, tKey: 'bibleRef.books.joshua' },
  { name: 'Judges', chapters: 21, tKey: 'bibleRef.books.judges' },
  { name: 'Ruth', chapters: 4, tKey: 'bibleRef.books.ruth' },
  { name: '1 Samuel', chapters: 31, tKey: 'bibleRef.books.1samuel' },
  { name: '2 Samuel', chapters: 24, tKey: 'bibleRef.books.2samuel' },
  { name: '1 Kings', chapters: 22, tKey: 'bibleRef.books.1kings' },
  { name: '2 Kings', chapters: 25, tKey: 'bibleRef.books.2kings' },
  { name: '1 Chronicles', chapters: 29, tKey: 'bibleRef.books.1chronicles' },
  { name: '2 Chronicles', chapters: 36, tKey: 'bibleRef.books.2chronicles' },
  { name: 'Ezra', chapters: 10, tKey: 'bibleRef.books.ezra' },
  { name: 'Nehemiah', chapters: 13, tKey: 'bibleRef.books.nehemiah' },
  { name: 'Esther', chapters: 10, tKey: 'bibleRef.books.esther' },
  { name: 'Job', chapters: 42, tKey: 'bibleRef.books.job' },
  { name: 'Psalms', chapters: 150, tKey: 'bibleRef.books.psalms' },
  { name: 'Proverbs', chapters: 31, tKey: 'bibleRef.books.proverbs' },
  { name: 'Ecclesiastes', chapters: 12, tKey: 'bibleRef.books.ecclesiastes' },
  { name: 'Song of Solomon', chapters: 8, tKey: 'bibleRef.books.songOfSolomon' },
  { name: 'Isaiah', chapters: 66, tKey: 'bibleRef.books.isaiah' },
  { name: 'Jeremiah', chapters: 52, tKey: 'bibleRef.books.jeremiah' },
  { name: 'Lamentations', chapters: 5, tKey: 'bibleRef.books.lamentations' },
  { name: 'Ezekiel', chapters: 48, tKey: 'bibleRef.books.ezekiel' },
  { name: 'Daniel', chapters: 12, tKey: 'bibleRef.books.daniel' },
  { name: 'Hosea', chapters: 14, tKey: 'bibleRef.books.hosea' },
  { name: 'Joel', chapters: 3, tKey: 'bibleRef.books.joel' },
  { name: 'Amos', chapters: 9, tKey: 'bibleRef.books.amos' },
  { name: 'Obadiah', chapters: 1, tKey: 'bibleRef.books.obadiah' },
  { name: 'Jonah', chapters: 4, tKey: 'bibleRef.books.jonah' },
  { name: 'Micah', chapters: 7, tKey: 'bibleRef.books.micah' },
  { name: 'Nahum', chapters: 3, tKey: 'bibleRef.books.nahum' },
  { name: 'Habakkuk', chapters: 3, tKey: 'bibleRef.books.habakkuk' },
  { name: 'Zephaniah', chapters: 3, tKey: 'bibleRef.books.zephaniah' },
  { name: 'Haggai', chapters: 2, tKey: 'bibleRef.books.haggai' },
  { name: 'Zechariah', chapters: 14, tKey: 'bibleRef.books.zechariah' },
  { name: 'Malachi', chapters: 4, tKey: 'bibleRef.books.malachi' },
  // New Testament
  { name: 'Matthew', chapters: 28, tKey: 'bibleRef.books.matthew' },
  { name: 'Mark', chapters: 16, tKey: 'bibleRef.books.mark' },
  { name: 'Luke', chapters: 24, tKey: 'bibleRef.books.luke' },
  { name: 'John', chapters: 21, tKey: 'bibleRef.books.john' },
  { name: 'Acts', chapters: 28, tKey: 'bibleRef.books.acts' },
  { name: 'Romans', chapters: 16, tKey: 'bibleRef.books.romans' },
  { name: '1 Corinthians', chapters: 16, tKey: 'bibleRef.books.1corinthians' },
  { name: '2 Corinthians', chapters: 13, tKey: 'bibleRef.books.2corinthians' },
  { name: 'Galatians', chapters: 6, tKey: 'bibleRef.books.galatians' },
  { name: 'Ephesians', chapters: 6, tKey: 'bibleRef.books.ephesians' },
  { name: 'Philippians', chapters: 4, tKey: 'bibleRef.books.philippians' },
  { name: 'Colossians', chapters: 4, tKey: 'bibleRef.books.colossians' },
  { name: '1 Thessalonians', chapters: 5, tKey: 'bibleRef.books.1thessalonians' },
  { name: '2 Thessalonians', chapters: 3, tKey: 'bibleRef.books.2thessalonians' },
  { name: '1 Timothy', chapters: 6, tKey: 'bibleRef.books.1timothy' },
  { name: '2 Timothy', chapters: 4, tKey: 'bibleRef.books.2timothy' },
  { name: 'Titus', chapters: 3, tKey: 'bibleRef.books.titus' },
  { name: 'Philemon', chapters: 1, tKey: 'bibleRef.books.philemon' },
  { name: 'Hebrews', chapters: 13, tKey: 'bibleRef.books.hebrews' },
  { name: 'James', chapters: 5, tKey: 'bibleRef.books.james' },
  { name: '1 Peter', chapters: 5, tKey: 'bibleRef.books.1peter' },
  { name: '2 Peter', chapters: 3, tKey: 'bibleRef.books.2peter' },
  { name: '1 John', chapters: 5, tKey: 'bibleRef.books.1john' },
  { name: '2 John', chapters: 1, tKey: 'bibleRef.books.2john' },
  { name: '3 John', chapters: 1, tKey: 'bibleRef.books.3john' },
  { name: 'Jude', chapters: 1, tKey: 'bibleRef.books.jude' },
  { name: 'Revelation', chapters: 22, tKey: 'bibleRef.books.revelation' },
];

export function parseBibleRef(ref) {
  if (!ref) return { book: '', chapter: null, verseStart: null, verseEnd: null };
  if (typeof ref === 'object' && 'book' in ref) return ref;

  const str = String(ref).trim();
  if (!str) return { book: '', chapter: null, verseStart: null, verseEnd: null };

  // Match "Book Chapter:VerseStart-VerseEnd"
  const match = str.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (match) {
    return {
      book: match[1],
      chapter: parseInt(match[2]),
      verseStart: match[3] ? parseInt(match[3]) : null,
      verseEnd: match[4] ? parseInt(match[4]) : null,
    };
  }

  // Just a book name
  const bookMatch = BIBLE_BOOKS.find((b) => str.startsWith(b.name));
  if (bookMatch) return { book: bookMatch.name, chapter: null, verseStart: null, verseEnd: null };

  return { book: '', chapter: null, verseStart: null, verseEnd: null };
}

export function formatBibleRef(ref) {
  if (!ref.book) return '';
  let s = ref.book;
  if (ref.chapter != null) {
    s += ` ${ref.chapter}`;
    if (ref.verseStart != null) {
      s += `:${ref.verseStart}`;
      if (ref.verseEnd != null && ref.verseEnd !== ref.verseStart) {
        s += `-${ref.verseEnd}`;
      }
    }
  }
  return s;
}

export default function BibleRefPicker({ value, onChange, className }) {
  const { t } = useLanguage();
  const ref = useMemo(() => parseBibleRef(value), [value]);

  const selectedBook = BIBLE_BOOKS.find((b) => b.name === ref.book);
  const chapterCount = selectedBook?.chapters || 0;

  const update = (partial) => {
    const next = { ...ref, ...partial };
    onChange(formatBibleRef(next), next);
  };

  return (
    <div className={`bible-ref-picker ${className || ''}`}>
      <select
        className="bible-book-select"
        value={ref.book}
        onChange={(e) => update({ book: e.target.value, chapter: null, verseStart: null, verseEnd: null })}
      >
        <option value="">{t('bibleRef.book')}</option>
        <optgroup label={t('bibleRef.oldTestament')}>
          {BIBLE_BOOKS.slice(0, 39).map((b) => (
            <option key={b.name} value={b.name}>{t(b.tKey)}</option>
          ))}
        </optgroup>
        <optgroup label={t('bibleRef.newTestament')}>
          {BIBLE_BOOKS.slice(39).map((b) => (
            <option key={b.name} value={b.name}>{t(b.tKey)}</option>
          ))}
        </optgroup>
      </select>

      {ref.book && (
        <select
          className="bible-chapter-select"
          value={ref.chapter ?? ''}
          onChange={(e) => {
            const ch = e.target.value ? parseInt(e.target.value) : null;
            update({ chapter: ch, verseStart: null, verseEnd: null });
          }}
        >
          <option value="">{t('bibleRef.chapter')}</option>
          {Array.from({ length: chapterCount }, (_, i) => i + 1).map((ch) => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
      )}

      {ref.chapter != null && (
        <>
          <input
            type="number"
            className="bible-verse-input"
            min={1}
            value={ref.verseStart ?? ''}
            onChange={(e) => {
              const v = e.target.value ? parseInt(e.target.value) : null;
              const updates = { verseStart: v };
              // Clear verseEnd if it's now below the new verseStart
              if (v != null && ref.verseEnd != null && ref.verseEnd < v) {
                updates.verseEnd = null;
              }
              update(updates);
            }}
            placeholder={t('bibleRef.verseStart')}
          />
          <span className="bible-verse-separator">-</span>
          <input
            type="number"
            className="bible-verse-input"
            min={ref.verseStart || 1}
            disabled={ref.verseStart == null}
            value={ref.verseEnd ?? ''}
            onChange={(e) => {
              const v = e.target.value ? parseInt(e.target.value) : null;
              update({ verseEnd: v });
            }}
            placeholder={t('bibleRef.verseEnd')}
          />
        </>
      )}
    </div>
  );
}
