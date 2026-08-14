export const formatSGD = (n: number) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(n);

export const calcPSF = (price: number, sqft: number) =>
  sqft > 0 ? Math.round(price / sqft) : 0;

export const districtName: Record<number, string> = {
  1: 'Raffles Place/Marina', 2: 'Chinatown/Tanjong Pagar',
  3: 'Alexandra/Commonwealth', 4: 'Harbourfront/Sentosa',
  5: 'Buona Vista/Clementi', 6: 'City Hall/Clarke Quay',
  7: 'Beach Road/Bugis', 8: 'Farrer Park',
  9: 'Orchard/River Valley', 10: 'Tanglin/Holland',
  11: 'Newton/Novena', 12: 'Balestier/Toa Payoh',
  13: 'Macpherson/Braddell', 14: 'Geylang/Paya Lebar',
  15: 'East Coast/Marine Parade', 16: 'Bedok',
  17: 'Changi/Pasir Ris', 18: 'Tampines',
  19: 'Hougang/Punggol/Sengkang', 20: 'Ang Mo Kio/Bishan',
  21: 'Clementi Park/Upper Bukit Timah', 22: 'Jurong',
  23: 'Bukit Batok/Choa Chu Kang', 24: 'Lim Chu Kang/Tengah',
  25: 'Woodlands/Admiralty', 26: 'Mandai/Upper Thomson',
  27: 'Sembawang/Yishun', 28: 'Seletar/Yio Chu Kang',
};

export const districtOptions = Object.entries(districtName).map(([k, v]) => ({
  value: parseInt(k),
  label: `D${k.padStart(2, '0')} ${v}`,
}));

export const propertyTypes = [
  'HDB', 'Condo', 'Landed', 'Commercial',
  'Industrial', 'Conservation Shophouse', 'New Launch', 'Investment',
];

export const waLink = (phone: string, message: string) =>
  `https://wa.me/65${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

export const trackView = async (id: string, supabase: any) => {
  const key = `viewed_${id}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  await supabase.rpc('increment_view_count', { property_uuid: id });
};

export const formatSize = (bytes: number) =>
  bytes < 1048576
    ? (bytes / 1024).toFixed(0) + ' KB'
    : (bytes / 1048576).toFixed(1) + ' MB';

export const relativeTime = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
};
