# Supabase Setup Instructions

## 1. SQL Setup (выполнено ✅)

Зайди в Supabase Dashboard → SQL Editor и выполни:

```sql
-- Create game_state table
CREATE TABLE game_state (
  id TEXT PRIMARY KEY DEFAULT 'main',
  state JSONB NOT NULL,
  tick INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial empty state
INSERT INTO game_state (id, state, tick)
VALUES ('main', '{}', 0);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
```

## 2. Локальное тестирование

### Запуск Vite (фронтенд):
```bash
npm run dev
```

### Проксирование API запросов:

Добавь в `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

### Запуск Vercel dev (API routes):
```bash
npx vercel dev --listen 3000
```

Теперь:
- Фронтенд: http://localhost:5173
- API прокс: http://localhost:5173/api/tick → http://localhost:3000/api/tick

## 3. Deploy на Vercel

### Environment Variables:

Добавь в Vercel Dashboard → Settings → Environment Variables:
```
SUPABASE_URL=https://fqlhuigagjzoecmaykgx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Deploy:
```bash
vercel --prod
```

## 4. Проверка работы

### В консоли браузера должно быть:
```
[Main] Loaded state from Supabase, tick: 0
[Realtime] Subscription status: SUBSCRIBED
[Tick] State updated, tick: 1
...
```

### Открой 2 вкладки:
- Оба должны видеть ОДНО И ТО ЖЕ состояние
- Обновления происходят в realtime

## 5. Troubleshooting

### Realtime не работает:
1. Проверь что таблица добавлена в publication:
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

2. Проверь RLS политики в Supabase Dashboard → Authentication → Policies

### API возвращает 500:
- Проверь логи в Vercel Dashboard → Functions
- Проверь что env vars установлены
