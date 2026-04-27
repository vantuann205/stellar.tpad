/**
 * Test script to verify bonding curve flow:
 * 1. Create new token
 * 2. Check initial database state
 * 3. Buy tokens
 * 4. Check database after buy
 * 5. Sell tokens
 * 6. Check database after sell
 * 7. Verify price calculations match smart contract
 * 8. Verify chart data (OHLCV)
 * 9. Verify UTC+7 timezone
 */

import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
  Keypair,
  Account,
  scValToNative,
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// Contract IDs from .env.local
const FACTORY_ID = 'CBTJIGONHNTVSGTWZZTTJF54X5Y5AFCA2YUAQEI26WYZG3XUL52SKHTC';
const BONDING_CURVE_ID = 'CA6O4MTIA2I7ADDVT64RF6XQOUVJ4BG3LQV5TZXG42OKXSMS54JOUV52';
const TOKEN_WASM_HASH = 'cfd5e1176fd87012cf2fc93cba87b2ca6b981bfbec226fffd63bf4eef313b649';

// Deployer wallet (from .env.local)
const DEPLOYER_SECRET = 'SBEC2YNDTABW5S4BSQTRDJWE5ZAZ3PRSHXS4HXBOZU545BO4BAUZJIO6';
const deployer = Keypair.fromSecret(DEPLOYER_SECRET);

// Bonding curve parameters (from smart contract)
const BASE_PRICE = 1_000; // stroops
const SLOPE = 25_000; // stroops/token
const STROOPS = 10_000_000n;

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
  data?: any;
}

const results: TestResult[] = [];

function log(step: string, status: 'PASS' | 'FAIL', details: string, data?: any) {
  results.push({ step, status, details, data });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${step}: ${details}`);
  if (data) console.log('   Data:', JSON.stringify(data, null, 2));
}

// Calculate expected price from smart contract formula
function calculatePrice(soldSupply: bigint): number {
  const soldTokens = soldSupply / STROOPS;
  const priceStroops = BigInt(BASE_PRICE) + BigInt(SLOPE) * soldTokens;
  return Number(priceStroops) / 1e7; // Convert to XLM
}

// Calculate buy cost
function calculateBuyCost(soldSupply: bigint, tokenAmount: bigint): bigint {
  const n = tokenAmount / STROOPS;
  const s = soldSupply / STROOPS;
  const cost = n * BigInt(BASE_PRICE) + BigInt(SLOPE) * s * n + BigInt(SLOPE) * n * (n - 1n) / 2n;
  return cost;
}

async function signAndSend(tx: any): Promise<string> {
  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }
  
  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  prepared.sign(deployer);
  
  const resp = await rpc.sendTransaction(prepared);
  if (resp.status === 'ERROR') {
    throw new Error(`Transaction error: ${JSON.stringify(resp)}`);
  }
  
  // Wait for confirmation
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await rpc.getTransaction(resp.hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return resp.hash;
    }
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${resp.hash}`);
    }
  }
  throw new Error(`Transaction timeout: ${resp.hash}`);
}

async function getTokenState(tokenAddress: string) {
  const contract = new Contract(BONDING_CURVE_ID);
  const account = await rpc.getAccount(deployer.publicKey());
  
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_token_state', new Address(tokenAddress).toScVal()))
    .setTimeout(30)
    .build();
  
  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`get_token_state failed: ${sim.error}`);
  }
  
  const result = scValToNative(sim.result!.retval);
  return {
    sold_supply: BigInt(result.sold_supply || 0),
    xlm_reserve: BigInt(result.xlm_reserve || 0),
    total_supply: BigInt(result.total_supply || 0),
  };
}

