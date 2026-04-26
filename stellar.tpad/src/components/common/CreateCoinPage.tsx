'use client';

import React, { useState, useRef } from 'react';
import { Upload, Rocket, Loader2, CheckCircle2, AlertCircle, Wallet } from 'lucide-react';

interface CreateCoinPageProps {
  onCancel: () => void;
  onTokenCreated?: (contractId: string, name: string, symbol: string) => void;
}

interface TokenForm {
  name: string;
  symbol: string;
  description: string;
  imageFile: File | null;
  imageUrl: string;
  twitter: string;
  telegram: string;
  website: string;
}

type Step = 'form' | 'deploying' | 'success';

const WASM_HASH = process.env.NEXT_PUBLIC_TOKEN_WASM_HASH ?? '';

export default function CreateCoinPage({ onCancel, onTokenCreated }: CreateCoinPageProps) {
  const [form, setForm] = useState<TokenForm>({
    name: '', symbol: '', description: '',
    imageFile: null, imageUrl: '',
    twitter: '', telegram: '', website: '',
  });
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [deployLog, setDeployLog] = useState<string[]>([]);
  const [contractId, setContractId] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- image upload ----
  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setForm(f => ({ ...f, imageFile: file, imageUrl: url }));
    } catch (e) {
      alert('Upload error: ' + (e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  };

  // ---- deploy ----
  const handleDeploy = async () => {
    if (!form.name.trim() || !form.symbol.trim() || !form.description.trim()) {
      setError('Vui lòng điền đầy đủ tên, ticker và mô tả.');
      return;
    }
    if (!form.imageUrl) {
      setError('Vui lòng upload ảnh token.');
      return;
    }

    setError('');
    setStep('deploying');
    setDeployLog([]);

    const log = (msg: string) => setDeployLog(prev => [...prev, msg]);

    try {
      // 1. Connect Freighter
      log('🔌 Kết nối Freighter wallet...');
      const { isConnected, requestAccess, getAddress, signTransaction } = await import('@stellar/freighter-api');
      const connected = await isConnected();
      if (!connected) throw new Error('Freighter chưa được cài đặt. Cài tại https://freighter.app');

      // Request access if not already granted
      await requestAccess();

      const addrResult = await getAddress();
      const publicKey = typeof addrResult === 'string' ? addrResult : (addrResult as any).address ?? '';
      if (!publicKey) throw new Error('Không lấy được địa chỉ ví từ Freighter.');
      log(`✅ Wallet: ${publicKey.slice(0, 8)}...${publicKey.slice(-4)}`);

      if (!WASM_HASH) throw new Error('NEXT_PUBLIC_TOKEN_WASM_HASH chưa được cấu hình trong .env.local');

      // 2. Deploy contract + register bonding curve (1 signature only)
      log('🚀 Deploying token contract on Stellar Testnet...');
      const { deployAndInitToken } = await import('@/features/token/token.service');

      const bondingCurveId = process.env.NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID;
      if (!bondingCurveId) throw new Error('NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID not configured');

      const newContractId = await deployAndInitToken({
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        adminPublicKey: publicKey,
        bondingCurveAddress: bondingCurveId,
        wasmHash: WASM_HASH,
        signTransaction: async (txXdr: string) => {
          log('✍️ Vui lòng ký transaction trong Freighter...');
          const result = await signTransaction(txXdr, {
            networkPassphrase: 'Test SDF Network ; September 2015',
          });
          if (typeof result === 'string') return result;
          const xdrStr = (result as any).signedTxXdr;
          if (!xdrStr) throw new Error('Freighter không trả về signed XDR');
          return xdrStr;
        },
      });

      log(`✅ Contract deployed: ${newContractId}`);
      log('💰 1,000,000,000 tokens minted to bonding curve pool!');
      log('📊 Token registered in bonding curve!');

      // 3. Save to DB
      log('💾 Lưu vào database...');
      try {
        await fetch('/api/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            symbol: form.symbol.trim().toUpperCase(),
            description: form.description.trim(),
            image_url: form.imageUrl,
            social_link: form.twitter || form.telegram || form.website || '',
            totalSupply: '1000000000',
            owner: publicKey,
            contractAddress: newContractId,
          }),
        });
        log('✅ Đã lưu vào database.');
      } catch {
        log('⚠️ Lưu DB thất bại (contract vẫn deployed thành công).');
      }

      setContractId(newContractId);
      setStep('success');
      onTokenCreated?.(newContractId, form.name.trim(), form.symbol.trim().toUpperCase());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`❌ Lỗi: ${msg}`);
      setError(msg);
      setStep('form');
    }
  };

  // ---- render ----
  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center animate-fade-in">
        <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-6" />
        <h2 className="text-3xl font-black text-white mb-2">Token Launched! 🎉</h2>
        <p className="text-gray-400 mb-6">1,000,000,000 <span className="text-white font-bold">{form.symbol.toUpperCase()}</span> đã được mint vào ví của bạn.</p>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-8 text-left">
          <p className="text-xs text-gray-500 mb-1">Contract ID</p>
          <p className="text-sm text-emerald-400 font-mono break-all">{contractId}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            Về trang chủ
          </button>
          <button
            onClick={() => { setStep('form'); setForm({ name:'',symbol:'',description:'',imageFile:null,imageUrl:'',twitter:'',telegram:'',website:'' }); }}
            className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
          >
            Tạo coin khác
          </button>
        </div>
      </div>
    );
  }

  if (step === 'deploying') {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 animate-fade-in">
        <div className="text-center mb-8">
          <Loader2 className="w-12 h-12 text-emerald-400 mx-auto mb-4 animate-spin" />
          <h2 className="text-2xl font-black text-white">Đang deploy...</h2>
          <p className="text-gray-400 text-sm mt-1">Vui lòng ký các transaction trong Freighter</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2 font-mono text-sm">
          {deployLog.map((line, i) => (
            <p key={i} className={line.startsWith('❌') ? 'text-red-400' : line.startsWith('✅') || line.startsWith('💰') ? 'text-emerald-400' : 'text-gray-300'}>
              {line}
            </p>
          ))}
          {!error && <p className="text-gray-500 animate-pulse">...</p>}
        </div>
      </div>
    );
  }

  const previewName = form.name.trim() || 'Your Coin';
  const previewTicker = form.symbol.trim() ? `$${form.symbol.trim().toUpperCase()}` : '$TICK';

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-white mb-2">Launch Your Coin</h1>
        <p className="text-gray-400">Deploy token trên Stellar Testnet. Supply mặc định 1,000,000,000 — mint ngay cho bạn.</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-8 shadow-2xl">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          {/* Form */}
          <div className="space-y-6 xl:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-emerald-400 uppercase mb-2">Token Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Stellar Pepe"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg bg-gray-900 border border-gray-700 p-3 text-white focus:border-emerald-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-400 uppercase mb-2">Ticker *</label>
                <input
                  type="text"
                  placeholder="e.g. SPEPE"
                  value={form.symbol}
                  onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase().slice(0, 12) }))}
                  className="w-full rounded-lg bg-gray-900 border border-gray-700 p-3 text-white focus:border-emerald-500 outline-none transition-colors uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-400 uppercase mb-2">Description *</label>
              <textarea
                placeholder="Mô tả token của bạn..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg bg-gray-900 border border-gray-700 p-3 text-white focus:border-emerald-500 outline-none h-28 resize-none transition-colors"
              />
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-xs font-bold text-emerald-400 uppercase mb-2">Token Image *</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  form.imageUrl ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-gray-700 hover:border-emerald-500 bg-gray-900/50'
                }`}
              >
                {uploading ? (
                  <><Loader2 className="w-8 h-8 mb-2 animate-spin text-emerald-400" /><span className="text-sm text-gray-400">Uploading...</span></>
                ) : form.imageUrl ? (
                  <><img src={form.imageUrl} alt="Token" className="w-16 h-16 rounded-lg mb-2 object-cover" /><span className="text-sm text-emerald-400">Đổi ảnh</span></>
                ) : (
                  <><Upload className="w-8 h-8 mb-2 text-gray-500" /><span className="text-sm text-gray-400">Kéo thả hoặc click để upload</span><span className="text-xs text-gray-600 mt-1">PNG, JPG, GIF — tối đa 5MB</span></>
                )}
              </div>
            </div>

            {/* Social links */}
            <div className="border-t border-gray-800 pt-6">
              <p className="text-xs font-bold text-gray-500 uppercase mb-4">Social Links (tuỳ chọn)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['twitter', 'telegram', 'website'] as const).map(key => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1 capitalize">{key}</label>
                    <input
                      type="text"
                      placeholder={key === 'twitter' ? 'https://x.com/...' : key === 'telegram' ? 'https://t.me/...' : 'https://...'}
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded bg-gray-900 border border-gray-800 p-2 text-white text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="xl:sticky xl:top-24">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Preview</p>
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <div className="flex gap-3 mb-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-800 flex items-center justify-center">
                  {form.imageUrl
                    ? <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    : <span className="text-gray-600 text-xs">No img</span>
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-black text-white truncate">{previewName}</p>
                  <p className="text-sm text-emerald-400 font-mono">{previewTicker}</p>
                  <p className="text-xs text-gray-500 mt-1">Supply: 1,000,000,000</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 line-clamp-3">{form.description || 'Mô tả sẽ hiển thị ở đây...'}</p>

              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Wallet className="w-3 h-3" />
                  <span>Stellar Testnet</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">Decimals: 7 · 1B tokens mint ngay</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-8 pt-6 border-t border-gray-800">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-lg font-bold text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleDeploy}
            disabled={!form.name.trim() || !form.symbol.trim() || !form.description.trim() || !form.imageUrl}
            className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg text-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01] shadow-lg shadow-emerald-900/40"
          >
            <Rocket className="w-5 h-5" />
            Launch Coin 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
