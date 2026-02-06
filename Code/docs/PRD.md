# NextWatch - Product Requirements Document (PRD)

## Executive Summary

**Product Name:** NextWatch
**Tagline:** "Find your next watch, together"
**Problem Statement:** People waste significant time deciding what movie or show to watch together, especially couples and friend groups with different tastes.
**Solution:** A collaborative movie recommendation app that learns individual preferences through swipe-based rating and matches them to suggest movies everyone will enjoy.

---

## Product Vision

### Target Users
1. **Couples** - Partners with different movie tastes trying to find common ground
2. **Friend Groups** - 3-5 friends planning a movie night
3. **Families** - Parents and kids/teens finding age-appropriate content everyone likes

### Core Value Proposition
- **Save Time** - No more 30-minute debates about what to watch
- **Fair Recommendations** - Algorithm considers everyone's preferences equally
- **Learn Over Time** - The more you rate, the better suggestions become

---

## Feature Specification

### Phase 1: Foundation (MVP)

#### 1.1 User Authentication
- **Sign up** with email/password or social login (Google, Apple)
- **User profile** with display name and optional avatar
- **Account management** - password reset, email verification
- **Tech:** Supabase Auth

#### 1.2 Movie Rating (Swipe Interface)
- **Curated Feed** - Movies presented one at a time (Tinder-style)
- **Rating Actions:**
  - 👎 **Skip** - Not interested / Already seen
  - 👍 **Like** - Would watch this
  - ❤️ **Love** - Really want to watch
  - 🔥 **Super Like** - Must watch, top priority
- **Movie Card displays:**
  - Poster image
  - Title + Year
  - Genre tags
  - TMDB rating
  - Brief synopsis (expandable)
- **Browse Mode** - Search and rate specific movies/shows
- **Content Toggle** - Switch between Movies and TV Shows
- **Tech:** Trakt API (trending, recommendations) + OMDb API (metadata, ratings, posters)

#### 1.3 User Preference Profile
- **Rated movies history** - All movies user has rated
- **Genre affinity** - Auto-calculated from ratings
- **Stats** - Total rated, favorite genres, rating distribution

### Phase 2: Matching

#### 2.1 Friends System
- **Add friends** via username search or invite link
- **Friends list** with online status
- **Friend requests** - send, accept, decline
- **Tech:** Supabase Realtime for presence

#### 2.2 Session Creation
- **Quick Session** - Generate shareable code/link
- **Select Friends** - Choose from friends list
- **Session Settings:**
  - Movie or TV Show
  - Genre preferences (optional filter)
  - Release year range (optional)

#### 2.3 Matching Algorithm
- **Input:** Ratings from all session participants
- **Output:** Categorized recommendations
  - 🎯 **Perfect Match** - Everyone rated highly
  - 👍 **Great for Most** - Majority rated highly
  - 🤝 **Compromise Picks** - Balanced across all preferences
- **Scoring factors:**
  - Individual rating weight (Super Like > Love > Like)
  - Genre alignment across users
  - No negative ratings from anyone

---

## Recommendation Algorithm Specification

### Approach: Content-Based Filtering (Real-time)

**Why Content-Based for MVP:**
- Works immediately with first rating (no cold-start)
- Doesn't need large user base
- Explainable recommendations
- Real-time updates after each swipe

### User Preference Profile Schema

```javascript
// Stored in Supabase, updated real-time
userPreferenceProfile = {
  userId: "uuid",

  // Genre affinity (0.0 to 1.0)
  genreAffinity: {
    "Action": 0.85,
    "Sci-Fi": 0.72,
    "Comedy": 0.45,
    "Horror": 0.12,
    // ... all genres
  },

  // Director preferences (learned from ratings)
  directorAffinity: {
    "Christopher Nolan": 0.95,
    "Denis Villeneuve": 0.80
  },

  // Actor preferences
  actorAffinity: {
    "Leonardo DiCaprio": 0.88
  },

  // Rating patterns
  stats: {
    totalRated: 280,
    superLikes: 15,
    loves: 42,
    likes: 89,
    skips: 134,
    avgPreferredYear: 2015,
    avgPreferredRating: 7.2
  },

  updatedAt: "timestamp"
}
```

### Affinity Calculation

```javascript
// When user rates a movie
function updateAffinity(userProfile, movie, rating) {
  const ratingWeight = {
    'super_like': 1.0,
    'love': 0.75,
    'like': 0.5,
    'skip': -0.3  // Negative signal
  };

  const weight = ratingWeight[rating];
  const decayFactor = 0.95; // Older ratings matter less

  // Update genre affinity
  movie.genres.forEach(genre => {
    const currentAffinity = userProfile.genreAffinity[genre] || 0.5;
    const newAffinity = (currentAffinity * decayFactor) + (weight * (1 - decayFactor));
    userProfile.genreAffinity[genre] = Math.max(0, Math.min(1, newAffinity));
  });

  // Update director affinity
  if (movie.director && weight > 0) {
    const current = userProfile.directorAffinity[movie.director] || 0.5;
    userProfile.directorAffinity[movie.director] =
      Math.min(1, current + (weight * 0.1));
  }

  // Update actor affinity (top 3 cast)
  movie.cast.slice(0, 3).forEach(actor => {
    if (weight > 0) {
      const current = userProfile.actorAffinity[actor] || 0.5;
      userProfile.actorAffinity[actor] = Math.min(1, current + (weight * 0.05));
    }
  });

  return userProfile;
}
```

### Movie Scoring for Feed

```javascript
function scoreMovieForUser(movie, userProfile) {
  let score = 0;
  let weights = { genre: 0.40, director: 0.20, actor: 0.15, quality: 0.15, recency: 0.10 };

  // Genre match (40%)
  const genreScore = movie.genres.reduce((sum, genre) =>
    sum + (userProfile.genreAffinity[genre] || 0.5), 0) / movie.genres.length;
  score += genreScore * weights.genre;

  // Director match (20%)
  const directorScore = userProfile.directorAffinity[movie.director] || 0.5;
  score += directorScore * weights.director;

  // Actor match (15%)
  const actorScores = movie.cast.slice(0, 5).map(actor =>
    userProfile.actorAffinity[actor] || 0.5);
  const actorScore = actorScores.length > 0 ?
    actorScores.reduce((a, b) => a + b) / actorScores.length : 0.5;
  score += actorScore * weights.actor;

  // Quality score from IMDb (15%)
  score += (movie.imdbRating / 10) * weights.quality;

  // Recency preference (10%)
  const yearDiff = Math.abs(movie.year - userProfile.stats.avgPreferredYear);
  const recencyScore = Math.max(0, 1 - (yearDiff / 30));
  score += recencyScore * weights.recency;

  return score; // 0.0 to 1.0
}
```

### Group Matching Algorithm

```javascript
function calculateGroupMatches(sessionParticipants) {
  // Get all movies rated by any participant
  const candidateMovies = getCandidateMovies(sessionParticipants);

  const results = {
    perfect: [],      // Score > 0.8, Agreement > 90%
    greatForMost: [], // Score > 0.6, Agreement > 70%
    compromise: []    // Score > 0.5, No negative ratings
  };

  candidateMovies.forEach(movie => {
    const userScores = sessionParticipants.map(user => ({
      userId: user.id,
      rating: getUserRating(user.id, movie.id),
      predictedScore: scoreMovieForUser(movie, user.profile)
    }));

    // Calculate group metrics
    const avgScore = average(userScores.map(s => s.predictedScore));
    const agreement = calculateAgreement(userScores);
    const hasSkip = userScores.some(s => s.rating === 'skip');

    // Categorize
    if (avgScore >= 0.8 && agreement >= 0.9 && !hasSkip) {
      results.perfect.push({ movie, avgScore, agreement });
    } else if (avgScore >= 0.6 && agreement >= 0.7 && !hasSkip) {
      results.greatForMost.push({ movie, avgScore, agreement });
    } else if (avgScore >= 0.5 && !hasSkip) {
      results.compromise.push({ movie, avgScore, agreement });
    }
  });

  // Sort each category by score
  Object.keys(results).forEach(key => {
    results[key].sort((a, b) => b.avgScore - a.avgScore);
  });

  return results;
}

function calculateAgreement(userScores) {
  // Standard deviation - lower = more agreement
  const scores = userScores.map(s => s.predictedScore);
  const mean = average(scores);
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Convert to 0-1 agreement score (inverse of std dev)
  return Math.max(0, 1 - (stdDev * 2));
}
```

### Database Tables for Algorithm

```sql
-- User preference profiles (real-time updated)
CREATE TABLE user_preferences (
  user_id UUID REFERENCES profiles(id) PRIMARY KEY,
  genre_affinity JSONB DEFAULT '{}',
  director_affinity JSONB DEFAULT '{}',
  actor_affinity JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{"totalRated": 0}',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger to update preferences after each rating
CREATE OR REPLACE FUNCTION update_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Called by application layer after rating insert
  -- Updates genre_affinity, director_affinity, etc.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Feed Curation Strategy

1. **New Users (< 10 ratings):** Show trending/popular movies
2. **Building Profile (10-50 ratings):** Mix of trending + personalized
3. **Established (50+ ratings):** Primarily personalized recommendations

```javascript
function getCuratedFeed(userId, page) {
  const profile = getUserProfile(userId);
  const totalRated = profile.stats.totalRated;

  if (totalRated < 10) {
    // New user: 80% trending, 20% genre-based
    return mixFeed(getTrending(), getByTopGenres(profile), 0.8, 0.2);
  } else if (totalRated < 50) {
    // Building: 50% personalized, 50% discovery
    return mixFeed(getPersonalized(profile), getDiscovery(), 0.5, 0.5);
  } else {
    // Established: 70% personalized, 30% discovery
    return mixFeed(getPersonalized(profile), getDiscovery(), 0.7, 0.3);
  }
}
```

### Phase 3: Enhanced Features

#### 3.1 Watchlist
- Save matched movies for later
- Mark as "Watched" with post-watch rating
- Share watchlist with friends

#### 3.2 Streaming Availability (Future)
- Show where movie is available (Netflix, Prime, etc.)
- Filter by user's subscriptions
- Tech: JustWatch API or similar

#### 3.3 Advanced Matching
- "Mood" matching (quick watch vs. binge)
- Episode length considerations for TV
- Seasonal/holiday recommendations

---

## Technical Architecture

### Current State
```
┌─────────────────────────────────────────┐
│           NextWatch (Current)           │
├─────────────────────────────────────────┤
│  React 18 + Vite (Web only)             │
│  localStorage (favorites)               │
│  TMDB API (movie data)                  │
│  No authentication                      │
│  No backend                             │
└─────────────────────────────────────────┘
```

### Target Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    NextWatch (Target)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌───────────────┐         ┌───────────────┐              │
│   │   React Web   │         │ React Native  │              │
│   │   (Vite)      │         │  (iOS/Android)│              │
│   └───────┬───────┘         └───────┬───────┘              │
│           │                         │                       │
│           └────────────┬────────────┘                       │
│                        │                                    │
│                        ▼                                    │
│           ┌────────────────────────┐                        │
│           │   Shared Components    │                        │
│           │   (if using Tamagui/   │                        │
│           │    React Native Web)   │                        │
│           └────────────┬───────────┘                        │
│                        │                                    │
│                        ▼                                    │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                    Supabase                          │  │
│   ├─────────────────────────────────────────────────────┤  │
│   │  Auth          │  Database      │  Realtime         │  │
│   │  - Email/Pass  │  - Users       │  - Presence       │  │
│   │  - Google      │  - Ratings     │  - Sessions       │  │
│   │  - Apple       │  - Friends     │  - Notifications  │  │
│   │                │  - Sessions    │                   │  │
│   └─────────────────────────────────────────────────────┘  │
│                        │                                    │
│                        ▼                                    │
│           ┌────────────────────────┐                        │
│           │       TMDB API         │                        │
│           │    (Movie Data)        │                        │
│           └────────────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema (Supabase/PostgreSQL)

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Content Ratings (Movies & TV Shows)
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  content_id INTEGER NOT NULL,  -- TMDB movie or TV ID
  content_type TEXT CHECK (content_type IN ('movie', 'tv')),
  rating TEXT CHECK (rating IN ('skip', 'like', 'love', 'super_like')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, content_id, content_type)
);

-- Friendships
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  friend_id UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Watch Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,  -- Shareable code
  host_id UUID REFERENCES profiles(id),
  settings JSONB,  -- genres, year range, etc.
  status TEXT CHECK (status IN ('waiting', 'active', 'completed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Session Participants
CREATE TABLE session_participants (
  session_id UUID REFERENCES sessions(id),
  user_id UUID REFERENCES profiles(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

-- Session Results (cached recommendations)
CREATE TABLE session_results (
  session_id UUID REFERENCES sessions(id) PRIMARY KEY,
  perfect_matches JSONB,  -- Array of movie IDs
  great_for_most JSONB,
  compromise_picks JSONB,
  generated_at TIMESTAMP DEFAULT NOW()
);
```