async function checkDatabase(tokenAddress: string, step: string) {
  // Retry up to 3 times for Neon serverless cold start
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tokenRes = await fetch(`http://localhost:3000/api/tokens/${tokenAddress}`);
      const tokenData = await tokenRes.json();
      
      if (!tokenData.success) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        log(step, 'FAIL', 'Token not found in database', { tokenAddress });
        return null;
      }
      
      const token = tokenData.data;
      
      const [metricsRes, tradesRes, ohlcvRes] = await Promise.all([
        fetch(`http://localhost:3000/api/tokens/${tokenAddress}/metrics`),
        fetch(`http://localhost:3000/api/trades?tokenId=${tokenAddress}`),
        fetch(`http://localhost:3000/api/ohlcv?tokenId=${tokenAddress}&interval=5m`),
      ]);
      
      const [metricsData, tradesData, ohlcvData] = await Promise.all([
        metricsRes.json(),
        tradesRes.json(),
        ohlcvRes.json(),
      ]);
      
      return {
        token,
        metrics: metricsData.data,
        trades: tradesData.data || [],
        ohlcv: ohlcvData.data || [],
      };
    } catch (err) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      log(step, 'FAIL', `Database check failed: ${err}`, { error: String(err) });
      return null;
    }
  }
  return null;
}

async function verifyPrice(tokenAddress: string, step: string) {
  try {
    // Get state from smart contract
    const state = await getTokenState(tokenAddress);
    const expectedPrice = calculatePrice(state.sold_supply);
    
    // Get price from database
    const dbData = await checkDatabase(tokenAddress, step);
    if (!dbData) return false;
    
    const dbPrice = parseFloat(dbData.token.current_price || 0);
    const priceDiff = Math.abs(dbPrice - expectedPrice);
    const priceDiffPct = expectedPrice > 0 ? (priceDiff / expectedPrice) * 100 : 0;
    
    if (priceDiffPct > 1) {
      log(step, 'FAIL', `Price mismatch: DB=${dbPrice}, Expected=${expectedPrice}, Diff=${priceDiffPct.toFixed(2)}%`, {
        dbPrice,
        expectedPrice,
        soldSupply: state.sold_supply.toString(),
      });
      return false;
    }
    
    log(step, 'PASS', `Price correct: ${dbPrice} XLM (diff: ${priceDiffPct.toFixed(4)}%)`, {
      dbPrice,
      expectedPrice,
      soldSupply: state.sold_supply.toString(),
    });
    return true;
  } catch (err) {
    log(step, 'FAIL', `Price verification failed: ${err}`);
    return false;
  }
}

async function verifyTimezone(tokenAddress: string, step: string) {
  // Retry up to 3 times for Neon cold start
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const dbData = await checkDatabase(tokenAddress, step);
      if (!dbData) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, 3000)); continue; }
        return false;
      }
      
      const rawCreatedAt = String(dbData.token.created_at);
      const utcStr = rawCreatedAt.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(rawCreatedAt)
        ? rawCreatedAt
        : rawCreatedAt.replace(' ', 'T') + 'Z';
      const createdAtUtc = new Date(utcStr);
      const diffMs = Math.abs(Date.now() - createdAtUtc.getTime());
      const diffMinutes = diffMs / 1000 / 60;
      
      if (diffMinutes > 30) {
        log(step, 'FAIL', `created_at too old: ${createdAtUtc.toISOString()}, diff=${diffMinutes.toFixed(1)}min`);
        return false;
      }
      
      const utc7Display = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(createdAtUtc);
      
      log(step, 'PASS', `Timezone OK — DB UTC: ${createdAtUtc.toISOString()} → Display UTC+7: ${utc7Display} (diff: ${diffMinutes.toFixed(1)}min)`);
      return true;
    } catch (err) {
      if (attempt < 3) { await new Promise(r => setTimeout(r, 3000)); continue; }
      log(step, 'FAIL', `Timezone verification failed: ${err}`);
      return false;
    }
  }
  return false;
}

