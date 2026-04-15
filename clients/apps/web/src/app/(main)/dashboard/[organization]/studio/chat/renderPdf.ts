import PDFDocument from 'pdfkit'

/**
 * Render a workbook markdown document to a PDF.
 *
 * This is intentionally minimal. Studio workbooks follow a tight structure
 * — H1 title, blockquote promise, ##/### section headings, paragraphs, and
 * bullet lists — so we parse line-by-line and emit styled blocks onto a
 * pdfkit document. Bold (`**…**`) and italic (`*…*`) runs inside paragraphs
 * are honoured; anything more exotic falls back to plain text. That's fine:
 * the .md file is also shipped alongside for anyone who wants a richer
 * rendering.
 */
export async function renderWorkbookPdf(markdown: string): Promise<Uint8Array> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    info: { Title: extractTitle(markdown) ?? 'Workbook' },
  })

  const chunks: Buffer[] = []
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () =>
      resolve(new Uint8Array(Buffer.concat(chunks as unknown as Uint8Array[]))),
    )
    doc.on('error', reject)
  })

  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let inList = false

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.trim() === '') {
      if (inList) inList = false
      doc.moveDown(0.5)
      continue
    }

    const h1 = /^#\s+(.+)$/.exec(line)
    if (h1) {
      inList = false
      doc.moveDown(0.6)
      doc
        .font('Helvetica-Bold')
        .fontSize(26)
        .fillColor('#111')
        .text(h1[1], { paragraphGap: 8 })
      continue
    }

    const h2 = /^##\s+(.+)$/.exec(line)
    if (h2) {
      inList = false
      doc.moveDown(0.8)
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor('#111')
        .text(h2[1], { paragraphGap: 6 })
      continue
    }

    const h3 = /^###\s+(.+)$/.exec(line)
    if (h3) {
      inList = false
      doc.moveDown(0.4)
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#222')
        .text(h3[1], { paragraphGap: 4 })
      continue
    }

    const blockquote = /^>\s+(.+)$/.exec(line)
    if (blockquote) {
      inList = false
      doc
        .font('Helvetica-Oblique')
        .fontSize(12)
        .fillColor('#555')
        .text(blockquote[1], {
          indent: 12,
          paragraphGap: 6,
        })
      continue
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line)
    if (bullet) {
      inList = true
      renderParagraph(doc, `• ${bullet[1]}`, {
        indent: 16,
        paragraphGap: 2,
      })
      continue
    }

    renderParagraph(doc, line, { paragraphGap: 6 })
  }

  doc.end()
  return done
}

/**
 * Render a line with inline **bold** and *italic* runs. Switches fonts
 * between segments so weight/style actually changes in the output.
 */
function renderParagraph(
  doc: PDFKit.PDFDocument,
  line: string,
  options: { indent?: number; paragraphGap?: number } = {},
): void {
  const segments = splitInline(line)
  doc.font('Helvetica').fontSize(11).fillColor('#222')

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1
    const font =
      segment.kind === 'bold'
        ? 'Helvetica-Bold'
        : segment.kind === 'italic'
          ? 'Helvetica-Oblique'
          : 'Helvetica'
    doc.font(font).text(segment.text, {
      continued: !isLast,
      indent: index === 0 ? options.indent : 0,
      paragraphGap: isLast ? options.paragraphGap : 0,
    })
  })
}

type Segment = { kind: 'plain' | 'bold' | 'italic'; text: string }

function splitInline(line: string): Segment[] {
  const segments: Segment[] = []
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'plain', text: line.slice(lastIndex, match.index) })
    }
    if (match[2] !== undefined) {
      segments.push({ kind: 'bold', text: match[2] })
    } else if (match[3] !== undefined) {
      segments.push({ kind: 'italic', text: match[3] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < line.length) {
    segments.push({ kind: 'plain', text: line.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ kind: 'plain', text: line }]
}

function extractTitle(markdown: string): string | null {
  const match = /^#\s+(.+)$/m.exec(markdown)
  return match?.[1]?.trim() ?? null
}
