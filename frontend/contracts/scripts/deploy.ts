import { deployConfig } from './config';

async function main() {
  console.log('Deploy contracts to', deployConfig.network);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});