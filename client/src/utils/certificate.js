/**
 * Client-side certificate renderer powered by `jsPDF`.
 *
 * Why client-side?
 *   - The server's only job is to validate completion and stamp the
 *     `certificateIssuedAt` date. Generating PDFs on the API thread
 *     would tie up Node, balloon memory, and force us to host (or
 *     proxy) a binary blob the user almost always wants to download
 *     locally anyway. Rendering in the browser keeps the API stateless
 *     and lets the document carry the user's chosen font / color
 *     theme without round-tripping it.
 *   - The data baked into the PDF is the exact authoritative payload
 *     the server returned (`POST /api/courses/:id/certificate`), so
 *     the client cannot inflate the names or back-date the document
 *     beyond what the API just signed off on.
 *
 * SECURITY notes:
 *   - The PDF embeds only PUBLIC profile fields (student name,
 *     instructor name, course title, completion date). No emails,
 *     roles, or internal ids beyond `certificateId` (= enrollment
 *     `_id`) which we expose deliberately so a future
 *     `GET /certificates/:id/verify` endpoint can confirm authenticity.
 *   - All text is rendered via `doc.text(...)` so jsPDF escapes it for
 *     us — there's no HTML/SVG injection surface here.
 *
 * The function returns a Promise so we can dynamically import
 * `jspdf` (~150KB gzip) only when the user actually clicks "Download
 * certificate" — keeping it out of the dashboard's initial chunk.
 * It still calls `doc.save(...)` itself for the common "click →
 * download" path so consumers get a one-liner at the call site.
 */

const PAGE = Object.freeze({
  width: 297,
  height: 210,
});

const COLORS = Object.freeze({
  ink: [17, 24, 39],
  muted: [107, 114, 128],
  accent: [37, 99, 235],
  border: [37, 99, 235],
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const formatDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
};

const drawBorder = (doc) => {
  const inset = 8;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(1.4);
  doc.rect(inset, inset, PAGE.width - inset * 2, PAGE.height - inset * 2);

  doc.setLineWidth(0.3);
  doc.rect(inset + 3, inset + 3, PAGE.width - (inset + 3) * 2, PAGE.height - (inset + 3) * 2);
};

const drawCenteredText = (doc, text, y, { size, weight = 'normal', color = COLORS.ink } = {}) => {
  doc.setFont('helvetica', weight);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, PAGE.width / 2, y, { align: 'center' });
};

/**
 * Render and download a completion certificate.
 *
 * @param {object} data
 * @param {string} data.studentName     — the learner's full display name
 * @param {string} data.courseTitle     — course title as it appears in the catalog
 * @param {string} data.instructorName  — owning instructor's display name
 * @param {string|Date} [data.completedAt]          — when the learner reached 100%
 * @param {string|Date} [data.certificateIssuedAt]  — when the server stamped issuance
 * @param {string} data.certificateId   — enrollment `_id` (verifiable identifier)
 * @returns {Promise<jsPDF>} resolves to the jsPDF instance after `doc.save(...)` ran
 */
export const generateCertificatePdf = async ({
  studentName,
  courseTitle,
  instructorName,
  completedAt,
  certificateIssuedAt,
  certificateId,
}) => {
  if (!studentName || !courseTitle || !certificateId) {
    throw new Error('generateCertificatePdf: studentName, courseTitle and certificateId are required.');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  drawBorder(doc);

  drawCenteredText(doc, 'CERTIFICATE OF COMPLETION', 50, {
    size: 28,
    weight: 'bold',
    color: COLORS.accent,
  });

  drawCenteredText(doc, 'This is to certify that', 75, {
    size: 14,
    color: COLORS.muted,
  });

  drawCenteredText(doc, studentName, 95, {
    size: 32,
    weight: 'bold',
  });

  drawCenteredText(doc, 'has successfully completed the course', 115, {
    size: 14,
    color: COLORS.muted,
  });

  // Course title may be long; let jsPDF's `splitTextToSize` wrap it
  // to a sane width before we draw, so a 120-char title doesn't run
  // off the side of the page.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.ink);
  const wrappedTitle = doc.splitTextToSize(`"${courseTitle}"`, PAGE.width - 60);
  doc.text(wrappedTitle, PAGE.width / 2, 132, { align: 'center' });

  const completedLine = completedAt
    ? `Completed on ${formatDate(completedAt)}`
    : `Issued on ${formatDate(certificateIssuedAt) || formatDate(new Date())}`;
  drawCenteredText(doc, completedLine, 160, {
    size: 12,
    color: COLORS.muted,
  });

  drawCenteredText(doc, `Issued by ${instructorName || 'the instructor'}`, 172, {
    size: 12,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Certificate ID: ${certificateId}`, PAGE.width / 2, PAGE.height - 14, {
    align: 'center',
  });

  doc.save(`certificate-${certificateId}.pdf`);

  return doc;
};

export default generateCertificatePdf;
