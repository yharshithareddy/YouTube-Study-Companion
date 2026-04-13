import express from 'express';
import cors from 'cors';
import sessionsRouter from './routes/sessions.js';
import notesRouter from './routes/notes.js';
import pomodoroRouter from './routes/pomodoro.js';
import recommendationsRouter from './routes/recommendations.js';

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use('/sessions', sessionsRouter);
app.use('/sessions', notesRouter);
app.use('/sessions', pomodoroRouter);
app.use('/recommendations', recommendationsRouter);
app.get('/', (req, res) => {
  res.json({ message: 'Study Companion API is running' });
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

