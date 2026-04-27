'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  TransactionBuilder,
  BASE_FEE,
  Networks,
  Asset,
  Operation,
  Memo,
} from '@stellar/stellar-sdk';
import { rpc as SorobanRpc } from '@stellar/stellar-sdk';
import { STELLAR_TESTNET_RPC_URL, STELLAR_NETWORK_PASSPHRASE } from '@/config/network';
import { TREASURY_ADDRESS, MINT_FEE_XLM, BONDING_CURVE_CONTRACT } from '@/config/contracts';
import { deployAndInitToken } from '@/features/token/token.service';
import { registerToken } from '@/features/trade/bonding-curve.service';

const rpc = new SorobanRpc.Server(STELLAR_TESTNET_RPC_URL, { allowHttp: false });

export default function CreateCoinPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', symbol: '', description: '', imageUrl: '', socialLink: '' });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warn'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'warn', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const sign = async (xdrStr: string) => {
    const res = await signTransaction(xdrStr, { networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string });
    if ('error' in res) throw new Error(res.error);
    return res.signedTxXdr;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.symbol) { showToast('error', 'name and symbol are required'); return; }

    setLoading(true);
    try {
      // 1. check wallet via stellarWalletService (supports Freighter + Rabet)
      setStep('checking wallet...');
      const { stellarWalletService } = await import('@/services/wallet.service');
      let adminPublicKey = await stellarWalletService.getPublicKey();
      if (!adminPublicKey) {
        const result = await stellarWalletService.connect();
        adminPublicKey = result.address;
      }
      if (!adminPublicKey) { showToast('error', 'please connect wallet first'); return; }

      const sign = async (xdrStr: string) => {
        const { signedTxXdr } = await stellarWalletService.signTransaction(xdrStr, {
          networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
        });
        if (!signedTxXdr) throw new Error('Signing failed or rejected');
        return signedTxXdr;
      };

      // 2. pay mint fee 1 XLM → treasury
      setStep('paying 1 XLM mint fee...');
      const account = await rpc.getAccount(adminPublicKey);
      const paymentTx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
      })
        .addOperation(
          Operation.payment({
            destination: TREASURY_ADDRESS,
            asset: Asset.native(),
            amount: String(MINT_FEE_XLM),
          })
        )
        .addMemo(Memo.text('tpad mint fee'))
        .setTimeout(30)
        .build();

      const signedPayment = await sign(paymentTx.toXDR());
      const paymentResp = await rpc.sendTransaction(
        TransactionBuilder.fromXDR(signedPayment, STELLAR_NETWORK_PASSPHRASE as string)
      );
      if (paymentResp.status === 'ERROR') {
        showToast('error', 'mint fee payment failed');
        return;
      }
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const s = await rpc.getTransaction(paymentResp.hash);
        if (s.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) break;
        if (s.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
          showToast('error', 'mint fee payment rejected');
          return;
        }
      }

      // 3. deploy token
      setStep('deploying token contract...');
      const wasmHash = process.env.NEXT_PUBLIC_TOKEN_WASM_HASH ?? '';
      const tokenAddress = await deployAndInitToken({
        name: form.name,
        symbol: form.symbol,
        adminPublicKey,
        bondingCurveAddress: BONDING_CURVE_CONTRACT,
        wasmHash,
        signTransaction: sign,
      });

      // 4. register into bonding curve
      setStep('registering bonding curve...');
      let bcRegistered = true;
      try {
        await registerToken(tokenAddress, adminPublicKey, sign);
      } catch (err) {
        console.error('[CreateCoinPage] registerToken failed:', err);
        bcRegistered = false;
        showToast('warn', 'token created but bonding curve registration failed');
      }

      // 5. save to DB — retry up to 3 times
      setStep('saving token...');
      let saved = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch('/api/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name,
              symbol: form.symbol,
              description: form.description,
              image_url: form.imageUrl,
              social_link: form.socialLink,
              totalSupply: '1000000000',
              owner: adminPublicKey,
              contractAddress: tokenAddress,
              bonding_curve_contract: BONDING_CURVE_CONTRACT,
              bonding_curve_registered: bcRegistered,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            saved = true;
            break;
          } else {
            throw new Error(data.error || `HTTP ${res.status}`);
          }
        } catch (dbErr) {
          console.error(`[CreateCoinPage] DB save attempt ${attempt} failed:`, dbErr);
          if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
          else showToast('warn', `DB save failed: ${dbErr instanceof Error ? dbErr.message : dbErr}`);
        }
      }

      showToast('success', 'token created successfully!');
      router.push(`/token/${tokenAddress}`);
    } catch (err) {
      showToast('error', String(err));
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  return (
    <div className="min-h-screen bg-pump-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-pump-card border border-gray-800 rounded-lg p-6 space-y-6">
        <h1 className="text-xl font-bold text-white">create a new token</h1>

        {/* mint fee notice */}
        <div className="bg-pump-green/10 border border-pump-green/20 rounded-lg px-4 py-3 text-sm text-pump-green">
          creating a token requires a <strong>1 XLM mint fee</strong>
        </div>

        {toast && (
          <div className={`px-4 py-2 rounded text-sm ${
            toast.type === 'success' ? 'bg-pump-green/10 text-pump-green' :
            toast.type === 'warn'    ? 'bg-yellow-500/10 text-yellow-400' :
                                       'bg-pump-red/10 text-pump-red'
          }`}>
            {toast.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'name',        label: 'token name',   placeholder: 'my token' },
            { key: 'symbol',      label: 'symbol',       placeholder: 'MTK' },
            { key: 'description', label: 'description',  placeholder: 'optional' },
            { key: 'imageUrl',    label: 'image url',    placeholder: 'https://...' },
            { key: 'socialLink',  label: 'social link',  placeholder: 'https://twitter.com/...' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1 uppercase font-medium">{label}</label>
              <input
                type="text"
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-gray-900/80 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-pump-green/50 transition-colors"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-bold uppercase tracking-widest bg-pump-green text-black hover:bg-green-400 shadow-[0_0_20px_rgba(74,222,128,0.2)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{step || 'processing...'}</>
            ) : (
              'create token'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
