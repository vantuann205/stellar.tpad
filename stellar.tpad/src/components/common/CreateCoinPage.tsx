'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, Wallet } from 'lucide-react';
import Toast, { type ToastMessage } from '@/components/ui/Toast';
import { STELLAR_NETWORK_PASSPHRASE } from '@/config/network';

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

type Step = 'form';

const WASM_HASH = process.env.NEXT_PUBLIC_TOKEN_WASM_HASH ?? '';

export default function CreateCoinPage({ onCancel, onTokenCreated }: CreateCoinPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<TokenForm>({
    name: '', symbol: '', description: '',
    imageFile: null, imageUrl: '',
    twitter: '', telegram: '', website: '',
  });
  const [uploading, setUploading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addToast = (type: ToastMessage['type'], title: string, message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

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
      addToast('error', 'Thiếu thông tin', 'Vui lòng điền đầy đủ tên, ticker và mô tả.');
      return;
    }
    if (!form.imageUrl) {
      addToast('error', 'Thiếu ảnh', 'Vui lòng upload ảnh token.');
      return;
    }

    setIsDeploying(true);

    try {
      // 1. Connect Freighter
      const { stellarWalletService } = await import('@/services/wallet.service');

      let publicKey = await stellarWalletService.getPublicKey();
      if (!publicKey) {
        const result = await stellarWalletService.connect();
        publicKey = result.address;
      }
      if (!publicKey) throw new Error('Không lấy được địa chỉ ví. Vui lòng kết nối ví trước.');

      if (!WASM_HASH) throw new Error('NEXT_PUBLIC_TOKEN_WASM_HASH chưa được cấu hình trong .env.local');

      const bondingCurveId = process.env.NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID;
      if (!bondingCurveId) throw new Error('NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID not configured');

      // 2. Deploy contract + register bonding curve (1 signature only)
      const { deployAndInitToken } = await import('@/features/token/token.service');

      const newContractId = await deployAndInitToken({
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        adminPublicKey: publicKey,
        bondingCurveAddress: bondingCurveId,
        wasmHash: WASM_HASH,
        signTransaction: async (txXdr: string) => {
          const { signedTxXdr } = await stellarWalletService.signTransaction(txXdr, {
            networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
          });
          if (!signedTxXdr) throw new Error('Ký transaction thất bại hoặc bị từ chối');
          return signedTxXdr;
        },
      });

      // 3. Save to DB — retry up to 3 times
      let saved = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch('/api/tokens', {
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
              bonding_curve_contract: bondingCurveId,
              bonding_curve_registered: true,
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
          if (attempt === 3) throw dbErr;
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // Success!
      addToast('success', 'Thành công!', `${form.symbol.trim().toUpperCase()} đã được tạo và deployed.`);
      onTokenCreated?.(newContractId, form.name.trim(), form.symbol.trim().toUpperCase());
      
      // Auto-redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast('error', 'Deploy thất bại', msg);
      setIsDeploying(false);
    }
  };

  // ---- render ----
  const previewName = form.name.trim() || 'Your Coin';
  const previewTicker = form.symbol.trim() ? `$${form.symbol.trim().toUpperCase()}` : '$TICK';

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-white mb-2">Launch Your Coin</h1>
        <p className="text-gray-400">Deploy token trên Stellar Mainnet. Supply mặc định 1,000,000,000 — mint ngay cho bạn.</p>
      </div>

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
                  <span>Stellar Mainnet</span>
                </div>
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
            disabled={!form.name.trim() || !form.symbol.trim() || !form.description.trim() || !form.imageUrl || isDeploying}
            className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg text-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01] shadow-lg shadow-emerald-900/40"
          >
            {isDeploying ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Deploying...</>
            ) : (
              'Launch Coin'
            )}
          </button>
        </div>
      </div>

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 pointer-events-none z-50 flex flex-col">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </div>
  );
}
