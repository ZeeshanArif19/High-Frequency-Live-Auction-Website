/**
 * client/src/data/placeholderData.js
 *
 * Placeholder auction data for the landing page.
 * NOTE: This data will be replaced with real DB fetches in future iterations.
 */

export const placeholderStats = {
  activeBidders: 24091,
  activeSessions: 14892,
  dailyVolume: '₹3.53Cr', // ₹35.3 Million equivalent
  liveMarkets: 348,
  tradesPerSecond: 84.9,
  userBalance: '₹10,39,750.00', // ~$12,450 converted
};

export const placeholderAuctions = [
  {
    id: 'auction-001',
    title: 'A. Lange & Söhne Datograph',
    description: 'Platinum case, black dial. Reference 403.035. Complete with original box and papers.',
    currentAsk: '₹24,17,000', // ~$29,000 (reduced)
    closingIn: '00:04:12',
    progressPercentage: 85,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBO1DX2P9y4CRKbeqmFsUN8Sm28ldyeDNvre4CGrzXXeAoe8ktB-1a4WgqJKCBD5DGOOaoT-yhxBnC0vhiWBHsk2hdxQqPCWWU9pJp5OZqBkz7zQgxMf-sZG4lJ9Sco1oLSy21KCZFyPn8KGaTQdBJhvKkQBA8BLgZ1kluHwx8oGNHBZxhSO-Mfd59c7o_eg6ynv-bJPf25DOX_Z7Ixwf-OG8y_RMKTGOpDxiNym-NzrFoevTf04GdHNw',
    imageAlt: 'Macro photography of a luxury Swiss chronograph watch face. Intricate gears visible, brushed steel and dark carbon fiber textures.',
    status: 'live',
  },
  {
    id: 'auction-002',
    title: '1962 Ferrari 250 GTO Spec',
    description: 'Immaculate restoration. Matching numbers. Eligible for Mille Miglia.',
    currentAsk: '₹2,41,70,00', // ~$290,000 (reduced)
    closingIn: '00:12:45',
    progressPercentage: 60,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDGTFUpZc_UzS4RoxqIEAHevcJ_LehR39HTF0AAyP8CyiqEBgSuJYcBgVFi_FXe9MBnSBZLv6U5Yav8d6iEwhtZ9Txz-C25cHu2zDKrSAyS9wXRVvddz5NCHV_9Prs7-onaH4pDyfN0nm7RY5TFzEbFdLzMpwWWxDGIMWpD4opD2AXg5nTF45TLjRCslXr6krzrQll9L6ny4CSaahokUmOzqqTVVZqcYO0-fvQG102Iqr9C78ks246zLg',
    imageAlt: 'A pristine, vintage 1960s sports car dashboard. Analog dials glowing faintly in the dark.',
    status: 'live',
  },
  {
    id: 'auction-003',
    title: 'Genesis Block Artefact #004',
    description: 'Verified digital original. Transferred directly from cold storage.',
    currentAsk: '₹40,25,000',
    closingIn: '00:01:09',
    progressPercentage: 95,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAKN8XxVQickP8I6N3vPaRq9r7kRI_w7_wtxc-zG1MEVgWBMUwmYzzgLe0fOxmpfuV8JvToRg5M5PmD8yhr2ykDKqpiLNx0Fs5sI5EVZPv7DxzJ5rhwgm_q5dHwVsNh0k50zQRHmgRMpaGeFOxozxI83WpePXMwy4zlVaZfM4qzKmpABVprHGevqEebXnC_8Pl3HB3ZENYLkCk4O9IA3Tek4NkOFtxiG08fM2k0ukPeIrrXHqXv8wXgLg',
    imageAlt: 'A glowing, holographic display of a rare digital asset or cryptograph. High-tech, dark cyberpunk aesthetic.',
    status: 'live',
  },
];

export const heroBackgroundImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCY6HitGo7yrTvjtMzQynrQTPQGwNn0ueo3xyVUtGFi1V9HORnc8zf2knfDExe47cD8qrEPk20z58oRbe7492dZaUwP2MLhhpfmJqbKhaPYsvWXk9Kwu1mYR0KHNO-IZrP85i3uAZN3bmNg34-GYLqZa-lPyBUHJ-Rxdp09NOdhMkeI0hWSvTkhXijqTKP7bVkGfkX-6wwqQGuNVk9RcoM4fqldbgGw3dsFQl9ejzc67LDvuHSc5d02lw';
