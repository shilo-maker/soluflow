import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { transpose, transposeChord } from './transpose';
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
 * Generate a multi-song PDF using A4PDFView component for each song
 * @param {Object} service - The service object
 * @param {Array} songs - Array of songs in the setlist
 * @param {Object} options - Optional settings like fontSize
 */
export const generateMultiSongPDF = async (service, songs, options = {}) => {
  const { fontSize = 14 } = options;

  console.log('Generating multi-song PDF for:', songs.length, 'songs');

  // Format filename: [Date] - [Time] - [Venue]
  let filename = 'SoluFlow';

  if (service.date) {
    const date = new Date(service.date);
    const formattedDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
    filename = formattedDate;

    // Add time if available
    const formattedTime = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    if (formattedTime !== '00:00') {
      filename += ` - ${formattedTime}`;
    }
  }

  // Add venue
  if (service.venue) {
    filename += ` - ${service.venue}`;
  } else if (service.title) {
    filename += ` - ${service.title}`;
  }

  filename += '.pdf';
  console.log('PDF filename:', filename);
  console.log('Service venue:', service.venue);
  console.log('Service title:', service.title);

  // Create the title page first
  console.log('Creating title page...');

  // Load Heebo font if not already loaded
  if (!document.querySelector('link[href*="Heebo"]')) {
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
    // Wait a bit for font to load
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const titlePageContainer = document.createElement('div');
  titlePageContainer.style.position = 'fixed';
  titlePageContainer.style.left = '-10000px';
  titlePageContainer.style.top = '0';
  titlePageContainer.style.width = '595px';
  titlePageContainer.style.height = '842px';
  titlePageContainer.style.backgroundColor = '#ffffff';
  titlePageContainer.style.padding = '60px 40px';
  titlePageContainer.style.boxSizing = 'border-box';
  titlePageContainer.style.fontFamily = "'Heebo', Arial, sans-serif";
  document.body.appendChild(titlePageContainer);

  // Format date and time for display
  let displayDate = '';
  let displayTime = '';
  if (service.date) {
    const date = new Date(service.date);
    displayDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const time = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    if (time !== '00:00') {
      displayTime = time;
    }
  }

  // Build title page HTML
  titlePageContainer.innerHTML = `
    <div style="text-align: center;">
      <h1 style="font-size: 36px; font-weight: 700; margin: 0 0 20px 0; color: #333;">
        ${service.venue || service.title || 'Service'}
      </h1>
      ${displayTime ? `
        <div style="font-size: 18px; color: #666; margin-bottom: 40px; direction: rtl;">
          האסיפה מתחילה ב ${displayTime}
        </div>
      ` : '<div style="margin-bottom: 40px;"></div>'}
      <hr style="border: none; border-top: 2px solid #4ECDC4; margin: 0 0 30px 0;">
      <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 30px 0; color: #4ECDC4;">
        רשימת שירים
      </h2>
    </div>
    <div style="text-align: right; direction: rtl; font-size: 16px; line-height: 2;">
      ${songs.map((song, index) => {
        const metaInfo = [];
        if (song.authors) metaInfo.push(song.authors);
        if (song.key) {
          const transposedKey = song.transposition || song.serviceSongTransposition || 0;
          const finalKey = transposedKey !== 0 ? transposeChord(song.key, transposedKey) : song.key;
          metaInfo.push(finalKey);
        }
        if (song.bpm) metaInfo.push(`${song.bpm} BPM`);

        return `
          <div style="margin-bottom: 12px; padding-right: 10px;">
            ${index + 1}. <strong>${song.title}</strong>${metaInfo.length > 0 ? ` - ${metaInfo.join(' | ')}` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Convert title page to canvas
  const titleCanvas = await html2canvas(titlePageContainer, {
    scale: 2,
    useCORS: true,
    letterRendering: true,
    logging: false,
    allowTaint: true,
    backgroundColor: '#ffffff'
  });

  const titleImgData = titleCanvas.toDataURL('image/jpeg', 0.95);

  // Create PDF with title page
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = 210;
  const pdfHeight = 297;
  const titleImgWidth = pdfWidth;
  const titleImgHeight = (titleCanvas.height * pdfWidth) / titleCanvas.width;

  pdf.addImage(titleImgData, 'JPEG', 0, 0, titleImgWidth, Math.min(titleImgHeight, pdfHeight), undefined, 'FAST');

  // Store PDF instance for adding songs
  window.multiSongPdf = pdf;
  window.multiSongPdfFilename = filename;

  // Cleanup title page container
  document.body.removeChild(titlePageContainer);
  console.log('Title page created');

  // Track errors during PDF generation
  const errors = [];
  let successCount = 0;

  // Generate PDF for each song individually
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const songTransposition = song.transposition || song.serviceSongTransposition || 0;
    console.log(`Processing song ${i + 1}/${songs.length}:`, song.title, 'with transposition:', songTransposition);

    // Create a temporary container for rendering (off-screen but visible for rendering)
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '595px';
    container.style.height = '842px';
    container.style.zIndex = '-9999';
    document.body.appendChild(container);

    try {
      // Render the A4PDFView component
      const root = createRoot(container);

      // Create a promise that resolves when the component is rendered
      await new Promise((resolve) => {
        root.render(
          <A4PDFView
            song={song}
            transposition={song.transposition || song.serviceSongTransposition || 0}
            fontSize={fontSize}
          />
        );
        // Give React more time to render
        setTimeout(resolve, 1000);
      });

      const a4Page = container.querySelector('.a4-page');
      if (!a4Page) {
        console.error('A4 page not found for song:', song.title);
        console.log('Container HTML:', container.innerHTML.substring(0, 200));
        root.unmount();
        document.body.removeChild(container);
        continue;
      }

      console.log('A4 page found, dimensions:', a4Page.offsetWidth, 'x', a4Page.offsetHeight);

      // Configure PDF options for A4 size
      const serviceName = service.venue || service.title?.split(' ').slice(1).join(' ') || service.title || 'Setlist';
      const opt = {
        margin: 0,
        filename: `SoluFlow - ${serviceName}.pdf`,
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

      // Convert to canvas
      const canvas = await html2canvas(a4Page, {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      console.log('Canvas created, dimensions:', canvas.width, 'x', canvas.height);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      console.log('Image data length:', imgData.length);

      // Calculate dimensions for PDF (A4 in mm: 210 x 297)
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      console.log('PDF dimensions:', pdfWidth, 'x', pdfHeight, 'mm');
      console.log('Image will be scaled to:', imgWidth, 'x', imgHeight, 'mm');

      // Add song to existing PDF (title page is already the first page)
      const pdf = window.multiSongPdf;
      if (pdf) {
        pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight), undefined, 'FAST');

        // If this is the last song, save the PDF
        if (i === songs.length - 1) {
          pdf.save(window.multiSongPdfFilename || filename);
          delete window.multiSongPdf;
          delete window.multiSongPdfFilename;
        }
      }

      // Cleanup
      root.unmount();
      document.body.removeChild(container);
      successCount++;

    } catch (error) {
      console.error('Error generating PDF for song:', song.title, error);

      // Track the error
      errors.push({
        songTitle: song.title,
        songIndex: i + 1,
        error: error.message || 'Unknown error'
      });

      // Cleanup on error
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      // Continue with next song
    }
  }

  // Cleanup global PDF reference to prevent memory leaks
  const cleanupPdfInstance = () => {
    if (window.multiSongPdf) {
      delete window.multiSongPdf;
    }
    if (window.multiSongPdfFilename) {
      delete window.multiSongPdfFilename;
    }
  };

  // After processing all songs, check if there were any errors
  if (errors.length > 0) {
    const errorSummary = `PDF generation completed with errors:\n` +
      `- Successfully generated: ${successCount}/${songs.length} songs\n` +
      `- Failed songs:\n${errors.map(e => `  • ${e.songTitle} (${e.error})`).join('\n')}`;

    console.error(errorSummary);

    // Cleanup on error
    cleanupPdfInstance();

    // If all songs failed, throw an error
    if (successCount === 0) {
      throw new Error(`Failed to generate PDF for all songs. ${errors[0].error}`);
    } else {
      // If some songs succeeded, throw a warning error
      throw new Error(`PDF generated but ${errors.length} song(s) failed:\n${errors.map(e => e.songTitle).join(', ')}`);
    }
  }

  console.log(`✅ PDF generation completed successfully for ${successCount} songs`);

  // Final cleanup (should already be cleaned in the loop, but ensure it's done)
  cleanupPdfInstance();

  // Return the filename for potential sharing
  return filename;
};

/**
 * Generate a multi-song PDF and return as Blob for sharing
 * @param {Object} service - The service object
 * @param {Array} songs - Array of songs in the setlist
 * @param {Object} options - Optional settings like fontSize
 * @returns {Promise<{blob: Blob, filename: string}>} The PDF blob and filename
 */
export const generateMultiSongPDFBlob = async (service, songs, options = {}) => {
  const { fontSize = 14 } = options;

  console.log('Generating multi-song PDF blob for:', songs.length, 'songs');

  // Format filename: [Date] - [Time] - [Venue]
  let filename = 'SoluFlow';

  if (service.date) {
    const date = new Date(service.date);
    const formattedDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
    filename = formattedDate;

    const formattedTime = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    if (formattedTime !== '00:00') {
      filename += ` - ${formattedTime}`;
    }
  }

  if (service.venue) {
    filename += ` - ${service.venue}`;
  } else if (service.title) {
    filename += ` - ${service.title}`;
  }

  filename += '.pdf';

  // Load Heebo font if not already loaded
  if (!document.querySelector('link[href*="Heebo"]')) {
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Create title page
  const titlePageContainer = document.createElement('div');
  titlePageContainer.style.position = 'fixed';
  titlePageContainer.style.left = '-10000px';
  titlePageContainer.style.top = '0';
  titlePageContainer.style.width = '595px';
  titlePageContainer.style.height = '842px';
  titlePageContainer.style.backgroundColor = '#ffffff';
  titlePageContainer.style.padding = '60px 40px';
  titlePageContainer.style.boxSizing = 'border-box';
  titlePageContainer.style.fontFamily = "'Heebo', Arial, sans-serif";
  document.body.appendChild(titlePageContainer);

  let displayTime = '';
  if (service.date) {
    const date = new Date(service.date);
    const time = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    if (time !== '00:00') {
      displayTime = time;
    }
  }

  titlePageContainer.innerHTML = `
    <div style="text-align: center;">
      <h1 style="font-size: 36px; font-weight: 700; margin: 0 0 20px 0; color: #333;">
        ${service.venue || service.title || 'Service'}
      </h1>
      ${displayTime ? `
        <div style="font-size: 18px; color: #666; margin-bottom: 40px; direction: rtl;">
          האסיפה מתחילה ב ${displayTime}
        </div>
      ` : '<div style="margin-bottom: 40px;"></div>'}
      <hr style="border: none; border-top: 2px solid #4ECDC4; margin: 0 0 30px 0;">
      <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 30px 0; color: #4ECDC4;">
        רשימת שירים
      </h2>
    </div>
    <div style="text-align: right; direction: rtl; font-size: 16px; line-height: 2;">
      ${songs.map((song, index) => {
        const metaInfo = [];
        if (song.authors) metaInfo.push(song.authors);
        if (song.key) {
          const transposedKey = song.transposition || song.serviceSongTransposition || 0;
          const finalKey = transposedKey !== 0 ? transposeChord(song.key, transposedKey) : song.key;
          metaInfo.push(finalKey);
        }
        if (song.bpm) metaInfo.push(`${song.bpm} BPM`);

        return `
          <div style="margin-bottom: 12px; padding-right: 10px;">
            ${index + 1}. <strong>${song.title}</strong>${metaInfo.length > 0 ? ` - ${metaInfo.join(' | ')}` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  const titleCanvas = await html2canvas(titlePageContainer, {
    scale: 2,
    useCORS: true,
    letterRendering: true,
    logging: false,
    allowTaint: true,
    backgroundColor: '#ffffff'
  });

  const titleImgData = titleCanvas.toDataURL('image/jpeg', 0.95);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = 210;
  const pdfHeight = 297;
  const titleImgWidth = pdfWidth;
  const titleImgHeight = (titleCanvas.height * pdfWidth) / titleCanvas.width;

  pdf.addImage(titleImgData, 'JPEG', 0, 0, titleImgWidth, Math.min(titleImgHeight, pdfHeight), undefined, 'FAST');

  document.body.removeChild(titlePageContainer);

  // Generate PDF for each song
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const songTransposition = song.transposition || song.serviceSongTransposition || 0;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '595px';
    container.style.height = '842px';
    container.style.zIndex = '-9999';
    document.body.appendChild(container);

    try {
      const root = createRoot(container);

      await new Promise((resolve) => {
        root.render(
          <A4PDFView
            song={song}
            transposition={songTransposition}
            fontSize={fontSize}
          />
        );
        setTimeout(resolve, 1000);
      });

      const a4Page = container.querySelector('.a4-page');
      if (!a4Page) {
        root.unmount();
        document.body.removeChild(container);
        continue;
      }

      const canvas = await html2canvas(a4Page, {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight), undefined, 'FAST');

      root.unmount();
      document.body.removeChild(container);

    } catch (error) {
      console.error('Error generating PDF for song:', song.title, error);
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    }
  }

  // Return as blob
  const blob = pdf.output('blob');
  return { blob, filename };
};

/**
 * Generate a single-song PDF using A4PDFView component
 * @param {Object} song - The song object
 * @param {number} transposition - Current transposition value
 * @param {number} fontSize - Font size for the content
 */
export const generateSongPDF = async (song, transposition = 0, fontSize = 14) => {
  // Create a temporary container for rendering (completely hidden)
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.visibility = 'hidden';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-9999';
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
      filename: `SoluFlow - ${song.title}.pdf`,
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
    console.error('Error generating PDF for song:', song.title, error);

    // Cleanup on error
    if (container.parentNode) {
      document.body.removeChild(container);
    }

    // Throw a more descriptive error
    const errorMessage = error.message || 'Unknown error occurred';
    throw new Error(`Failed to generate PDF for "${song.title}": ${errorMessage}`);
  }
};
