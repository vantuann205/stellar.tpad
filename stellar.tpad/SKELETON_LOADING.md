# Skeleton Loading Implementation

## Tổng quan
Đã implement skeleton loading với hiệu ứng shimmer cho toàn bộ ứng dụng. Skeleton screens hiển thị layout giống y hệt component thật với animation chạy sáng (shimmer effect).

## Cấu trúc File

```
src/
├── components/
│   ├── ui/
│   │   └── Skeleton.tsx          # Base skeleton component với shimmer effect
│   └── skeleton/
│       └── index.tsx              # Tất cả skeleton components (tái sử dụng)
└── app/
    ├── loading.tsx                # Skeleton cho home page
    └── token/[contractAddress]/
        └── loading.tsx            # Skeleton cho trade page
```

## Components

### 1. Base Skeleton (`src/components/ui/Skeleton.tsx`)
Component cơ bản với shimmer animation:
- **Variants**: `text`, `circular`, `rectangular`
- **Animation**: Shimmer effect (gradient chạy từ trái sang phải)
- **Responsive**: Tự động adapt với dark/light mode

### 2. Reusable Skeletons (`src/components/skeleton/index.tsx`)

#### `CardSkeleton`
- Khớp chính xác với `CoinCard` component
- Layout: Image 124x124px + content bên phải
- Bao gồm: name, ticker, creator, price, progress bar, volume, description

#### `ListSkeleton`
- Grid layout cho danh sách tokens
- Responsive: 1-4 columns tùy screen size
- Configurable count (default: 6)

#### `ChartSkeleton`
- Khớp với TradingView chart
- Bao gồm: header, interval buttons, chart area 400px

#### `TableSkeleton`
- Khớp với TransactionTable
- Bao gồm: header row + configurable data rows
- 7 columns: Account, Type, Price, Amount, Fees, Date, Tx Hash

#### `CommentSkeleton`
- Khớp với CommentSection
- Layout: Avatar circular 40px + content
- Configurable count (default: 3)

#### `TokenInfoBarSkeleton`
- Khớp chính xác với TokenInfoBar
- Left: Token name, symbol, creator/contract buttons, date
- Right: 6 metrics columns (Market Cap, Vol 24h, Price, 5m, 1h, 6h)

#### `BondingCurveSkeleton`
- Khớp với BondingCurve component
- Bao gồm: header, progress bar, stats grid, warning box

#### `TradeFormSkeleton`
- Khớp với BondingCurveTrader
- Bao gồm: Buy/Sell tabs, input fields, button, stats

#### `TradePageSkeleton`
- Full page skeleton cho trade page
- Layout: Back button + TokenInfoBar + Grid (8-4 columns)
- Left: Chart + BondingCurve + TransactionTable
- Right: TradeForm + Comments + TopHolders

#### `HomePageSkeleton`
- Full page skeleton cho home page
- Bao gồm: Header + ListSkeleton

## Shimmer Animation

### Tailwind Config (`tailwind.config.js`)
```javascript
animation: {
  'shimmer': 'shimmer 2s infinite',
},
keyframes: {
  'shimmer': {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(100%)' }
  }
}
```

### Implementation
```tsx
<div className="relative overflow-hidden bg-gray-200 dark:bg-gray-800">
  <div className="absolute inset-0 -translate-x-full animate-shimmer 
    bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
</div>
```

## Next.js Integration

### Automatic Loading States
Next.js tự động hiển thị `loading.tsx` khi:
- Navigate giữa các routes
- Server Component đang fetch data
- Suspense boundary được trigger

### File Locations
```
app/
├── loading.tsx                    # Home page loading
└── token/[contractAddress]/
    └── loading.tsx                # Trade page loading
```

## Usage trong Components

### Home Page (`src/app/page.tsx`)
```tsx
import { ListSkeleton } from '@/components/skeleton';

{loading ? (
  <ListSkeleton count={9} />
) : (
  <div className="grid ...">
    {tokens.map(token => <CoinCard ... />)}
  </div>
)}
```

### Table Mode
```tsx
{loading ? (
  <table>
    <tbody>
      {Array.from({ length: 10 }).map((_, idx) => (
        <tr key={idx}>
          <td><Skeleton width="80px" height="16px" /></td>
          ...
        </tr>
      ))}
    </tbody>
  </table>
) : (
  // Real data
)}
```

## Best Practices

### ✅ Đúng
1. **Khớp chính xác với layout thật**
   - Cùng dimensions (width, height)
   - Cùng spacing (padding, margin, gap)
   - Cùng structure (flex, grid)

2. **Tái sử dụng components**
   - Tạo skeleton components riêng
   - Export từ một file duy nhất
   - Configurable với props

3. **Responsive**
   - Skeleton phải responsive như component thật
   - Sử dụng cùng breakpoints

### ❌ Sai
1. ~~Tạo nhiều file skeleton riêng lẻ~~
2. ~~Skeleton không khớp với layout thật~~
3. ~~Hardcode dimensions không responsive~~

## Performance

### Lợi ích
- **Perceived Performance**: User thấy content load nhanh hơn
- **No Layout Shift**: Không bị nhảy layout khi data load
- **Better UX**: User biết đang load gì (shape of content)

### Metrics
- **FCP (First Contentful Paint)**: Cải thiện vì skeleton render ngay
- **CLS (Cumulative Layout Shift)**: Giảm về 0 vì layout cố định
- **LCP (Largest Contentful Paint)**: Không ảnh hưởng (vẫn đợi real content)

## Testing

### Manual Testing
1. Slow 3G network throttling
2. Navigate giữa các pages
3. Refresh page
4. Check dark/light mode

### Expected Behavior
- Skeleton hiển thị ngay lập tức
- Shimmer animation chạy mượt
- Transition smooth sang real content
- Layout không shift

## Future Improvements

1. **Staggered Animation**: Skeleton items fade in lần lượt
2. **Pulse Effect**: Thêm pulse animation option
3. **Custom Shimmer Colors**: Configurable shimmer colors
4. **Skeleton Variants**: More skeleton types (profile, settings, etc.)
