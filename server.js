import 'dotenv/config';
import app from './api/index.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Server] Local development server running on http://localhost:${PORT}`);
  console.log(`[Server] API endpoints available at http://localhost:${PORT}/api/*`);
});
