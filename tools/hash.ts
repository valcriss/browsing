#!/usr/bin/env ts-node
import bcrypt from 'bcryptjs';

async function main() {
  const pwd = process.argv[2];
  if (!pwd) {
    // eslint-disable-next-line no-console
    console.error('Usage: npm run hash -- "myPassword"');
    process.exit(1);
  }
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(pwd, salt);
  // eslint-disable-next-line no-console
  console.log(hash);
}

void main();
