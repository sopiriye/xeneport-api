import * as fs from 'fs';
import * as crypto from 'crypto';

const secret = crypto.randomBytes(64).toString('hex');

fs.appendFileSync('.env', `\nJWT_SECRET="${secret}"\n`);

console.log('JWT_SECRET generated and saved!');
