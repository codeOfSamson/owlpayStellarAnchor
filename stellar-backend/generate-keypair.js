import { Keypair } from '@stellar/stellar-sdk';

// Generate a new keypair for client domain signing
const keypair = Keypair.random();

console.log('=== CLIENT DOMAIN KEYPAIR ===\n');
console.log('Public Key (add to stellar.toml SIGNING_KEY):');
console.log(keypair.publicKey());
console.log('\nSecret Key (add to .env as CLIENT_DOMAIN_SECRET):');
console.log(keypair.secret());
console.log('\n⚠️  IMPORTANT: Keep the secret key secure and never commit it to git!');
console.log('⚠️  Add the public key to your stellar.toml file');
console.log('⚠️  Add the secret key to your backend .env file\n');