### Tech Stack Summary

| Layer | Technology | Reason |
|-------|------------|--------|
| Web Frontend | React 18 + Vite | Existing, fast, modern |
| Mobile | React Native | Code reuse, single codebase |
| UI Components | Tamagui (optional) | Share components web + native |
| Auth | Supabase Auth | Easy social login, JWT |
| Database | Supabase (PostgreSQL) | Relational, good for queries |
| Realtime | Supabase Realtime | Sessions, presence, notifications |
| Movie Data | Trakt + OMDb APIs | Trakt for trending/social, OMDb for metadata/ratings |
| Hosting (Web) | Vercel / Netlify | Free, easy deployment |
| Hosting (API) | Supabase (managed) | No server management |

### API Strategy: Trakt + OMDb Hybrid

**Why this combination:**
- TMDB is blocked in India, need reliable alternatives
- Both have generous free tiers for MVP testing
- Complementary features

| API | Used For | Free Tier |
|-----|----------|-----------|
| **Trakt API** | Trending movies/shows, recommendations, discover feed | Generous limits |
| **OMDb API** | Detailed metadata, IMDb/RT ratings, poster images | 1,000 calls/day |

**Data Flow:**
```
User opens app
    ↓
Trakt API → Get trending/popular movies
    ↓
OMDb API → Enrich with ratings, posters, plot
    ↓
Display to user
```

**API Keys Required:**
1. Trakt: https://trakt.tv/oauth/applications (free account)
2. OMDb: https://www.omdbapi.com/apikey.aspx (free tier)

**Future Enhancement:** Add Watchmode API for "Where to Watch" feature

---

## Technical Implementation Details

### 1. API Integration (Trakt + OMDb)

#### Environment Variables
```env
# .env file
VITE_TRAKT_CLIENT_ID=your_trakt_client_id
VITE_TRAKT_CLIENT_SECRET=your_trakt_client_secret
VITE_OMDB_API_KEY=your_omdb_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Trakt API Service (`src/services/trakt.js`)
```javascript
const TRAKT_API_URL = 'https://api.trakt.tv';
const CLIENT_ID = import.meta.env.VITE_TRAKT_CLIENT_ID;

const headers = {
  'Content-Type': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': CLIENT_ID
};

// Get trending movies
export async function getTrendingMovies(page = 1, limit = 20) {
  const response = await fetch(
    `${TRAKT_API_URL}/movies/trending?page=${page}&limit=${limit}`,
    { headers }
  );
  return response.json();
}

// Get trending TV shows
export async function getTrendingShows(page = 1, limit = 20) {
  const response = await fetch(
    `${TRAKT_API_URL}/shows/trending?page=${page}&limit=${limit}`,
    { headers }
  );
  return response.json();
}

// Get popular movies
export async function getPopularMovies(page = 1, limit = 20) {
  const response = await fetch(
    `${TRAKT_API_URL}/movies/popular?page=${page}&limit=${limit}`,
    { headers }
  );
  return response.json();
}

// Search movies and shows
export async function searchContent(query, type = 'movie') {
  const response = await fetch(
    `${TRAKT_API_URL}/search/${type}?query=${encodeURIComponent(query)}`,
    { headers }
  );
  return response.json();
}

// Get movie details
export async function getMovieDetails(traktId) {
  const response = await fetch(
    `${TRAKT_API_URL}/movies/${traktId}?extended=full`,
    { headers }
  );
  return response.json();
}

// Get recommendations based on a movie
export async function getRecommendations(traktId, type = 'movies') {
  const response = await fetch(
    `${TRAKT_API_URL}/${type}/${traktId}/related`,
    { headers }
  );
  return response.json();
}
```

#### OMDb API Service (`src/services/omdb.js`)
```javascript
const OMDB_API_URL = 'https://www.omdbapi.com';
const API_KEY = import.meta.env.VITE_OMDB_API_KEY;

// Get movie by IMDb ID (preferred - most accurate)
export async function getMovieByImdbId(imdbId) {
  const response = await fetch(
    `${OMDB_API_URL}/?apikey=${API_KEY}&i=${imdbId}&plot=full`
  );
  return response.json();
}

// Get movie by title (fallback)
export async function getMovieByTitle(title, year = null) {
  let url = `${OMDB_API_URL}/?apikey=${API_KEY}&t=${encodeURIComponent(title)}&plot=full`;
  if (year) url += `&y=${year}`;
  const response = await fetch(url);
  return response.json();
}

// Search movies
export async function searchMovies(query, page = 1) {
  const response = await fetch(
    `${OMDB_API_URL}/?apikey=${API_KEY}&s=${encodeURIComponent(query)}&page=${page}`
  );
  return response.json();
}
```

#### Combined Movie Service (`src/services/movies.js`)
```javascript
import * as trakt from './trakt';
import * as omdb from './omdb';

// Cache to avoid duplicate OMDb calls
const omdbCache = new Map();

// Get enriched movie data (Trakt + OMDb combined)
export async function getEnrichedMovie(traktMovie) {
  const imdbId = traktMovie.ids?.imdb;

  // Check cache first
  if (imdbId && omdbCache.has(imdbId)) {
    return { ...traktMovie, omdb: omdbCache.get(imdbId) };
  }

  // Fetch from OMDb
  let omdbData = null;
  if (imdbId) {
    omdbData = await omdb.getMovieByImdbId(imdbId);
    if (omdbData.Response !== 'False') {
      omdbCache.set(imdbId, omdbData);
    }
  }

  return {
    // Trakt data
    id: traktMovie.ids?.trakt,
    imdbId: imdbId,
    tmdbId: traktMovie.ids?.tmdb,
    title: traktMovie.title,
    year: traktMovie.year,
    overview: traktMovie.overview,
    runtime: traktMovie.runtime,
    genres: traktMovie.genres || [],

    // OMDb enrichment
    poster: omdbData?.Poster !== 'N/A' ? omdbData?.Poster : null,
    imdbRating: parseFloat(omdbData?.imdbRating) || null,
    rottenTomatoes: extractRTRating(omdbData?.Ratings),
    director: omdbData?.Director,
    actors: omdbData?.Actors?.split(', ') || [],
    plot: omdbData?.Plot || traktMovie.overview,
  };
}

function extractRTRating(ratings) {
  if (!ratings) return null;
  const rt = ratings.find(r => r.Source === 'Rotten Tomatoes');
  return rt ? parseInt(rt.Value) : null;
}

// Get feed for user
export async function getFeedMovies(page = 1) {
  const trending = await trakt.getTrendingMovies(page);

  // Enrich top 10 with OMDb data (rate limit friendly)
  const enriched = await Promise.all(
    trending.slice(0, 10).map(item => getEnrichedMovie(item.movie))
  );

  return enriched;
}
```

---

### 2. Supabase Setup & Queries

#### Initial Setup (`src/services/supabase.js`)
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### Complete Database Schema with RLS
```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Ratings table
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id TEXT NOT NULL,  -- IMDb ID (tt1234567)
  content_type TEXT CHECK (content_type IN ('movie', 'tv')) NOT NULL,
  rating TEXT CHECK (rating IN ('skip', 'like', 'love', 'super_like')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id, content_type)
);

-- RLS Policies for ratings
CREATE POLICY "Users can view own ratings"
  ON ratings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ratings"
  ON ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings"
  ON ratings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Friends can view each other's ratings for matching"
  ON ratings FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND ((user_id = auth.uid() AND friend_id = ratings.user_id)
           OR (friend_id = auth.uid() AND user_id = ratings.user_id))
    )
  );

-- User preferences table
CREATE TABLE user_preferences (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  genre_affinity JSONB DEFAULT '{}',
  director_affinity JSONB DEFAULT '{}',
  actor_affinity JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{"totalRated": 0, "superLikes": 0, "loves": 0, "likes": 0, "skips": 0}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for user_preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Friendships table
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- RLS for friendships
CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they're part of"
  ON friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  content_type TEXT CHECK (content_type IN ('movie', 'tv', 'both')) DEFAULT 'both',
  settings JSONB DEFAULT '{}',
  status TEXT CHECK (status IN ('waiting', 'active', 'completed')) DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Session participants table
CREATE TABLE session_participants (
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

-- RLS for sessions
CREATE POLICY "Session participants can view session"
  ON sessions FOR SELECT
  USING (
    host_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM session_participants
      WHERE session_id = sessions.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can join with valid code"
  ON sessions FOR SELECT
  USING (status = 'waiting');

-- Session results table (cached recommendations)
CREATE TABLE session_results (
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE PRIMARY KEY,
  perfect_matches JSONB DEFAULT '[]',
  great_for_most JSONB DEFAULT '[]',
  compromise_picks JSONB DEFAULT '[]',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to generate session code
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate session code
CREATE OR REPLACE FUNCTION set_session_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_session_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_code_trigger
  BEFORE INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_session_code();
```

#### Common Database Queries (`src/services/database.js`)
```javascript
import { supabase } from './supabase';

// ============ PROFILES ============

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

export async function searchProfiles(query) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', `%${query}%`)
    .limit(10);
  return { data, error };
}

// ============ RATINGS ============

export async function addRating(userId, contentId, contentType, rating) {
  const { data, error } = await supabase
    .from('ratings')
    .upsert({
      user_id: userId,
      content_id: contentId,
      content_type: contentType,
      rating: rating
    }, {
      onConflict: 'user_id,content_id,content_type'
    })
    .select()
    .single();
  return { data, error };
}

export async function getUserRatings(userId, contentType = null) {
  let query = supabase
    .from('ratings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (contentType) {
    query = query.eq('content_type', contentType);
  }

  const { data, error } = await query;
  return { data, error };
}

export async function getRatingsByContent(contentId) {
  const { data, error } = await supabase
    .from('ratings')
    .select('rating, user_id')
    .eq('content_id', contentId);
  return { data, error };
}

// ============ USER PREFERENCES ============

export async function getUserPreferences(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function updateUserPreferences(userId, preferences) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      ...preferences,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  return { data, error };
}

// ============ FRIENDSHIPS ============

export async function sendFriendRequest(userId, friendId) {
  const { data, error } = await supabase
    .from('friendships')
    .insert({ user_id: userId, friend_id: friendId })
    .select()
    .single();
  return { data, error };
}

export async function respondToFriendRequest(friendshipId, accept) {
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', friendshipId)
    .select()
    .single();
  return { data, error };
}

export async function getFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      status,
      user:profiles!friendships_user_id_fkey(id, username, display_name, avatar_url),
      friend:profiles!friendships_friend_id_fkey(id, username, display_name, avatar_url)
    `)
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');
  return { data, error };
}

export async function getPendingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      created_at,
      user:profiles!friendships_user_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('friend_id', userId)
    .eq('status', 'pending');
  return { data, error };
}

// ============ SESSIONS ============

export async function createSession(hostId, name, contentType = 'both') {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      host_id: hostId,
      name: name,
      content_type: contentType
    })
    .select()
    .single();

  if (data) {
    // Add host as participant
    await supabase
      .from('session_participants')
      .insert({ session_id: data.id, user_id: hostId });
  }

  return { data, error };
}

export async function joinSession(code, userId) {
  // Find session by code
  const { data: session, error: findError } = await supabase
    .from('sessions')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('status', 'waiting')
    .single();

  if (findError || !session) {
    return { data: null, error: findError || { message: 'Session not found' } };
  }

  // Add participant
  const { error: joinError } = await supabase
    .from('session_participants')
    .insert({ session_id: session.id, user_id: userId });

  return { data: session, error: joinError };
}

export async function getSessionParticipants(sessionId) {
  const { data, error } = await supabase
    .from('session_participants')
    .select(`
      joined_at,
      user:profiles(id, username, display_name, avatar_url)
    `)
    .eq('session_id', sessionId);
  return { data, error };
}

export async function getSessionWithParticipants(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      host:profiles!sessions_host_id_fkey(id, username, display_name, avatar_url),
      participants:session_participants(
        user:profiles(id, username, display_name, avatar_url)
      )
    `)
    .eq('id', sessionId)
    .single();
  return { data, error };
}
```

---

### 3. Authentication Flow

#### Auth Context (`src/contexts/AuthContext.jsx`)
```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  // Sign up with email
  async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) return { error };

    // Create profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          username: username,
          display_name: username
        });

      // Initialize preferences
      await supabase
        .from('user_preferences')
        .insert({ user_id: data.user.id });

      if (profileError) return { error: profileError };
    }

    return { data };
  }

  // Sign in with email
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }

  // Sign in with Google
  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    return { data, error };
  }

  // Sign out
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  // Reset password
  async function resetPassword(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return { data, error };
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    refreshProfile: () => user && fetchProfile(user.id)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

#### Protected Route Component (`src/components/ProtectedRoute.jsx`)
```jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
```

#### Auth Pages Structure
```jsx
// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  }

  async function handleGoogleSignIn() {
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  }

  return (
    <div className="auth-page">
      <h1>Welcome Back</h1>
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="divider">or</div>

      <button onClick={handleGoogleSignIn} className="google-btn">
        Continue with Google
      </button>

      <p>
        Don't have an account? <Link to="/signup">Sign Up</Link>
      </p>
      <p>
        <Link to="/forgot-password">Forgot Password?</Link>
      </p>
    </div>
  );
}
```

#### Updated App Router (`src/App.jsx`)
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MovieProvider } from './contexts/MovieContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import NavBar from './components/NavBar';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import AuthCallback from './pages/AuthCallback';
import Profile from './pages/Profile';
import Swipe from './pages/Swipe';
import Friends from './pages/Friends';
import Session from './pages/Session';
import Favorites from './pages/Favorites';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MovieProvider>
          <NavBar />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute><Home /></ProtectedRoute>
            } />
            <Route path="/swipe" element={
              <ProtectedRoute><Swipe /></ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute><Profile /></ProtectedRoute>
            } />
            <Route path="/friends" element={
              <ProtectedRoute><Friends /></ProtectedRoute>
            } />
            <Route path="/session/:id?" element={
              <ProtectedRoute><Session /></ProtectedRoute>
            } />
            <Route path="/favorites" element={
              <ProtectedRoute><Favorites /></ProtectedRoute>
            } />
          </Routes>
        </MovieProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

