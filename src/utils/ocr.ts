/*
| Making sense of the text read off equipment photos.
|
| The phone runs ML Kit on each photo and the API stores what it returns
| untouched: every recognised line joined with "\n", stray fragments and all
| ("MacBoOk Air\nF4\n$\n%"). The broker shows that text verbatim as "Scanned
| text", so it is never rewritten. These helpers only read it, to show the
| driver something useful: a tidy one-line summary, the VIN if there is one,
| and whether the load's truck or trailer number appears.
*/

/** Same rule as the broker's App\Support\Vin::VALID. I, O and Q never appear in a VIN. */
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/** ISO 3779 letter values for the check digit. */
const VIN_LETTER_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * The scanned text as one readable line: whitespace collapsed, fragments with
 * fewer than two letters or digits dropped ("$", "%", "F"), repeats removed,
 * lines joined with " · ". Returns "" when nothing worth showing was read.
 */
export function cleanOcrText(raw?: string | null): string {
  if (!raw) return "";

  const seen = new Set<string>();
  const lines: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const tidy = line.replace(/\s+/g, " ").trim();
    if ((tidy.match(/[A-Za-z0-9]/g) ?? []).length < 2) continue;

    const key = tidy.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(tidy);
  }

  return lines.join(" · ");
}

/** Whether position 9 of a well-formed VIN is the ISO 3779 check digit for the rest. */
export function vinCheckDigitValid(vin: string): boolean {
  if (!VIN_PATTERN.test(vin)) return false;

  let sum = 0;
  for (let i = 0; i < vin.length; i++) {
    const char = vin[i];
    const value = char >= "0" && char <= "9" ? Number(char) : VIN_LETTER_VALUES[char];
    sum += value * VIN_WEIGHTS[i];
  }

  const remainder = sum % 11;
  return vin[8] === (remainder === 10 ? "X" : String(remainder));
}

export interface VinReading {
  vin: string;
  /**
   * The check digit adds up. North American VINs always carry one; VINs from
   * elsewhere (India, for one) need not, so an unconfirmed reading is still a
   * reading, just a less certain one.
   */
  confirmed: boolean;
}

/*
| A 17-character run of uppercase letters and digits as a VIN, or null.
|
| ML Kit reads 0 as O and 1 as I often enough to matter, and a VIN can never
| contain O, Q or I, so inside a candidate those are taken as the digits they
| stand for. Only inside a candidate: folded across the whole text, ordinary
| words would start to look like VINs.
*/
function asVin(candidate: string): string | null {
  if (candidate.length !== 17) return null;
  const vin = candidate.replace(/[OQ]/g, "0").replace(/I/g, "1");
  if (vin.startsWith("0")) return null; // zero-padded placeholders, as in the broker's rule
  return VIN_PATTERN.test(vin) ? vin : null;
}

/** "VIN1FUJGLDR9CLBP8834" -> "1FUJGLDR9CLBP8834" when the label was read glued to the number. */
function withoutVinLabel(token: string): string {
  return token.length > 17 ? token.replace(/^VIN(?:N[O0]|NUMBER)?/, "") : token;
}

/**
 * The VIN in a photo's scanned text, or null.
 *
 * Candidates are whole words, or two or three neighbouring words on the same
 * line that together make exactly 17 characters (plates sometimes space the
 * VIN out, and OCR splits on smudges). Nothing else: sliding a 17-character
 * window along run-together text "finds" a VIN in almost any photo.
 *
 * Preference: a whole word whose check digit adds up, then joined words whose
 * check digit adds up, then a whole word without one. Joined words are only
 * accepted with a valid check digit, because neighbouring words of the right
 * total length are common on a busy plate ("FREIGHTLINER" + "12345").
 */
export function extractVin(raw?: string | null): VinReading | null {
  if (!raw) return null;

  let joinedConfirmed: string | null = null;
  let unconfirmed: string | null = null;

  for (const line of raw.split(/\r?\n/)) {
    const tokens = line
      .toUpperCase()
      .replace(/\bVIN\b(?:\s*(?:NO|NUMBER)\b)?/g, " ")
      .split(/[^A-Z0-9]+/)
      .filter(Boolean)
      .map(withoutVinLabel);

    for (let i = 0; i < tokens.length; i++) {
      const whole = asVin(tokens[i]);
      if (whole) {
        if (vinCheckDigitValid(whole)) return { vin: whole, confirmed: true };
        if (!unconfirmed) unconfirmed = whole;
      }

      let joined = tokens[i];
      for (let span = 2; span <= 3 && i + span <= tokens.length; span++) {
        joined += tokens[i + span - 1];
        if (joined.length < 17) continue;

        const candidate = asVin(joined);
        if (!joinedConfirmed && candidate && vinCheckDigitValid(candidate)) {
          joinedConfirmed = candidate;
        }
        break;
      }
    }
  }

  if (joinedConfirmed) return { vin: joinedConfirmed, confirmed: true };
  return unconfirmed ? { vin: unconfirmed, confirmed: false } : null;
}

/** Letters and digits only, with ML Kit's usual mix-ups folded the same way on both sides (O/Q -> 0, I -> 1). */
function foldForMatch(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/[OQ]/g, "0")
    .replace(/I/g, "1");
}

/**
 * Whether a unit number (the load's truck or trailer number) appears in a
 * photo's scanned text, ignoring spaces, dashes and case ("T-102" matches
 * "T 1O2"). Matched within a line, never across two. Numbers shorter than
 * three characters are never matched: "12" turns up in almost any text.
 */
export function unitMatch(
  raw: string | null | undefined,
  unitNumber: string | null | undefined,
): boolean {
  const unit = foldForMatch(unitNumber ?? "");
  if (!raw || unit.length < 3) return false;

  return raw.split(/\r?\n/).some((line) => foldForMatch(line).includes(unit));
}