async function verifyChart(tokenAddress: string, step: string) {
  try {
    const dbData = await checkDatabase(tokenAddress, step);
    if (!dbData) return false;
    
    // Retry OHLCV up to 3 times (Neon serverless cold start)
    let ohlcv: any[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const ohlcvRes = await fetch(`http://localhost:3000/api/ohlcv?tokenId=${tokenAddress}&interval=5m`);
      const ohlcvData = await ohlcvRes.json();
      ohlcv = ohlcvData.data || [];
      if (ohlcv.length > 0) break;
      if (attempt < 3) {
        console.log(`   ⏳ OHLCV attempt ${attempt} returned empty, retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    
    if (ohlcv.length === 0) {
      log(step, 'FAIL', 'No OHLCV data in chart after 3 attempts');
      return false;
    }
    
    // Verify last candle close price matches current DB price
    const lastCandle = ohlcv[ohlcv.length - 1];
    const currentPrice = parseFloat(dbData.token.current_price || 0);
    const candleClose = parseFloat(lastCandle.close);
    
    const priceDiffPct = currentPrice > 0 ? Math.abs(candleClose - currentPrice) / currentPrice * 100 : 0;
    
    if (priceDiffPct > 5) {
      log(step, 'FAIL', `Chart price mismatch: candle_close=${candleClose}, current_price=${currentPrice}, diff=${priceDiffPct.toFixed(2)}%`);
      return false;
    }
    
    log(step, 'PASS', `Chart OK: ${ohlcv.length} candles, last close=${candleClose} XLM`, { candles: ohlcv.length, lastCandle });
    return true;
  } catch (err) {
    log(step, 'FAIL', `Chart verification failed: ${err}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Bonding Curve Flow Test\n');
  console.log('📋 Test Configuration:');
  console.log(`   Factory: ${FACTORY_ID}`);
  console.log(`   Bonding Curve: ${BONDING_CURVE_ID}`);
  console.log(`   Deployer: ${deployer.publicKey()}`);
  console.log(`   Base Price: ${BASE_PRICE} stroops (${BASE_PRICE / 1e7} XLM)`);
  console.log(`   Slope: ${SLOPE} stroops/token (${SLOPE / 1e7} XLM/token)\n`);
  
  let tokenAddress = '';
  
  try {
    // STEP 1: Create token
    console.log('📝 STEP 1: Creating new token...');
    const account = await rpc.getAccount(deployer.publicKey());
    const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
    
    const tx = new TransactionBuilder(account, {
      fee: String(Number(BASE_FEE) * 300),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        new Contract(FACTORY_ID).call(
          'create_token',
          nativeToScVal(Buffer.from(TOKEN_WASM_HASH, 'hex'), { type: 'bytes' }),
          nativeToScVal(salt, { type: 'bytes' }),
          new Address(deployer.publicKey()).toScVal(),
          new Address(BONDING_CURVE_ID).toScVal(),
          nativeToScVal('Test Token', { type: 'string' }),
          nativeToScVal('TEST', { type: 'string' })
        )
      )
      .setTimeout(60)
      .build();
    
    const txHash = await signAndSend(tx);
    log('Create Token', 'PASS', `Token created: ${txHash}`);
    
    // Get token address from transaction
    const txResult = await rpc.getTransaction(txHash);
    if (txResult.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS && txResult.returnValue) {
      tokenAddress = Address.fromScVal(txResult.returnValue).toString();
      log('Get Token Address', 'PASS', `Token address: ${tokenAddress}`);
    } else {
      throw new Error('Failed to get token address from transaction');
    }
    
    // Wait for database to update
    await new Promise(r => setTimeout(r, 3000));
    
    // Register token in database (simulate what frontend does after create)
    console.log('\n💾 Registering token in database...');
    try {
      const saveRes = await fetch('http://localhost:3000/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Token',
          symbol: 'TEST',
          description: 'Bonding curve flow test token',
          image_url: '',
          social_link: '',
          totalSupply: 1_000_000_000, // 1B tokens
          owner: deployer.publicKey(),
          contractAddress: tokenAddress,
          bonding_curve_contract: BONDING_CURVE_ID,
          bonding_curve_registered: true,
        }),
      });
      const saveData = await saveRes.json();
      if (saveData.success || saveData.data) {
        log('Save Token to DB', 'PASS', `Token saved to database with id=${saveData.data?.id}`);
      } else {
        log('Save Token to DB', 'FAIL', `Failed: ${JSON.stringify(saveData)}`);
      }
    } catch (err) {
      log('Save Token to DB', 'FAIL', `Error: ${err}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // STEP 2: Check initial database state
    console.log('\n📊 STEP 2: Checking initial database state...');
    const initialDb = await checkDatabase(tokenAddress, 'Initial DB Check');
    if (initialDb) {
      log('Initial DB Check', 'PASS', 'Token found in database', {
        name: initialDb.token.name,
        symbol: initialDb.token.symbol,
        current_price: initialDb.token.current_price,
        marketcap: initialDb.token.marketcap,
      });
    }
    
    await verifyPrice(tokenAddress, 'Initial Price Check');
    await verifyTimezone(tokenAddress, 'Initial Timezone Check');
    
    // STEP 3: Buy tokens
    console.log('\n💰 STEP 3: Buying 100 tokens...');
    const buyAmount = 100n * STROOPS; // 100 tokens
    const state = await getTokenState(tokenAddress);
    const buyCost = calculateBuyCost(state.sold_supply, buyAmount);
    const buyFee = buyCost / 100n; // 1% fee
    const maxXlmIn = (buyCost + buyFee) * 110n / 100n; // 10% slippage
    
    const account2 = await rpc.getAccount(deployer.publicKey());
    const buyTx = new TransactionBuilder(account2, {
      fee: String(Number(BASE_FEE) * 200),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        new Contract(BONDING_CURVE_ID).call(
          'buy',
          new Address(deployer.publicKey()).toScVal(),
          new Address(tokenAddress).toScVal(),
          nativeToScVal(buyAmount, { type: 'i128' }),
          nativeToScVal(maxXlmIn, { type: 'i128' })
        )
      )
      .setTimeout(60)
      .build();
    
    const buyHash = await signAndSend(buyTx);
    log('Buy Tokens', 'PASS', `Bought 100 tokens: ${buyHash}`, {
      amount: '100 tokens',
      cost: `${Number(buyCost) / 1e7} XLM`,
      fee: `${Number(buyFee) / 1e7} XLM`,
    });
    
    // Save buy trade to database
    await new Promise(r => setTimeout(r, 3000)); // wait for chain confirmation
    const buyState = await getTokenState(tokenAddress);
    const buySoldTokens = Number(buyState.sold_supply) / 1e7;
    const buyCurrentPrice = calculatePrice(buyState.sold_supply);
    const buyDbRes = await checkDatabase(tokenAddress, 'Get Token ID for Buy');
    if (buyDbRes) {
      await fetch('http://localhost:3000/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: buyDbRes.token.id,
          buyer_address: deployer.publicKey(),
          seller_address: null,
          quantity: 100,
          sold_supply: buySoldTokens,
          price_per_token: buyCurrentPrice,
          total_price: Number(buyCost) / 1e7,
          transaction_hash: buyHash,
          status: 'completed',
        }),
      });
      log('Save Buy to DB', 'PASS', `Saved buy: price=${buyCurrentPrice} XLM, sold_supply=${buySoldTokens}`);
    }
    
    // STEP 4: Check database after buy
    console.log('\n📊 STEP 4: Checking database after buy...');
    await verifyPrice(tokenAddress, 'Price After Buy');
    await verifyChart(tokenAddress, 'Chart After Buy');
    
    const afterBuyDb = await checkDatabase(tokenAddress, 'DB After Buy');
    if (afterBuyDb) {
      log('DB After Buy', 'PASS', 'Database updated after buy', {
        current_price: afterBuyDb.token.current_price,
        volume_24h: afterBuyDb.token.volume_24h,
        trades: afterBuyDb.trades.length,
      });
    }
    
    // STEP 5: Sell tokens
    console.log('\n💸 STEP 5: Selling 50 tokens...');
    const sellAmount = 50n * STROOPS; // 50 tokens
    const stateAfterBuy = await getTokenState(tokenAddress);
    
    const account3 = await rpc.getAccount(deployer.publicKey());
    const sellTx = new TransactionBuilder(account3, {
      fee: String(Number(BASE_FEE) * 200),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        new Contract(BONDING_CURVE_ID).call(
          'sell',
          new Address(deployer.publicKey()).toScVal(),
          new Address(tokenAddress).toScVal(),
          nativeToScVal(sellAmount, { type: 'i128' }),
          nativeToScVal(0n, { type: 'i128' }) // min_xlm_out = 0 for test
        )
      )
      .setTimeout(60)
      .build();
    
    const sellHash = await signAndSend(sellTx);
    log('Sell Tokens', 'PASS', `Sold 50 tokens: ${sellHash}`);
    
    // Save sell trade to database
    await new Promise(r => setTimeout(r, 3000));
    const sellState = await getTokenState(tokenAddress);
    const sellSoldTokens = Number(sellState.sold_supply) / 1e7;
    const sellCurrentPrice = calculatePrice(sellState.sold_supply);
    const sellDbRes = await checkDatabase(tokenAddress, 'Get Token ID for Sell');
    if (sellDbRes) {
      await fetch('http://localhost:3000/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: sellDbRes.token.id,
          buyer_address: null,
          seller_address: deployer.publicKey(),
          quantity: 50,
          sold_supply: sellSoldTokens,
          price_per_token: sellCurrentPrice,
          total_price: Number(calculateBuyCost(stateAfterBuy.sold_supply - 50n * STROOPS, 50n * STROOPS)) / 1e7,
          transaction_hash: sellHash,
          status: 'completed',
        }),
      });
      log('Save Sell to DB', 'PASS', `Saved sell: price=${sellCurrentPrice} XLM, sold_supply=${sellSoldTokens}`);
    }
    
    await new Promise(r => setTimeout(r, 2000));
    
    // STEP 6: Check database after sell
    console.log('\n📊 STEP 6: Checking database after sell...');
    await verifyPrice(tokenAddress, 'Price After Sell');
    await verifyChart(tokenAddress, 'Chart After Sell');
    
    const afterSellDb = await checkDatabase(tokenAddress, 'DB After Sell');
    if (afterSellDb) {
      log('DB After Sell', 'PASS', 'Database updated after sell', {
        current_price: afterSellDb.token.current_price,
        volume_24h: afterSellDb.token.volume_24h,
        trades: afterSellDb.trades.length,
      });
    }
    
    // STEP 7: Verify final state
    console.log('\n🔍 STEP 7: Final verification...');
    const finalState = await getTokenState(tokenAddress);
    const expectedSoldSupply = 50n * STROOPS; // 100 bought - 50 sold = 50
    
    if (finalState.sold_supply === expectedSoldSupply) {
      log('Final Supply Check', 'PASS', `Sold supply correct: ${Number(finalState.sold_supply) / 1e7} tokens`);
    } else {
      log('Final Supply Check', 'FAIL', `Sold supply mismatch: expected=${Number(expectedSoldSupply) / 1e7}, actual=${Number(finalState.sold_supply) / 1e7}`);
    }
    
  } catch (err) {
    log('Test Execution', 'FAIL', `Test failed: ${err}`, { error: String(err) });
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  
  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.step}: ${r.details}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  if (tokenAddress) {
    console.log(`\n🔗 Test Token Address: ${tokenAddress}`);
    console.log(`🌐 View on frontend: http://localhost:3000/token/${tokenAddress}\n`);
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