---

## Implementation Roadmap

### Sprint 1: Auth Foundation (Week 1-2)
- [ ] Set up Supabase project
- [ ] Implement email/password signup & login
- [ ] Create user profile page
- [ ] Add Google OAuth
- [ ] Migrate from localStorage to Supabase for favorites
- [ ] Update UI for logged-in state

### Sprint 2: Swipe Rating System (Week 3-4)
- [ ] Design swipe card component
- [ ] Implement swipe gestures (web: drag, mobile: touch)
- [ ] Create curated movie feed algorithm
- [ ] Build rating storage in Supabase
- [ ] Add browse/search mode for specific movies
- [ ] Create user profile with rating history

### Sprint 3: Friends & Sessions (Week 5-6)
- [ ] Implement friend request system
- [ ] Build friends list UI
- [ ] Create session generation (codes/links)
- [ ] Implement session joining flow
- [ ] Add realtime presence (who's online)

### Sprint 4: Matching Algorithm (Week 7-8)
- [ ] Design matching algorithm logic
- [ ] Implement category scoring (Perfect/Great/Compromise)
- [ ] Build results display UI
- [ ] Add "Save to Watchlist" feature
- [ ] Implement session history

### Sprint 5: React Native Mobile App (Week 9-12)
- [ ] Set up React Native project
- [ ] Port authentication screens
- [ ] Implement swipe gestures (native)
- [ ] Port all screens to mobile
- [ ] Test on iOS and Android
- [ ] App store preparation

### Sprint 6: Polish & Launch (Week 13-14)
- [ ] UI/UX refinement
- [ ] Performance optimization
- [ ] Error handling & edge cases
- [ ] Beta testing with real users
- [ ] Launch web app
- [ ] Submit to app stores

---

## Design Requirements

### Design Principles
1. **Delightful Interactions** - Swipe animations should feel smooth and satisfying
2. **Dark Mode First** - Primary interface is dark (movie theater feel)
3. **Visual Hierarchy** - Movie posters are the hero, UI elements secondary
4. **Instant Feedback** - Every action has immediate visual response
5. **Accessibility** - Support for screen readers, color blind users

### Key Screens to Design
1. **Onboarding** - Welcome, signup, initial genre preferences
2. **Home/Feed** - Swipe interface with movie cards
3. **Movie Detail** - Full info, trailer, cast, ratings
4. **Profile** - User stats, rating history, settings
5. **Friends** - List, requests, search
6. **Session** - Create, join, waiting room, results
7. **Results** - Categorized recommendations with actions

### Design Tools to Consider
- **Figma** - For mockups and prototypes
- **Framer Motion** - Web animations
- **Reanimated** - React Native animations
- **Tamagui** - Cross-platform component library

---

## Metrics & Success Criteria

### MVP Success Metrics
- [ ] Users can create account and login
- [ ] Users can rate 50+ movies via swipe
- [ ] Two users can connect and get recommendations
- [ ] Recommendations feel relevant (user feedback)

### Growth Metrics (Post-Launch)
- Daily Active Users (DAU)
- Movies rated per user per session
- Sessions created per week
- Friend connections made
- Time from session start to movie selection

---

## React Native Mobile App Implementation

### Project Setup

#### Using Expo (Recommended for faster development)
```bash
# Create new Expo project
npx create-expo-app@latest NextWatch-mobile --template blank-typescript

# Navigate to project
cd NextWatch-mobile

# Install dependencies
npx expo install @supabase/supabase-js
npx expo install react-native-url-polyfill
npx expo install @react-native-async-storage/async-storage
npx expo install expo-secure-store
npx expo install expo-auth-session expo-web-browser
npx expo install react-native-gesture-handler
npx expo install react-native-reanimated
npm install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
```

### Mobile Project Structure

```
NextWatch-mobile/
├── app.json                    # Expo config
├── App.tsx                     # Entry point
├── babel.config.js
├── tsconfig.json
├── src/
│   ├── components/
│   │   ├── SwipeCard.tsx       # Swipeable movie card
│   │   ├── MovieCard.tsx
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── SignupScreen.tsx
│   │   │   └── ForgotPasswordScreen.tsx
│   │   ├── main/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── SwipeScreen.tsx
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── FriendsScreen.tsx
│   │   │   └── SessionScreen.tsx
│   │   └── index.ts
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Shared with web (slightly modified)
│   │   └── MovieContext.tsx
│   ├── services/
│   │   ├── supabase.ts         # Mobile Supabase client
│   │   ├── trakt.ts            # Same as web
│   │   ├── omdb.ts             # Same as web
│   │   └── movies.ts           # Same as web
│   ├── hooks/
│   │   ├── useSwipeGesture.ts
│   │   └── useAuth.ts
│   ├── lib/
│   │   └── matching.ts         # Same as web
│   ├── styles/
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   └── typography.ts
│   └── types/
│       └── index.ts
└── assets/
    ├── icon.png
    ├── splash.png
    └── adaptive-icon.png
```

### Mobile Supabase Client (`src/services/supabase.ts`)
```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Navigation Setup (`src/navigation/AppNavigator.tsx`)
```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### Swipe Gesture Implementation (`src/hooks/useSwipeGesture.ts`)
```typescript
import { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';

type SwipeDirection = 'left' | 'right' | 'up';

interface UseSwipeGestureProps {
  onSwipeLeft: () => void;   // Skip
  onSwipeRight: () => void;  // Like
  onSwipeUp: () => void;     // Super Like
  threshold?: number;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  threshold = 120
}: UseSwipeGestureProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      rotation.value = event.translationX / 20; // Tilt effect
    })
    .onEnd((event) => {
      const { translationX, translationY, velocityX, velocityY } = event;

      // Swipe right (Like)
      if (translationX > threshold || velocityX > 500) {
        translateX.value = withSpring(500);
        runOnJS(onSwipeRight)();
      }
      // Swipe left (Skip)
      else if (translationX < -threshold || velocityX < -500) {
        translateX.value = withSpring(-500);
        runOnJS(onSwipeLeft)();
      }
      // Swipe up (Super Like)
      else if (translationY < -threshold || velocityY < -500) {
        translateY.value = withSpring(-500);
        runOnJS(onSwipeUp)();
      }
      // Return to center
      else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotation.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const reset = () => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    rotation.value = withSpring(0);
  };

  return { gesture, animatedStyle, reset };
}
```

### SwipeCard Component (`src/components/SwipeCard.tsx`)
```typescript
import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { Movie } from '../types';
import { colors, spacing } from '../styles';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = height * 0.7;

interface SwipeCardProps {
  movie: Movie;
  onRate: (rating: 'skip' | 'like' | 'love' | 'super_like') => void;
}

export default function SwipeCard({ movie, onRate }: SwipeCardProps) {
  const { gesture, animatedStyle, reset } = useSwipeGesture({
    onSwipeLeft: () => {
      onRate('skip');
      setTimeout(reset, 300);
    },
    onSwipeRight: () => {
      onRate('like');
      setTimeout(reset, 300);
    },
    onSwipeUp: () => {
      onRate('super_like');
      setTimeout(reset, 300);
    },
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Image
          source={{ uri: movie.poster }}
          style={styles.poster}
          resizeMode="cover"
        />
        <View style={styles.overlay}>
          <View style={styles.info}>
            <Text style={styles.title}>{movie.title}</Text>
            <Text style={styles.year}>{movie.year}</Text>
            <View style={styles.genres}>
              {movie.genres.slice(0, 3).map((genre) => (
                <View key={genre} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre}</Text>
                </View>
              ))}
            </View>
            {movie.imdbRating && (
              <View style={styles.rating}>
                <Text style={styles.ratingText}>⭐ {movie.imdbRating}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  },
  info: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  year: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  genres: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  genreTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  genreText: {
    color: colors.text,
    fontSize: 12,
  },
  rating: {
    marginTop: spacing.sm,
  },
  ratingText: {
    fontSize: 16,
    color: colors.accent,
  },
});
```

### Swipe Screen (`src/screens/main/SwipeScreen.tsx`)
```typescript
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import SwipeCard from '../../components/SwipeCard';
import ActionButtons from '../../components/ActionButtons';
import { getFeedMovies, getEnrichedMovie } from '../../services/movies';
import { addRating } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { Movie } from '../../types';
import { colors } from '../../styles';

export default function SwipeScreen() {
  const { user } = useAuth();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovies();
  }, []);

  async function loadMovies() {
    setLoading(true);
    const feedMovies = await getFeedMovies(1);
    setMovies(feedMovies);
    setLoading(false);
  }

  async function handleRate(rating: 'skip' | 'like' | 'love' | 'super_like') {
    const movie = movies[currentIndex];

    // Save rating to database
    await addRating(user!.id, movie.imdbId, 'movie', rating);

    // Move to next card
    setCurrentIndex((prev) => prev + 1);

    // Load more movies if running low
    if (currentIndex >= movies.length - 3) {
      const moreMovies = await getFeedMovies(Math.floor(currentIndex / 10) + 2);
      setMovies((prev) => [...prev, ...moreMovies]);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const currentMovie = movies[currentIndex];

  if (!currentMovie) {
    return (
      <View style={styles.empty}>
        <Text>No more movies to show!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SwipeCard movie={currentMovie} onRate={handleRate} />
      <ActionButtons
        onSkip={() => handleRate('skip')}
        onLike={() => handleRate('like')}
        onLove={() => handleRate('love')}
        onSuperLike={() => handleRate('super_like')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
```

### Design System (`src/styles/`)

#### Colors (`colors.ts`)
```typescript
export const colors = {
  // Primary
  primary: '#6366F1',      // Indigo
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',

  // Background
  background: '#0F0F0F',
  surface: '#1A1A1A',
  card: '#242424',

  // Text
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',

  // Actions
  like: '#22C55E',         // Green
  love: '#EC4899',         // Pink
  superLike: '#3B82F6',    // Blue
  skip: '#EF4444',         // Red

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // Misc
  border: '#374151',
  overlay: 'rgba(0, 0, 0, 0.7)',
};
```

#### Spacing (`spacing.ts`)
```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

### App Entry Point (`App.tsx`)
```typescript
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { MovieProvider } from './src/contexts/MovieContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <MovieProvider>
            <AppNavigator />
          </MovieProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### Expo Config (`app.json`)
```json
{
  "expo": {
    "name": "NextWatch",
    "slug": "nextwatch",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0F0F0F"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourname.nextwatch"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F0F0F"
      },
      "package": "com.yourname.nextwatch"
    },
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": {
            "compileSdkVersion": 34,
            "targetSdkVersion": 34
          }
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

### Code Sharing Strategy

**Files that can be shared between Web and Mobile:**
| File | Shareable | Notes |
|------|-----------|-------|
| `services/trakt.ts` | ✅ 100% | Pure API calls |
| `services/omdb.ts` | ✅ 100% | Pure API calls |
| `services/movies.ts` | ✅ 100% | Pure logic |
| `services/database.ts` | ✅ 100% | Supabase queries |
| `lib/matching.ts` | ✅ 100% | Algorithm logic |
| `types/index.ts` | ✅ 100% | TypeScript types |
| `contexts/AuthContext` | ⚠️ 90% | Minor storage differences |
| `components/*` | ❌ | Different UI components |

**Monorepo Option (Advanced):**
```
nextwatch/
├── packages/
│   ├── shared/           # Shared services, types, logic
│   │   ├── services/
│   │   ├── lib/
│   │   └── types/
│   ├── web/              # React web app
│   └── mobile/           # React Native app
├── package.json
└── turbo.json            # If using Turborepo
```

### Mobile Build & Deploy

```bash
# Development
npx expo start

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to App Store
eas submit --platform ios

# Submit to Play Store
eas submit --platform android
```

---

## Testing Strategy

### Testing Stack

| Tool | Purpose | Why |
|------|---------|-----|
| **Vitest** | Unit & Integration tests | Fast, Vite-native, Jest-compatible |
| **React Testing Library** | Component testing | Tests user behavior, not implementation |
| **MSW (Mock Service Worker)** | API mocking | Mock Trakt/OMDb/Supabase in tests |
| **Playwright** | E2E testing | Cross-browser, reliable |

### Test Structure

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── trakt.test.js
│   │   │   ├── omdb.test.js
│   │   │   ├── movies.test.js
│   │   │   └── database.test.js
│   │   ├── utils/
│   │   │   └── matching.test.js
│   │   └── hooks/
│   │       └── useAuth.test.js
│   ├── integration/
│   │   ├── auth.test.jsx
│   │   ├── rating.test.jsx
│   │   └── session.test.jsx
│   └── components/
│       ├── MovieCard.test.jsx
│       ├── SwipeCard.test.jsx
│       └── NavBar.test.jsx
├── e2e/
│   ├── auth.spec.js
│   ├── swipe.spec.js
│   ├── friends.spec.js
│   └── session.spec.js
└── mocks/
    ├── handlers.js
    ├── server.js
    └── data/
        ├── movies.json
        └── users.json
```

### Setup Files

#### Vitest Config (`vitest.config.js`)
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/__tests__/']
    }
  }
});
```

#### Test Setup (`src/__tests__/setup.js`)
```javascript
import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { server } from '../mocks/server';

// Start mock server before tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Close server after all tests
afterAll(() => server.close());
```

#### MSW Handlers (`src/mocks/handlers.js`)
```javascript
import { http, HttpResponse } from 'msw';

const mockMovies = [
  {
    ids: { trakt: 1, imdb: 'tt0111161' },
    title: 'The Shawshank Redemption',
    year: 1994,
    genres: ['drama', 'crime']
  },
  {
    ids: { trakt: 2, imdb: 'tt0068646' },
    title: 'The Godfather',
    year: 1972,
    genres: ['drama', 'crime']
  }
];

const mockOmdbData = {
  'tt0111161': {
    Title: 'The Shawshank Redemption',
    Year: '1994',
    imdbRating: '9.3',
    Poster: 'https://example.com/poster1.jpg',
    Director: 'Frank Darabont',
    Actors: 'Tim Robbins, Morgan Freeman',
    Plot: 'Two imprisoned men...'
  }
};

export const handlers = [
  // Trakt API mocks
  http.get('https://api.trakt.tv/movies/trending', () => {
    return HttpResponse.json(
      mockMovies.map(movie => ({ movie, watchers: 100 }))
    );
  }),

  http.get('https://api.trakt.tv/movies/popular', () => {
    return HttpResponse.json(mockMovies);
  }),

  http.get('https://api.trakt.tv/search/movie', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query')?.toLowerCase();
    const results = mockMovies.filter(m =>
      m.title.toLowerCase().includes(query)
    );
    return HttpResponse.json(results.map(movie => ({ movie })));
  }),

  // OMDb API mocks
  http.get('https://www.omdbapi.com/', ({ request }) => {
    const url = new URL(request.url);
    const imdbId = url.searchParams.get('i');
    const data = mockOmdbData[imdbId];
    return HttpResponse.json(data || { Response: 'False' });
  }),

  // Supabase Auth mocks
  http.post('*/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-token',
      user: { id: 'user-123', email: 'test@example.com' }
    });
  }),

  // Supabase Database mocks
  http.get('*/rest/v1/profiles*', () => {
    return HttpResponse.json([
      { id: 'user-123', username: 'testuser', display_name: 'Test User' }
    ]);
  }),

  http.post('*/rest/v1/ratings', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...body, id: 'rating-123' });
  })
];
```

#### MSW Server (`src/mocks/server.js`)
```javascript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Example Tests

