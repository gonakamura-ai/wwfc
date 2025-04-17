'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
// @ts-ignore
import { geoEquirectangular } from 'd3-geo-projection';
import { X, Menu, GripHorizontal } from 'lucide-react';
import { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import * as topojson from 'topojson-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import Draggable from 'react-draggable';

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

// 純粋なクライアントサイドコンポーネントとして地図を分離
const WorldMap = ({ 
  onCountrySelect, 
  pins,
  selectedCountryName
}: { 
  onCountrySelect: (name: string) => void,
  pins: PinData[],
  selectedCountryName: string | null
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [worldData, setWorldData] = useState<any>(null);

  // データの取得
  useEffect(() => {
    console.log("Fetching map data...");
    fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
      .then(response => response.json())
      .then(data => {
        console.log("Map data loaded successfully");
        setWorldData(data);
      })
      .catch(err => {
        console.error("Error loading map data:", err);
      });
  }, []);

  // コンポーネント内でRef作成
  const mapTransformRef = useRef<any>(null);

  // 地図の変換状態を保存するためのグローバル変数
  let mapTransformState: any = null;

  // 地図の描画
  useEffect(() => {
    if (!worldData || !mapRef.current) return;

    console.log("Drawing map with zoom level:", globalZoomScale);
    
    const drawMap = () => {
    if (!mapRef.current) return;
    
      // 既存のSVGをクリア
      mapRef.current.innerHTML = '';
      
      // コンテナのサイズを取得
    const width = mapRef.current.clientWidth;
      const height = mapRef.current.clientHeight;

      console.log(`Map container size: ${width}x${height}`);

      // SVG要素を作成
    const svg = d3.select(mapRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");
      
      // メインのグループ要素
      const g = svg.append("g");
      
      // 投影法の設定 - グリーンランドが見えるようにスケールとオフセットを調整
      const projection = d3.geoEquirectangular()
        .scale(width / 7) // スケールを小さくしてより広い範囲を表示
        .center([32, 10]) // 中心をグリーンランド付近に移動
        .translate([width / 2, height / 2]); // 垂直方向のオフセットを調整
      
      // パスジェネレータ
    const path = d3.geoPath().projection(projection);

      try {
        // TopoJSONからGeoJSONに変換
        const countries = topojson.feature(worldData, worldData.objects.countries) as any;
        
        // 南極を除外
        const filteredCountries = countries.features.filter((d: any) => d.id !== "010");
        
        // マップ幅を少し広げる（スクロール時の隙間をなくすため）
        const mapWidth = width * 1.05; // 少し幅を広げる
        
        // 横ドラッグでループするための3つの地図を作成（左、中央、右）
        for (let i = -1; i <= 1; i++) {
          const countryGroup = g.append("g")
            .attr("transform", `translate(${i * mapWidth}, 0)`)
            .attr("class", "countries-group");
          
          countryGroup.selectAll("path.country")
            .data(filteredCountries)
      .enter()
      .append("path")
      .attr("class", "country")
            .attr("d", path as any)
            .attr("fill", (d: any) => {
              // 初期表示時に選択された国があればピンクにする
              if (selectedCountryName && d.properties && d.properties.name === selectedCountryName) {
                return "#ffb6c1";
              }
              return "#ffffff";
            })
            .attr("stroke", "#a6c6f2")
            .attr("stroke-width", 0.5)
            .style("cursor", "pointer")
            .on("click", function(event, d: any) {
              // イベントのバブリングと既定の動作を停止
              event.preventDefault();
              event.stopPropagation();
              
              // 現在の変換状態を保存
              const currentTransform = mapTransformRef.current || globalMapTransform || d3.zoomIdentity;
              
              // 全ての国の色をリセット
              svg.selectAll("path.country").attr("fill", "#ffffff");
              
              // クリックした国を強調 (this要素を使用)
              d3.select(this).attr("fill", "#ffb6c1");
              
              // 国の情報を表示
              if (d.properties && d.properties.name) {
                onCountrySelect(d.properties.name);
              }
              
              // 地図の位置を維持
              setTimeout(() => {
                svg.call(zoom.transform as any, currentTransform);
              }, 10);
            });
        }
        
        // 3セットのピンを描画（左、中央、右）
        for (let i = -1; i <= 1; i++) {
          g.append("g")
            .attr("transform", `translate(${i * mapWidth}, 0)`)
            .selectAll("circle")
            .data(pins)
      .enter()
            .append("circle")
            .attr("cx", (d: PinData) => {
              const [x, _] = projection([d.lon, d.lat]) || [0, 0];
              return x;
            })
            .attr("cy", (d: PinData) => {
              const [_, y] = projection([d.lon, d.lat]) || [0, 0];
              return y;
            })
            .attr("r", 6)
            .attr("fill", (d: PinData) => {
              // 初期表示時に選択された国があればピンク色に
              if (selectedCountryName && d.name === selectedCountryName) {
                return "#ff69b4"; // ピンの色を少し強めに
              }
              return "pink";
            })
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .style("cursor", "pointer")
            .on("click", function(event, d: PinData) {
              // イベントのバブリングと既定の動作を停止
              event.preventDefault();
              event.stopPropagation();
              
              // 現在の変換状態を保存
              const currentTransform = mapTransformRef.current || globalMapTransform || d3.zoomIdentity;
              
              // 全ての国の色をリセット
              svg.selectAll("path.country").attr("fill", "#ffffff");
              
              // すべての国グループ内から該当する国を選択して色を変更
              svg.selectAll(".countries-group")
                .selectAll("path.country")
                .filter((country: any) => {
                  return country.properties && 
                         country.properties.name === d.name;
                })
                .attr("fill", "#ffb6c1");
              
              // 国の情報を表示
              onCountrySelect(d.name);
              
              // 地図の位置を維持
              setTimeout(() => {
                svg.call(zoom.transform as any, currentTransform);
              }, 10);
            });
        }
        
        // 無限ループ用のズーム/パン設定
        const SCROLL_LIMIT = width * 2; // スクロール制限を広げる
        
        // 保存された変換状態があれば使用する
        let initialTransform = mapTransformRef.current || globalMapTransform || d3.zoomIdentity;
        
        // 保存されたズームレベルを適用
        if (globalZoomScale && globalZoomScale > 1) {
          initialTransform = d3.zoomIdentity.scale(globalZoomScale).translate(initialTransform.x, initialTransform.y);
        }
        
        // ズーム処理
        const zoom = d3.zoom()
          .scaleExtent([1, 8]) // ズームの範囲を設定
          .translateExtent([[-SCROLL_LIMIT, 0], [SCROLL_LIMIT, height]]) // 上下の移動を制限、左右は広げる
          .on("zoom", (event) => {
            // クリックイベントの場合の処理
            if (event.sourceEvent && event.sourceEvent.type === 'click') {
              // 国やピンの要素がクリックされた場合はズーム処理をスキップ
              const target = event.sourceEvent.target;
              if (target && (
                  (target.classList && target.classList.contains('country')) || 
                  target.tagName === 'circle'
                )) {
                // クリックイベントでの地図移動を防止
                return;
              }
            }
            
            // 現在の変換状態を取得
            const transform = event.transform;
            
            // 変換状態をグローバルに保存
            mapTransformRef.current = transform;
            globalMapTransform = transform;
            globalZoomScale = transform.k;
            
            // 左右ループのためのスムーズな処理
            if (transform.x < -mapWidth) {
              transform.x += mapWidth;
            } else if (transform.x > mapWidth) {
              transform.x -= mapWidth;
            }
            
            // 変換を適用
            g.attr("transform", transform);
          });
        
        // ズーム関数を設定
        svg.call(zoom as any)
           // ダブルクリックによる自動ズームを無効化
           .on("dblclick.zoom", null);
        
        // 初期位置を設定
        if (globalZoomScale && globalZoomScale > 1) {
          svg.call(zoom.transform as any, initialTransform);
        } else {
          g.attr("transform", initialTransform);
        }
        
        console.log("Map drawn successfully with zoom level:", globalZoomScale);
      } catch (error) {
        console.error("Error drawing map:", error);
      }
    };
    
    // 地図を描画（常に実行）
    drawMap();
    
    // リサイズハンドラーを設定
    const handleResize = () => {
      drawMap();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [worldData, pins, onCountrySelect, selectedCountryName]);
  
  return (
    <div 
      ref={mapRef} 
      style={{
        width: '100%',
        height: '800px',
        backgroundColor: '#a6c6f2', // 海の色を元の青に戻す
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0',
        boxShadow: 'none'
      }}
    />
  );
};

// ファッション画像のカテゴリー
const fashionCategories = [
  "Casual", "Formal", "Sports", "Street", "Outdoor", 
  "Vintage", "Mode", "Gothic", "Lolita", "Hip Hop",
  "Surf", "Military", "Trod", "Minimal", "Esnek",
  "Retro", "Punk", "Rock", "Garry", "Monoton"
];

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
  
  // 固定画像ソース (Unsplashの固定URLを使用)
  const fashionImages = [
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=188&fit=crop",
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=188&fit=crop",
    "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=188&fit=crop",
    "https://images.unsplash.com/photo-1475180098004-ca77a66827be?w=188&fit=crop",
    "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=188&fit=crop",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=188&fit=crop",
    "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=188&fit=crop",
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=188&fit=crop",
    "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=188&fit=crop",
    "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=188&fit=crop",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=188&fit=crop",
    "https://images.unsplash.com/photo-1554412933-514a83d2f3c8?w=188&fit=crop",
    "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=188&fit=crop",
    "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=188&fit=crop",
    "https://images.unsplash.com/photo-1587754568293-82a0317594dc?w=188&fit=crop",
    "https://images.unsplash.com/photo-1500643752441-4dc90cda350a?w=188&fit=crop",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=188&fit=crop",
    "https://images.unsplash.com/photo-1517256673644-36ad11246d21?w=188&fit=crop",
    "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=188&fit=crop",
    "https://images.unsplash.com/photo-1516762689617-e1cffcef479d?w=188&fit=crop"
  ];
  
  // さらに画像URLを追加して重複を減らす
  const additionalImages = [
    "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=188&fit=crop",
    "https://images.unsplash.com/photo-1542838686-37da4a9fd1b3?w=188&fit=crop",
    "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=188&fit=crop",
    "https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?w=188&fit=crop",
    "https://images.unsplash.com/photo-1532453288009-a29217d06b56?w=188&fit=crop",
    "https://images.unsplash.com/photo-1548826490-58de0a903cde?w=188&fit=crop",
    "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=188&fit=crop",
    "https://images.unsplash.com/photo-1576674627305-05866b3d5f01?w=188&fit=crop",
    "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=188&fit=crop",
    "https://images.unsplash.com/photo-1536593998369-f0d25ed0fb1d?w=188&fit=crop"
  ];
  
  // 全ての画像を結合
  const allImages = [...fashionImages, ...additionalImages];
  
  // 画像の高さを変える値の配列（より縦長になるよう高さを増加）
  const heights = [250, 300, 350, 280, 320, 270, 330, 290, 310, 340];
  
  // 全ての利用可能な画像をシャッフル
  const shuffledImages = [...allImages].sort(() => Math.random() - 0.5);
  
  // すべての可能なタイトルを生成してシャッフル
  const allTitles = generateAllPossibleTitles();
  
  // 100個のカードを生成
  for (let i = 1; i <= 100; i++) {
    // 使える画像数以内で繰り返すためのインデックス
    const imageIndex = (i - 1) % shuffledImages.length;
    // タイトルのインデックス (120種類のタイトルがある)
    const titleIndex = (i - 1) % allTitles.length;
    // シャッフルした画像配列から選択
    const source = shuffledImages[imageIndex];
    // シャッフルしたタイトル配列から選択
    const title = allTitles[titleIndex];
    // ランダムな高さを選択
    const height = heights[Math.floor(Math.random() * heights.length)];
    
    cards.push({
      id: i,
      src: source,
      alt: title,
      title: title,
      height: height // 高さをバラバラに
    });
  }
  
  return cards;
};

// 画像カードを一度だけ生成して使いまわす
const FIXED_IMAGE_CARDS: ImageCard[] = generateImageCards();

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [navbarActive, setNavbarActive] = useState(false);
  const [animateChart, setAnimateChart] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
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
      { name: 'Casual', value: 0 },
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
      { name: 'Dresses', value: 0 },
      { name: 'Skirts', value: 0 },
      { name: 'Pants', value: 0 },
      { name: 'Blouses', value: 0 },
      { name: 'Accessories', value: 0 }
    ];

    const menFashionCategories = [
      { name: 'Suits', value: 0 },
      { name: 'Casual', value: 0 },
      { name: 'Leather Shoes', value: 0 },
      { name: 'Sneakers', value: 0 },
      { name: 'Outerwear', value: 0 }
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
    
    // アニメーション用：少し遅延してからデータを更新
    // 2段階でアニメーションを行うために少し待つ
    setTimeout(() => {
      // アニメーションのための一意のキーを更新
      setAnimationKey(prev => prev + 1);
      
      // 実際の値を設定（アニメーション効果用）- 3つのデータセットをアップデート
      const updatedFashionData = [
        { name: 'Casual', value: Math.floor(Math.random() * 100) },
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
        { name: 'Dresses', value: Math.floor(Math.random() * 100) },
        { name: 'Skirts', value: Math.floor(Math.random() * 100) },
        { name: 'Pants', value: Math.floor(Math.random() * 100) },
        { name: 'Blouses', value: Math.floor(Math.random() * 100) },
        { name: 'Accessories', value: Math.floor(Math.random() * 100) }
      ];

      const updatedMenFashionData = [
        { name: 'Suits', value: Math.floor(Math.random() * 100) },
        { name: 'Casual', value: Math.floor(Math.random() * 100) },
        { name: 'Leather Shoes', value: Math.floor(Math.random() * 100) },
        { name: 'Sneakers', value: Math.floor(Math.random() * 100) },
        { name: 'Outerwear', value: Math.floor(Math.random() * 100) }
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

  return (
    <div className="app-container" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'auto',
      margin: 0,
      padding: 0,
      overflow: 'auto',
      backgroundColor: '#f0f8ff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      minHeight: '100vh',
    }}>
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
          justifyContent: 'flex-start',
          paddingTop: '10px',
          zIndex: 20,
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0
        }}>
          <button 
            onClick={toggleNavbar}
          style={{
              background: 'none',
              border: 'none',
              color: '#333',
              fontSize: '20px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            <Menu size={24} />
          </button>
        </div>

        {/* メインエリア */}
        <div className="main-area" style={{ 
          flex: 1, 
          marginLeft: '75px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* セクションタイトル - 地図 */}
          <div style={{
            backgroundColor: '#e6f0ff',
            padding: '15px 20px 0 20px',
            margin: '0',
            width: '100%',
            borderBottom: 'none'
          }}>
            <h2 style={{ 
              fontSize: '36px',
              fontWeight: '800',
              margin: 0,
              color: '#1a1a5c',
              fontFamily: '"Playfair Display", "Times New Roman", serif',
              letterSpacing: '1px',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)',
              textTransform: 'capitalize',
              backgroundImage: 'linear-gradient(45deg, #1a1a5c, #5050a5)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              padding: '10px 0'
            }}>World Wide Fashion Color</h2>
      </div>

          {/* 地図コンテナ - マージン追加 */}
          <div className="map-container" style={{ 
            position: 'relative', 
            marginTop: '0px',
            paddingTop: '0px',
            height: '800px',
            width: '100%',
            borderTop: 'none',
            backgroundColor: '#a6c6f2' // 背景色を元の青に戻す
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
                bounds=".map-container" // 地図コンテナ内に制限
              >
                <div style={{
                  position: 'absolute',
                  top: '150px', // 初期位置を地図の中央付近に
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 5px 20px rgba(0, 0, 0, 0.2)',
                  padding: '20px 20px 5px 20px', // 下部にパディングを減らす
                  width: '90%',
                  maxWidth: '1100px', // 最大幅を広げて横長に
                  minWidth: '850px', // 最小幅をさらに広げて表示を確保
                  height: 'auto', // 高さを自動調整
                  minHeight: '400px',
                  maxHeight: '550px', // 最大高さを制限して下に伸びないようにする
                  zIndex: 30,
                  resize: 'both',
                  overflow: 'visible' // スクロールを無効化
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
                          height: 'auto', 
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
                  
                  {/* 3つのグラフを表示するセクション */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 1fr', // 3カラムの固定グリッドに変更
                    gap: '20px',
                    marginBottom: '20px',
                    overflow: 'visible' // スクロールが発生しないようにする
                  }}>
                    {/* カラー分析グラフ - 円グラフで表示 */}
                    <div>
                      <h3 style={{ 
                        fontSize: '18px', 
                        marginBottom: '10px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>Color</h3>
                      <div style={{ height: '250px', width: '100%', overflow: 'visible' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ left: 30, right: 30, top: 10, bottom: 10 }}>
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
                              cy="50%"
                              labelLine={{ stroke: '#999', strokeWidth: 1, strokeDasharray: '' }}
                              label={({ name, percent }) => {
                                // 名前とパーセントを表示
                                return `${name}: ${(percent * 100).toFixed(0)}%`;
                              }}
                              outerRadius={68}
                              innerRadius={35} // ドーナツグラフにする
                              paddingAngle={3} // 各セグメント間の間隔
                              dataKey="value"
                              animationDuration={1500}
                              animationBegin={100}
                              animationEasing="ease-out"
                              isAnimationActive={animateChart}
                              startAngle={90}
                              endAngle={-270}
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
                                padding: '10px'
                              }}
                              formatter={(value, name) => [`${value}%`, name]}
                              itemStyle={{ color: '#333' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 女性ファッション分析グラフ */}
                    <div>
                      <h3 style={{ 
                        fontSize: '18px', 
                        marginBottom: '10px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>Women's</h3>
                      <div style={{ height: '250px', width: '100%', overflow: 'visible' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={selectedCountry.womenFashionData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                          >
                            <CartesianGrid strokeDasharray="5 5" stroke="#f0f0f0" />
                            <XAxis 
                              type="number" 
                              domain={[0, 100]} 
                              ticks={[0, 25, 50, 75, 100]}
                              height={40}
                            />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              width={80} 
                            />
                            <Tooltip />
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
                              label={{
                                position: 'insideRight',
                                fill: '#fff',
                                fontSize: 12,
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
                        fontSize: '18px', 
                        marginBottom: '10px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>Men's</h3>
                      <div style={{ height: '250px', width: '100%', overflow: 'visible' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={selectedCountry.menFashionData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                          >
                            <CartesianGrid strokeDasharray="5 5" stroke="#f0f0f0" />
                            <XAxis 
                              type="number" 
                              domain={[0, 100]} 
                              ticks={[0, 25, 50, 75, 100]}
                              height={40}
                            />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              width={80}
                            />
                            <Tooltip />
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
                              label={{
                                position: 'insideRight',
                                fill: '#fff',
                                fontSize: 12,
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
          
          {/* 画像ギャラリー */}
          <div style={{
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '20px',
            borderTop: '1px solid #ddd',
            marginTop: '20px'
          }}>
            {/* マンソリーレイアウト（不均一な高さの画像グリッド） */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(188px, 1fr))',
              gap: '15px',
              margin: '0 auto'
            }}>
              {FIXED_IMAGE_CARDS.map(card => (
            <div 
              key={card.id} 
                  style={{
                    width: '188px', // 5cm固定幅に明示的に指定
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    justifySelf: 'center'
                  }}
                  onMouseEnter={(e) => {
                    // @ts-ignore
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    // @ts-ignore
                    e.currentTarget.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    // @ts-ignore
                    e.currentTarget.style.transform = 'translateY(0)';
                    // @ts-ignore
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                  }}
            >
              <img 
                src={card.src} 
                alt={card.alt} 
                    style={{ 
                      width: '100%', 
                      height: `${card.height}px`,
                      objectFit: 'cover'
                    }}
                  />
                  <div style={{ 
                    padding: '8px',
                    borderTop: '1px solid #f0f0f0'
                  }}>
                    <h3 style={{ 
                      margin: 0,
                      fontWeight: 'normal',
                      color: '#333',
                      fontSize: '13px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{card.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
        </div>
      </div>

      {/* アニメーション用のCSSスタイル */}
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
      `}</style>
    </div>
  );
} 