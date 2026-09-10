import { MapLayerConfig } from '../../types/api.js';

export class MapService {
  public getMapConfig(
    layer: MapLayerConfig['layer'] = 'rain',
    latitude: number = 23.0225,
    longitude: number = 72.5714,
    zoom: number = 7
  ): MapLayerConfig {
    const tileUrlTemplates: Record<MapLayerConfig['layer'], string> = {
      rain: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=demo',
      temp: 'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=demo',
      wind: 'https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=demo',
      clouds: 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=demo'
    };

    const legends: Record<MapLayerConfig['layer'], MapLayerConfig['legend']> = {
      rain: [
        { value: '0 mm/h', color: '#E0E0E0', label: 'No Rain' },
        { value: '1-5 mm/h', color: '#81D4FA', label: 'Light Rain' },
        { value: '5-15 mm/h', color: '#0288D1', label: 'Moderate Rain' },
        { value: '>15 mm/h', color: '#D50000', label: 'Heavy Downpour' }
      ],
      temp: [
        { value: '<15°C', color: '#29B6F6', label: 'Cool' },
        { value: '15-30°C', color: '#66BB6A', label: 'Mild / Comfortable' },
        { value: '30-40°C', color: '#FFA726', label: 'Warm / Hot' },
        { value: '>40°C', color: '#D32F2F', label: 'Extreme Heat' }
      ],
      wind: [
        { value: '<15 km/h', color: '#B2DFDB', label: 'Calm Breeze' },
        { value: '15-40 km/h', color: '#FFB74D', label: 'Moderate Wind' },
        { value: '>40 km/h', color: '#F44336', label: 'Gale / Storm' }
      ],
      clouds: [
        { value: '0-20%', color: '#FFF9C4', label: 'Clear Sky' },
        { value: '20-70%', color: '#B0BEC5', label: 'Partly Cloudy' },
        { value: '70-100%', color: '#546E7A', label: 'Overcast' }
      ]
    };

    return {
      layer,
      tileUrlTemplate: tileUrlTemplates[layer] || tileUrlTemplates.rain,
      attribution: '© WeatherGPT Map Overlay Engine | MoES / OpenMeteo Data',
      legend: legends[layer] || legends.rain,
      center: { latitude, longitude },
      zoom
    };
  }
}

export const mapService = new MapService();
