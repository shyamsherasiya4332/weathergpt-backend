import { Request, Response } from 'express';
import { mapService } from '../services/map/mapService.js';
import { MapLayerConfig } from '../types/api.js';

export class MapController {
  handleGetMap(req: Request, res: Response): void {
    const layer = (req.query.layer || 'rain') as MapLayerConfig['layer'];
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : 23.0225;
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : 72.5714;
    const zoom = req.query.zoom ? parseInt(req.query.zoom as string, 10) : 7;

    const mapConfig = mapService.getMapConfig(layer, lat, lon, zoom);

    res.json({
      success: true,
      map: mapConfig,
      generated_at: new Date().toISOString()
    });
  }
}

export const mapController = new MapController();
