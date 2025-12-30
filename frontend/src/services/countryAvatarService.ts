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
      return this.countriesCache;
    }

    try {
      const response = await api.get('/users/data/countries', {
        params: { lang: language }
      });
      
      this.countriesCache = response.data;
      this.cacheTimestamp = now;
      
      return response.data;
    } catch (error) {
      console.error('Error fetching countries:', error);
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
      const response = await fetch('/wesnoth-units/manifest.json');
      this.manifestCache = await response.json();
      this.cacheTimestamp = now;
      return this.manifestCache;
    } catch (error) {
      console.error('Error loading manifest:', error);
      return null;
    }
  }

  async getAvatars(): Promise<Avatar[]> {
    const manifest = await this.getManifest();
    if (!manifest || !manifest.avatars) {
      return [];
    }

    return manifest.avatars.map((avatar: any) => ({
      id: avatar.id,
      name: avatar.name,
      path: avatar.path,
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
