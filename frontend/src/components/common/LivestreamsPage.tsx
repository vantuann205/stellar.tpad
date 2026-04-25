import React, { useState, useEffect } from 'react';
import { Users, Play, Heart, MessageSquare, Loader } from 'lucide-react';

interface Livestream {
  id: string;
  user_address: string;
  title: string;
  token: string;
  thumbnail_url: string;
  avatar_url: string;
  viewers: number;
  created_at: string;
}

const LivestreamsPage: React.FC = () => {
  const [streams, setStreams] = useState<Livestream[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStreams = async () => {
    try {
      const response = await fetch('/api/livestreams');
      const data = await response.json();
      if (data.success) {
        setStreams(data.data);
      }
    } catch (error) {
      console.error('Error fetching livestreams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, []);
  return (
    <div className="animate-fade-in pb-10">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                Live Now
            </h1>
            <p className="text-gray-400 mt-1">Watch traders aping into bonding curves in real-time.</p>
        </div>
        <button className="bg-pump-accent hover:bg-violet-500 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 transition-colors">
            <Play className="w-4 h-4 fill-current" />
            Go Live
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-20">
            <Loader className="w-8 h-8 animate-spin text-pump-accent" />
          </div>
        ) : streams.length === 0 ? (
          <div className="col-span-full text-center py-20">
            <p className="text-gray-400">No active livestreams at the moment.</p>
          </div>
        ) : (
          streams.map((stream) => (
            <div key={stream.id} className="bg-pump-card border border-gray-800 rounded-xl overflow-hidden group hover:border-pump-accent/50 transition-all cursor-pointer">
                {/* Thumbnail Container */}
                <div className="relative aspect-video">
                    <img src={stream.thumbnail_url} alt={stream.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        LIVE
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                        <Users className="w-3 h-3" /> {stream.viewers.toLocaleString()}
                    </div>
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <div className="w-12 h-12 bg-pump-accent/90 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-5 h-5 fill-white text-white ml-1" />
                        </div>
                    </div>
                </div>

                {/* Info */}
                <div className="p-4 flex gap-3">
                    <img src={stream.avatar_url} alt={stream.user_address} className="w-10 h-10 rounded-full border border-gray-700" />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-sm truncate leading-tight mb-1">{stream.title}</h3>
                        <p className="text-gray-400 text-xs hover:text-pump-accent">{stream.user_address}</p>
                        <div className="flex items-center gap-2 mt-2">
                             <span className="text-[10px] bg-gray-800 text-pump-green px-1.5 py-0.5 rounded font-mono border border-gray-700">
                                Trading {stream.token}
                             </span>
                        </div>
                    </div>
                </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LivestreamsPage;
