import { api } from './api';

export interface Country {
  code: string;
  name: string;
  flag: string;
  official_name?: string;
  region?: string;
  names?: Record<string, string>;
}

export interface Avatar {
  id: string;
  name: string;
  path: string;
  filename: string;
}

class CountriesService {
  private countriesCache: Country[] = [];
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  async getCountries(language: string = 'en'): Promise<Country[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.countriesCache.length > 0 && now - this.cacheTimestamp < this.CACHE_DURATION) {
      console.log('🔄 Returning cached countries:', this.countriesCache.length);
      return this.countriesCache;
    }

    try {
      // Try to get from backend first
      try {
        console.log('🌐 Fetching from backend...');
        const response = await api.get('/users/data/countries', {
          params: { lang: language }
        });
        
        console.log('✅ Backend response received:', response.data);
        
        if (response.data && Array.isArray(response.data)) {
          // Ensure all countries have proper flag and name
          const countries = response.data.map((country: any) => ({
            code: country.code,
            name: country.name || 'Unknown',
            flag: country.flag || country.flag_emoji || '🌍',
            official_name: country.official_name,
            region: country.region,
            names: country.names
          }));
          
          console.log('✨ Transformed countries:', countries.length);
          console.log('🏁 First country:', countries[0]);
          
          this.countriesCache = countries;
          this.cacheTimestamp = now;
          return countries;
        }
      } catch (backendError) {
        console.warn('⚠️ Backend fetch failed:', backendError);
      }
      
      // Fallback to local JSON data
      console.log('📁 Loading from local JSON...');
      const response = await fetch('/data/countries.json');
      const data = await response.json();
      
      // Transform the data to match the expected format
      const countries = data.countries.map((country: any) => ({
        code: country.code,
        name: country.names[language] || country.names['en'] || country.code,
        flag: country.flag || country.flag_emoji || '🌍',
        official_name: country.official_name,
        region: country.region,
        names: country.names
      }));
      
      console.log('✨ Local countries loaded:', countries.length);
      console.log('🏁 First country:', countries[0]);
      
      this.countriesCache = countries;
      this.cacheTimestamp = now;
      return countries;
    } catch (error) {
      console.error('❌ Error fetching countries:', error);
      return [];
    }
  }

  async getCountriesByLanguage(language: string): Promise<Country[]> {
    return this.getCountries(language);
  }

  clearCache(): void {
    this.countriesCache = [];
    this.cacheTimestamp = 0;
  }
}

class AvatarsService {
  private manifestCache: any = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  async getManifest(): Promise<any> {
    const now = Date.now();
    
    if (this.manifestCache && now - this.cacheTimestamp < this.CACHE_DURATION) {
      return this.manifestCache;
    }

    try {
      const response = await fetch('/wesnoth-avatars/manifest.json');
      const data = await response.json();
      this.manifestCache = data;
      this.cacheTimestamp = now;
      return this.manifestCache;
    } catch (error) {
      console.error('Error loading manifest:', error);
      return [];
    }
  }

  async getAvatars(): Promise<Avatar[]> {
    const manifest = await this.getManifest();
    if (!manifest) {
      return [];
    }

    // Handle both array and object formats
    const avatarsArray = Array.isArray(manifest) ? manifest : (manifest.avatars || []);

    return avatarsArray.map((avatar: any) => ({
      id: avatar.id,
      name: avatar.name,
      // Encode the filename to handle special characters like parentheses
      path: `/wesnoth-avatars/${encodeURIComponent(avatar.filename)}`,
      filename: avatar.filename
    }));
  }

  clearCache(): void {
    this.manifestCache = null;
    this.cacheTimestamp = 0;
  }
}

export const countriesService = new CountriesService();
export const avatarsService = new AvatarsService();