#### Unit Test: Matching Algorithm (`src/__tests__/unit/utils/matching.test.js`)
```javascript
import { describe, it, expect } from 'vitest';
import { scoreMovieForUser, calculateGroupMatches } from '../../../lib/matching';

describe('Matching Algorithm', () => {
  const mockUserProfile = {
    genreAffinity: { 'action': 0.9, 'comedy': 0.3, 'drama': 0.7 },
    directorAffinity: { 'Christopher Nolan': 0.95 },
    actorAffinity: { 'Leonardo DiCaprio': 0.8 },
    stats: { avgPreferredYear: 2015 }
  };

  describe('scoreMovieForUser', () => {
    it('should score action movies highly for action-loving users', () => {
      const actionMovie = {
        genres: ['action', 'thriller'],
        director: 'Unknown',
        cast: ['Unknown Actor'],
        imdbRating: 7.5,
        year: 2020
      };

      const score = scoreMovieForUser(actionMovie, mockUserProfile);
      expect(score).toBeGreaterThan(0.6);
    });

    it('should score Nolan films highly', () => {
      const nolanMovie = {
        genres: ['sci-fi'],
        director: 'Christopher Nolan',
        cast: ['Unknown Actor'],
        imdbRating: 8.5,
        year: 2014
      };

      const score = scoreMovieForUser(nolanMovie, mockUserProfile);
      expect(score).toBeGreaterThan(0.7);
    });

    it('should score comedy movies lower for this user', () => {
      const comedyMovie = {
        genres: ['comedy', 'romance'],
        director: 'Unknown',
        cast: ['Unknown Actor'],
        imdbRating: 6.0,
        year: 2022
      };

      const score = scoreMovieForUser(comedyMovie, mockUserProfile);
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('calculateGroupMatches', () => {
    it('should categorize movies into perfect, great, and compromise', () => {
      const users = [
        { id: '1', profile: { genreAffinity: { action: 0.9 } } },
        { id: '2', profile: { genreAffinity: { action: 0.8 } } }
      ];

      const results = calculateGroupMatches(users);

      expect(results).toHaveProperty('perfect');
      expect(results).toHaveProperty('greatForMost');
      expect(results).toHaveProperty('compromise');
    });
  });
});
```

#### Component Test: SwipeCard (`src/__tests__/components/SwipeCard.test.jsx`)
```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SwipeCard from '../../components/SwipeCard';

describe('SwipeCard', () => {
  const mockMovie = {
    id: 1,
    title: 'Test Movie',
    year: 2024,
    poster: 'https://example.com/poster.jpg',
    genres: ['Action', 'Drama'],
    imdbRating: 8.5
  };

  const mockOnRate = vi.fn();

  beforeEach(() => {
    mockOnRate.mockClear();
  });

  it('renders movie information correctly', () => {
    render(<SwipeCard movie={mockMovie} onRate={mockOnRate} />);

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('8.5')).toBeInTheDocument();
  });

  it('calls onRate with "like" when like button clicked', () => {
    render(<SwipeCard movie={mockMovie} onRate={mockOnRate} />);

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    expect(mockOnRate).toHaveBeenCalledWith(mockMovie, 'like');
  });

  it('calls onRate with "super_like" when super like button clicked', () => {
    render(<SwipeCard movie={mockMovie} onRate={mockOnRate} />);

    const superLikeButton = screen.getByRole('button', { name: /super like/i });
    fireEvent.click(superLikeButton);

    expect(mockOnRate).toHaveBeenCalledWith(mockMovie, 'super_like');
  });

  it('calls onRate with "skip" when skip button clicked', () => {
    render(<SwipeCard movie={mockMovie} onRate={mockOnRate} />);

    const skipButton = screen.getByRole('button', { name: /skip/i });
    fireEvent.click(skipButton);

    expect(mockOnRate).toHaveBeenCalledWith(mockMovie, 'skip');
  });

  it('shows fallback when poster fails to load', () => {
    render(<SwipeCard movie={{ ...mockMovie, poster: null }} onRate={mockOnRate} />);

    expect(screen.getByText('No Poster')).toBeInTheDocument();
  });
});
```

#### Integration Test: Auth Flow (`src/__tests__/integration/auth.test.jsx`)
```javascript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import Login from '../../pages/Login';

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Authentication Flow', () => {
  it('shows error for invalid credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByPlaceholderText(/email/i), 'wrong@email.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    });
  });

  it('navigates to home on successful login', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByPlaceholderText(/email/i), 'test@example.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });

  it('shows Google sign-in button', () => {
    renderWithProviders(<Login />);

    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
  });
});
```

#### E2E Test: Swipe Flow (`e2e/swipe.spec.js`)
```javascript
import { test, expect } from '@playwright/test';

test.describe('Swipe Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[placeholder="Email"]', 'test@example.com');
    await page.fill('[placeholder="Password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('/');
  });

  test('should display movie cards in swipe view', async ({ page }) => {
    await page.goto('/swipe');

    // Wait for movie card to load
    await expect(page.locator('.swipe-card')).toBeVisible();

    // Check movie info is displayed
    await expect(page.locator('.movie-title')).toBeVisible();
    await expect(page.locator('.movie-year')).toBeVisible();
  });

  test('should rate movie when like button clicked', async ({ page }) => {
    await page.goto('/swipe');

    // Get initial movie title
    const initialTitle = await page.locator('.movie-title').textContent();

    // Click like button
    await page.click('button:has-text("Like")');

    // New movie should appear
    await expect(page.locator('.movie-title')).not.toHaveText(initialTitle);
  });

  test('should allow swiping gestures', async ({ page }) => {
    await page.goto('/swipe');

    const card = page.locator('.swipe-card');
    const initialTitle = await page.locator('.movie-title').textContent();

    // Swipe right (like)
    await card.dragTo(page.locator('body'), {
      targetPosition: { x: 500, y: 300 }
    });

    // Wait for animation and new card
    await page.waitForTimeout(500);
    await expect(page.locator('.movie-title')).not.toHaveText(initialTitle);
  });
});

test.describe('Session Matching', () => {
  test('should create and share session', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[placeholder="Email"]', 'test@example.com');
    await page.fill('[placeholder="Password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    await page.goto('/session');

    // Create new session
    await page.click('button:has-text("Create Session")');

    // Session code should be displayed
    await expect(page.locator('.session-code')).toBeVisible();
    const code = await page.locator('.session-code').textContent();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('should join session with valid code', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[placeholder="Email"]', 'friend@example.com');
    await page.fill('[placeholder="Password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    await page.goto('/session');

    // Enter session code
    await page.fill('[placeholder="Enter Code"]', 'ABC123');
    await page.click('button:has-text("Join")');

    // Should join session
    await expect(page.locator('.session-waiting')).toBeVisible();
  });
});
```

