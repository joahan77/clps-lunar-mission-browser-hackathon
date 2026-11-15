export interface DataPoint {
  time: string;
  utc?: string;
  sunElevation: number;
  sunAzimuth?: number;
  earthElevation: number;
  earthAzimuth?: number;
  solarIrradiance?: number;
  batteryLevel?: number;
  dataRate?: number;
  commsStatus?: string;
  sunVisible?: boolean;
  earthVisible?: boolean;
  terrainHorizon?: number;
  maxSurfaceTempK?: number | null;
  averageSlopeDeg?: number | null;
  illuminationPct?: number | null;
  waterIcePct?: number | null;
}

export interface SiteSummary {
  totalHours: number;
  sunHours: number;
  sunPercent: number;
  commsHours: number;
  commsUptimePercent: number;
  avgSolarIrradiance: number;
  minSunElevation: number;
  maxSunElevation: number;
  minEarthElevation: number;
  maxEarthElevation: number;
  maxSurfaceTempK?: number | null;
  averageSlopeDeg?: number | null;
  illuminationPct?: number | null;
  waterIcePct?: number | null;
}

export interface LandingSite {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  description: string;
  dataFile: string;
  heightmapUrl: string;
  summary?: SiteSummary;
}

export const landingSites: LandingSite[] = [
  {
    id: 'shackleton',
    name: 'Shackleton Crater',
    label: 'Site 01: Shackleton',
    lat: -89.9,
    lon: 0.0,
    description: 'Lunar South Pole rim with near-permanent solar illumination peaks and cold trap craters.',
    dataFile: 'shackleton_data.json',
    heightmapUrl: '/heightmaps/shackleton_heightmap.png',
  },
  {
    id: 'malapert',
    name: 'Malapert Mountain',
    label: 'Site 02: Malapert',
    lat: -86.0,
    lon: -2.9,
    description: 'High-elevation massif with continuous line-of-sight communication to Earth.',
    dataFile: 'malapert_data.json',
    heightmapUrl: '/heightmaps/malapert_heightmap.png',
  },
  {
    id: 'de_gerlache',
    name: 'de Gerlache Rim',
    label: 'Site 03: de Gerlache',
    lat: -88.5,
    lon: -87.1,
    description: 'Connecting ridge between de Gerlache and Shackleton, target for robotic landers.',
    dataFile: 'de_gerlache_data.json',
    heightmapUrl: '/heightmaps/de_gerlache_heightmap.png',
  },
  {
    id: 'mons_mouton',
    name: 'Mons Mouton',
    label: 'Site 04: Mons Mouton',
    lat: -85.5,
    lon: 32.7,
    description: 'Broad elevated plateau with high solar visibility adjacent to South Pole-Aitken basin.',
    dataFile: 'mons_mouton_data.json',
    heightmapUrl: '/heightmaps/mons_mouton_heightmap.png',
  },
  {
    id: 'nobile_rim',
    name: 'Nobile Rim',
    label: 'Site 05: Nobile Rim',
    lat: -85.4,
    lon: 53.5,
    description: 'VIPER rover exploration target with permanently shadowed regions and volatile deposits.',
    dataFile: 'nobile_rim_data.json',
    heightmapUrl: '/heightmaps/nobile_rim_heightmap.png',
  },
  {
    id: 'haworth',
    name: 'Haworth Crater',
    label: 'Site 06: Haworth',
    lat: -87.4,
    lon: -4.0,
    description: 'Deep permanently shadowed crater floor harboring significant lunar water ice deposits.',
    dataFile: 'haworth_data.json',
    heightmapUrl: '/heightmaps/haworth_heightmap.png',
  },
  {
    id: 'cabeus_b',
    name: 'Cabeus B',
    label: 'Site 07: Cabeus B',
    lat: -86.0,
    lon: -42.0,
    description: 'High-interest scientific site near LCROSS impact zone rich in subsurface hydrogen.',
    dataFile: 'cabeus_b_data.json',
    heightmapUrl: '/heightmaps/cabeus_b_heightmap.png',
  },
  {
    id: 'slater_plain',
    name: 'Slater Plain',
    label: 'Site 08: Slater Plain',
    lat: -86.0,
    lon: -20.0,
    description: 'Relatively smooth transit corridor between Faustini and Amundsen craters.',
    dataFile: 'slater_plain_data.json',
    heightmapUrl: '/heightmaps/slater_plain_heightmap.png',
  },
  {
    id: 'apollo_11',
    name: 'Apollo 11',
    label: 'Apollo 11',
    lat: 0.674,
    lon: 23.473,
    description: 'Historic first crewed lunar landing site in Mare Tranquillitatis.',
    dataFile: 'apollo_11_data.json',
    heightmapUrl: '/heightmaps/apollo_11_heightmap.png',
  },
  {
    id: 'apollo_17',
    name: 'Apollo 17',
    label: 'Apollo 17',
    lat: 20.190,
    lon: 30.772,
    description: 'Final Apollo mission exploration of Taurus-Littrow highland valley.',
    dataFile: 'apollo_17_data.json',
    heightmapUrl: '/heightmaps/apollo_17_heightmap.png',
  },
  {
    id: 'change_4',
    name: "Chang'e 4",
    label: "Chang'e 4",
    lat: -45.5,
    lon: 177.6,
    description: 'First soft landing on the lunar farside within Von Kármán crater.',
    dataFile: 'change_4_data.json',
    heightmapUrl: '/heightmaps/change_4_heightmap.png',
  },
  {
    id: 'luna_9',
    name: 'Luna 9',
    label: 'Luna 9',
    lat: 7.13,
    lon: -64.37,
    description: 'First spacecraft to achieve a soft touchdown on the Moon, Oceanus Procellarum.',
    dataFile: 'luna_9_data.json',
    heightmapUrl: '/heightmaps/luna_9_heightmap.png',
  },
  {
    id: 'chandrayaan_3',
    name: 'Chandrayaan-3',
    label: 'Chandrayaan-3',
    lat: -69.37,
    lon: 32.32,
    description: 'ISRO Vikram lander touchdown site at Shiv Shakti Point near Manzinus crater.',
    dataFile: 'chandrayaan_3_data.json',
    heightmapUrl: '/heightmaps/chandrayaan_3_heightmap.png',
  },
  {
    id: 'im_1_odysseus',
    name: 'IM-1 Odysseus',
    label: 'IM-1 Odysseus',
    lat: -80.13,
    lon: 1.44,
    description: 'Intuitive Machines CLPS robotic commercial landing near Malapert A crater.',
    dataFile: 'im_1_odysseus_data.json',
    heightmapUrl: '/heightmaps/im_1_odysseus_heightmap.png',
  },
];
