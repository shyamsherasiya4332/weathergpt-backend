import request from 'supertest';
import { createApp } from '../src/app.js';
import { voiceService } from '../src/services/voice/voiceService.js';

const app = createApp();

describe('Voice AI Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/voice/transcribe - Should handle unconfigured voice service gracefully', async () => {
    jest.spyOn(voiceService, 'isConfigured').mockReturnValue(false);

    const res = await request(app)
      .post('/api/voice/transcribe')
      .set('Content-Type', 'audio/wav')
      .send(Buffer.from('fake_audio_bytes'));

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VOICE_NOT_CONFIGURED');
  });

  it('POST /api/voice/speak - Should handle speak request validation', async () => {
    jest.spyOn(voiceService, 'isConfigured').mockReturnValue(true);
    jest.spyOn(voiceService, 'synthesize').mockResolvedValueOnce({
      audioBuffer: Buffer.from('mock_audio_data'),
      format: 'mp3'
    });

    const res = await request(app)
      .post('/api/voice/speak')
      .send({ text: 'The weather in Morbi is clear.', language: 'en' });

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/audio\/mp3/);
  });
});