### Coverage Goals

| Category | Target | Notes |
|----------|--------|-------|
| **Unit Tests** | 80%+ | Core logic, utilities, hooks |
| **Component Tests** | 70%+ | All interactive components |
| **Integration Tests** | Key flows | Auth, rating, session creation |
| **E2E Tests** | Critical paths | Login → Rate → Match flow |

### Test Scripts (`package.json`)
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### CI/CD Testing Pipeline
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit & integration tests
        run: npm run test:coverage

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TMDB API rate limits | Medium | High | Cache responses, implement backoff |
| Complex matching algorithm | Medium | Medium | Start simple, iterate based on feedback |
| React Native learning curve | Low | Medium | Use Expo for easier development |
| User adoption | Medium | High | Focus on beautiful UI, easy onboarding |
| Cold start (no ratings) | High | Medium | Suggest popular movies, genre quiz |

---

## Decisions Made

| Decision | Choice | Notes |
|----------|--------|-------|
| **Monetization** | Freemium | Free basic, paid premium features |
| **Content Scope** | Movies + TV Shows | Both from the start |
| **Mobile Strategy** | React Native | Code reuse, single codebase |
| **Backend** | Supabase | Auth + PostgreSQL + Realtime |
| **Rating System** | 3 levels | Like, Love, Super Like + Skip |
| **UI Priority** | Beautiful UI critical | Invest in design quality |
| **Movie/TV Data** | Trakt + OMDb APIs | Hybrid approach for reliability |
| **Streaming Info** | Later (Watchmode) | Not in MVP |
| **Recommendation Algorithm** | Content-based filtering | Real-time profile updates |

### Freemium Model Details
**Free Tier:**
- Unlimited movie/show ratings
- Connect with up to 3 friends
- Create up to 2 sessions per day
- Basic matching algorithm

**Premium Tier ($4.99/month or $39.99/year):**
- Unlimited friends
- Unlimited sessions
- Advanced matching filters
- Session history & analytics
- Priority support
- No ads (if ads added to free tier)

## Open Questions (Remaining)

1. **Age ratings** - Filter content by age appropriateness?
2. **Watch history** - Track what users have actually watched?
3. **Notifications** - Push notifications for session invites?

---

## Next Steps

1. **Immediate:** Review and approve this PRD
2. **This Week:** Set up Supabase project, create database schema
3. **Next:** Begin Sprint 1 - Authentication implementation

---

## File Structure (Proposed for new features)

```
NextWatch/
├── Code/                      # Web app (existing)
│   ├── src/
│   │   ├── components/
│   │   │   ├── MovieCard.jsx
│   │   │   ├── NavBar.jsx
│   │   │   ├── SwipeCard.jsx      # NEW
│   │   │   └── AuthForm.jsx       # NEW
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Favorites.jsx
│   │   │   ├── Login.jsx          # NEW
│   │   │   ├── Signup.jsx         # NEW
│   │   │   ├── Profile.jsx        # NEW
│   │   │   ├── Swipe.jsx          # NEW
│   │   │   ├── Friends.jsx        # NEW
│   │   │   └── Session.jsx        # NEW
│   │   ├── contexts/
│   │   │   ├── MovieContext.jsx
│   │   │   ├── AuthContext.jsx    # NEW
│   │   │   └── SessionContext.jsx # NEW
│   │   ├── services/
│   │   │   ├── api.js             # REMOVE (old TMDB)
│   │   │   ├── trakt.js           # NEW - Trakt API client
│   │   │   ├── omdb.js            # NEW - OMDb API client
│   │   │   ├── movies.js          # NEW - Combined movie service
│   │   │   └── supabase.js        # NEW - Supabase client
│   │   ├── hooks/                 # NEW
│   │   │   ├── useAuth.js
│   │   │   ├── useRatings.js
│   │   │   └── useSession.js
│   │   └── lib/                   # NEW
│   │       └── matching.js        # Recommendation algorithm
│   └── ...
├── mobile/                    # React Native app (NEW)
│   ├── App.tsx
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   └── navigation/
│   └── ...
└── docs/                      # Documentation (NEW)
    ├── PRD.md                 # This document
    ├── API.md                 # API documentation
    └── CONTRIBUTING.md        # Contribution guidelines
```

---

## Architecture & Deployment Strategy

### Architecture Decision: Serverless Monolith

**Why Serverless Monolith (not Microservices)?**

| Factor | Serverless Monolith | Microservices |
|--------|---------------------|---------------|
| **Team Size** | ✅ Perfect for 1-3 devs | ❌ Needs larger team |
| **Complexity** | ✅ Simple to develop | ❌ Complex coordination |
| **Cost** | ✅ Pay per use, free tiers | ❌ Multiple services cost more |
| **Deployment** | ✅ Single deployment | ❌ Many deployments to manage |
| **Scaling** | ✅ Auto-scales | ✅ Fine-grained scaling |
| **MVP Speed** | ✅ Fast iteration | ❌ Slower to build |

**Recommendation:** Start with **Serverless Monolith** using Supabase (backend) + Vercel (frontend). Migrate to microservices only if needed at scale (100K+ users).

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXTWATCH ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │     CLIENTS      │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
            ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
            │   Web App     │  │   iOS App     │  │  Android App  │
            │   (React)     │  │(React Native) │  │(React Native) │
            │   Vercel      │  │  App Store    │  │  Play Store   │
            └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
                    │                  │                  │
                    └──────────────────┼──────────────────┘
                                       │
                                       │ HTTPS
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE (BaaS)                                │
│                        https://yourproject.supabase.co                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌────────────┐ │
│   │    Auth     │    │  Database   │    │  Realtime   │    │  Storage   │ │
│   │             │    │ (PostgreSQL)│    │ (WebSocket) │    │  (S3-like) │ │
│   │ - Email/PW  │    │             │    │             │    │            │ │
│   │ - Google    │    │ - profiles  │    │ - sessions  │    │ - avatars  │ │
│   │ - Apple     │    │ - ratings   │    │ - presence  │    │            │ │
│   │ - JWT       │    │ - friends   │    │ - chat      │    │            │ │
│   │             │    │ - sessions  │    │             │    │            │ │
│   └─────────────┘    └─────────────┘    └─────────────┘    └────────────┘ │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    Row Level Security (RLS)                          │  │
│   │              Users can only access their own data                    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Server-side calls
                                       ▼
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
            ┌───────────────┐                     ┌───────────────┐
            │   Trakt API   │                     │   OMDb API    │
            │               │                     │               │
            │ - Trending    │                     │ - Metadata    │
            │ - Popular     │                     │ - Ratings     │
            │ - Search      │                     │ - Posters     │
            │ - Recommend   │                     │ - Cast info   │
            └───────────────┘                     └───────────────┘
```

### Deployment Strategy

#### Web App Deployment (Vercel)

**What is Vercel?**
Vercel is a cloud platform optimized for frontend frameworks like React. It provides:
- Automatic deployments from Git
- Global CDN (content delivery network)
- Free SSL certificates
- Preview deployments for pull requests
- Serverless functions if needed
- Free tier perfect for MVP

**Setup Steps:**

1. **Create Vercel Account**
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Connect Repository**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Login
   vercel login

   # Deploy from project root
   cd NextWatch/Code
   vercel
   ```

3. **Configure Build Settings**
   ```json
   // vercel.json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "framework": "vite",
     "rewrites": [
       { "source": "/(.*)", "destination": "/" }
     ]
   }
   ```

4. **Environment Variables** (in Vercel Dashboard)
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   VITE_TRAKT_CLIENT_ID=xxx
   VITE_OMDB_API_KEY=xxx
   ```

5. **Custom Domain**
   - Add domain in Vercel Dashboard
   - Update DNS records
   - SSL auto-configured

**Deployment Flow:**
```
Developer pushes to GitHub
        │
        ▼
Vercel detects push
        │
        ▼
Runs: npm run build
        │
        ▼
Deploys to global CDN
        │
        ▼
Live at nextwatch.app
```

#### Mobile App Deployment

**iOS Deployment (App Store)**

1. **Requirements:**
   - Apple Developer Account ($99/year)
   - Mac for building (or EAS Build)
   - App Store Connect account

2. **Build with EAS:**
   ```bash
   # Install EAS CLI
   npm install -g eas-cli

   # Login to Expo
   eas login

   # Configure project
   eas build:configure

   # Build for iOS
   eas build --platform ios --profile production
   ```

3. **Submit to App Store:**
   ```bash
   eas submit --platform ios
   ```

4. **App Store Checklist:**
   - [ ] App icons (1024x1024)
   - [ ] Screenshots (6.5", 5.5" displays)
   - [ ] App description
   - [ ] Privacy policy URL
   - [ ] Age rating questionnaire

**Android Deployment (Play Store)**

1. **Requirements:**
   - Google Play Developer Account ($25 one-time)
   - Keystore for signing

2. **Build with EAS:**
   ```bash
   # Build for Android
   eas build --platform android --profile production
   ```

3. **Submit to Play Store:**
   ```bash
   eas submit --platform android
   ```

4. **Play Store Checklist:**
   - [ ] App icons (512x512)
   - [ ] Feature graphic (1024x500)
   - [ ] Screenshots
   - [ ] App description
   - [ ] Privacy policy
   - [ ] Content rating questionnaire

### Environment Configuration

#### Development vs Production

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENVIRONMENT SETUP                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   LOCAL DEVELOPMENT                                             │
│   ├── .env.local (gitignored)                                  │
│   ├── Supabase local or dev project                            │
│   └── Test API keys                                            │
│                                                                 │
│   STAGING (Optional)                                            │
│   ├── Vercel preview deployments                               │
│   ├── Supabase staging project                                 │
│   └── Test API keys with higher limits                         │
│                                                                 │
│   PRODUCTION                                                    │
│   ├── Vercel production                                        │
│   ├── Supabase production project                              │
│   └── Production API keys                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Environment Files Structure

**Web App:**
```bash
# .env.local (development - gitignored)
VITE_SUPABASE_URL=https://dev-xxx.supabase.co
VITE_SUPABASE_ANON_KEY=dev_key_here
VITE_TRAKT_CLIENT_ID=dev_trakt_id
VITE_OMDB_API_KEY=dev_omdb_key

# .env.example (committed - template)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TRAKT_CLIENT_ID=your_trakt_client_id
VITE_OMDB_API_KEY=your_omdb_key
```

**Mobile App:**
```bash
# .env (development - gitignored)
EXPO_PUBLIC_SUPABASE_URL=https://dev-xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=dev_key_here
EXPO_PUBLIC_TRAKT_CLIENT_ID=dev_trakt_id
EXPO_PUBLIC_OMDB_API_KEY=dev_omdb_key
```

---

## Security Best Practices

### 1. Secrets Management

**What needs to be kept secret?**

| Secret | Where Stored | Who Has Access |
|--------|--------------|----------------|
| Supabase Service Key | Never in client | Backend only (if needed) |
| Supabase Anon Key | Environment vars | Safe to expose (RLS protects data) |
| Trakt Client Secret | Environment vars | Server-side only |
| Trakt Client ID | Environment vars | Can be public |
| OMDb API Key | Environment vars | Can be public (rate limited) |
| JWT Secret | Supabase manages | Never exposed |

**Key Principle:** The Supabase "anon" key is designed to be public. Security comes from Row Level Security (RLS), not hiding the key.

### 2. API Key Protection Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    API KEY SECURITY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   CLIENT-SIDE KEYS (OK to expose)                              │
│   ├── Supabase Anon Key - RLS protects data                    │
│   ├── Trakt Client ID - Rate limited by Trakt                  │
│   └── OMDb API Key - Rate limited (1000/day)                   │
│                                                                 │
│   SERVER-SIDE KEYS (Never expose)                              │
│   ├── Supabase Service Key - Bypasses RLS                      │
│   └── Trakt Client Secret - Used for OAuth                     │
│                                                                 │
│   STORAGE:                                                      │
│   ├── Development: .env.local (gitignored)                     │
│   ├── Production: Vercel/EAS environment variables             │
│   └── Never: Hardcoded in source code                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Data Privacy & User Data Protection

**Row Level Security (RLS) - The Core Security Layer**

```sql
-- Example: Users can ONLY see their own ratings
CREATE POLICY "Users can only view own ratings"
  ON ratings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Example: Users can only see friends' ratings in sessions
