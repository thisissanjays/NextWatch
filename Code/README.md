# NextWatch

A movie discovery and recommendation web application that helps users explore, search, and save movies they're interested in watching.

## Features

- **Browse Popular Movies** - View currently trending movies on the home page
- **Search Movies** - Search for movies by title
- **Save Favorites** - Add movies to your personal favorites list with one click
- **Persistent Storage** - Favorites are saved locally and persist across browser sessions
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI library |
| Vite | 5.4.10 | Build tool & dev server |
| React Router DOM | 6.28.0 | Client-side routing |
| TMDB API | v3 | Movie data source |
| CSS | - | Component-scoped styling |

## Project Structure

```
src/
├── main.jsx                 # Application entry point
├── App.jsx                  # Root component with routing setup
├── assets/                  # Static assets
│   ├── NextWatch.svg
│   ├── Next_Watch.png
│   └── react.svg
├── components/              # Reusable UI components
│   ├── MovieCard.jsx        # Individual movie card display
│   └── NavBar.jsx           # Navigation header
├── pages/                   # Page-level components
│   ├── Home.jsx             # Home page with search & popular movies
│   └── Favorites.jsx        # User's saved favorites
├── contexts/                # React Context for state management
│   ├── MovieContext.jsx     # Favorites state provider
│   └── useMovieContext.jsx  # Custom hook for context access
├── services/                # API integration layer
│   └── api.js               # TMDB API functions
└── css/                     # Component stylesheets
    ├── index.css            # Global styles
    ├── App.css              # Layout styles
    ├── Home.css             # Home page styles
    ├── Favorites.css        # Favorites page styles
    ├── MovieCard.css        # Movie card styles
    └── Navbar.css           # Navigation styles
```

## Architecture

### Component-Based Structure

The application follows a modular component-based architecture with clear separation of concerns:

- **Pages** - Full-screen views (`Home`, `Favorites`)
- **Components** - Reusable UI pieces (`MovieCard`, `NavBar`)
- **Contexts** - Global state management using React Context API
- **Services** - Centralized API communication layer

### State Management

Uses React Context API with a custom hook pattern:

```
MovieProvider (Context)
    ├── favorites state (array of movies)
    ├── addToFavorites()
    ├── removeFromFavorites()
    └── isFavorite()
           ↓
useMovieContext() hook → Components
```

### Data Persistence

Favorites are automatically saved to browser localStorage and restored on app load.

### Routing

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Home | Popular movies & search |
| `/favorites` | Favorites | User's saved movies |

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn
- TMDB API key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd NextWatch/Code
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your TMDB API key:
   ```
   VITE_TMDB_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `npm run dev` | Start Vite development server with hot reload |
| Build | `npm run build` | Create optimized production build |
| Lint | `npm run lint` | Run ESLint to check code quality |
| Preview | `npm run preview` | Preview production build locally |

## API Configuration

This application uses [The Movie Database (TMDB)](https://www.themoviedb.org/) API for movie data.

### Getting an API Key

1. Create an account at [TMDB](https://www.themoviedb.org/signup)
2. Go to your [API settings](https://www.themoviedb.org/settings/api)
3. Request an API key (choose "Developer" option)
4. Copy your API key

### Environment Setup

The API key is stored in environment variables for security:

1. Copy the example file: `cp .env.example .env`
2. Add your API key to `.env`: `VITE_TMDB_API_KEY=your_key`
3. Never commit `.env` to version control (it's already in `.gitignore`)

### Endpoints Used

- `GET /movie/popular` - Fetch popular movies
- `GET /search/movie` - Search movies by title

## Features Detail

### Home Page
- Displays a grid of popular movies on initial load
- Search bar to find movies by title
- Loading states and error handling
- Click the heart icon to add/remove from favorites

### Favorites Page
- Displays all saved favorite movies
- Shows empty state when no favorites exist
- Movies can be removed directly from this page

### Movie Card
- Shows movie poster, title, and release year
- Heart button indicates and toggles favorite status
- Hover effects for enhanced interactivity

## Styling

The application uses a dark theme with:
- Component-scoped CSS files
- CSS Grid for responsive movie layouts
- Flexbox for navigation and form layouts
- Smooth transitions and hover effects
- Mobile-first responsive design

---

Built with React + Vite
