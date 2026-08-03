import { COUNTRIES } from './constants/countries';
import { parseWhatsAppNumber, normalizeWhatsAppNumber } from './lib/phone';

// 1. Find all intersecting dial codes
console.log('--- Finding Intersecting Country Dial Codes ---');
const intersections: { parent: string; child: string }[] = [];

for (const a of COUNTRIES) {
  for (const b of COUNTRIES) {
    if (a.code !== b.code && b.dialCode.startsWith(a.dialCode)) {
      intersections.push({ parent: `${a.flag} ${a.name} (${a.dialCode})`, child: `${b.flag} ${b.name} (${b.dialCode})` });
    }
  }
}

console.log(`Found ${intersections.length} intersecting country code pairs:`);
console.table(intersections.slice(0, 15)); // Show top 15

// 2. Define unit tests for intersecting dial codes
console.log('\n--- Running Unit Tests for Phone Number Parser ---');

const testCases = [
  // Overlap test: US (+1) vs Antigua and Barbuda (+1268)
  { input: '+12684641234', expectedCountry: '+1268', expectedBody: '4641234' },
  { input: '+15551234567', expectedCountry: '+1', expectedBody: '5551234567' },

  // Overlap test: Singapore (+65) vs others (none, but testing +65 digits)
  { input: '+6582134444', expectedCountry: '+65', expectedBody: '82134444' },

  // Overlap test: Australia (+61) vs Cocos Islands (+61) / Christmas Island (+61)
  // Note: Since they share exactly the same dialCode '+61', they should both extract '+61'
  { input: '+61412345678', expectedCountry: '+61', expectedBody: '412345678' },

  // Overlap test: UK (+44) vs Guernsey (+44) / Jersey (+44) / Isle of Man (+44)
  { input: '+447624123456', expectedCountry: '+44', expectedBody: '7624123456' },

  // Test local formatting inputs
  { input: '08123456789', expectedCountry: '+62', expectedBody: '8123456789' },
  { input: '8123456789', expectedCountry: '+62', expectedBody: '8123456789' },
  { input: '628123456789', expectedCountry: '+62', expectedBody: '8123456789' }
];

let passed = 0;
for (const tc of testCases) {
  const result = parseWhatsAppNumber(tc.input);
  const match = result.countryCode === tc.expectedCountry && result.body === tc.expectedBody;
  if (match) {
    console.log(`✅ PASSED: "${tc.input}" ➔ Country: ${result.countryCode}, Body: ${result.body}`);
    passed++;
  } else {
    console.error(`❌ FAILED: "${tc.input}"\n   Expected: Country: ${tc.expectedCountry}, Body: ${tc.expectedBody}\n   Got:      Country: ${result.countryCode}, Body: ${result.body}`);
  }
}

console.log(`\nTest results: ${passed}/${testCases.length} passed.`);
if (passed !== testCases.length) {
  process.exit(1);
}
