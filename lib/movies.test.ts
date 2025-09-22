import { fetchMovieRecords, parseMovieReleaseYear } from './movies';
import { supabaseAdminClient } from './supabaseAdminClient';

jest.mock('./supabaseAdminClient', () => ({
  supabaseAdminClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

jest.mock('./itemTypes', () => ({
  getMovieItemTypeId: jest.fn().mockResolvedValue(1),
}));

describe('movies', () => {
  describe('parseMovieReleaseYear', () => {
    it('should return null if metadata is null', () => {
      expect(parseMovieReleaseYear(null)).toBeNull();
    });

    it('should return null if metadata is not an object', () => {
      expect(parseMovieReleaseYear('not an object')).toBeNull();
    });

    it('should extract year from tmdb.release_date', () => {
      const metadata = { tmdb: { release_date: '2023-01-01' } };
      expect(parseMovieReleaseYear(metadata)).toBe('2023');
    });

    it('should extract year from release_date', () => {
      const metadata = { release_date: '2022-02-02' };
      expect(parseMovieReleaseYear(metadata)).toBe('2022');
    });

    it('should extract year from releaseDate', () => {
      const metadata = { releaseDate: '2021-03-03' };
      expect(parseMovieReleaseYear(metadata)).toBe('2021');
    });

    it('should return null for invalid date format', () => {
      const metadata = { release_date: '202' };
      expect(parseMovieReleaseYear(metadata)).toBeNull();
    });
  });

  describe('fetchMovieRecords', () => {
    it('should fetch movie records from supabase', async () => {
      const mockData = [
        { id: 1, name: 'Movie 1', image_path: 'path1', metadata: {} },
        { id: 2, name: 'Movie 2', image_path: 'path2', metadata: {} },
      ];
      (supabaseAdminClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const movies = await fetchMovieRecords();
      expect(movies).toEqual(mockData);
      expect(supabaseAdminClient.from).toHaveBeenCalledWith('rankable_items');
    });
  });
});
