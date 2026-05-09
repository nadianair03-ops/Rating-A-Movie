const API_KEY = '92e5e6a1';
const API_URL = 'https://www.omdbapi.com/';

// State Management
let state = {
    currentView: 'search-view',
    searchResults: [],
    searchQuery: '',
    searchPage: 1,
    totalResults: 0,
    currentMovie: null,
    watchlist: JSON.parse(localStorage.getItem('cinevault_watchlist')) || [],
    filters: {
        type: '',
        sort: ''
    },
    watchlistFilters: {
        status: 'all', // all, watched, unwatched, favorites
        sort: 'date-desc'
    }
};

// DOM Elements
const views = {
    search: document.getElementById('search-view'),
    detail: document.getElementById('detail-view'),
    watchlist: document.getElementById('watchlist-view')
};

const navBtns = document.querySelectorAll('.nav-btn');
const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.getElementById('search-results');
const loadingState = document.getElementById('search-loading');
const emptyState = document.getElementById('search-empty');
const loadMoreBtn = document.getElementById('load-more-btn');
const typeFilter = document.getElementById('type-filter');
const sortFilter = document.getElementById('sort-filter');
const detailContent = document.getElementById('detail-content');
const backBtn = document.getElementById('back-to-search');

// Initialization
function init() {
    setupEventListeners();
    renderWatchlist(); // Pre-render to get stats
    updateStats();
}

