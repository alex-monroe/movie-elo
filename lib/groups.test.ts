import { fetchMovieRankingGroups } from './groups';
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

describe('groups', () => {
  describe('fetchMovieRankingGroups', () => {
    it('should fetch movie ranking groups from supabase', async () => {
      const mockData = [
        { id: '1', name: 'Group 1', description: 'Description 1' },
        { id: '2', name: 'Group 2', description: null },
      ];
      (supabaseAdminClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const groups = await fetchMovieRankingGroups();
      expect(groups).toEqual(mockData);
      expect(supabaseAdminClient.from).toHaveBeenCalledWith('ranking_groups');
    });

    it('should handle empty data from supabase', async () => {
      (supabaseAdminClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const groups = await fetchMovieRankingGroups();
      expect(groups).toEqual([]);
    });

    it('should handle invalid data from supabase', async () => {
        const mockData = [
            { id: '1', name: 'Group 1', description: 'Description 1' },
            { id: null, name: 'Group 2', description: 'Description 2' },
            { id: '3', name: null, description: 'Description 3' },
        ];
        (supabaseAdminClient.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        });

        const groups = await fetchMovieRankingGroups();
        expect(groups).toEqual([{ id: '1', name: 'Group 1', description: 'Description 1' }]);
    });
  });
});
