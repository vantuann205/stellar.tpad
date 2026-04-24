'use client'

import React, { useState, useEffect } from 'react';
import { Upload, AlertTriangle, ShieldCheck, Rocket, Loader2 } from 'lucide-react';
import { BrowserProvider, Contract } from 'ethers';
import { wrapEthereumProvider } from '@oasisprotocol/sapphire-paratime';
import { FACTORY_ABI, FACTORY_ADDRESS } from '../abi/factoryAbi';

interface CreateCoinPageProps {
  onCancel: () => void;
  onTokenCreated?: (tokenAddress: string, tokenName: string, tokenSymbol: string) => void;
}

interface TokenForm {
  name: string;
  symbol: string;
  description: string;
  imageFile: File | null;
  imageUrl: string;
}

const CreateCoinPage: React.FC<CreateCoinPageProps> = ({ onCancel, onTokenCreated }) => {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [form, setForm] = useState<TokenForm>({
    name: '',
    symbol: '',
    description: '',
    imageFile: null,
    imageUrl: ''
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setConnected(true);
            setAddress(accounts[0]);
          }
        } catch (error) {
          console.log('No wallet connection detected');
        }
      }
    };
    checkConnection();
  }, []);

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setForm(prev => ({
          ...prev,
          imageFile: file,
          imageUrl: data.url
        }));
      } else {
        alert('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload error: ' + (error instanceof Error ? error.message : 'Unknown'));
    } finally {
      setUploading(false);
    }
  };

  const handleDragDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleCreate = async () => {
    // Validation checks
    if (!form.name || !form.name.trim()) {
      alert('❌ Vui lòng nhập tên token!');
      return;
    }

    if (!form.symbol || !form.symbol.trim()) {
      alert('❌ Vui lòng nhập ticker!');
      return;
    }

    if (!form.description || !form.description.trim()) {
      alert('❌ Vui lòng nhập mô tả token!');
      return;
    }

    if (!form.imageUrl || !form.imageUrl.trim()) {
      alert('❌ Vui lòng upload ảnh token trước khi deploy!');
      return;
    }

    if (!window.ethereum) {
      alert('Vui lòng cài đặt MetaMask!');
      return;
    }

    setLoading(true);
    try {
      let ethereum = window.ethereum;
      if (window.ethereum.providers) {
        ethereum = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum;
      }

      const wrappedProvider = wrapEthereumProvider(ethereum);
      const provider = new BrowserProvider(wrappedProvider);
      const signer = await provider.getSigner();

      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

      // Deploy token
      const tx = await factory.createToken(form.name, form.symbol, form.description);
      const receipt = await tx.wait();

      // Find TokenCreated event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed?.name === 'TokenCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = factory.interface.parseLog(event);
        const tokenAddress = parsed?.args[0];

        // Get user address
        const userAddress = await signer.getAddress();

        console.log('Token created on blockchain:', {
          name: form.name,
          symbol: form.symbol,
          contractAddress: tokenAddress,
          owner: userAddress,
        });

        // Save token to database
        try {
          console.log('Saving token to database...');
          const response = await fetch('/api/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name,
              symbol: form.symbol,
              description: form.description || '',
              image_url: form.imageUrl || '',
              social_link: '',
              totalSupply: '1000000000',
              owner: userAddress,
              contractAddress: tokenAddress,
            }),
          });

          console.log('API Response Status:', response.status);

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Token saved to database:', data);
            const tokenId = data.data.id;

            // Save transaction
            try {
              console.log('Saving transaction to database...');
              const txResponse = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token_id: tokenId,
                  from_address: '0x0000000000000000000000000000000000000000',
                  to_address: userAddress,
                  amount: '1000000000',
                  transaction_hash: tx.hash,
                }),
              });

              if (txResponse.ok) {
                const txData = await txResponse.json();
                console.log('✅ Transaction saved to database:', txData);
              } else {
                console.error('⚠️ Transaction save failed');
              }
            } catch (txError) {
              console.error('Error saving transaction:', txError);
            }
          } else {
            try {
              const error = await response.json();
              console.error('API Error:', error);
              alert(`Failed to save to database: ${error.error || 'Unknown error'}`);
            } catch {
              console.error('Failed to parse error response');
              alert(`Failed to save to database`);
            }
          }
        } catch (dbError) {
          console.error('Error saving token to database:', dbError);
          alert('Token created but failed to save to database');
        }

        if (onTokenCreated) onTokenCreated(tokenAddress, form.name.trim(), form.symbol.trim());
      } else {
        alert('Token created but address not found in logs');
      }
    } catch (error: any) {
      console.error('Create error:', error);
      alert('Lỗi khi tạo token: ' + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  const previewName = form.name.trim() || 'Your Coin';
  const previewTicker = form.symbol.trim() || '$TICK';
  const previewDescription = form.description.trim() || 'Token description preview will appear here.';
  const previewCreator = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x...';

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Launch on Oasis</h1>
        <p className="text-gray-600 dark:text-gray-400">Deploy your token on Oasis Sapphire instantly. No presale, no team allocation.</p>
      </div>

      <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="grid gap-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            <div className="space-y-6 xl:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Token Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Based Rose"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-3 text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Ticker</label>
                  <input
                    type="text"
                    placeholder="e.g. $ROSE"
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    className="w-full rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-3 text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Description <span className="text-red-600 dark:text-red-400">*</span></label>
                <textarea
                  placeholder="Tell the world why this token will flip ETH..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-3 text-gray-900 dark:text-white focus:border-blue-500 outline-none h-32 transition-colors resize-none"
                />
                <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">{form.description.length} characters</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Token Image <span className="text-red-600 dark:text-red-400">*</span></label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onDragEnter={handleDragDrop}
                  onDragOver={handleDragDrop}
                  onDragLeave={handleDragDrop}
                  onDrop={handleDragDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-all bg-gray-100 dark:bg-gray-900/50 ${
                    form.imageUrl 
                      ? 'border-green-500/50' 
                      : 'border-gray-400 dark:border-gray-700 hover:border-blue-500 hover:text-blue-500'
                  } ${!form.imageUrl && 'text-gray-600 dark:text-gray-500'}`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-10 h-10 mb-3 animate-spin" />
                      <span className="text-sm font-medium">Uploading...</span>
                    </>
                  ) : form.imageUrl ? (
                    <>
                      <img src={form.imageUrl} alt="Token" className="w-20 h-20 rounded-lg mb-3 object-cover" />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Change Image</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mb-3" />
                      <span className="text-sm font-medium">Drag and drop or click to upload</span>
                      <span className="text-xs text-gray-600 dark:text-gray-600 mt-1">PNG, JPG, GIF up to 5MB</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="xl:sticky xl:top-24">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Live Preview</p>
              <div className="rounded-xl border border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-[#0b1324] p-4 shadow-lg">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-gray-200 dark:bg-gray-800">
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-semibold">No Image</div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xl font-black text-gray-900 dark:text-white truncate">{previewName}</p>
                    <p className="text-sm tracking-wide text-gray-500 dark:text-gray-400 truncate">{previewTicker}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <span>🐸</span>
                      <span className="truncate">{previewCreator}</span>
                      <span className="text-gray-400">just now</span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 line-clamp-2 break-words">
                  {previewDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-300 dark:border-gray-800 pt-6">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-4">Social Links (Optional)</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1">Twitter Link</label>
                <input type="text" placeholder="https://x.com/..." className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 text-gray-900 dark:text-white text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1">Telegram Link</label>
                <input type="text" placeholder="https://t.me/..." className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 text-gray-900 dark:text-white text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1">Website</label>
                <input type="text" placeholder="https://..." className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 text-gray-900 dark:text-white text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-blue-100 dark:bg-blue-900/10 border border-blue-300 dark:border-blue-500/20 rounded-lg p-4 flex gap-3 items-start">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-200/80">
              <p className="mb-1 font-bold text-blue-700 dark:text-blue-400">Fair Launch Protocol</p>
              <p>Sniper protection enabled. Metadata is immutable on Oasis. Liquidity is automatically locked in the bonding curve contract until graduation.</p>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 py-4 rounded-lg font-bold text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-400 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !form.imageUrl || !form.name.trim() || !form.symbol.trim() || !form.description.trim()}
              className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-lg text-lg uppercase tracking-wide shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
              Deploy Token
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCoinPage;
