/*
 * Creates the one superadmin and prints the Microsoft Authenticator QR plus 10 recovery codes.
 * Run once: pnpm bootstrap:superadmin   (refuses if a superadmin already exists)
 */
import QRCode from 'qrcode';
import { bootstrapSuperadmin } from '@chai/db';

const name = process.argv[2] ?? 'Ye';

const { enrolment, recoveryCodes } = await bootstrapSuperadmin(name);
console.log('\nScan this in Microsoft Authenticator: Add account → Other account.\n');
console.log(await QRCode.toString(enrolment.otpauth, { type: 'terminal', small: true }));
console.log('Can’t scan? Enter this key by hand:', enrolment.secret.match(/.{1,4}/g)?.join(' '));
console.log('\nRecovery codes (each works once). Keep them on paper and in a password manager:\n');
for (const code of recoveryCodes) console.log('  ', code);
console.log(
  '\nThen press Ctrl+Shift+1+9 on the control app and sign in with your email and the 6-digit code.\n',
);
