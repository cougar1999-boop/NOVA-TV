const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Mock Database
const mockData = {
  channels: [
    { id: '1', name: 'ESPN', logo: 'https://via.placeholder.com/300x200?text=ESPN', group: 'Sports', url: 'http://example.com/stream1.m3u8' },
    { id: '2', name: 'HBO', logo: 'https://via.placeholder.com/300x200?text=HBO', group: 'Entertainment', url: 'http://example.com/stream2.m3u8' },
    { id: '3', name: 'Discovery', logo: 'https://via.placeholder.com/300x200?text=Discovery', group: 'Documentary', url: 'http://example.com/stream3.m3u8' },
    { id: '4', name: 'CNN', logo: 'https://via.placeholder.com/300x200?text=CNN', group: 'News', url: 'http://example.com/stream4.m3u8' },
    { id: '5', name: 'BBC', logo: 'https://via.placeholder.com/300x200?text=BBC', group: 'News', url: 'http://example.com/stream5.m3u8' },
    { id: '6', name: 'Eurosport', logo: 'https://via.placeholder.com/300x200?text=Eurosport', group: 'Sports', url: 'http://example.com/stream6.m3u8' },
  ],
  movies: [
    { id: '101', name: 'The Matrix', logo: 'https://via.placeholder.com/300x200?text=The+Matrix', category: 'Action', year: 1999, description: 'A sci-fi masterpiece', url: 'http://example.com/movie1.mp4' },
    { id: '102', name: 'Inception', logo: 'https://via.placeholder.com/300x200?text=Inception', category: 'Sci-Fi', year: 2010, description: 'Dreams within dreams', url: 'http://example.com/movie2.mp4' },
    { id: '103', name: 'The Dark Knight', logo: 'https://via.placeholder.com/300x200?text=Dark+Knight', category: 'Action', year: 2008, description: 'Batman takes on Joker', url: 'http://example.com/movie3.mp4' },
    { id: '104', name: 'Interstellar', logo: 'https://via.placeholder.com/300x200?text=Interstellar', category: 'Sci-Fi', year: 2014, description: 'Journey through space', url: 'http://example.com/movie4.mp4' },
    { id: '105', name: 'The Shawshank Redemption', logo: 'https://via.placeholder.com/300x200?text=Shawshank', category: 'Drama', year: 1994, description: 'A timeless classic', url: 'http://example.com/movie5.mp4' },
    { id: '106', name: 'Pulp Fiction', logo: 'https://via.placeholder.com/300x200?text=Pulp+Fiction', category: 'Crime', year: 1994, description: 'Interconnected stories', url: 'http://example.com/movie6.mp4' },
    { id: '107', name: 'The Avengers', logo: 'https://via.placeholder.com/300x200?text=Avengers', category: 'Action', year: 2012, description: 'Marvel heroes unite', url: 'http://example.com/movie7.mp4' },
    { id: '108', name: 'Forrest Gump', logo: 'https://via.placeholder.com/300x200?text=Forrest+Gump', category: 'Drama', year: 1994, description: 'Life is like a box of chocolates', url: 'http://example.com/movie8.mp4' },
  ],
  series: [
    { id: '201', name: 'Breaking Bad', logo: 'https://via.placeholder.com/300x200?text=Breaking+Bad', category: 'Crime Drama', seasons: 5, description: 'A chemistry teacher turns to crime', url: 'http://example.com/series1.m3u8' },
    { id: '202', name: 'Game of Thrones', logo: 'https://via.placeholder.com/300x200?text=Game+of+Thrones', category: 'Fantasy', seasons: 8, description: 'War for the Iron Throne', url: 'http://example.com/series2.m3u8' },
    { id: '203', name: 'Stranger Things', logo: 'https://via.placeholder.com/300x200?text=Stranger+Things', category: 'Sci-Fi', seasons: 4, description: 'Mystery in the Upside Down', url: 'http://example.com/series3.m3u8' },
    { id: '204', name: 'The Office', logo: 'https://via.placeholder.com/300x200?text=The+Office', category: 'Comedy', seasons: 9, description: 'Mockumentary office comedy', url: 'http://example.com/series4.m3u8' },
    { id: '205', name: 'House', logo: 'https://via.placeholder.com/300x200?text=House', category: 'Medical Drama', seasons: 8, description: 'Brilliant doctor solves mysteries', url: 'http://example.com/series5.m3u8' },
    { id: '206', name: 'The Crown', logo: 'https://via.placeholder.com/300x200?text=The+Crown', category: 'Drama', seasons: 5, description: 'Royal family biography', url: 'http://example.com/series6.m3u8' },
    { id: '207', name: 'Sherlock', logo: 'https://via.placeholder.com/300x200?text=Sherlock', category: 'Mystery', seasons: 4, description: 'Modern detective stories', url: 'http://example.com/series7.m3u8' },
    { id: '208', name: 'The Mandalorian', logo: 'https://via.placeholder.com/300x200?text=Mandalorian', category: 'Sci-Fi', seasons: 3, description: 'Star Wars bounty hunter', url: 'http://example.com/series8.m3u8' },
  ]
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Get all channels
app.get('/api/channels', (req, res) => {
  res.json({
    success: true,
    data: mockData.channels,
    total: mockData.channels.length
  });
});

// Get movies
app.get('/api/movies', (req, res) => {
  const category = req.query.category;
  
  let movies = mockData.movies;
  if (category && category !== 'all') {
    movies = movies.filter(m => m.category.toLowerCase() === category.toLowerCase());
  }
  
  res.json({
    success: true,
    data: movies,
    total: movies.length
  });
});

// Get series
app.get('/api/series', (req, res) => {
  const category = req.query.category;
  
  let series = mockData.series;
  if (category && category !== 'all') {
    series = series.filter(s => s.category.toLowerCase() === category.toLowerCase());
  }
  
  res.json({
    success: true,
    data: series,
    total: series.length
  });
});

// Get categories for movies
app.get('/api/categories/movies', (req, res) => {
  const categories = [...new Set(mockData.movies.map(m => m.category))];
  res.json({
    success: true,
    data: categories.map(c => ({ id: c.toLowerCase(), name: c }))
  });
});

// Get categories for series
app.get('/api/categories/series', (req, res) => {
  const categories = [...new Set(mockData.series.map(s => s.category))];
  res.json({
    success: true,
    data: categories.map(c => ({ id: c.toLowerCase(), name: c }))
  });
});

// Search
app.get('/api/search', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  
  const results = [
    ...mockData.channels.filter(c => c.name.toLowerCase().includes(query)),
    ...mockData.movies.filter(m => m.name.toLowerCase().includes(query)),
    ...mockData.series.filter(s => s.name.toLowerCase().includes(query))
  ];
  
  res.json({
    success: true,
    data: results,
    total: results.length
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index-with-api.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎬 Nova TV Server running on http://localhost:${PORT}`);
  console.log(`📺 Open http://localhost:${PORT} in your browser`);
});