CREATE POLICY "Session participants can view each other's ratings"
  ON ratings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_participants sp1
      JOIN session_participants sp2 ON sp1.session_id = sp2.session_id
      WHERE sp1.user_id = auth.uid()
      AND sp2.user_id = ratings.user_id
    )
  );
```

**What user data we store:**
| Data | Purpose | Who Can Access |
|------|---------|----------------|
| Email | Authentication | Only the user |
| Username | Display name | Public |
| Ratings | Recommendations | User + friends in sessions |
| Preferences | Algorithm | Only the user |
| Friend list | Social features | User + their friends |

### 4. Authentication Security

**Best Practices Implemented:**

1. **Password Requirements**
   ```javascript
   // Enforce in Supabase Auth settings
   {
     "min_password_length": 8,
     "require_email_verification": true
   }
   ```

2. **Secure Session Handling**
   - JWT tokens with short expiry (1 hour)
   - Refresh tokens stored securely
   - Auto-refresh before expiry

3. **OAuth Security**
   - State parameter for CSRF protection
   - PKCE flow for mobile apps
   - Verified redirect URLs only

4. **Rate Limiting** (Supabase built-in)
   - Auth attempts limited per IP
   - API requests limited per user

### 5. Input Validation & Sanitization

```javascript
// Always validate user input
function validateUsername(username) {
  // Only alphanumeric and underscore
  const valid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
  if (!valid) {
    throw new Error('Invalid username format');
  }
  return username.toLowerCase();
}

// Sanitize search queries
function sanitizeSearch(query) {
  return query
    .trim()
    .slice(0, 100)  // Limit length
    .replace(/[<>]/g, '');  // Remove HTML-like chars
}
```

### 6. Security Checklist

**Before Launch:**
- [ ] All RLS policies tested
- [ ] No hardcoded secrets in code
- [ ] Environment variables set in production
- [ ] HTTPS enforced everywhere
- [ ] CORS configured properly
- [ ] Rate limiting active
- [ ] Error messages don't leak info
- [ ] SQL injection impossible (Supabase handles this)
- [ ] XSS protection (React handles this)

### 7. Privacy Policy Requirements

**You MUST have a Privacy Policy covering:**
1. What data you collect
2. How you use it
3. Who you share it with (Trakt, OMDb for API calls)
4. How users can delete their data
5. Cookie usage
6. Third-party services used

**GDPR Compliance (if serving EU users):**
- Right to access data
- Right to delete data
- Right to export data
- Consent for data processing

---

## UI/UX Wireframes & Screen Specifications

### Screen Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEXTWATCH USER FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐
  │   SPLASH    │
  │   SCREEN    │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐     ┌─────────────┐
  │   LOGIN     │────▶│   SIGNUP    │
  │   SCREEN    │◀────│   SCREEN    │
  └──────┬──────┘     └─────────────┘
         │
         │ (authenticated)
         ▼
  ┌─────────────┐
  │    HOME     │ ◀─────────────────────────────────────────────┐
  │   SCREEN    │                                                │
  └──────┬──────┘                                                │
         │                                                       │
         ├────────────────┬────────────────┬────────────────┐   │
         ▼                ▼                ▼                ▼   │
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┴───┐
  │   SWIPE     │  │  FRIENDS    │  │  SESSION    │  │   PROFILE   │
  │   SCREEN    │  │   SCREEN    │  │   SCREEN    │  │   SCREEN    │
  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘
         │                │                │
         │                │                │
         ▼                ▼                ▼
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │   MOVIE     │  │   FRIEND    │  │  SESSION    │
  │   DETAIL    │  │   PROFILE   │  │   RESULTS   │
  │   (Modal)   │  │   (Modal)   │  │   SCREEN    │
  └─────────────┘  └─────────────┘  └─────────────┘
```

### Screen Specifications

#### 1. Splash Screen
```
┌─────────────────────────────┐
│                             │
│                             │
│         [LOGO]              │
│        NextWatch            │
│                             │
│    "Find your next watch,   │
│         together"           │
│                             │
│      [Loading spinner]      │
│                             │
└─────────────────────────────┘

Duration: 2-3 seconds while checking auth state
```

#### 2. Login Screen
```
┌─────────────────────────────┐
│                             │
│         [LOGO]              │
│        NextWatch            │
│                             │
│  ┌───────────────────────┐  │
│  │ Email                 │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Password          👁  │  │
│  └───────────────────────┘  │
│                             │
│  [      Sign In        ]    │  ← Primary button
│                             │
│  ────────── or ──────────   │
│                             │
│  [ G  Continue with Google] │  ← OAuth button
│                             │
│  Don't have an account?     │
│  [Sign Up]    [Forgot PW?]  │
│                             │
└─────────────────────────────┘

Error states:
- Invalid email: Red border + "Enter valid email"
- Wrong password: "Invalid email or password"
- Network error: Toast notification
```

#### 3. Home Screen (Main Tab)
```
┌─────────────────────────────┐
│  NextWatch          [👤]    │  ← Header with profile
├─────────────────────────────┤
│                             │
│  Good evening, Sanjay! 👋   │
│                             │
│  ┌─────────────────────────┐│
│  │ [🔥 Start Swiping]      ││  ← Primary CTA
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ [👥 Start Session]      ││  ← Secondary CTA
│  └─────────────────────────┘│
│                             │
│  ─────────────────────────  │
│                             │
│  Your Stats                 │
│  ┌───────┬───────┬───────┐ │
│  │  42   │  15   │  8    │ │
│  │ Rated │ Loved │Friends│ │
│  └───────┴───────┴───────┘ │
│                             │
│  Recent Activity            │
│  ┌─────────────────────────┐│
│  │ 🎬 Liked "Inception"    ││
│  │ 🔥 Super Liked "Dune"   ││
│  │ 👥 Session with @wife   ││
│  └─────────────────────────┘│
│                             │
├─────────────────────────────┤
│ [🏠] [🔥] [👥] [⚙️]        │  ← Bottom navigation
└─────────────────────────────┘
```

#### 4. Swipe Screen (Core Experience)
```
┌─────────────────────────────┐
│  ← Back           Movies ▼  │  ← Toggle Movies/TV
├─────────────────────────────┤
│                             │
│  ┌─────────────────────────┐│
│  │                         ││
│  │    [MOVIE POSTER]       ││
│  │                         ││
│  │                         ││
│  │                         ││
│  │ ─────────────────────── ││  ← Gradient overlay
│  │ The Dark Knight         ││
│  │ 2008 • Action, Drama    ││
│  │ ⭐ 9.0  🍅 94%          ││
│  │                         ││
│  │ [ℹ️ More Info]          ││  ← Tap to expand
│  └─────────────────────────┘│
│                             │
│   [👎]   [❤️]   [🔥]       │  ← Action buttons
│   Skip   Like  Super       │
│                             │
│  ← Swipe left = Skip       │
│  → Swipe right = Like      │
│  ↑ Swipe up = Super Like   │
│                             │
├─────────────────────────────┤
│ [🏠] [🔥] [👥] [⚙️]        │
└─────────────────────────────┘

Swipe animations:
- Card tilts as user drags
- Green overlay on right swipe
- Red overlay on left swipe
- Blue/gold overlay on up swipe
- Next card visible behind
```

#### 5. Movie Detail Modal
```
┌─────────────────────────────┐
│  ┌─────────────────────────┐│
│  │                         ││
│  │    [MOVIE BACKDROP]     ││
│  │                         ││
│  │        [× Close]        ││
│  └─────────────────────────┘│
│                             │
│  The Dark Knight            │
│  2008 • 2h 32min • PG-13   │
│                             │
│  ⭐ 9.0 IMDb  🍅 94% RT     │
│                             │
│  Action • Crime • Drama     │
│                             │
│  ─────────────────────────  │
│                             │
│  Overview                   │
│  When the menace known as   │
│  the Joker wreaks havoc... │
│  [Read more]                │
│                             │
│  Director                   │
│  Christopher Nolan          │
│                             │
│  Cast                       │
│  Christian Bale, Heath...   │
│                             │
│  ┌─────────────────────────┐│
│  │ [👎 Skip]  [❤️ Like]   ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

#### 6. Friends Screen
```
┌─────────────────────────────┐
│  Friends                    │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 🔍 Search users...    │  │
│  └───────────────────────┘  │
│                             │
│  Friend Requests (2)        │
│  ┌─────────────────────────┐│
│  │ 👤 @john_doe           ││
│  │     [✓ Accept] [✗]     ││
│  ├─────────────────────────┤│
│  │ 👤 @movie_fan42        ││
│  │     [✓ Accept] [✗]     ││
│  └─────────────────────────┘│
│                             │
│  Your Friends (8)           │
│  ┌─────────────────────────┐│
│  │ 👤 @wife      🟢 Online││
│  │    42 movies rated      ││
│  ├─────────────────────────┤│
│  │ 👤 @bestfriend  ⚫     ││
│  │    156 movies rated     ││
│  ├─────────────────────────┤│
│  │ 👤 @colleague   🟢     ││
│  │    23 movies rated      ││
│  └─────────────────────────┘│
│                             │
│  [➕ Invite Friends]        │
│                             │
├─────────────────────────────┤
│ [🏠] [🔥] [👥] [⚙️]        │
└─────────────────────────────┘
```

#### 7. Session Screen
```
┌─────────────────────────────┐
│  ← Back     Start Session   │
├─────────────────────────────┤
│                             │
│  Create New Session         │
│  ┌─────────────────────────┐│
│  │ Session Name (optional) ││
│  │ [Friday Movie Night   ] ││
│  └─────────────────────────┘│
│                             │
│  Content Type               │
│  [Movies] [TV Shows] [Both] │
│       ▲                     │
│                             │
│  Select Friends             │
│  ┌─────────────────────────┐│
│  │ [✓] @wife               ││
│  │ [ ] @bestfriend         ││
│  │ [✓] @colleague          ││
│  └─────────────────────────┘│
│                             │
│  [   Create Session   ]     │
│                             │
│  ─────── OR ───────         │
│                             │
│  Join Session               │
│  ┌─────────────────────────┐│
│  │ Enter Code: [ABC123]    ││
│  └─────────────────────────┘│
│  [     Join Session    ]    │
│                             │
├─────────────────────────────┤
│ [🏠] [🔥] [👥] [⚙️]        │
└─────────────────────────────┘
```

#### 8. Session Waiting Room
```
┌─────────────────────────────┐
│  ← Leave    Movie Night     │
├─────────────────────────────┤
│                             │
│  Session Code               │
│  ┌─────────────────────────┐│
│  │       ABC123            ││
│  │    [📋 Copy] [📤 Share] ││
│  └─────────────────────────┘│
│                             │
│  Waiting for participants...│
│                             │
│  In Session (2/3)           │
│  ┌─────────────────────────┐│
│  │ 👤 You (Host)    ✓     ││
│  │ 👤 @wife         ✓     ││
│  │ 👤 @colleague    ⏳     ││  ← Waiting
│  └─────────────────────────┘│
│                             │
│  Minimum 2 people needed    │
│                             │
│  [  Find Matches  ]         │  ← Disabled until ready
│                             │
│                             │
│                             │
├─────────────────────────────┤
│ [🏠] [🔥] [👥] [⚙️]        │
└─────────────────────────────┘
```

#### 9. Session Results Screen
```
┌─────────────────────────────┐
│  ← Back     Results 🎉      │
├─────────────────────────────┤
│                             │
│  Movie Night Results        │
│  with @wife, @colleague     │
│                             │
│  🎯 Perfect Matches (3)     │
│  ┌─────────────────────────┐│
│  │ [📷] Inception          ││
│  │      2010 • 98% match   ││
│  ├─────────────────────────┤│
│  │ [📷] The Matrix         ││
│  │      1999 • 95% match   ││
│  └─────────────────────────┘│
│                             │
│  👍 Great for Most (5)      │
│  ┌─────────────────────────┐│
│  │ [📷] Interstellar       ││
│  │      2014 • 87% match   ││
│  └─────────────────────────┘│
│                             │
│  🤝 Compromise Picks (4)    │
│  ┌─────────────────────────┐│
│  │ [📷] Avatar             ││
│  │      2009 • 72% match   ││
│  └─────────────────────────┘│
│                             │
│  [💾 Save to Watchlist]     │
│                             │
├─────────────────────────────┤
│ [🏠] [🔥] [👥] [⚙️]        │
└─────────────────────────────┘
```

#### 10. Profile Screen
```
┌─────────────────────────────┐
│  Profile           [Edit]   │
├─────────────────────────────┤
│                             │
│        [AVATAR]             │
│       @username             │
│      Display Name           │
│                             │
│  ─────────────────────────  │
│                             │
│  Statistics                 │
│  ┌───────┬───────┬───────┐ │
│  │  142  │  45   │  32   │ │
│  │ Rated │ Loved │Super  │ │
│  └───────┴───────┴───────┘ │
│                             │
│  Top Genres                 │
│  ┌─────────────────────────┐│
│  │ Action      ████████ 85%││
│  │ Sci-Fi      ██████── 72%││
│  │ Drama       █████─── 65%││
│  └─────────────────────────┘│
│                             │
│  Rating History             │
│  [View All Ratings →]       │
│                             │
│  ─────────────────────────  │
│                             │
│  [⚙️ Settings]              │
│  [🚪 Sign Out]              │
│                             │
├─────────────────────────────┤
│ [🏠] [🔥] [👥] [⚙️]        │
└─────────────────────────────┘
```

### Design Tokens

```css
/* Colors */
--color-primary: #6366F1;      /* Indigo - main actions */
--color-like: #22C55E;         /* Green - like */
--color-love: #EC4899;         /* Pink - love */
--color-super: #3B82F6;        /* Blue - super like */
--color-skip: #EF4444;         /* Red - skip */

