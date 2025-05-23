'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3';
// @ts-ignore
import { geoEquirectangular } from 'd3-geo-projection';
import { X, Menu, GripHorizontal, Shirt, ShoppingBag, Crown, Layers, Footprints } from 'lucide-react';
import { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import * as topojson from 'topojson-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import Draggable from 'react-draggable';
import Masonry from 'react-masonry-css';
import { motion } from "framer-motion";
import type { LatLngExpression } from 'leaflet';

// Leafletのスタイルをクライアントサイドでのみ読み込む
const LeafletStyles = () => {
  useEffect(() => {
    // CSSをlinkタグで読み込む
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);
  return null;
};

// Leafletコンポーネントを動的インポート
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

// MapControlsコンポーネントを動的インポート
const MapControls = dynamic(
  () => import('./components/MapControls').then((mod) => mod.default),
  { ssr: false }
);

// マーカーアイコンの設定をクライアントサイドでのみ行う
const setupMarkerIcon = () => {
  if (typeof window !== 'undefined') {
    const L = require('leaflet');
    const defaultIcon = L.icon({
      iconUrl: '/images/marker-icon.png',
      iconRetinaUrl: '/images/marker-icon-2x.png',
      shadowUrl: '/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = defaultIcon;
  }
};

// カスタムフック: ウィンドウサイズを監視
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    // ウィンドウのリサイズをハンドリング
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // リスナーを追加
    window.addEventListener('resize', handleResize);
    
    // 初期値設定
    handleResize();
    
    // クリーンアップ
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

// 型定義
interface CountryData {
  id: string;
  name: string;
  code: string;
  fashionPopularity: number;
  weather: string;
  temperature: number;
  humidity: number;
  // 3つのデータセットを保持するように変更
  fashionData: {
    name: string;
  value: number;
  }[];
  colorData: {
    name: string;
    value: number;
  }[];
  womenFashionData: {
    name: string;
  value: number;
  }[];
  menFashionData: {
    name: string;
    value: number;
  }[];
}

interface PinData {
    name: string;
  lat: number;
  lon: number;
}

interface ImageCard {
  id: number;
  src: string;
  alt: string;
  title: string;
  height: number;
}

// グローバル変数として地図の変換状態を保存
let globalMapTransform: any = null;
// ズーム状態も別途保存
let globalZoomScale: number = 1;
// 最後のマウス操作時間を追跡
let lastInteractionTime: number = 0;

// WorldMapコンポーネントを更新
const WorldMap = ({ 
  onCountrySelect, 
  pins,
  selectedCountryName
}: { 
  onCountrySelect: (name: string) => void,
  pins: PinData[],
  selectedCountryName: string | null
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setupMarkerIcon();
  }, []);

  if (!isClient) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#68a0e8',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        fontSize: '18px'
      }}>
        Loading map...
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      backgroundColor: '#68a0e8',
      borderRadius: '0',
      overflow: 'hidden'
    }}>
      <LeafletStyles />
      <MapContainer
        center={[20, 0] as LatLngExpression}
        zoom={2}
        style={{ width: '100%', height: '100%' }}
        minZoom={2}
        maxZoom={8}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapControls onCountrySelect={onCountrySelect} />
        
        {pins.map((pin) => (
          <Marker
            key={pin.name}
            position={[pin.lat, pin.lon] as LatLngExpression}
            eventHandlers={{
              click: () => onCountrySelect(pin.name)
            }}
          >
            <Popup>{pin.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

WorldMap.displayName = "WorldMap";

// ファッション画像のカテゴリー
const fashionCategories = [
  "Outer", "Formal", "Sports", "Street", "Outdoor", 
  "Vintage", "Mode", "Gothic", "Lolita", "Hip Hop",
  "Surf", "Military", "Trod", "Minimal", "Esnek",
  "Retro", "Punk", "Rock", "Garry", "Monoton"
];

// ファッションアイテムのアイコンURL
const fashionItemIcons = {
  hat: "/images/hat.png", // 帽子アイコン
  outer: "/images/autor.png", // アウターアイコン
  inner: "/images/shrit.png", // インナーアイコン
  bottoms: "/images/pants.png", // ボトムスアイコン
  shoes: "/images/shoes.png" // 靴アイコン
};

// 全てのカテゴリーとサフィックスの組み合わせを使うように改良したタイトル生成関数
const generateAllPossibleTitles = () => {
  const titles: string[] = [];
  
  // 全てのカテゴリーとサフィックスの組み合わせを生成
  for (const category of fashionCategories) {
    const suffixes = ["Coord", "Style", "Fashion", "Look", "Trend", "Snap"];
    for (const suffix of suffixes) {
      titles.push(`${category} ${suffix}`);
    }
  }
  
  // タイトルをシャッフル
  return [...titles].sort(() => Math.random() - 0.5);
};

// 画像カードデータ - 約100個に増やす
const generateImageCards = (): ImageCard[] => {
  const cards: ImageCard[] = [];
  
  // ギャラリー画像のパスを定義（実際のファイル名を使用）
  const galleryImages = [
    "/images/gallery/バッグ_000006.jpg",
    "/images/gallery/包包_000042.jpg",
    "/images/gallery/包包_000045.jpg",
    "/images/gallery/กระเป๋า_000001.jpg",
    "/images/gallery/กระเป๋า_000011.jpg",
    "/images/gallery/กระเป๋า_000031.jpg",
    "/images/gallery/शॉपिंग बैग_000035.jpg",
    "/images/gallery/बैग_000022.jpg",
    "/images/gallery/बैग_000062.jpg",
    "/images/gallery/बैग_000070.jpg",
    "/images/gallery/حقيبة_000028.jpg",
    "/images/gallery/حقيبة_000085.jpg",
    "/images/gallery/Сумка_000021.jpg",
    "/images/gallery/Сумка для покупок_000056.jpg",
    "/images/gallery/Çanta_000004.jpg",
    "/images/gallery/Túi xách_000031.jpg",
    "/images/gallery/Túi xách_000051.jpg",
    "/images/gallery/Tasche_000052.jpg",
    "/images/gallery/Schal_000009.jpg",
    "/images/gallery/Schal_000028.jpg",
    "/images/gallery/Schal_000048.jpg",
    "/images/gallery/स्कार्फ़_000001.jpg",
    "/images/gallery/स्कार्फ़_000019.jpg",
    "/images/gallery/स्कार्फ़_000041.jpg",
    "/images/gallery/وشاح_000032.jpg",
    "/images/gallery/Шарф_000015.jpg",
    "/images/gallery/Шарф_000020.jpg",
    "/images/gallery/Шарф_000026.jpg",
    "/images/gallery/Écharpe_000056.jpg",
    "/images/gallery/夹克_000008.jpg",
    "/images/gallery/夹克_000013.jpg",
    "/images/gallery/夹克_000014.jpg",
    "/images/gallery/夹克_000030.jpg",
    "/images/gallery/夹克_000033.jpg",
    "/images/gallery/แจ็กเก็ต_000054.jpg",
    "/images/gallery/Μπουφάν_000017.jpg",
    "/images/gallery/Μπουφάν_000039.jpg",
    "/images/gallery/Veste_000018.jpg",
    "/images/gallery/Veste_000021.jpg",
    "/images/gallery/Veste_000024.jpg",
    "/images/gallery/Veste_000039.jpg",
    "/images/gallery/Takki_000034.jpg",
    "/images/gallery/패딩_000026.jpg",
    "/images/gallery/패딩_000037.jpg",
    "/images/gallery/ダウンジャケット_000026.jpg",
    "/images/gallery/डाउन जैकेट_000047.jpg",
    "/images/gallery/Пуховик_000009.jpg",
    "/images/gallery/Пуховик_000015.jpg",
    "/images/gallery/Пуховик_000036.jpg",
    "/images/gallery/Μπουφάν πούπουλο_000009.jpg",
    "/images/gallery/down_jackets_000010.jpg",
    "/images/gallery/down_jackets_000032.jpg",
    "/images/gallery/down_jackets_000070.jpg",
    "/images/gallery/コート_000001.jpg",
    "/images/gallery/大衣_000040.jpg",
    "/images/gallery/डाउन कोट_000030.jpg",
    "/images/gallery/डाउन कोट_000035.jpg",
    "/images/gallery/कोट_000013.jpg",
    "/images/gallery/Áo khoác lông vũ_000026.jpg",
    "/images/gallery/Áo khoác lông vũ dài_000060.jpg",
    "/images/gallery/Áo khoác len_000011.jpg",
    "/images/gallery/Áo khoác len_000041.jpg",
    "/images/gallery/ブラトップ_000025.jpg",
    "/images/gallery/ブラトップ_000063.jpg",
    "/images/gallery/브라탑_000011.jpg",
    "/images/gallery/브라탑_000042.jpg",
    "/images/gallery/브라탑_000045.jpg",
    "/images/gallery/브라탑_000055.jpg",
    "/images/gallery/توب حمالة الصدر_000005.jpg",
    "/images/gallery/توب حمالة الصدر_000045.jpg",
    "/images/gallery/Top de sujetador_000005.jpg",
    "/images/gallery/Top de sujetador_000037.jpg",
    "/images/gallery/Top de sujetador_000047.jpg",
    "/images/gallery/Top con reggiseno_000039.jpg",
    "/images/gallery/Top con reggiseno_000048.jpg",
    "/images/gallery/Top con reggiseno_000052.jpg",
    "/images/gallery/Áo ngực thể thao_000009.jpg",
    "/images/gallery/Áo ngực thể thao_000016.jpg",
    "/images/gallery/キャミソール_000057.jpg",
    "/images/gallery/캐미솔_000052.jpg",
    "/images/gallery/Áo len_000002.jpg",
    "/images/gallery/Áo len_000004.jpg",
    "/images/gallery/Áo len_000015.jpg",
    "/images/gallery/Áo thun dài tay_000011.jpg",
    "/images/gallery/Áo thun dài tay_000031.jpg",
    "/images/gallery/Áo thun dài tay_000039.jpg",
    "/images/gallery/Áo sơ mi_000045.jpg",
    "/images/gallery/Áo gi-lê_000005.jpg"
  ];

  // 画像をシャッフル
  const shuffledImages = [...galleryImages].sort(() => Math.random() - 0.5);
  
  // 利用可能な画像の数だけカードを生成（最大100枚）
  const numberOfCards = Math.min(100, shuffledImages.length);
  for (let i = 0; i < numberOfCards; i++) {
    cards.push({
      id: i + 1,
      src: shuffledImages[i],
      alt: `Fashion Item ${i + 1}`,
      title: "", // タイトルを空文字列に設定
      height: 300 // 固定の高さを使用
    });
  }
  
  return cards;
};

// 画像カードを一度だけ生成して使いまわす
const FIXED_IMAGE_CARDS: ImageCard[] = generateImageCards();

const GlobalStyle = () => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap');
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translate(-50%, -40%); }
      to { opacity: 1; transform: translate(-50%, -50%); }
    }
    
    body {
      margin: 0;
      padding: 0;
      overflow: auto;
      font-family: Arial, Helvetica, sans-serif;
    }
    
    * {
      box-sizing: border-box;
    }
    
    /* マソンリーグリッドのスタイル */
    .my-masonry-grid {
      display: flex;
      margin-left: -15px;
      width: auto;
    }
    
    .my-masonry-grid_column {
      padding-left: 15px;
      background-clip: padding-box;
    }
    
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 10px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
    
    .no-focus-outline {
      outline: none !important;
    }
    
    .recharts-sector:focus {
      outline: none !important;
    }
    
    .recharts-sector:active {
      outline: none !important;
    }
    
    .recharts-surface:focus {
      outline: none !important;
    }
    
    .recharts-wrapper {
      outline: none !important;
    }
    
    *:focus {
      outline: none !important;
    }
  `}</style>
);

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [navbarActive, setNavbarActive] = useState(false);
  const [animateChart, setAnimateChart] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // ウィンドウサイズを取得
  const windowSize = useWindowSize();
  // 小さい画面かどうか - ブレークポイントを調整
  const isSmallScreen = windowSize.width < 992; // 768px → 992pxに変更してより広い範囲をsmallとして扱う
  
  // クライアントサイドでのみレンダリングされるようにするためのフラグ
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // ピンのデータ
  const pins: PinData[] = [
    { name: "United Kingdom", lat: 51.5074, lon: -0.1278 },
    { name: "China", lat: 39.9042, lon: 116.4074 },
    { name: "South Korea", lat: 37.5665, lon: 126.9780 },
    { name: "Japan", lat: 35.6895, lon: 139.6917 },
    { name: "United States", lat: 38.9072, lon: -77.0369 }
  ];

  // ナビバーの開閉
  const toggleNavbar = () => {
    setNavbarActive(!navbarActive);
  };

  // この部分を追加：ESCキーハンドラーの参照を保持
  const escKeyHandler = useRef<((e: KeyboardEvent) => void) | null>(null);

  // 国を選択した時の処理
  const selectCountry = (name: string) => {
    // 前回選択した国と同じ場合はアニメーションをスキップ
    if (selectedCountry && selectedCountry.name === name) {
      return;
    }
    
    // 初期表示時にanimateChartをfalseに設定
    setAnimateChart(false);
    
    // アニメーションキーを更新
    setAnimationKey(prev => prev + 1);
    
    // ランダムなデータを生成
    const fashionPopularity = Math.floor(Math.random() * 100);
    
    // 国コードを設定（サンプル）
    let countryCode = "";
    
    // 国名から国コードへのマッピング（ISO 3166-1 alpha-2）
    const countryNameToCode: {[key: string]: string} = {
      // 北米
      "United States": "US",
      "USA": "US",
      "United States of America": "US",
      "U.S.A.": "US",
      "U.S.": "US",
      "America": "US",
      "Canada": "CA",
      "Mexico": "MX",
      "Cuba": "CU",
      "Puerto Rico": "PR",
      "Jamaica": "JM",
      "Haiti": "HT",
      "Bahamas": "BS",
      "Dominican Republic": "DO",
      "Dominica": "DM",
      "Panama": "PA",
      "Costa Rica": "CR",
      "Nicaragua": "NI",
      "Honduras": "HN",
      "El Salvador": "SV",
      "Guatemala": "GT",
      "Belize": "BZ",
      
      // 南米
      "Brazil": "BR",
      "Argentina": "AR",
      "Chile": "CL",
      "Peru": "PE",
      "Colombia": "CO",
      "Venezuela": "VE",
      "Ecuador": "EC",
      "Bolivia": "BO",
      "Paraguay": "PY",
      "Uruguay": "UY",
      "Guyana": "GY",
      "Suriname": "SR",
      "French Guiana": "GF",
      "Falkland Islands": "FK",
      
      // ヨーロッパ
      "United Kingdom": "GB",
      "France": "FR",
      "Germany": "DE",
      "Italy": "IT",
      "Spain": "ES",
      "Portugal": "PT",
      "Netherlands": "NL",
      "Belgium": "BE",
      "Switzerland": "CH",
      "Austria": "AT",
      "Sweden": "SE",
      "Norway": "NO",
      "Denmark": "DK",
      "Finland": "FI",
      "Ireland": "IE",
      "Greece": "GR",
      "Poland": "PL",
      "Czech Republic": "CZ",
      "Hungary": "HU",
      "Romania": "RO",
      "Ukraine": "UA",
      "Russia": "RU",
      "Luxembourg": "LU",
      "Slovenia": "SI",
      "Croatia": "HR",
      "Lithuania": "LT",
      "Estonia": "EE",
      "Latvia": "LV",
      "Belarus": "BY",
      "Bosnia and Herzegovina": "BA",
      "Moldova": "MD",
      "Albania": "AL",
      "Kosovo": "XK",
      "North Macedonia": "MK",
      "Bulgaria": "BG",
      "Slovakia": "SK",
      "Iceland": "IS",
      "Greenland": "GL",
      "Montenegro": "ME",
      "Serbia": "RS",
      "Vatican City": "VA",
      "Andorra": "AD",
      "Monaco": "MC",
      "Liechtenstein": "LI",
      "San Marino": "SM",
      
      // アジア
      "Japan": "JP",
      "China": "CN",
      "South Korea": "KR",
      "North Korea": "KP",
      "India": "IN",
      "Pakistan": "PK",
      "Bangladesh": "BD",
      "Vietnam": "VN",
      "Thailand": "TH",
      "Malaysia": "MY",
      "Indonesia": "ID",
      "Philippines": "PH",
      "Singapore": "SG",
      "Turkey": "TR",
      "Iran": "IR",
      "Iraq": "IQ",
      "Saudi Arabia": "SA",
      "Israel": "IL",
      "Syria": "SY",
      "Jordan": "JO",
      "Lebanon": "LB",
      "Yemen": "YE",
      "Oman": "OM",
      "United Arab Emirates": "AE",
      "Qatar": "QA",
      "Kuwait": "KW",
      "Bahrain": "BH",
      "Afghanistan": "AF",
      "Nepal": "NP",
      "Sri Lanka": "LK",
      "Bhutan": "BT",
      "Maldives": "MV",
      "Mongolia": "MN",
      "Taiwan": "TW",
      "Cambodia": "KH",
      "Laos": "LA",
      "Myanmar": "MM",
      "Brunei": "BN",
      "Timor-Leste": "TL",
      "Cyprus": "CY",
      
      // アフリカ
      "Egypt": "EG",
      "South Africa": "ZA",
      "Nigeria": "NG",
      "Kenya": "KE",
      "Ethiopia": "ET",
      "Morocco": "MA",
      "Algeria": "DZ",
      "Tunisia": "TN",
      "Ghana": "GH",
      "Senegal": "SN",
      "Libya": "LY",
      "Madagascar": "MG",
      "Western Sahara": "EH",
      "Mauritania": "MR",
      "Mali": "ML",
      "Gambia": "GM",
      "Guinea": "GN",
      "Guinea-Bissau": "GW",
      "Sierra Leone": "SL",
      "Liberia": "LR",
      "Ivory Coast": "CI",
      "Burkina Faso": "BF",
      "Niger": "NE",
      "Chad": "TD",
      "Sudan": "SD",
      "South Sudan": "SS",
      "Eritrea": "ER",
      "Djibouti": "DJ",
      "Somalia": "SO",
      "Uganda": "UG",
      "Rwanda": "RW",
      "Burundi": "BI",
      "Tanzania": "TZ",
      "Mozambique": "MZ",
      "Zimbabwe": "ZW",
      "Zambia": "ZM",
      "Malawi": "MW",
      "Angola": "AO",
      "Namibia": "NA",
      "Botswana": "BW",
      "Lesotho": "LS",
      "Eswatini": "SZ",
      "Mauritius": "MU",
      "Comoros": "KM",
      "Seychelles": "SC",
      "Equatorial Guinea": "GQ",
      "Gabon": "GA",
      "Cameroon": "CM",
      "Central African Republic": "CF",
      "Benin": "BJ",
      "Togo": "TG",
      "Cape Verde": "CV",
      "Sao Tome and Principe": "ST",
      
      // オセアニア
      "Australia": "AU",
      "New Zealand": "NZ",
      "Papua New Guinea": "PG",
      "Fiji": "FJ",
      "Solomon Islands": "SB",
      "Vanuatu": "VU",
      "Samoa": "WS",
      "Kiribati": "KI",
      "Tonga": "TO",
      "Micronesia": "FM",
      "Marshall Islands": "MH",
      "Palau": "PW",
      "Tuvalu": "TV",
      "Nauru": "NR",
      
      // 追加のエイリアス
      "Czech Rep.": "CZ",
      "Czechia": "CZ",
      "S. Korea": "KR",
      "Korea": "KR",
      "N. Korea": "KP",
      "S. Africa": "ZA",
      "Dem. Rep. Congo": "CD",
      "Democratic Republic of the Congo": "CD",
      "Republic of the Congo": "CG",
      "Burma": "MM",
      "W. Sahara": "EH",
      "Bosnia and Herz.": "BA",
      "Bosnia": "BA",
      "Macedonia": "MK",
      "North Mac.": "MK",
      "Côte d'Ivoire": "CI",
      "Dominican Rep.": "DO",
      "DR Congo": "CD",
      "Congo": "CG",
      "UAE": "AE",
      "Swaziland": "SZ",
      "East Timor": "TL",
      "Brunei Darussalam": "BN",
      "Trinidad and Tobago": "TT",
      "St. Lucia": "LC",
      "St. Vincent and the Grenadines": "VC",
      "Antigua and Barbuda": "AG",
      "St. Kitts and Nevis": "KN",
      "Falkland Is.": "FK",
      "Falklands": "FK",
      "Bermuda": "BM",
      "Greenl.": "GL",
      "Mold.": "MD",
      "Lux.": "LU",
      "S. Sudan": "SS",
      "Eq. Guinea": "GQ",
      "Eqs. Guinea": "GQ",
      "Palestine": "PS",
      "Vatican": "VA",
      "St. Vin. and Gren.": "VC",
      "U.S. Virgin Is.": "VI",
      "N. Mariana Is.": "MP",
      "Fr. Polynesia": "PF",
      "New Caledonia": "NC",
      "Cook Is.": "CK",
      "Cayman Is.": "KY",
      "Br. Virgin Is.": "VG",
      "Turks and Caicos Is.": "TC",
      // カリブ海の追加国
      "Grenada": "GD",
      "Barbados": "BB",
      "Aruba": "AW",
      "Curacao": "CW",
      "Sint Maarten": "SX",
      "Montserrat": "MS",
      "Anguilla": "AI",
      "Guadeloupe": "GP",
      "Martinique": "MQ",
      // アジアの追加国・地域
      "Macau": "MO",
      "Hong Kong": "HK",
      "Kyrgyzstan": "KG",
      "Tajikistan": "TJ",
      "Turkmenistan": "TM",
      "Uzbekistan": "UZ",
      "Kazakhstan": "KZ",
      "Azerbaijan": "AZ",
      "Armenia": "AM",
      "Georgia": "GE",
      // オセアニアの追加地域
      "American Samoa": "AS",
      "Guam": "GU",
      "Wallis and Futuna": "WF",
      "Niue": "NU",
      "Tokelau": "TK",
      "Pitcairn Islands": "PN",
      // アフリカの追加地域
      "Reunion": "RE",
      "Mayotte": "YT",
      "Saint Helena": "SH",
      "Ascension Island": "AC",
      "Tristan da Cunha": "TA",
      // その他の地域や表記
      "Channel Islands": "JE", // ジャージー島を代表的に使用
      "Isle of Man": "IM",
      "Gibraltar": "GI",
      "Faroe Islands": "FO",
      "Åland Islands": "AX",
      "Svalbard and Jan Mayen": "SJ",
      "South Georgia": "GS",
      "Western Samoa": "WS",
      "Congo-Brazzaville": "CG",
      "Congo-Kinshasa": "CD",
      "Somaliland": "SO", // 国際的に認められていないが、実質的な独立状態
      "Northern Cyprus": "CY", // 国際的に認められていないが表記として
      "Transnistria": "MD", // 国際的に認められていないが表記として
      "Abkhazia": "GE", // 国際的に認められていないが表記として
      "South Ossetia": "GE", // 国際的に認められていないが表記として
      "DPRK": "KP",
      "ROK": "KR",
      "FYROM": "MK", // 旧マケドニアの呼称
      "PRC": "CN",
      "ROC": "TW",
      "UK": "GB",
      "England": "GB-ENG",
      "Scotland": "GB-SCT",
      "Wales": "GB-WLS",
      "Northern Ireland": "GB-NIR",
      "Republic of Ireland": "IE",
      "Bahrain Is.": "BH",
      "Timor": "TL",
      "West Bank": "PS",
      "Gaza": "PS",
      "Gaza Strip": "PS",
      "Christmas Is.": "CX",
      "Easter Is.": "CL", // チリ領
      "Norfolk Is.": "NF",
      "Caribbean Netherlands": "BQ",
      "Central African Rep.": "CF",
      "CAR": "CF" // 追加
    };
    
    // 国名に対応するコードがあれば取得、なければ国連旗（UN）
    countryCode = countryNameToCode[name] || "UN";
    
    // 初期値は0で、アニメーション用に3つのデータセットを準備
    const fashionCategories = [
      { name: 'アウター', value: 0 },
      { name: 'Formal', value: 0 },
      { name: 'Sports', value: 0 },
      { name: 'Street', value: 0 },
      { name: 'Outdoor', value: 0 }
    ];

    const colorCategories = [
      { name: 'Red', value: 0 },
      { name: 'Blue', value: 0 },
      { name: 'Green', value: 0 },
      { name: 'Black', value: 0 },
      { name: 'Pastel', value: 0 }
    ];

    const womenFashionCategories = [
      { name: '帽子', value: 0 },
      { name: 'アウター', value: 0 },
      { name: 'インナー', value: 0 },
      { name: 'ボトムス', value: 0 },
      { name: '靴', value: 0 }
    ];

    const menFashionCategories = [
      { name: '帽子', value: 0 },
      { name: 'アウター', value: 0 },
      { name: 'インナー', value: 0 },
      { name: 'ボトムス', value: 0 },
      { name: '靴', value: 0 }
    ];

    // 天気のランダム設定
    const weatherTypes = ["Sunny", "Cloudy", "Rainy", "Snowy", "Foggy", "Windy", "Stormy"];
    const randomWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];

    // 初期値は0で、アニメーション用
    const countryData: CountryData = {
      id: name.toLowerCase().replace(/\s/g, '-'),
      name: name,
      code: countryCode,
      fashionPopularity: fashionPopularity,
      weather: randomWeather,
      temperature: 22,
      humidity: 55,
      fashionData: fashionCategories,
      colorData: colorCategories,
      womenFashionData: womenFashionCategories,
      menFashionData: menFashionCategories
    };
    
    // まず初期データ（全て0）で表示
    setSelectedCountry(countryData);
    setShowPopup(true);
    
    // 既存のイベントリスナーを削除（前回のものがあれば）
    if (escKeyHandler.current) {
      document.removeEventListener('keydown', escKeyHandler.current);
    }
    
    // 新しいハンドラーを作成して保存
    escKeyHandler.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopup();
      }
    };
    
    // 新しいハンドラーを追加
    document.addEventListener('keydown', escKeyHandler.current);
    
    // アニメーション用：少し遅延してからデータを更新
    // 2段階でアニメーションを行うために少し待つ
    setTimeout(() => {
      // アニメーションのための一意のキーを更新
      setAnimationKey(prev => prev + 1);
      
      // 実際の値を設定（アニメーション効果用）- 3つのデータセットをアップデート
      const updatedFashionData = [
        { name: 'アウター', value: Math.floor(Math.random() * 100) },
        { name: 'Formal', value: Math.floor(Math.random() * 100) },
        { name: 'Sports', value: Math.floor(Math.random() * 100) },
        { name: 'Street', value: Math.floor(Math.random() * 100) },
        { name: 'Outdoor', value: Math.floor(Math.random() * 100) }
      ];
      
      // 合計を計算して正規化（円グラフ用）
      const colorValues = [
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100)
      ];
      
      const updatedColorData = [
        { name: 'Red', value: colorValues[0] },
        { name: 'Blue', value: colorValues[1] },
        { name: 'Green', value: colorValues[2] },
        { name: 'Black', value: colorValues[3] },
        { name: 'Pastel', value: colorValues[4] }
      ];

      const updatedWomenFashionData = [
        { name: 'Hat', value: Math.floor(Math.random() * 100) },
        { name: 'Outer', value: Math.floor(Math.random() * 100) },
        { name: 'Inner', value: Math.floor(Math.random() * 100) },
        { name: 'Bottoms', value: Math.floor(Math.random() * 100) },
        { name: 'Shoes', value: Math.floor(Math.random() * 100) }
      ];

      const updatedMenFashionData = [
        { name: 'Hat', value: Math.floor(Math.random() * 100) },
        { name: 'Outer', value: Math.floor(Math.random() * 100) },
        { name: 'Inner', value: Math.floor(Math.random() * 100) },
        { name: 'Bottoms', value: Math.floor(Math.random() * 100) },
        { name: 'Shoes', value: Math.floor(Math.random() * 100) }
      ];
      
      // データを更新して、アニメーションを有効化
      setSelectedCountry(prev => {
        if (prev) {
          return {
            ...prev,
            fashionData: updatedFashionData,
            colorData: updatedColorData,
            womenFashionData: updatedWomenFashionData,
            menFashionData: updatedMenFashionData
          };
        }
        return prev;
      });
      
      // アニメーションを有効化 - 少し遅延して値が0からアニメーションするようにする
      setTimeout(() => {
        setAnimateChart(true);
      }, 50);
    }, 300);
  };

  // ポップアップを閉じる
  const closePopup = () => {
    setShowPopup(false);
    
    // ESCキーイベントリスナーを削除
    if (escKeyHandler.current) {
      document.removeEventListener('keydown', escKeyHandler.current);
      escKeyHandler.current = null;
    }
  };

  // この部分を追加：グラフコンポーネントのキーをリセットするために使用
  const [animationKey, setAnimationKey] = useState(0);

  // サーバーサイドレンダリング時は最小限の内容を返す
  if (!isMounted) {
  return (
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100vh',
        backgroundColor: '#f0f8ff',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <h1>Loading...</h1>
        </div>
    );
  }

  // サイドバーのボタンクリックハンドラー
  const handleSettingsClick = () => {
    setShowSettings(!showSettings);
    setShowNotifications(false); // 他のメニューを閉じる
  };

  const handleNotificationsClick = () => {
    setShowNotifications(!showNotifications);
    setShowSettings(false); // 他のメニューを閉じる
  };

  const handleSearchClick = () => {
    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  };

  const handleAccountClick = () => {
    // アカウントページへの遷移
    window.location.href = '/account';
  };

  return (
    <div className="app-container" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'auto',
      margin: 0,
      padding: 0,
      overflow: 'auto',
      backgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      minHeight: '100vh',
      border: 'none',
    }}>
      <GlobalStyle />
      <div className="content-container" style={{
        display: 'flex',
        position: 'relative',
        minHeight: '100%',
      }}>
        {/* ナビゲーションバー */}
        <div className="navbar" style={{
          width: '75px',
          height: '100%',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '15px',
          paddingBottom: '15px',
          zIndex: 20,
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)'
        }}>
          {/* 上部アイコン群 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%'
          }}>
            {/* ロゴ */}
            <button 
              onClick={toggleNavbar}
              style={{
                background: 'none',
                border: 'none',
                color: '#333',
                cursor: 'pointer',
                padding: '10px',
                marginBottom: '15px' // 25pxから15pxに変更
              }}
            >
              <img src="/images/logo.png" alt="Logo" width="40" height="40" />
            </button>
            
            {/* サーチアイコン - ナビゲーション */}
            <button 
              onClick={handleSearchClick}
              style={{
                background: 'none',
                border: 'none',
                color: '#333',
                cursor: 'pointer',
                margin: '0 0 15px 0', // marginを上下15pxに統一
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s'
              }}
            >
              <img src="/images/search.png" alt="Search" width="30" height="30" />
            </button>
            
            {/* プラスアイコン - 新規作成 */}
            <button 
              style={{
                background: 'none',
                border: 'none',
                color: '#333',
                cursor: 'pointer',
                margin: '0 0 15px 0', // marginを上下15pxに統一
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s'
              }}
            >
              <img src="/images/plus.png" alt="Create New" width="30" height="30" />
            </button>
            
            {/* ベルアイコン - 通知 */}
            <button 
              onClick={handleNotificationsClick}
              style={{
                background: 'none',
                border: 'none',
                color: '#333',
                cursor: 'pointer',
                margin: '0', // 最後のアイコンなのでbottom marginは不要
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s',
                position: 'relative'
              }}
            >
              <img src="/images/bell.png" alt="Notifications" width="30" height="30" />
              <span style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                background: '#ff4757',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>3</span>
            </button>
          </div>
          
          {/* 下部アイコン群 */}
          <div style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            {/* アカウントアイコン */}
            <button 
              onClick={handleAccountClick}
              style={{
                background: 'none',
                border: 'none',
                color: '#333',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'center',
                width: '100%'
              }}
            >
              <img src="/images/user.png" alt="User" width="30" height="30" />
            </button>

            {/* 設定アイコン */}
            <button 
              onClick={handleSettingsClick}
              style={{
                background: 'none',
                border: 'none',
                color: '#333',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s',
                display: 'flex',
                justifyContent: 'center',
                width: '100%'
              }}
            >
              <img src="/images/settings.png" alt="Settings" width="30" height="30" />
            </button>
          </div>
        </div>

        {/* メインエリア */}
        <div className="main-area" style={{ 
          flex: 1, 
          marginLeft: '75px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* セクションタイトル - 削除 */}

          {/* 地図コンテナ - 位置を上に調整 */}
          <div className="map-container" style={{ 
            position: 'relative', 
            marginTop: '-75px',
            paddingTop: '0px',
            height: '80vh', // 高さを調整して地図全体が見えるように
            width: '100%',
            borderTop: 'none',
            backgroundColor: '#68a0e8',
            marginBottom: '-30px',
            borderBottom: 'none',
            zIndex: 5,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <WorldMap 
              onCountrySelect={(name: string) => {
                selectCountry(name);
              }}
              pins={pins}
              selectedCountryName={selectedCountry ? selectedCountry.name : null}
            />
            
            {/* 国情報ポップアップ - Draggableで囲む */}
            {showPopup && selectedCountry && (
              <Draggable 
                handle=".popup-handle, .popup-footer-handle"
              >
                <div style={{
                  position: 'absolute',
                  top: '100px', // 上部からの距離を調整
                  left: '30px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 5px 20px rgba(0, 0, 0, 0.2)',
                  padding: '15px',
                  width: isSmallScreen ? 'calc(100% - 60px)' : '65%',
                  maxWidth: '800px',
                  minWidth: '300px',
                  height: 'auto',
                  minHeight: isSmallScreen ? '250px' : '350px',
                  maxHeight: 'calc(100vh - 100px)',
                  zIndex: 30,
                  resize: 'both',
                  overflow: 'visible'
                }}>
                  <div className="popup-handle" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px',
                    cursor: 'move'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <img 
                        src={`https://flagcdn.com/w80/${selectedCountry.code.toLowerCase()}.png`}
                        alt={`${selectedCountry.name} flag`}
                        style={{ 
                          width: '60px', 
                          height: '40px', 
                          objectFit: 'fill',
                          marginRight: '15px',
                          border: '1px solid #eee',
                          borderRadius: '3px',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <h2 style={{
                        margin: 0,
                        fontSize: '22px',
                        fontWeight: 'bold',
                        color: '#333'
                      }}>{selectedCountry.name}</h2>
                    </div>
                    <button 
                      onClick={closePopup}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '20px',
                        padding: '5px'
                      }}
                    >
                      <X size={24} />
                    </button>
                  </div>
                  
                  {/* 統計カード - 復元 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '15px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      backgroundColor: '#e0e0e0',
                      padding: '10px',
                      borderRadius: '5px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Popularity</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{selectedCountry.fashionPopularity}%</div>
                    </div>
                    <div style={{
                      backgroundColor: '#e0e0e0',
                      padding: '10px',
                      borderRadius: '5px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Weather</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{selectedCountry.weather}</div>
                    </div>
                    <div style={{
                      backgroundColor: '#e0e0e0',
                      padding: '10px',
                      borderRadius: '5px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Temperature</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{selectedCountry.temperature}°C</div>
                    </div>
                    <div style={{
                      backgroundColor: '#e0e0e0',
                      padding: '10px',
                      borderRadius: '5px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Humidity</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{selectedCountry.humidity}%</div>
                    </div>
                  </div>
                  
                  {/* 3つのグラフを表示するセクション - 3つ横並び */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: isSmallScreen ? '1fr' : '1fr 1fr 1fr', // 3つ横並び
                    gap: isSmallScreen ? '10px' : '12px',
                    marginBottom: '15px',
                    marginTop: '5px',
                    overflow: 'visible'
                  }}>
                    {/* カラー分析グラフ - 円グラフで表示 */}
                    <div>
                      <h3 style={{ 
                        fontSize: '16px',
                        marginBottom: '8px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>Color</h3>
                      <div style={{ 
                        height: isSmallScreen ? '160px' : '180px', 
                        width: '100%', 
                        overflow: 'visible',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ left: isSmallScreen ? 5 : 10, right: isSmallScreen ? 5 : 10, top: 5, bottom: 10 }}>
                            <defs>
                              <linearGradient id="colorRedGradient" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#FF0000" stopOpacity={1} />
                              </linearGradient>
                              <linearGradient id="colorBlueGradient" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#4D96FF" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#0000FF" stopOpacity={1} />
                              </linearGradient>
                              <linearGradient id="colorGreenGradient" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#6BCB77" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#008000" stopOpacity={1} />
                              </linearGradient>
                              <linearGradient id="colorBlackGradient" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#474747" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#000000" stopOpacity={1} />
                              </linearGradient>
                              <linearGradient id="colorPastelGradient" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#FFD3E1" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#FFA5C4" stopOpacity={1} />
                              </linearGradient>
                            </defs>
                            <Pie
                              key={`color-pie-${animationKey}`}
                              data={selectedCountry.colorData}
                              cx="50%"
                              cy="45%" // 少し上に配置して凡例のスペースを確保
                              labelLine={isSmallScreen ? false : { stroke: '#999', strokeWidth: 1 }}
                              label={({ name, percent }) => {
                                // パーセンテージが小さすぎる場合はラベルを表示しない
                                if (percent < 0.05) return null;
                                
                                // 画面サイズに基づいてフォントサイズを調整
                                const fontSize = isSmallScreen ? 8 : 
                                                windowSize.width < 768 ? 9 : 
                                                windowSize.width < 1024 ? 10 : 11;
                                
                                const value = (percent * 100).toFixed(0);
                                // 値とカラー名両方を表示する
                                return isSmallScreen ? `${value}%` : `${name}: ${value}%`;
                              }}
                              outerRadius={isSmallScreen ? 38 : windowSize.width < 768 ? 44 : 48}
                              innerRadius={isSmallScreen ? 18 : windowSize.width < 768 ? 24 : 28}
                              paddingAngle={4} // セグメント間の間隔を少し大きく
                              dataKey="value"
                              animationDuration={1500}
                              animationBegin={100}
                              animationEasing="ease-out"
                              isAnimationActive={animateChart}
                              startAngle={90}
                              endAngle={-270}
                              className="no-focus-outline" // CSSクラスを追加
                            >
                              {selectedCountry.colorData.map((entry, index) => {
                                // 明るい色から少し暗い色へのグラデーション用のID
                                const gradientId = `colorGradient${index}`;
                                let baseColor;
                                
                                switch(entry.name) {
                                  case 'Red': baseColor = '#FF6B6B'; break;
                                  case 'Blue': baseColor = '#4D96FF'; break;
                                  case 'Green': baseColor = '#6BCB77'; break;
                                  case 'Black': baseColor = '#474747'; break;
                                  default: baseColor = '#FFD3E1'; // パステル
                                }
                                
                                // 暗い色のバージョン（影用）を計算
                                const darkerColor = baseColor.replace(
                                  /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i, 
                                  (_, r, g, b) => {
                                    const darken = (hex: string) => {
                                      const num = Math.max(0, parseInt(hex, 16) - 40);
                                      return num.toString(16).padStart(2, '0');
                                    };
                                    return `#${darken(r)}${darken(g)}${darken(b)}`;
                                  }
                                );
                                
                                let fillId;
                                switch(entry.name) {
                                  case 'Red': fillId = 'url(#colorRedGradient)'; break;
                                  case 'Blue': fillId = 'url(#colorBlueGradient)'; break;
                                  case 'Green': fillId = 'url(#colorGreenGradient)'; break;
                                  case 'Black': fillId = 'url(#colorBlackGradient)'; break;
                                  default: fillId = 'url(#colorPastelGradient)'; // パステル
                                }
                                
                                // 直接色を定義（フォールバック用）
                                const directColor = entry.name === 'Red' ? '#FF0000' : 
                                                   entry.name === 'Blue' ? '#0000FF' : 
                                                   entry.name === 'Green' ? '#00FF00' : 
                                                   entry.name === 'Black' ? '#000000' : '#FFD3E1';
                                
                                return (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={fillId}
                                    stroke={darkerColor}
                                    strokeWidth={0.5}
                                    className="no-focus-outline" // CSSクラスを追加
                                  />
                                );
                              })}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                borderRadius: '8px', 
                                border: 'none', 
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                padding: '8px'
                              }}
                              formatter={(value, name) => [`${value}%`, name]}
                              itemStyle={{ color: '#333', fontSize: isSmallScreen ? '11px' : '12px' }}
                            />
                            <Legend 
                              layout="horizontal" 
                              verticalAlign="bottom" 
                              align="center"
                              wrapperStyle={{ 
                                fontSize: isSmallScreen ? '9px' : '10px', 
                                paddingTop: isSmallScreen ? '5px' : '10px',
                                bottom: isSmallScreen ? '-5px' : '0px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 女性ファッション分析グラフ */}
                    <div>
                      <h3 style={{ 
                        fontSize: '16px',
                        marginBottom: '8px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>Women's</h3>
                      <div style={{ height: isSmallScreen ? '200px' : '220px', width: '100%', overflow: 'visible' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={selectedCountry.womenFashionData}
                            layout="vertical"
                            margin={{ top: 5, right: 10, left: 5, bottom: 15 }}
                          >
                            <CartesianGrid strokeDasharray="5 5" stroke="#f0f0f0" />
                            <XAxis 
                              type="number" 
                              domain={[0, 100]} 
                              ticks={[0, 25, 50, 75, 100]}
                              height={30}
                              tickFormatter={(value) => `${value}`}
                              fontSize={isSmallScreen ? 9 : 10}
                            />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              width={isSmallScreen ? 45 : 50}
                              fontSize={isSmallScreen ? 8 : 9}
                              tickMargin={3}
                              tick={(props) => {
                                const { x, y, payload } = props;
                                // アイコンのマッピング
                                let iconUrl = "";
                                switch(payload.value) {
                                  case 'Hat': iconUrl = fashionItemIcons.hat; break;
                                  case 'Outer': iconUrl = fashionItemIcons.outer; break;
                                  case 'Inner': iconUrl = fashionItemIcons.inner; break;
                                  case 'Bottoms': iconUrl = fashionItemIcons.bottoms; break;
                                  case 'Shoes': iconUrl = fashionItemIcons.shoes; break;
                                  default: iconUrl = "";
                                }
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    <image 
                                      x={-35} 
                                      y={-10} 
                                      width={20} 
                                      height={20} 
                                      xlinkHref={iconUrl} 
                                    />
                                  </g>
                                );
                              }}
                            />
                            <Tooltip 
                              formatter={(value) => [`${value}%`, '']} 
                              contentStyle={{ fontSize: '12px', padding: '5px 8px' }} 
                            />
                            <defs>
                              <linearGradient id="womenGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#6BCB77" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#4CAF50" stopOpacity={1} />
                              </linearGradient>
                              <filter id="womenShadow" height="130%">
                                <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#6BCB77" floodOpacity="0.5" />
                              </filter>
                            </defs>
                            <Bar 
                              dataKey="value" 
                              fill="url(#womenGradient)"
                              animationDuration={800}
                              animationBegin={0}
                              isAnimationActive={true}
                              radius={[0, 4, 4, 0]}
                              barSize={18}
                              label={{
                                position: 'insideRight',
                                fill: '#fff',
                                fontSize: 10,
                                fontWeight: 'bold',
                                formatter: (value: number) => `${value}%`
                              }}
                            >
                              {selectedCountry.womenFashionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill="url(#womenGradient)" />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 男性ファッション分析グラフ */}
                    <div>
                      <h3 style={{ 
                        fontSize: '16px',
                        marginBottom: '8px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>Men's</h3>
                      <div style={{ height: isSmallScreen ? '200px' : '220px', width: '100%', overflow: 'visible' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={selectedCountry.menFashionData}
                            layout="vertical"
                            margin={{ top: 5, right: 10, left: 5, bottom: 15 }}
                          >
                            <CartesianGrid strokeDasharray="5 5" stroke="#f0f0f0" />
                            <XAxis 
                              type="number" 
                              domain={[0, 100]} 
                              ticks={[0, 25, 50, 75, 100]}
                              height={30}
                              tickFormatter={(value) => `${value}`}
                              fontSize={isSmallScreen ? 9 : 10}
                            />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              width={isSmallScreen ? 45 : 50}
                              fontSize={isSmallScreen ? 8 : 9}
                              tickMargin={3}
                              tick={(props) => {
                                const { x, y, payload } = props;
                                // アイコンのマッピング
                                let iconUrl = "";
                                switch(payload.value) {
                                  case 'Hat': iconUrl = fashionItemIcons.hat; break;
                                  case 'Outer': iconUrl = fashionItemIcons.outer; break;
                                  case 'Inner': iconUrl = fashionItemIcons.inner; break;
                                  case 'Bottoms': iconUrl = fashionItemIcons.bottoms; break;
                                  case 'Shoes': iconUrl = fashionItemIcons.shoes; break;
                                  default: iconUrl = "";
                                }
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    <image 
                                      x={-35} 
                                      y={-10} 
                                      width={20} 
                                      height={20} 
                                      xlinkHref={iconUrl} 
                                    />
                                  </g>
                                );
                              }}
                            />
                            <Tooltip 
                              formatter={(value) => [`${value}%`, '']} 
                              contentStyle={{ fontSize: '12px', padding: '5px 8px' }} 
                            />
                            <defs>
                              <linearGradient id="menGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#6BCB77" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#4CAF50" stopOpacity={1} />
                              </linearGradient>
                              <filter id="menShadow" height="130%">
                                <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#6BCB77" floodOpacity="0.5" />
                              </filter>
                            </defs>
                            <Bar 
                              dataKey="value" 
                              fill="url(#menGradient)"
                              animationDuration={800}
                              animationBegin={0}
                              isAnimationActive={true}
                              radius={[0, 4, 4, 0]}
                              barSize={18}
                              label={{
                                position: 'insideRight',
                                fill: '#fff',
                                fontSize: 10,
                                fontWeight: 'bold',
                                formatter: (value: number) => `${value}%`
                              }}
                            >
                              {selectedCountry.menFashionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill="url(#menGradient)" />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  {/* 下部ドラッグハンドル - 境界線なし */}
                  <div className="popup-footer-handle" style={{
                    height: '20px',
                    backgroundColor: 'white',
                    borderRadius: '0 0 8px 8px',
                    marginTop: '15px',
                    cursor: 'move'
                  }}>
                  </div>
        </div>
              </Draggable>
            )}
          </div>
          
          {/* 検索バー */}
          <div style={{
            width: '100%',
            backgroundColor: 'white',
            padding: '15px 20px',
            borderTop: 'none',
            borderBottom: 'none',
            display: 'flex',
            justifyContent: 'flex-start', // 中央揃えから左揃えに変更
            boxShadow: 'none',
            position: 'relative',
            zIndex: 10,
            marginTop: '-15px' // -40pxから-15pxに変更して少し下に移動
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              position: 'relative'
            }}>
              {/* 検索フォーム */}
              <div style={{
                position: 'relative',
                width: '40%',
                minWidth: '300px',
                marginLeft: '10px'
              }}>
                <input 
                  type="text"
                  placeholder="ファッションアイテム、カテゴリー、国名などで検索..."
                  style={{
                    width: '100%',
                    padding: '12px 20px 12px 45px',
                    fontSize: '14px',
                    border: `1px solid ${isSearchFocused ? '#3b82f6' : '#e0e0e0'}`,
                    borderRadius: '30px',
                    outline: 'none',
                    boxShadow: isSearchFocused ? '0 1px 6px rgba(59, 130, 246, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s ease',
                    caretColor: '#3b82f6', // カーソルの色を設定
                    animation: isSearchFocused ? 'caretBlink 1s infinite' : 'none' // カーソル点滅アニメーション
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                />
                {/* 検索アイコン */}
                <div style={{
                  position: 'absolute',
                  left: '15px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3b82f6'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                {/* 検索ボタン */}
                <button style={{
                  position: 'absolute',
                  right: '5px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '8px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
                >
                  検索
                </button>
              </div>
              
              {/* ファッションアイテムカテゴリボタン */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginLeft: '20px',
                gap: '10px',
                flexWrap: 'wrap'
              }}>
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 15px',
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  gap: '5px'
                }}
                onMouseEnter={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = 'none';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
                >
                  <img src="/images/hat.png" alt="帽子" width="20" height="20" />
                  <span>帽子</span>
                </button>
                
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 15px',
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  gap: '5px'
                }}
                onMouseEnter={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = 'none';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
                >
                  <img src="/images/autor.png" alt="アウター" width="20" height="20" />
                  <span>アウター</span>
                </button>
                
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 15px',
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  gap: '5px'
                }}
                onMouseEnter={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = 'none';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
                >
                  <img src="/images/shrit.png" alt="インナー" width="20" height="20" />
                  <span>インナー</span>
                </button>
                
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 15px',
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  gap: '5px'
                }}
                onMouseEnter={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = 'none';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
                >
                  <img src="/images/pants.png" alt="ボトムス" width="20" height="20" />
                  <span>ボトムス</span>
                </button>
                
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 15px',
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  gap: '5px'
                }}
                onMouseEnter={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  // @ts-ignore
                  e.currentTarget.style.boxShadow = 'none';
                  // @ts-ignore
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
                >
                  <img src="/images/shoes.png" alt="靴" width="20" height="20" />
                  <span>靴</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* 画像ギャラリー */}
          <div style={{
            width: '100%',
            backgroundColor: 'white',
            padding: '10px',
            borderTop: 'none',
            marginTop: '-30px'
          }}>
            <Masonry
              breakpointCols={{
                default: 6, // デフォルトのカラム数を増やす
                1400: 5,
                1100: 4,
                800: 3,
                500: 2,
                400: 1
              }}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {FIXED_IMAGE_CARDS.map(card => (
                <div 
                  key={card.id} 
                  style={{
                    backgroundColor: 'transparent',
                    borderRadius: '12px', // 角を丸くする
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    marginBottom: '10px'
                  }}
                  onMouseEnter={(e) => {
                    // @ts-ignore
                    e.currentTarget.style.transform = 'translateY(-5px)';
                  }}
                  onMouseLeave={(e) => {
                    // @ts-ignore
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <img 
                    src={card.src} 
                    alt={card.alt} 
                    style={{ 
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      objectFit: 'contain',
                      borderRadius: '12px' // 画像自体も角を丸くする
                    }}
                  />
                </div>
              ))}
            </Masonry>
          </div>
        </div>
      </div>
    </div>
  );
} 