import { languageService } from '../src/services/language/languageService.js';

describe('Language Detection Service - All 22 Official Indian Languages + Hinglish', () => {
  it('Should detect Gujarati script', () => {
    const res = languageService.detect('કાલે મોરબીમાં વરસાદ પડશે?');
    expect(res.code).toBe('gu');
    expect(res.name).toMatch(/Gujarati/i);
    expect(res.script).toBe('Gujarati');
  });

  it('Should detect Hindi in Devanagari script', () => {
    const res = languageService.detect('क्या कल दिल्ली में बारिश होगी?');
    expect(res.code).toBe('hi');
    expect(res.script).toBe('Devanagari');
  });

  it('Should detect Marathi in Devanagari script', () => {
    const res = languageService.detect('उद्या मुंबईत पाऊस पडेल का? मी बाहेर जाऊ का?');
    expect(res.code).toBe('mr');
    expect(res.script).toBe('Devanagari');
  });

  it('Should detect Tamil script', () => {
    const res = languageService.detect('சென்னையில் மழை பெய்யுமா?');
    expect(res.code).toBe('ta');
    expect(res.script).toBe('Tamil');
  });

  it('Should detect Telugu script', () => {
    const res = languageService.detect('హైదరాబాద్‌లో రేపు వర్షం పడుతుందా?');
    expect(res.code).toBe('te');
    expect(res.script).toBe('Telugu');
  });

  it('Should detect Bengali script', () => {
    const res = languageService.detect('আজ কলকাতায় বৃষ্টি হবে?');
    expect(res.code).toBe('bn');
    expect(res.script).toBe('Bengali');
  });

  it('Should detect Kannada script', () => {
    const res = languageService.detect('ಬೆಂಗಳೂರಿನಲ್ಲಿ ಮಳೆ ಬರುತ್ತದೆಯೇ?');
    expect(res.code).toBe('kn');
    expect(res.script).toBe('Kannada');
  });

  it('Should detect Malayalam script', () => {
    const res = languageService.detect('കൊച്ചിയിൽ മഴ പെയ്യുമോ?');
    expect(res.code).toBe('ml');
    expect(res.script).toBe('Malayalam');
  });

  it('Should detect Punjabi script', () => {
    const res = languageService.detect('ਅੰਮ੍ਰਿਤਸਰ ਵਿੱਚ ਮੀਂਹ ਪਵੇਗਾ?');
    expect(res.code).toBe('pa');
    expect(res.script).toBe('Gurmukhi');
  });

  it('Should detect Odia script', () => {
    const res = languageService.detect('ଭୁବନେଶ୍ୱରରେ ବର୍ଷା ହେବ କି?');
    expect(res.code).toBe('or');
    expect(res.script).toBe('Odia');
  });

  it('Should detect Urdu script', () => {
    const res = languageService.detect('کیا کل دہلی میں بارش ہوگی؟');
    expect(res.code).toBe('ur');
    expect(res.script).toBe('Arabic');
  });

  it('Should detect Hinglish query', () => {
    const res = languageService.detect('Morbi me kal rain hoga kya?');
    expect(res.code).toBe('hinglish');
  });

  it('Should detect English query', () => {
    const res = languageService.detect('Will it rain tomorrow in Morbi?');
    expect(res.code).toBe('en');
    expect(res.script).toBe('Latin');
  });

  it('Should recognize Indic scripts correctly', () => {
    expect(languageService.isIndicScript('વરસાદ')).toBe(true);
    expect(languageService.isIndicScript('बारिश')).toBe(true);
    expect(languageService.isIndicScript('rain')).toBe(false);
  });
});