--color-bg-primary: #0F0F0F;   /* Main background */
--color-bg-secondary: #1A1A1A; /* Cards */
--color-bg-tertiary: #242424;  /* Elevated elements */

--color-text-primary: #FFFFFF;
--color-text-secondary: #9CA3AF;
--color-text-muted: #6B7280;

/* Typography */
--font-family: 'Inter', -apple-system, sans-serif;
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-md: 16px;
--font-size-lg: 20px;
--font-size-xl: 24px;
--font-size-xxl: 32px;

/* Spacing */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;

/* Border Radius */
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-full: 9999px;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md: 0 4px 6px rgba(0,0,0,0.3);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.3);
```

---

## Error Handling Strategy

### Error Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING MATRIX                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  NETWORK ERRORS                                                 │
│  ├── No internet connection                                    │
│  ├── Request timeout                                           │
│  └── Server unreachable                                        │
│                                                                 │
│  API ERRORS                                                     │
│  ├── Trakt API down/rate limited                              │
│  ├── OMDb API down/rate limited                               │
│  └── Invalid API response                                      │
│                                                                 │
│  AUTH ERRORS                                                    │
│  ├── Invalid credentials                                       │
│  ├── Session expired                                           │
│  ├── Email not verified                                        │
│  └── Account disabled                                          │
│                                                                 │
│  DATABASE ERRORS                                                │
│  ├── Supabase connection failed                               │
│  ├── RLS policy violation                                      │
│  └── Duplicate entry                                           │
│                                                                 │
│  USER INPUT ERRORS                                              │
│  ├── Validation failures                                       │
│  ├── Invalid session code                                      │
│  └── Friend already added                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Error Handling Implementation

#### Global Error Boundary (`src/components/ErrorBoundary.jsx`)
```jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to error tracking service
    console.error('Error caught:', error, errorInfo);
    // Send to analytics/monitoring
    if (window.analytics) {
      window.analytics.track('Error', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

#### API Error Handler (`src/lib/errorHandler.js`)
```javascript
// Error types
export class NetworkError extends Error {
  constructor(message = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
    this.isRetryable = true;
  }
}

export class APIError extends Error {
  constructor(message, statusCode, source) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.source = source; // 'trakt', 'omdb', 'supabase'
    this.isRetryable = statusCode >= 500;
  }
}

export class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.isRetryable = false;
  }
}

// Error handler
export async function handleAPICall(apiCall, options = {}) {
  const {
    retries = 3,
    retryDelay = 1000,
    onRetry = () => {},
    fallback = null
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      lastError = error;

      // Don't retry non-retryable errors
      if (!error.isRetryable) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === retries) {
        break;
      }

      // Call retry callback
      onRetry(attempt, error);

      // Wait before retry (exponential backoff)
      await new Promise(resolve =>
        setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1))
      );
    }
  }

  // If fallback provided, return it instead of throwing
  if (fallback !== null) {
    console.warn('Using fallback due to error:', lastError);
    return fallback;
  }

  throw lastError;
}

// Usage example
export async function fetchMoviesWithRetry() {
  return handleAPICall(
    () => getTrendingMovies(),
    {
      retries: 3,
      retryDelay: 1000,
      onRetry: (attempt) => {
        console.log(`Retry attempt ${attempt}...`);
      },
      fallback: [] // Return empty array if all retries fail
    }
  );
}
```

#### Toast Notification System (`src/components/Toast.jsx`)
```jsx
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.type === 'error' && '❌ '}
            {toast.type === 'success' && '✅ '}
            {toast.type === 'warning' && '⚠️ '}
            {toast.message}
            <button onClick={() => removeToast(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
```

#### User-Friendly Error Messages
```javascript
// src/lib/errorMessages.js
export const ERROR_MESSAGES = {
  // Network
  'NETWORK_ERROR': 'Unable to connect. Please check your internet connection.',
  'TIMEOUT': 'Request timed out. Please try again.',

  // Auth
  'INVALID_CREDENTIALS': 'Invalid email or password.',
  'EMAIL_NOT_VERIFIED': 'Please verify your email before signing in.',
  'SESSION_EXPIRED': 'Your session has expired. Please sign in again.',
  'WEAK_PASSWORD': 'Password must be at least 8 characters.',

  // API
  'TRAKT_UNAVAILABLE': 'Movie data temporarily unavailable. Please try again.',
  'OMDB_RATE_LIMITED': 'Too many requests. Please wait a moment.',
  'API_ERROR': 'Something went wrong. Please try again.',

  // Session
  'SESSION_NOT_FOUND': 'Session not found or expired.',
  'SESSION_FULL': 'This session is full.',
  'ALREADY_IN_SESSION': 'You\'re already in this session.',

  // Friends
  'ALREADY_FRIENDS': 'You\'re already friends with this user.',
  'REQUEST_PENDING': 'Friend request already sent.',
  'USER_NOT_FOUND': 'User not found.',

  // Default
  'UNKNOWN': 'Something unexpected happened. Please try again.'
};

export function getErrorMessage(errorCode) {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['UNKNOWN'];
}
```

#### Offline Support
```javascript
// src/hooks/useOnlineStatus.js
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Usage in component
function SwipeScreen() {
  const isOnline = useOnlineStatus();
  const { addToast } = useToast();

  useEffect(() => {
    if (!isOnline) {
      addToast('You\'re offline. Some features may not work.', 'warning');
    }
  }, [isOnline]);

  // ...
}
```

---

## Analytics & Monitoring

### Analytics Events to Track

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYTICS EVENT MAP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  USER LIFECYCLE                                                 │
│  ├── user_signed_up         (method: email/google)            │
│  ├── user_signed_in         (method: email/google)            │
│  ├── user_signed_out                                          │
│  └── user_deleted_account                                      │
│                                                                 │
│  CORE ACTIONS                                                   │
│  ├── movie_rated            (rating, movie_id, genre)         │
│  ├── movie_detail_viewed    (movie_id)                        │
│  ├── search_performed       (query, results_count)            │
│  └── feed_loaded            (page, count)                      │
│                                                                 │
│  SOCIAL                                                         │
│  ├── friend_request_sent    (friend_id)                       │
│  ├── friend_request_accepted                                  │
│  ├── friend_removed                                           │
│  └── profile_viewed         (user_id)                         │
│                                                                 │
│  SESSIONS                                                       │
│  ├── session_created        (participant_count, content_type) │
│  ├── session_joined         (via: code/link/friend)          │
│  ├── session_completed      (participant_count, match_count) │
│  └── match_saved_to_watchlist (movie_id)                      │
│                                                                 │
│  ENGAGEMENT                                                     │
│  ├── app_opened             (source: direct/notification)     │
│  ├── screen_viewed          (screen_name)                     │
│  ├── time_on_screen         (screen_name, duration)          │
│  └── swipe_session_duration (movies_rated, duration)         │
│                                                                 │
│  ERRORS                                                         │
│  ├── api_error              (source, status_code, message)   │
│  ├── auth_error             (type, message)                  │
│  └── crash                  (error, stack)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Analytics Implementation

#### Supabase + Custom Events (Free Tier Friendly)
```javascript
// src/lib/analytics.js
import { supabase } from '../services/supabase';

class Analytics {
  constructor() {
    this.userId = null;
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setUserId(userId) {
    this.userId = userId;
  }

  async track(eventName, properties = {}) {
    const event = {
      event_name: eventName,
      user_id: this.userId,
      session_id: this.sessionId,
      properties: JSON.stringify(properties),
      timestamp: new Date().toISOString(),
      platform: this.getPlatform(),
      app_version: import.meta.env.VITE_APP_VERSION || '1.0.0'
    };

    // Log in development
    if (import.meta.env.DEV) {
      console.log('📊 Analytics:', eventName, properties);
    }

    // Store in Supabase
    try {
      await supabase.from('analytics_events').insert(event);
    } catch (error) {
      // Don't let analytics errors break the app
      console.error('Analytics error:', error);
    }
  }

  getPlatform() {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'web';
  }

  // Convenience methods
  trackScreenView(screenName) {
    this.track('screen_viewed', { screen_name: screenName });
  }

  trackMovieRated(movieId, rating, genres) {
    this.track('movie_rated', { movie_id: movieId, rating, genres });
  }

  trackSessionCreated(participantCount, contentType) {
    this.track('session_created', {
      participant_count: participantCount,
      content_type: contentType
    });
  }

  trackError(errorType, message, stack) {
    this.track('error', { error_type: errorType, message, stack });
  }
}

export const analytics = new Analytics();
```

#### Analytics Database Table
```sql
-- Analytics events table
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id),
  session_id TEXT,
  properties JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  platform TEXT,
  app_version TEXT
);

-- Index for querying
CREATE INDEX idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp);

-- RLS: Only allow inserting, not reading (privacy)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

-- No select policy = only admins can read via dashboard
```

### Monitoring & Alerting

#### Health Check Endpoint
```javascript
// For Vercel/web, create an API route or use Supabase Edge Function

// supabase/functions/health-check/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const checks = {
    database: false,
    traktApi: false,
    omdbApi: false,
    timestamp: new Date().toISOString()
  };

  // Check database
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error } = await supabase.from('profiles').select('id').limit(1);
    checks.database = !error;
  } catch {
    checks.database = false;
  }

  // Check Trakt API
  try {
    const res = await fetch('https://api.trakt.tv/movies/trending?limit=1', {
      headers: {
        'trakt-api-version': '2',
        'trakt-api-key': Deno.env.get('TRAKT_CLIENT_ID')!
      }
    });
    checks.traktApi = res.ok;
  } catch {
    checks.traktApi = false;
  }

  // Check OMDb API
  try {
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${Deno.env.get('OMDB_API_KEY')}&i=tt0111161`
    );
    const data = await res.json();
    checks.omdbApi = data.Response === 'True';
  } catch {
    checks.omdbApi = false;
  }

  const allHealthy = Object.values(checks).every(v => v === true || typeof v === 'string');

  return new Response(JSON.stringify(checks), {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
});
```

#### Error Monitoring with Sentry (Optional)
```javascript
// src/lib/sentry.js
import * as Sentry from '@sentry/react';

