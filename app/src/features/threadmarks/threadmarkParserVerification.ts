import {
  filterValidThreadmarks,
  getThreadmarkParseErrors,
  hasIncompleteThreadmarks,
  hasValidThreadmarks,
  parseThreadmarks,
} from './index';

export type ThreadmarkParserVerificationCase = Readonly<{
  name: string;
  input: string;
  expectedMinimumResults: number;
  options?: Parameters<typeof parseThreadmarks>[1];
}>;

export type ThreadmarkParserVerificationResult = Readonly<{
  name: string;
  passed: boolean;
  resultCount: number;
  validCount: number;
  errorCount: number;
  hasIncomplete: boolean;
}>;

export const threadmarkParserVerificationCases: readonly ThreadmarkParserVerificationCase[] = Object.freeze([
  {
    name: 'valid mother relationship',
    input: '@mother @Lilith Sorrengail',
    expectedMinimumResults: 1,
  },
  {
    name: 'valid canonical romantic partner relationship',
    input: '@romanticPartner @Xaden Riorson',
    expectedMinimumResults: 1,
  },
  {
    name: 'valid bonded relationship',
    input: '@bonded @Tairn',
    expectedMinimumResults: 1,
  },
  {
    name: 'alias resolves to canonical key',
    input: '@mom @Lilith Sorrengail',
    expectedMinimumResults: 1,
  },
  {
    name: 'punctuation is excluded from target',
    input: '@enemy @Jack Barlowe.',
    expectedMinimumResults: 1,
  },
  {
    name: 'multiple lines return multiple results',
    input: '@mother @Lilith Sorrengail\n@father @Asher Sorrengail',
    expectedMinimumResults: 2,
  },
  {
    name: 'multiple relationships in one sentence',
    input: 'Violet is connected through @mother @Lilith Sorrengail and @father @Asher Sorrengail.',
    expectedMinimumResults: 2,
  },
  {
    name: 'unknown first result does not block later result',
    input: '@archnemesis @Jack Barlowe\n@mother @Lilith Sorrengail',
    expectedMinimumResults: 2,
  },
  {
    name: 'incomplete marker',
    input: '@',
    expectedMinimumResults: 1,
  },
  {
    name: 'incomplete relationship target',
    input: '@mother @',
    expectedMinimumResults: 1,
  },
  {
    name: 'escaped marker is ignored',
    input: '\\@mother @Lilith Sorrengail',
    expectedMinimumResults: 0,
  },
  {
    name: 'email address is ignored',
    input: 'jon@example.com',
    expectedMinimumResults: 0,
  },
  {
    name: 'url marker is ignored',
    input: 'https://example.com/@mother',
    expectedMinimumResults: 0,
  },
  {
    name: 'excluded range is ignored',
    input: '@mother @Lilith Sorrengail',
    expectedMinimumResults: 0,
    options: { excludedRanges: [{ start: 0, end: 26 }] },
  },
  {
    name: 'maximum result count is respected',
    input: '@mother @Lilith Sorrengail\n@father @Asher Sorrengail',
    expectedMinimumResults: 1,
    options: { maximumResults: 1 },
  },
] as const);

export function verifyThreadmarkParserFoundation() {
  return Object.freeze(
    threadmarkParserVerificationCases.map((verificationCase) => {
      const results = parseThreadmarks(verificationCase.input, verificationCase.options);
      const validResults = filterValidThreadmarks(results);
      const errorResults = getThreadmarkParseErrors(results);
      const passed =
        results.length >= verificationCase.expectedMinimumResults &&
        (verificationCase.expectedMinimumResults === 0 || hasValidThreadmarks(results) || hasIncompleteThreadmarks(results));

      return Object.freeze({
        name: verificationCase.name,
        passed,
        resultCount: results.length,
        validCount: validResults.length,
        errorCount: errorResults.length,
        hasIncomplete: hasIncompleteThreadmarks(results),
      });
    }),
  );
}