// ==========================================
// NAVIGATION
// ==========================================
function switchView(viewId) {
    state.currentView = viewId;
    
    // Update Nav UI
    navBtns.forEach(btn => {
        if(btn.dataset.target === viewId) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Update Views
    Object.values(views).forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    const activeView = document.getElementById(viewId);
    activeView.classList.remove('hidden');
    // small delay to allow display:block to apply before animating opacity
    setTimeout(() => activeView.classList.add('active'), 10);

    if (viewId === 'watchlist-view') {
        renderWatchlist();
    }
}

// ==========================================
// SEARCH & API
// ==========================================
let debounceTimeout;

function handleSearch(e) {
    const query = e.target.value.trim();
    state.searchQuery = query;
    state.searchPage = 1;

    clearTimeout(debounceTimeout);
    
    if (!query) {
        searchResultsContainer.innerHTML = '';
        emptyState.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
        return;
    }

    debounceTimeout = setTimeout(() => {
        fetchMovies(true);
    }, 500); // 500ms debounce
}

async function fetchMovies(isNewSearch = false) {
    if (isNewSearch) {
        searchResultsContainer.innerHTML = '';
        emptyState.classList.add('hidden');
        loadingState.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
    }

    try {
        let url = `${API_URL}?apikey=${API_KEY}&s=${encodeURIComponent(state.searchQuery)}&page=${state.searchPage}`;
        if (state.filters.type) {
            url += `&type=${state.filters.type}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (isNewSearch) loadingState.classList.add('hidden');

        if (data.Response === "True") {
            let results = data.Search;
            state.totalResults = parseInt(data.totalResults);
            
            // Client side sorting if requested
            if (state.filters.sort === 'year-desc') {
                results.sort((a, b) => parseInt(b.Year) - parseInt(a.Year));
            } else if (state.filters.sort === 'year-asc') {
                results.sort((a, b) => parseInt(a.Year) - parseInt(b.Year));
            } else if (state.filters.sort === 'title-asc') {
                results.sort((a, b) => a.Title.localeCompare(b.Title));
            }

            if (isNewSearch) {
                state.searchResults = results;
            } else {
                state.searchResults = [...state.searchResults, ...results];
            }

            renderSearchResults(results);
            
            if (state.searchResults.length < state.totalResults) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
            
        } else {
            if (isNewSearch) {
                searchResultsContainer.innerHTML = `<p style="text-align: center; grid-column: 1/-1;">No results found for "${state.searchQuery}".</p>`;
                loadMoreBtn.classList.add('hidden');
            }
        }
    } catch (err) {
        console.error("Error fetching movies:", err);
        loadingState.classList.add('hidden');
    }
}

function renderSearchResults(movies) {
    movies.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.onclick = () => fetchMovieDetails(movie.imdbID);
        
        const posterUrl = movie.Poster !== "N/A" ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
        
        card.innerHTML = `
            <div class="poster-wrapper">
                <img src="${posterUrl}" alt="${movie.Title} poster" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${movie.Title}">${movie.Title}</h3>
                <div class="card-meta">
                    <span>${movie.Year}</span>
                    <span class="card-type">${movie.Type}</span>
                </div>
            </div>
        `;
        searchResultsContainer.appendChild(card);
    });
}

// ==========================================
// MOVIE DETAILS
// ==========================================
async function fetchMovieDetails(id) {
    switchView('detail-view');
    detailContent.innerHTML = `<div class="spinner" style="margin-top: 5rem;"></div><p style="text-align:center;">Loading details...</p>`;
    
    try {
        const res = await fetch(`${API_URL}?apikey=${API_KEY}&i=${id}&plot=full`);
        const data = await res.json();
        
        if (data.Response === "True") {
            state.currentMovie = data;
            renderMovieDetails(data);
            fetchSimilarMovies(data.Genre);
        }
    } catch (err) {
        console.error(err);
        detailContent.innerHTML = `<p>Error loading movie details.</p>`;
    }
}

function renderMovieDetails(movie) {
    const posterUrl = movie.Poster !== "N/A" ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
    const bgUrl = movie.Poster !== "N/A" ? movie.Poster : '';
    
    const isSaved = state.watchlist.some(m => m.imdbID === movie.imdbID);
    const savedData = state.watchlist.find(m => m.imdbID === movie.imdbID);
    
    let genres = movie.Genre.split(', ').map(g => `<span class="tag">${g}</span>`).join('');
    
    let html = `
        <div class="detail-hero">
            <div class="detail-bg" style="background-image: url('${bgUrl}')"></div>
            <img src="${posterUrl}" alt="Poster" class="detail-poster">
            
            <div class="detail-info">
                <h1>${movie.Title}</h1>
                <div class="detail-meta-tags">
                    <span class="tag mpaa">${movie.Rated}</span>
                    <span class="tag">${movie.Year}</span>
                    <span class="tag">${movie.Runtime}</span>
                    ${movie.Type === 'series' && movie.totalSeasons ? `<span class="tag">${movie.totalSeasons} Seasons</span>` : ''}
                    <span class="tag rating"><i class="ph-fill ph-star"></i> IMDb: ${movie.imdbRating}</span>
                </div>
                
                <div class="detail-meta-tags">
                    ${genres}
                </div>
                
                <p class="detail-plot">${movie.Plot}</p>
                
                <div class="detail-crew">
                    <div class="crew-item">
                        <h4>Director</h4>
                        <p>${movie.Director}</p>
                    </div>
                    <div class="crew-item">
                        <h4>Writers</h4>
                        <p>${movie.Writer}</p>
                    </div>
                    <div class="crew-item">
                        <h4>Cast</h4>
                        <p>${movie.Actors}</p>
                    </div>
                </div>
                
                <div class="detail-actions">
                    <button class="btn btn-trailer" onclick="openTrailer('${movie.Title.replace(/'/g, "\\'")}', '${movie.Year}')">
                        <i class="ph-fill ph-play-circle"></i> Watch Trailer
                    </button>
                    <button id="toggle-watchlist-btn" class="btn ${isSaved ? 'saved' : 'primary'} btn-watchlist-toggle" onclick="toggleWatchlist()">
                        <i class="ph-fill ${isSaved ? 'ph-check' : 'ph-plus'}"></i> 
                        ${isSaved ? 'Saved to Watchlist' : 'Add to Watchlist'}
                    </button>
                </div>
            </div>
        </div>
    `;

    // Personal Review Section (Only show if saved)
    if (isSaved) {
        html += renderPersonalReviewSection(savedData);
    }

    html += `
        <div class="similar-movies-section">
            <h2>You might also like</h2>
            <div id="similar-grid" class="similar-grid">
                <div class="spinner" style="margin: 2rem auto;"></div>
            </div>
        </div>
    `;

    detailContent.innerHTML = html;
    
    if (isSaved) {
        setupStarRating();
    }
}

function openTrailer(title, year) {
    const query = encodeURIComponent(`${title} ${year} official trailer`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
}

async function fetchSimilarMovies(genreString) {
    if (!genreString || genreString === "N/A") {
        document.getElementById('similar-grid').innerHTML = "<p>No similar movies found.</p>";
        return;
    }
    
    // Pick the first genre
    const primaryGenre = genreString.split(',')[0].trim();
    
    try {
        const res = await fetch(`${API_URL}?apikey=${API_KEY}&s=${encodeURIComponent(primaryGenre)}&type=movie&page=1`);
        const data = await res.json();
        
        const grid = document.getElementById('similar-grid');
        grid.innerHTML = '';
        
        if (data.Response === "True") {
            // Filter out current movie and show top 5
            const similar = data.Search.filter(m => m.imdbID !== state.currentMovie.imdbID).slice(0, 6);
            
            if (similar.length === 0) {
                 grid.innerHTML = "<p>No similar movies found.</p>";
                 return;
            }

            similar.forEach(movie => {
                const poster = movie.Poster !== "N/A" ? movie.Poster : 'https://via.placeholder.com/150x225?text=No+Poster';
                const el = document.createElement('div');
                el.className = 'similar-card';
                el.onclick = () => fetchMovieDetails(movie.imdbID);
                el.innerHTML = `
                    <img src="${poster}" alt="${movie.Title}">
                    <p title="${movie.Title}">${movie.Title}</p>
                `;
                grid.appendChild(el);
            });
        } else {
             grid.innerHTML = "<p>No similar movies found.</p>";
        }
    } catch (e) {
         document.getElementById('similar-grid').innerHTML = "<p>Failed to load similar movies.</p>";
    }
}

// ==========================================
// WATCHLIST & PERSONAL REVIEW
// ==========================================
function toggleWatchlist() {
    const movie = state.currentMovie;
    const index = state.watchlist.findIndex(m => m.imdbID === movie.imdbID);
    
    if (index > -1) {
        // Remove
        state.watchlist.splice(index, 1);
    } else {
        // Add
        state.watchlist.push({
            ...movie,
            addedAt: new Date().toISOString(),
            watched: false,
            favorite: false,
            personalRating: 0,
            review: '',
            personalTags: []
        });
    }
    
    saveWatchlist();
    renderMovieDetails(state.currentMovie); // re-render to show review section or update button
}

function saveWatchlist() {
    localStorage.setItem('cinevault_watchlist', JSON.stringify(state.watchlist));
    updateStats();
}

function renderPersonalReviewSection(data) {
    let stars = '';
    for(let i=1; i<=5; i++) {
        stars += `<i class="ph-fill ph-star ${i <= data.personalRating ? 'active' : ''}" data-rating="${i}"></i>`;
    }

    return `
        <div class="personal-review-section">
            <div class="review-header">
                <h2>My Review</h2>
                <div class="watchlist-toggles">
                    <button class="btn ${data.watched ? 'saved' : 'secondary'}" onclick="updateMovieData('${data.imdbID}', 'watched', ${!data.watched})">
                        <i class="ph-fill ph-check-circle"></i> ${data.watched ? 'Watched' : 'Mark Watched'}
                    </button>
                    <button class="btn ${data.favorite ? 'saved' : 'secondary'}" onclick="updateMovieData('${data.imdbID}', 'favorite', ${!data.favorite})">
                        <i class="ph-fill ph-heart"></i> ${data.favorite ? 'Favorited' : 'Favorite'}
                    </button>
                </div>
            </div>
            
            <div class="review-input-group">
                <div>
                    <label style="color: var(--text-secondary); display:block; margin-bottom:0.5rem;">Rating</label>
                    <div class="star-rating" id="star-rating-container">
                        ${stars}
                    </div>
                </div>
                
                <div>
                    <label style="color: var(--text-secondary); display:block; margin-bottom:0.5rem;">Notes / Review</label>
                    <textarea id="personal-review-text" onchange="updateMovieData('${data.imdbID}', 'review', this.value)" placeholder="Write your thoughts here...">${data.review || ''}</textarea>
                </div>
            </div>
        </div>
    `;
}

function setupStarRating() {
    const container = document.getElementById('star-rating-container');
    if (!container) return;
    
    const stars = container.querySelectorAll('i');
    stars.forEach(star => {
        star.onclick = function() {
            const rating = parseInt(this.dataset.rating);
            updateMovieData(state.currentMovie.imdbID, 'personalRating', rating);
            // Update UI instantly
            stars.forEach(s => {
                if (parseInt(s.dataset.rating) <= rating) s.classList.add('active');
                else s.classList.remove('active');
            });
        };
    });
}

function updateMovieData(id, key, value) {
    const index = state.watchlist.findIndex(m => m.imdbID === id);
    if (index > -1) {
        state.watchlist[index][key] = value;
        saveWatchlist();
        // If toggling watched/favorite, re-render to update button styles
        if(key === 'watched' || key === 'favorite') {
             renderMovieDetails(state.currentMovie);
        }
    }
}

// ==========================================
// WATCHLIST VIEW LOGIC
// ==========================================
function renderWatchlist() {
    const grid = document.getElementById('watchlist-grid');
    const empty = document.getElementById('watchlist-empty');
    grid.innerHTML = '';
    
    let filteredList = [...state.watchlist];
    
    // Apply Status Filter
    if (state.watchlistFilters.status === 'watched') {
        filteredList = filteredList.filter(m => m.watched);
    } else if (state.watchlistFilters.status === 'unwatched') {
        filteredList = filteredList.filter(m => !m.watched);
    } else if (state.watchlistFilters.status === 'favorites') {
        filteredList = filteredList.filter(m => m.favorite);
    }
    
    // Apply Sort
    filteredList.sort((a, b) => {
        const sort = state.watchlistFilters.sort;
        if (sort === 'date-desc') return new Date(b.addedAt) - new Date(a.addedAt);
        if (sort === 'date-asc') return new Date(a.addedAt) - new Date(b.addedAt);
        if (sort === 'title-asc') return a.Title.localeCompare(b.Title);
        if (sort === 'rating-desc') return (b.personalRating || 0) - (a.personalRating || 0);
        if (sort === 'imdb-desc') return parseFloat(b.imdbRating || 0) - parseFloat(a.imdbRating || 0);
        return 0;
    });

    if (filteredList.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        filteredList.forEach(movie => {
            const card = document.createElement('div');
            card.className = `movie-card ${movie.watched ? 'watched' : ''}`;
            card.onclick = () => fetchMovieDetails(movie.imdbID);
            
            const posterUrl = movie.Poster !== "N/A" ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
            
            // Badges
            let badges = '';
            if(movie.watched) badges += `<div class="badge-watched"><i class="ph-bold ph-check"></i></div>`;
            if(movie.favorite) badges += `<div class="badge-favorite"><i class="ph-fill ph-heart"></i></div>`;
            
            // Stars HTML
            let starsHtml = '';
            if (movie.personalRating > 0) {
                starsHtml = `<div class="card-personal-rating">
                    ${Array(movie.personalRating).fill('<i class="ph-fill ph-star"></i>').join('')}
                </div>`;
            }
            
            card.innerHTML = `
                ${badges}
                <div class="poster-wrapper">
                    <img src="${posterUrl}" alt="${movie.Title}" loading="lazy">
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${movie.Title}">${movie.Title}</h3>
                    <div class="card-meta">
                        <span>${movie.Year}</span>
                        <span><i class="ph-fill ph-star" style="color:var(--accent-star)"></i> ${movie.imdbRating}</span>
                    </div>
                    ${starsHtml}
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

function updateStats() {
    const list = state.watchlist;
    const total = list.length;
    const watched = list.filter(m => m.watched).length;
    const unwatched = total - watched;
    
    // Average Rating
    const ratedMovies = list.filter(m => m.personalRating > 0);
    const avgRating = ratedMovies.length ? (ratedMovies.reduce((sum, m) => sum + m.personalRating, 0) / ratedMovies.length).toFixed(1) : '0';
    
    // Total Runtime
    let runtimeMins = 0;
    list.filter(m => m.watched).forEach(m => {
        const match = m.Runtime.match(/\d+/);
        if (match) runtimeMins += parseInt(match[0]);
    });
    const hours = Math.floor(runtimeMins / 60);
    const mins = runtimeMins % 60;
    const runtimeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    document.getElementById('stats-dashboard').innerHTML = `
        <div class="stat-card">
            <div class="value">${total}</div>
            <div style="color:var(--text-secondary); font-size:0.85rem">Total Saved</div>
        </div>
        <div class="stat-card">
            <div class="value">${watched}</div>
            <div style="color:var(--text-secondary); font-size:0.85rem">Watched</div>
        </div>
        <div class="stat-card">
            <div class="value">${avgRating}</div>
            <div style="color:var(--text-secondary); font-size:0.85rem">Avg Rating</div>
        </div>
        <div class="stat-card">
            <div class="value">${runtimeStr}</div>
            <div style="color:var(--text-secondary); font-size:0.85rem">Watched Time</div>
        </div>
    `;
}

function exportWatchlist() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.watchlist, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "cinevault_watchlist.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// ==========================================
// EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
    // Navigation
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if(target) switchView(target);
        });
    });

    // Search
    searchInput.addEventListener('input', handleSearch);
    typeFilter.addEventListener('change', (e) => {
        state.filters.type = e.target.value;
        if(state.searchQuery) fetchMovies(true);
    });
    sortFilter.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        if(state.searchQuery) {
            // Sort locally without fetching if possible
            fetchMovies(true);
        }
    });
    loadMoreBtn.addEventListener('click', () => {
        state.searchPage++;
        fetchMovies();
    });

    // Detail View
    backBtn.addEventListener('click', () => {
        switchView('search-view');
        // Clear current movie? Optional.
    });

    // Watchlist Controls
    document.getElementById('go-to-search-btn').addEventListener('click', () => switchView('search-view'));
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.watchlistFilters.status = e.currentTarget.dataset.filter;
            renderWatchlist();
        });
    });

    document.getElementById('watchlist-sort').addEventListener('change', (e) => {
        state.watchlistFilters.sort = e.target.value;
        renderWatchlist();
    });

    document.getElementById('export-watchlist').addEventListener('click', exportWatchlist);
}

// Start
init();