export function initSentry() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1, // 10% of transactions
      beforeSend(event) {
        // Don't send events in development
        if (import.meta.env.DEV) return null;
        return event;
      }
    });
  }
}

export function captureError(error, context = {}) {
  console.error('Error:', error);
  if (import.meta.env.PROD) {
    Sentry.captureException(error, { extra: context });
  }
}
```

### Monitoring Dashboard (Supabase)

You can build a simple admin dashboard or use Supabase's SQL editor:

```sql
-- Daily active users
SELECT DATE(timestamp) as date, COUNT(DISTINCT user_id) as dau
FROM analytics_events
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date;

-- Most popular actions
SELECT event_name, COUNT(*) as count
FROM analytics_events
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY event_name
ORDER BY count DESC
LIMIT 10;

-- Rating distribution
SELECT
  properties->>'rating' as rating,
  COUNT(*) as count
FROM analytics_events
WHERE event_name = 'movie_rated'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY properties->>'rating';

-- Error frequency
SELECT
  properties->>'error_type' as error_type,
  COUNT(*) as count
FROM analytics_events
WHERE event_name = 'error'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY properties->>'error_type'
ORDER BY count DESC;

-- Session completion rate
SELECT
  (SELECT COUNT(*) FROM analytics_events WHERE event_name = 'session_completed'
   AND timestamp > NOW() - INTERVAL '7 days')::float /
  NULLIF((SELECT COUNT(*) FROM analytics_events WHERE event_name = 'session_created'
   AND timestamp > NOW() - INTERVAL '7 days'), 0) * 100 as completion_rate;
```

### Key Metrics to Monitor

| Metric | Definition | Target |
|--------|------------|--------|
| **DAU** | Daily Active Users | Growth |
| **Ratings/User** | Avg movies rated per user per day | >5 |
| **Session Success** | % of sessions that find matches | >80% |
| **API Error Rate** | % of API calls that fail | <1% |
| **App Crashes** | Crash-free sessions | >99% |
| **Time to First Rating** | How fast new users start rating | <2 min |

---

## Infrastructure Costs Estimate

### Free Tier (MVP Phase)

| Service | Free Tier | Limits |
|---------|-----------|--------|
| **Vercel** | Hobby plan | 100GB bandwidth, unlimited deploys |
| **Supabase** | Free plan | 500MB DB, 1GB storage, 2GB bandwidth |
| **OMDb API** | Free | 1,000 requests/day |
| **Trakt API** | Free | Generous limits |
| **Expo/EAS** | Free | 30 builds/month |

**Total MVP Cost: $0/month** (plus Apple Developer $99/year for iOS)

### Growth Phase (1,000+ users)

| Service | Plan | Cost | Notes |
|---------|------|------|-------|
| **Vercel** | Pro | $20/month | More bandwidth, team features |
| **Supabase** | Pro | $25/month | 8GB DB, 100GB storage |
| **OMDb API** | Patreon | $1-5/month | Remove rate limits |
| **Apple Developer** | Required | $99/year | iOS App Store |
| **Google Play** | Required | $25 one-time | Play Store |

**Total Growth Cost: ~$50/month**

### Scale Phase (10,000+ users)

| Service | Estimated | Notes |
|---------|-----------|-------|
| **Vercel** | $20-100/month | Based on traffic |
| **Supabase** | $25-200/month | Based on DB/storage |
| **Custom Domain** | $12/year | nextwatch.com |
| **Error Monitoring** | $0-29/month | Sentry free tier |

---

## Data Backup & Disaster Recovery

### Backup Strategy

#### What Supabase Provides Automatically

| Feature | Free Tier | Pro Tier ($25/mo) |
|---------|-----------|-------------------|
| **Daily Backups** | ❌ No | ✅ Yes (7 days retained) |
| **Point-in-Time Recovery** | ❌ No | ✅ Yes (up to 7 days) |
| **Backup Download** | ✅ Manual only | ✅ Manual + automated |

#### Manual Backup Strategy (Free Tier)

Since the free tier doesn't include automated backups, implement this:

```javascript
// scripts/backup.js
// Run this weekly or before major updates

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Service key for full access
);

async function backupTable(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*');

  if (error) {
    console.error(`Error backing up ${tableName}:`, error);
    return;
  }

  const filename = `backup_${tableName}_${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`✅ Backed up ${tableName}: ${data.length} rows`);
  return filename;
}

async function runBackup() {
  const tables = [
    'profiles',
    'ratings',
    'user_preferences',
    'friendships',
    'sessions',
    'session_participants'
  ];

  console.log('🔄 Starting backup...');
  const timestamp = new Date().toISOString();

  const backupFiles = [];
  for (const table of tables) {
    const file = await backupTable(table);
    if (file) backupFiles.push(file);
  }

  // Create manifest
  const manifest = {
    timestamp,
    tables: backupFiles,
    supabaseUrl: process.env.SUPABASE_URL
  };

  fs.writeFileSync(
    `backup_manifest_${timestamp.split('T')[0]}.json`,
    JSON.stringify(manifest, null, 2)
  );

  console.log('✅ Backup complete!');
}

runBackup();
```

#### Backup Schedule

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKUP SCHEDULE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DEVELOPMENT PHASE                                              │
│  ├── Manual backup before major changes                        │
│  └── Weekly manual backup to local storage                     │
│                                                                 │
│  PRE-LAUNCH                                                     │
│  ├── Full database export                                      │
│  └── Store in secure cloud storage (Google Drive, S3)          │
│                                                                 │
│  PRODUCTION (Free Tier)                                         │
│  ├── Weekly automated backup via cron/GitHub Actions           │
│  ├── Store backups in encrypted cloud storage                  │
│  └── Retain last 4 weekly backups                              │
│                                                                 │
│  PRODUCTION (Pro Tier - Recommended for 1000+ users)           │
│  ├── Daily automatic backups (Supabase managed)               │
│  ├── Point-in-time recovery available                          │
│  └── Monthly manual export for archive                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Automated Backup with GitHub Actions
```yaml
# .github/workflows/backup.yml
name: Weekly Database Backup

on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday at midnight
  workflow_dispatch:  # Allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install @supabase/supabase-js

      - name: Run backup script
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: node scripts/backup.js

      - name: Upload backup artifacts
        uses: actions/upload-artifact@v4
        with:
          name: backup-${{ github.run_number }}
          path: backup_*.json
          retention-days: 30

      # Optional: Upload to cloud storage
      - name: Upload to Google Cloud Storage
        if: ${{ secrets.GCS_BUCKET }}
        uses: google-github-actions/upload-cloud-storage@v1
        with:
          path: backup_*.json
          destination: ${{ secrets.GCS_BUCKET }}/backups/
```

### Disaster Recovery Plan

#### Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)

| Scenario | RPO (Data Loss) | RTO (Downtime) | Strategy |
|----------|-----------------|----------------|----------|
| **API Outage** | 0 | Minutes | Failover to cached data |
| **Database Corruption** | 7 days (Pro) | 1-4 hours | Point-in-time recovery |
| **Accidental Deletion** | Last backup | 1-2 hours | Restore from backup |
| **Supabase Regional Outage** | 7 days | Hours | Contact Supabase support |
| **Complete Data Loss** | Last backup | 4-8 hours | Full restore from backup |

#### Recovery Procedures

##### 1. Restoring from Backup
```javascript
// scripts/restore.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function restoreTable(tableName, backupFile) {
  console.log(`🔄 Restoring ${tableName}...`);

  const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

  // Clear existing data (BE CAREFUL!)
  const { error: deleteError } = await supabase
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    console.error(`Error clearing ${tableName}:`, deleteError);
    return;
  }

  // Insert backup data in batches
  const batchSize = 1000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await supabase.from(tableName).insert(batch);
    if (error) {
      console.error(`Error restoring batch:`, error);
    }
  }

  console.log(`✅ Restored ${tableName}: ${data.length} rows`);
}

// Usage: node scripts/restore.js profiles backup_profiles_2024-01-15.json
const [tableName, backupFile] = process.argv.slice(2);
restoreTable(tableName, backupFile);
```

##### 2. Point-in-Time Recovery (Pro Tier)
```bash
# Via Supabase Dashboard:
# 1. Go to Settings > Database
# 2. Click "Restore" under Backups
# 3. Select date/time to restore to
# 4. Confirm restoration

# Note: This creates a NEW project with restored data
# You'll need to update your environment variables
```

##### 3. Emergency Contacts
```
┌─────────────────────────────────────────────────────────────────┐
│                    EMERGENCY CONTACTS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SUPABASE SUPPORT                                               │
│  ├── Dashboard: https://supabase.com/dashboard/support         │
│  ├── Discord: https://discord.supabase.com                     │
│  └── Email: support@supabase.io (Pro tier priority)           │
│                                                                 │
│  VERCEL SUPPORT                                                 │
│  ├── Dashboard: https://vercel.com/help                        │
│  └── Status: https://www.vercel-status.com                     │
│                                                                 │
│  API PROVIDERS                                                  │
│  ├── Trakt Status: https://status.trakt.tv                    │
│  └── OMDb: Contact via website                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Retention Policy

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| User Profiles | Until account deleted | Core user data |
| Ratings | Until account deleted | User preferences |
| Session Data | 30 days after completion | Temporary data |
| Analytics Events | 90 days | Analysis, can be aggregated |
| Auth Logs | 30 days | Security auditing |
| Backups | 4 weeks rolling | Recovery capability |

### User Data Export (GDPR Compliance)
```javascript
// src/services/dataExport.js
import { supabase } from './supabase';

export async function exportUserData(userId) {
  const exports = {};

  // Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  exports.profile = profile;

  // Ratings
  const { data: ratings } = await supabase
    .from('ratings')
    .select('*')
    .eq('user_id', userId);
  exports.ratings = ratings;

  // Preferences
  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  exports.preferences = preferences;

  // Friendships
  const { data: friendships } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  exports.friendships = friendships;

  // Sessions participated in
  const { data: sessions } = await supabase
    .from('session_participants')
    .select('*, session:sessions(*)')
    .eq('user_id', userId);
  exports.sessions = sessions;

  return exports;
}

// User can request this via Profile > Settings > Export My Data
```

### Account Deletion
```javascript
// src/services/accountDeletion.js
export async function deleteUserAccount(userId) {
  // 1. Delete all user data (cascade should handle most)
  const tables = [
    'session_participants',
    'friendships',
    'ratings',
    'user_preferences',
    'profiles'
  ];

  for (const table of tables) {
    await supabase.from(table).delete().eq('user_id', userId);
  }

  // 2. Delete auth user (this also invalidates sessions)
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error('Failed to delete account');
  }

  return { success: true };
}

// Important: Implement a 30-day grace period before permanent deletion
```

---

## Post-Development Deployment Checklist

### Week 1: Pre-Launch
- [ ] All features tested locally
- [ ] Create production Supabase project
- [ ] Run database migrations in production
- [ ] Set up Vercel project and deploy
- [ ] Configure custom domain
- [ ] Set all environment variables
- [ ] Test authentication flow end-to-end
- [ ] Test API integrations

### Week 2: Beta Launch
- [ ] Deploy to production
- [ ] Invite 10-20 beta testers
- [ ] Monitor error logs (Supabase dashboard)
- [ ] Monitor performance (Vercel analytics)
- [ ] Collect feedback
- [ ] Fix critical bugs

### Week 3: Mobile Prep
- [ ] Create Apple Developer account
- [ ] Create Google Play Developer account
- [ ] Build iOS app with EAS
- [ ] Build Android app with EAS
- [ ] Submit for App Store review (can take 1-3 days)
- [ ] Submit to Play Store (usually faster)

### Week 4: Public Launch
- [ ] Apps approved and published
- [ ] Announce launch
- [ ] Monitor all systems
- [ ] Respond to user feedback
- [ ] Plan next sprint based on feedback

---

*Document Version: 1.0*
*Last Updated: February 2026*
*Status: Draft - Pending Review*
