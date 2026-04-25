'use client';

import React, { useState } from 'react';
import { X, Camera, Loader } from 'lucide-react';

interface WalletInfo {
  id: number;
  wallet_address: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  owned_coins: string[];
  minted_coins: string[];
  created_at: string;
  updated_at: string;
}

interface EditProfileModalProps {
  walletAddress: string;
  walletInfo: WalletInfo;
  onClose: () => void;
  onSave: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  walletAddress,
  walletInfo,
  onClose,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState(walletInfo.display_name || '');
  const [bio, setBio] = useState(walletInfo.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(walletInfo.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(walletInfo.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      let finalAvatarUrl = avatarUrl;

      // Upload avatar if changed
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          finalAvatarUrl = uploadData.url;
        } else {
          throw new Error('Failed to upload avatar');
        }
      }

      // Update wallet info
      const response = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          display_name: displayName || null,
          avatar_url: finalAvatarUrl || null,
          bio: bio || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onSave();
      } else {
        setError(data.error || 'Failed to save profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-pump-card border border-gray-800 rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="border-b border-gray-800 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Edit profile</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar Upload */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pump-accent to-blue-500 border-4 border-gray-800 flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  displayName?.[0]?.toUpperCase() || '?'
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-pump-green hover:bg-pump-green/80 disabled:bg-gray-600 text-black p-2 rounded-full transition-colors disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-bold text-white mb-2 flex items-center gap-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter username"
              disabled={loading}
              className="w-full bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-pump-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">You can change your username once every day</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-bold text-white mb-2">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your profile"
              disabled={loading}
              className="w-full bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-pump-green transition-colors resize-none h-24 disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={200}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={loading || !displayName.trim()}
            className="w-full bg-pump-green hover:bg-pump-green/80 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
