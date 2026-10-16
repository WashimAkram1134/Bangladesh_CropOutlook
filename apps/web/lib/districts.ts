/**
 * Static district reference data — Bangladesh Crop Outlook
 * 64 administrative districts of Bangladesh.
 * Source: Bangladesh Bureau of Statistics administrative boundaries.
 */
import type { District } from './types';

export const DISTRICTS: District[] = [
  // Dhaka Division
  { id: 'dhaka', name: 'Dhaka', nameBn: 'ঢাকা', division: 'Dhaka', areaKm2: 1463.6 },
  { id: 'faridpur', name: 'Faridpur', nameBn: 'ফরিদপুর', division: 'Dhaka', areaKm2: 2073.0 },
  { id: 'gazipur', name: 'Gazipur', nameBn: 'গাজীপুর', division: 'Dhaka', areaKm2: 1806.4 },
  { id: 'gopalganj', name: 'Gopalganj', nameBn: 'গোপালগঞ্জ', division: 'Dhaka', areaKm2: 1490.3 },
  { id: 'kishoreganj', name: 'Kishoreganj', nameBn: 'কিশোরগঞ্জ', division: 'Dhaka', areaKm2: 2688.8 },
  { id: 'madaripur', name: 'Madaripur', nameBn: 'মাদারীপুর', division: 'Dhaka', areaKm2: 1143.5 },
  { id: 'manikganj', name: 'Manikganj', nameBn: 'মানিকগঞ্জ', division: 'Dhaka', areaKm2: 1386.9 },
  { id: 'munshiganj', name: 'Munshiganj', nameBn: 'মুন্সিগঞ্জ', division: 'Dhaka', areaKm2: 954.9 },
  { id: 'narayanganj', name: 'Narayanganj', nameBn: 'নারায়ণগঞ্জ', division: 'Dhaka', areaKm2: 759.6 },
  { id: 'narsingdi', name: 'Narsingdi', nameBn: 'নরসিংদী', division: 'Dhaka', areaKm2: 1144.9 },
  { id: 'rajbari', name: 'Rajbari', nameBn: 'রাজবাড়ী', division: 'Dhaka', areaKm2: 1118.8 },
  { id: 'shariatpur', name: 'Shariatpur', nameBn: 'শরীয়তপুর', division: 'Dhaka', areaKm2: 1182.7 },
  { id: 'tangail', name: 'Tangail', nameBn: 'টাঙ্গাইল', division: 'Dhaka', areaKm2: 3414.3 },
  // Chittagong Division
  { id: 'bandarban', name: 'Bandarban', nameBn: 'বান্দরবান', division: 'Chittagong', areaKm2: 4479.0 },
  { id: 'brahmanbaria', name: 'Brahmanbaria', nameBn: 'ব্রাহ্মণবাড়িয়া', division: 'Chittagong', areaKm2: 1927.1 },
  { id: 'chandpur', name: 'Chandpur', nameBn: 'চাঁদপুর', division: 'Chittagong', areaKm2: 1704.0 },
  { id: 'chittagong', name: 'Chittagong', nameBn: 'চট্টগ্রাম', division: 'Chittagong', areaKm2: 5282.9 },
  { id: 'comilla', name: 'Comilla', nameBn: 'কুমিল্লা', division: 'Chittagong', areaKm2: 3085.7 },
  { id: 'coxsbazar', name: "Cox's Bazar", nameBn: "কক্সবাজার", division: 'Chittagong', areaKm2: 2491.9 },
  { id: 'feni', name: 'Feni', nameBn: 'ফেনী', division: 'Chittagong', areaKm2: 929.5 },
  { id: 'khagrachhari', name: 'Khagrachhari', nameBn: 'খাগড়াছড়ি', division: 'Chittagong', areaKm2: 2699.6 },
  { id: 'lakshmipur', name: 'Lakshmipur', nameBn: 'লক্ষ্মীপুর', division: 'Chittagong', areaKm2: 1535.7 },
  { id: 'noakhali', name: 'Noakhali', nameBn: 'নোয়াখালী', division: 'Chittagong', areaKm2: 3600.7 },
  { id: 'rangamati', name: 'Rangamati', nameBn: 'রাঙ্গামাটি', division: 'Chittagong', areaKm2: 6116.1 },
  // Rajshahi Division
  { id: 'bogura', name: 'Bogura', nameBn: 'বগুড়া', division: 'Rajshahi', areaKm2: 2919.9 },
  { id: 'chapainawabganj', name: 'Chapainawabganj', nameBn: 'চাঁপাইনবাবগঞ্জ', division: 'Rajshahi', areaKm2: 1703.2 },
  { id: 'joypurhat', name: 'Joypurhat', nameBn: 'জয়পুরহাট', division: 'Rajshahi', areaKm2: 965.0 },
  { id: 'naogaon', name: 'Naogaon', nameBn: 'নওগাঁ', division: 'Rajshahi', areaKm2: 3435.7 },
  { id: 'natore', name: 'Natore', nameBn: 'নাটোর', division: 'Rajshahi', areaKm2: 1905.0 },
  { id: 'pabna', name: 'Pabna', nameBn: 'পাবনা', division: 'Rajshahi', areaKm2: 2371.5 },
  { id: 'rajshahi', name: 'Rajshahi', nameBn: 'রাজশাহী', division: 'Rajshahi', areaKm2: 2407.0 },
  { id: 'sirajganj', name: 'Sirajganj', nameBn: 'সিরাজগঞ্জ', division: 'Rajshahi', areaKm2: 2497.9 },
  // Khulna Division
  { id: 'bagerhat', name: 'Bagerhat', nameBn: 'বাগেরহাট', division: 'Khulna', areaKm2: 3959.1 },
  { id: 'chuadanga', name: 'Chuadanga', nameBn: 'চুয়াডাঙ্গা', division: 'Khulna', areaKm2: 1174.1 },
  { id: 'jessore', name: 'Jessore', nameBn: 'যশোর', division: 'Khulna', areaKm2: 2567.5 },
  { id: 'jhenaidah', name: 'Jhenaidah', nameBn: 'ঝিনাইদহ', division: 'Khulna', areaKm2: 1963.9 },
  { id: 'khulna', name: 'Khulna', nameBn: 'খুলনা', division: 'Khulna', areaKm2: 4394.5 },
  { id: 'kushtia', name: 'Kushtia', nameBn: 'কুষ্টিয়া', division: 'Khulna', areaKm2: 1621.2 },
  { id: 'magura', name: 'Magura', nameBn: 'মাগুরা', division: 'Khulna', areaKm2: 1048.6 },
  { id: 'meherpur', name: 'Meherpur', nameBn: 'মেহেরপুর', division: 'Khulna', areaKm2: 751.6 },
  { id: 'narail', name: 'Narail', nameBn: 'নড়াইল', division: 'Khulna', areaKm2: 990.2 },
  { id: 'satkhira', name: 'Satkhira', nameBn: 'সাতক্ষীরা', division: 'Khulna', areaKm2: 3858.3 },
  // Barisal Division
  { id: 'barguna', name: 'Barguna', nameBn: 'বরগুনা', division: 'Barisal', areaKm2: 1831.3 },
  { id: 'barisal', name: 'Barisal', nameBn: 'বরিশাল', division: 'Barisal', areaKm2: 2784.5 },
  { id: 'bhola', name: 'Bhola', nameBn: 'ভোলা', division: 'Barisal', areaKm2: 3403.5 },
  { id: 'jhalokati', name: 'Jhalokati', nameBn: 'ঝালকাঠি', division: 'Barisal', areaKm2: 722.3 },
  { id: 'patuakhali', name: 'Patuakhali', nameBn: 'পটুয়াখালী', division: 'Barisal', areaKm2: 3221.3 },
  { id: 'pirojpur', name: 'Pirojpur', nameBn: 'পিরোজপুর', division: 'Barisal', areaKm2: 1276.5 },
  // Sylhet Division
  { id: 'habiganj', name: 'Habiganj', nameBn: 'হবিগঞ্জ', division: 'Sylhet', areaKm2: 2636.6 },
  { id: 'moulvibazar', name: 'Moulvibazar', nameBn: 'মৌলভীবাজার', division: 'Sylhet', areaKm2: 2799.4 },
  { id: 'sunamganj', name: 'Sunamganj', nameBn: 'সুনামগঞ্জ', division: 'Sylhet', areaKm2: 3747.2 },
  { id: 'sylhet', name: 'Sylhet', nameBn: 'সিলেট', division: 'Sylhet', areaKm2: 3490.4 },
  // Rangpur Division
  { id: 'dinajpur', name: 'Dinajpur', nameBn: 'দিনাজপুর', division: 'Rangpur', areaKm2: 3438.7 },
  { id: 'gaibandha', name: 'Gaibandha', nameBn: 'গাইবান্ধা', division: 'Rangpur', areaKm2: 2178.7 },
  { id: 'kurigram', name: 'Kurigram', nameBn: 'কুড়িগ্রাম', division: 'Rangpur', areaKm2: 2296.1 },
  { id: 'lalmonirhat', name: 'Lalmonirhat', nameBn: 'লালমনিরহাট', division: 'Rangpur', areaKm2: 1234.4 },
  { id: 'nilphamari', name: 'Nilphamari', nameBn: 'নীলফামারী', division: 'Rangpur', areaKm2: 1542.8 },
  { id: 'panchagarh', name: 'Panchagarh', nameBn: 'পঞ্চগড়', division: 'Rangpur', areaKm2: 1404.6 },
  { id: 'rangpur', name: 'Rangpur', nameBn: 'রংপুর', division: 'Rangpur', areaKm2: 2308.3 },
  { id: 'thakurgaon', name: 'Thakurgaon', nameBn: 'ঠাকুরগাঁও', division: 'Rangpur', areaKm2: 1808.3 },
  // Mymensingh Division
  { id: 'jamalpur', name: 'Jamalpur', nameBn: 'জামালপুর', division: 'Mymensingh', areaKm2: 2031.1 },
  { id: 'mymensingh', name: 'Mymensingh', nameBn: 'ময়মনসিংহ', division: 'Mymensingh', areaKm2: 4363.5 },
  { id: 'netrokona', name: 'Netrokona', nameBn: 'নেত্রকোণা', division: 'Mymensingh', areaKm2: 2810.3 },
  { id: 'sherpur', name: 'Sherpur', nameBn: 'শেরপুর', division: 'Mymensingh', areaKm2: 1364.7 },
];

export function getDistrictById(id: string): District | undefined {
  return DISTRICTS.find((d) => d.id === id);
}

export function getDistrictsByDivision(): Record<string, District[]> {
  return DISTRICTS.reduce(
    (acc, d) => {
      if (!acc[d.division]) acc[d.division] = [];
      acc[d.division].push(d);
      return acc;
    },
    {} as Record<string, District[]>
  );
}
