import { useMapEvents } from 'react-leaflet';

interface MapControlsProps {
  onCountrySelect: (name: string) => void;
}

const MapControls = ({ onCountrySelect }: MapControlsProps) => {
  const map = useMapEvents({
    click: (e) => {
      // クリックした位置の座標から国名を取得（逆ジオコーディング）
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
        .then(response => response.json())
        .then(data => {
          if (data.address && data.address.country) {
            onCountrySelect(data.address.country);
          }
        })
        .catch(error => console.error('Error:', error));
    },
    zoomend: () => {
      // ズーム終了時の処理
    },
    moveend: () => {
      // 移動終了時の処理
    }
  });

  return null;
};

export default MapControls; 