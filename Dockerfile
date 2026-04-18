FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Declare build-time args so next build can bake them into the JS bundle
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
# Use next directly so Railway's SIGTERM reaches the Node process (npm doesn't forward signals)
CMD ["node_modules/.bin/next", "start"]
