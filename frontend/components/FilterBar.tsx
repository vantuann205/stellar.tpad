import React, { useEffect, useRef, useState } from 'react';
import { Grid2X2, ListFilter, Settings } from 'lucide-react';
import { SortOption } from '../types';

interface FilterBarProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  listMode: 'grid' | 'table';
  onListModeChange: (mode: 'grid' | 'table') => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  currentSort,
  onSortChange,
  listMode,
  onListModeChange,
}) => {
  const [showViewMenu, setShowViewMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setShowViewMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-4 mb-6 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-white dark:bg-pump-card rounded border border-gray-300 dark:border-gray-800 p-1">
          <button className="px-4 py-1 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded shadow text-xs font-bold">New</button>
          <button className="px-4 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs font-bold">Terminal</button>
        </div>

        <div className="relative ml-auto" ref={menuRef}>
          <div className="flex items-center gap-2">
            <select
              value={currentSort}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="h-11 min-w-[170px] bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white text-xs rounded-xl px-3 outline-none w-full sm:w-auto focus:border-blue-500"
            >
              <option value="creationTime">Sort: Creation Time</option>
              <option value="featured">Sort: Featured</option>
              <option value="marketCap">Sort: MC</option>
              <option value="lastReply">Sort: Last Reply</option>
            </select>
            <button
              type="button"
              aria-label="Display settings"
              onClick={() => setShowViewMenu((prev) => !prev)}
              className="h-11 w-11 rounded-xl border border-gray-300/70 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-[#171b25] dark:text-gray-200 dark:hover:bg-[#1d2330]"
            >
              <Settings size={16} className="mx-auto" />
            </button>
          </div>

          {showViewMenu && (
            <div className="absolute right-0 z-50 mt-3 w-[250px] rounded-xl border border-gray-300/70 bg-white/95 p-3 shadow-2xl backdrop-blur-sm dark:border-gray-700 dark:bg-[#0f131d]/95">
              <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-[#171d28]">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onListModeChange('grid');
                    setShowViewMenu(false);
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-base font-semibold transition ${
                    listMode === 'grid'
                      ? 'bg-white text-gray-900 shadow dark:bg-[#0a0d14] dark:text-white'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <Grid2X2 size={16} />
                  Grid
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onListModeChange('table');
                    setShowViewMenu(false);
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-base font-semibold transition ${
                    listMode === 'table'
                      ? 'bg-white text-gray-900 shadow dark:bg-[#0a0d14] dark:text-white'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <ListFilter size={16} />
                  Table
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
