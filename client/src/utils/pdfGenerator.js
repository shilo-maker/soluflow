import html2pdf from 'html2pdf.js';
import { transpose } from './transpose';
import { createRoot } from 'react-dom/client';
import React from 'react';
import A4PDFView from '../components/A4PDFView';

/**
 * Generate a PDF from a setlist
 * @param {Object} service - The service object with name and date
 * @param {Array} songs - Array of songs in the setlist
 * @param {Object} options - Optional settings like fontSize
 */
export const generateSetlistPDF = async (service, songs, options = {}) => {
  const { fontSize = 14 } = options;

  // Load the footer image as base64
  const loadFooterAsBase64 = async () => {
    try {
      const response = await fetch('/solu_flow_footer.png');
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading footer:', error);
      return '';
    }
  };

  const logoBase64 = await loadFooterAsBase64();
  console.log('Footer loaded:', logoBase64 ? 'Success' : 'Failed', logoBase64?.substring(0, 50));

  // Helper to detect if text contains Hebrew
  const hasHebrew = (text) => {
    return /[\u0590-\u05FF]/.test(text);
  };

  // Helper to measure text width
  const measureTextWidth = (text, fontSize, fontFamily) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontSize}px ${fontFamily}`;
    return context.measureText(text).width;
  };

  // Helper function to parse ChordPro content
  const parseChordProLine = (line) => {
    const chordPattern = /\[([^\]]+)\]/g;
    const chords = [];
    let match;
    let offset = 0; // Track how many characters we've removed

    while ((match = chordPattern.exec(line)) !== null) {
      // Adjust position to account for previously removed chord markers
      const adjustedPosition = match.index - offset;

      chords.push({
        chord: match[1],
        position: adjustedPosition
      });

      // Update offset: we're removing [chord] which is chord.length + 2 brackets
      offset += match[1].length + 2;
    }

    const lyrics = line.replace(/\[([^\]]+)\]/g, '');
    return { chords, lyrics };
  };

  // Build HTML content
  let htmlContent = `
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Heebo', Arial, sans-serif;
            padding: 20px;
            direction: ltr;
          }
          .title-page {
            margin-bottom: 40px;
            page-break-after: always;
          }
          .title-page > .service-title,
          .title-page > .service-date {
            text-align: center;
          }
          .service-title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .service-date {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
          }
          .toc {
            margin-bottom: 20px;
          }
          .toc-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .toc-item {
            margin: 8px 0;
            padding-left: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .toc-song-info {
            flex: 1;
          }
          .toc-meta {
            font-size: 12px;
            color: #666;
            margin-left: 15px;
          }
          .song {
            margin-bottom: 30px;
          }
          .song.page-break {
            page-break-before: always;
          }
          .song-header {
            margin-bottom: 20px;
            border-bottom: 2px solid #4ECDC4;
            padding-bottom: 10px;
          }
          .song-title {
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .song-meta {
            font-size: 12px;
            color: #666;
            margin: 3px 0;
          }
          .song-content {
            font-size: ${fontSize}px;
            line-height: 1.8;
            white-space: pre-wrap;
          }
          .chord-line {
            position: relative;
            height: 1.2em;
            min-height: 1.2em;
          }
          .chord {
            position: absolute;
            color: #4ECDC4;
            font-weight: bold;
            white-space: nowrap;
            font-family: 'Heebo', Arial, sans-serif;
          }
          .lyric-line {
            color: #333;
            min-height: 1.2em;
            white-space: pre-wrap;
          }
          .lyric-line.rtl {
            direction: rtl;
            text-align: right;
          }
          .section-header {
            font-weight: bold;
            font-size: ${fontSize + 2}px;
            color: #4ECDC4;
            margin-top: 12px;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .section-header.rtl {
            direction: rtl;
            text-align: right;
          }
          .chord-lyric-pair {
            margin-bottom: 4px;
            position: relative;
          }
          .empty-line {
            height: 1em;
          }
          .page-footer {
            text-align: center;
            margin-top: 20px;
            padding: 10px 0;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .page-footer img {
            max-width: 120px;
            height: auto;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div class="title-page">
          <div class="service-title">${service.venue || service.title?.split(' ').slice(1).join(' ') || service.title || 'Setlist'}</div>
          ${service.date ? `<div class="service-date">${new Date(service.date).toLocaleDateString()}</div>` : ''}

          <div class="toc">
            <div class="toc-title">Songs:</div>
            ${songs.map((song, index) => {
              const metaInfo = [];
              if (song.key) metaInfo.push(`Key: ${song.key}`);
              if (song.bpm) metaInfo.push(`BPM: ${song.bpm}`);
              const metaString = metaInfo.length > 0 ? metaInfo.join(' | ') : '';

              return `
              <div class="toc-item">
                <span class="toc-song-info">${index + 1}. ${song.title}${song.authors ? ` - ${song.authors}` : ''}</span>
                ${metaString ? `<span class="toc-meta">${metaString}</span>` : ''}
              </div>`;
            }).join('')}
          </div>
          ${logoBase64 ? `<div class="page-footer"><img src="${logoBase64}" alt="SoluFlow Logo" /></div>` : ''}
        </div>
  `;

  // Add each song
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const isHebrew = hasHebrew(song.title || '') || hasHebrew(song.content || '');

    htmlContent += `
      <div class="song${i > 0 ? ' page-break' : ''}">
        <div class="song-header">
          <div class="song-title">${i + 1}. ${song.title}</div>
          ${song.authors ? `<div class="song-meta">By: ${song.authors}</div>` : ''}
          <div class="song-meta">
            ${song.key ? `Key: ${song.key}` : ''}
            ${song.bpm ? ` | BPM: ${song.bpm}` : ''}
            ${song.timeSig ? ` | Time: ${song.timeSig}` : ''}
          </div>
        </div>
        <div class="song-content">
    `;

    if (song.content) {
      const transposedContent = song.serviceSongTransposition
        ? transpose(song.content, song.serviceSongTransposition)
        : song.content;

      const lines = transposedContent.split('\n');
      let inSection = false;

      for (const line of lines) {
        // Skip ChordPro directives except sections
        if (line.match(/^{(?!soc|eoc)[^}]*}/i)) {
          continue;
        }

        // Section start
        if (line.match(/^{soc[:\s]*(.*)}/i)) {
          const sectionName = line.match(/^{soc[:\s]*(.*)}/i)[1] || 'Chorus';
          htmlContent += `<div class="section-header ${isHebrew ? 'rtl' : ''}">${sectionName}</div>`;
          inSection = true;
          continue;
        }

        // Section end
        if (line.match(/^{eoc}/i)) {
          inSection = false;
          continue;
        }

        // Empty line
        if (line.trim() === '') {
          htmlContent += '<div class="empty-line"></div>';
          continue;
        }

        // Lines with chords
        if (line.includes('[')) {
          const { chords, lyrics } = parseChordProLine(line);
          const isLyricRTL = hasHebrew(lyrics);

          htmlContent += '<div class="chord-lyric-pair">';

          // Chord line with absolute positioning
          if (chords.length > 0) {
            htmlContent += '<div class="chord-line">';

            chords.forEach(({ chord, position }) => {
              // Calculate the pixel position of the text before the chord
              const textBeforeChord = lyrics.substring(0, position);
              const textWidth = measureTextWidth(textBeforeChord, fontSize, "'Heebo', Arial, sans-serif");

              // For RTL, position from the right; for LTR, position from the left
              if (isLyricRTL) {
                htmlContent += `<span class="chord" style="right: ${textWidth}px;">${chord}</span>`;
              } else {
                htmlContent += `<span class="chord" style="left: ${textWidth}px;">${chord}</span>`;
              }
            });

            htmlContent += '</div>';
          }

          // Lyric line
          htmlContent += `<div class="lyric-line ${isLyricRTL ? 'rtl' : ''}">${lyrics || '&nbsp;'}</div>`;
          htmlContent += '</div>';
        } else {
          // Plain lyrics
          const isLyricRTL = hasHebrew(line);
          htmlContent += `<div class="lyric-line ${isLyricRTL ? 'rtl' : ''}">${line}</div>`;
        }
      }
    }

    htmlContent += `
        </div>
        ${logoBase64 ? `<div class="page-footer"><img src="${logoBase64}" alt="SoluFlow Logo" /></div>` : ''}
      </div>
    `;
  }

  htmlContent += `
      </body>
    </html>
  `;

  // Create a temporary element
  const element = document.createElement('div');
  element.innerHTML = htmlContent;

  // Configure PDF options
  const serviceName = service.venue || service.title?.split(' ').slice(1).join(' ') || service.title || 'Setlist';
  const opt = {
    margin: 15,
    filename: `${serviceName.replace(/[^a-z0-9]/gi, '_')}${service.date ? '_' + new Date(service.date).toISOString().split('T')[0] : ''}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // Generate PDF
  return html2pdf().set(opt).from(element).save();
};

/**
 * Generate a single-song PDF using A4PDFView component
 * @param {Object} song - The song object
 * @param {number} transposition - Current transposition value
 * @param {number} fontSize - Font size for the content
 */
export const generateSongPDF = async (song, transposition = 0, fontSize = 14) => {
  // Create a temporary container for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    // Render the A4PDFView component
    const root = createRoot(container);

    // Create a promise that resolves when the component is rendered
    await new Promise((resolve) => {
      root.render(
        <A4PDFView
          song={song}
          transposition={transposition}
          fontSize={fontSize}
        />
      );
      // Give React time to render
      setTimeout(resolve, 500);
    });

    // Configure PDF options for A4 size
    // A4 in pixels at 72 DPI: 595x842
    // A4 in mm: 210x297
    const opt = {
      margin: 0, // No margin since we control layout precisely
      filename: `${song.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        width: 595,
        height: 842,
        windowWidth: 595,
        windowHeight: 842
      },
      jsPDF: {
        unit: 'px',
        format: [595, 842],
        orientation: 'portrait',
        hotfixes: ['px_scaling']
      }
    };

    // Generate PDF
    await html2pdf().set(opt).from(container.querySelector('.a4-page')).save();

    // Cleanup
    root.unmount();
    document.body.removeChild(container);

  } catch (error) {
    console.error('Error generating PDF:', error);
    // Cleanup on error
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    throw error;
  }
};
