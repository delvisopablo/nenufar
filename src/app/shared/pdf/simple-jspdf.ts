type JsPdfOptions = {
  unit?: 'mm';
  format?: [number, number];
};

type TextOptions = {
  align?: 'left' | 'center' | 'right';
};

function mmToPt(value: number): number {
  return value * 72 / 25.4;
}

function escapePdfText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()\\]/g, '\\$&')
    .replace(/[^\x20-\x7E]/g, '');
}

export default class jsPDF {
  private readonly widthMm: number;
  private readonly heightMm: number;
  private readonly content: string[] = [];
  private fontSize = 12;

  constructor(options: JsPdfOptions = {}) {
    const format = options.format ?? [80, 200];
    this.widthMm = format[0];
    this.heightMm = format[1];
  }

  setFont(_fontName: string, _fontStyle: string): void {
    // Fallback local: usamos una sola fuente PDF base.
  }

  setFontSize(size: number): void {
    this.fontSize = size;
  }

  text(value: string, x: number, y: number, options: TextOptions = {}): void {
    const safeText = escapePdfText(String(value ?? ''));
    const fontSizePt = mmToPt(this.fontSize * 0.352778);
    const estimatedWidthPt = safeText.length * fontSizePt * 0.5;
    let xPt = mmToPt(x);

    if (options.align === 'center') {
      xPt -= estimatedWidthPt / 2;
    } else if (options.align === 'right') {
      xPt -= estimatedWidthPt;
    }

    const yPt = mmToPt(this.heightMm - y);
    this.content.push(
      `BT /F1 ${fontSizePt.toFixed(2)} Tf 1 0 0 1 ${xPt.toFixed(2)} ${yPt.toFixed(2)} Tm (${safeText}) Tj ET`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number): void {
    const fromX = mmToPt(x1).toFixed(2);
    const fromY = mmToPt(this.heightMm - y1).toFixed(2);
    const toX = mmToPt(x2).toFixed(2);
    const toY = mmToPt(this.heightMm - y2).toFixed(2);

    this.content.push(`0.4 w ${fromX} ${fromY} m ${toX} ${toY} l S`);
  }

  save(filename: string): void {
    const pdf = this.buildPdf();
    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private buildPdf(): string {
    const widthPt = mmToPt(this.widthMm).toFixed(2);
    const heightPt = mmToPt(this.heightMm).toFixed(2);
    const stream = this.content.join('\n');

    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj`,
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj',
      `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    for (const object of objects) {
      offsets.push(pdf.length);
      pdf += `${object}\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';

    for (let index = 1; index < offsets.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  }
}
