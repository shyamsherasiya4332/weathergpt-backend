import { ResolvedLocation, WeatherData } from '../../types/weather.js';

export interface IWeatherProvider {
  getWeatherData(location: ResolvedLocation): Promise<WeatherData>;
}
